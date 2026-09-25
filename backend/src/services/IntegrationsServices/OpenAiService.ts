import axios from "axios";
import { proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import logger from "../../utils/logger";
import { getWbot } from "../../libs/wbot";
import { getJidOf } from "../WbotServices/getJidOf";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import Queue from "../../models/Queue";
import SendAiAudioReplyService from "../AiServices/SendAiAudioReplyService";

const resolveTransferQueueId = async (
  ticket: Ticket,
  preferredQueueId?: number | null
): Promise<number | null> => {
  const preferred = Number(preferredQueueId || 0);
  if (preferred > 0) {
    logger.info(
      `[AI SERVICE] Fila de transferência resolvida pelo nó da IA: ${preferred}`
    );
    return preferred;
  }

  const currentQueueId = Number(ticket.queueId || 0);
  if (currentQueueId > 0) {
    logger.info(
      `[AI SERVICE] Fila de transferência resolvida pelo ticket: ${currentQueueId}`
    );
    return currentQueueId;
  }

  try {
    const whatsapp = await ShowWhatsAppService(
      ticket.whatsappId,
      ticket.companyId
    );

    const connectionQueueId = Number((whatsapp as any)?.queueId || 0);
    if (connectionQueueId > 0) {
      logger.info(
        `[AI SERVICE] Fila de transferência resolvida pela conexão: ${connectionQueueId}`
      );
      return connectionQueueId;
    }

    const queues = Array.isArray((whatsapp as any)?.queues)
      ? (whatsapp as any).queues
      : [];

    const firstQueueId = Number(queues?.[0]?.id || 0);
    if (firstQueueId > 0) {
      logger.info(
        `[AI SERVICE] Fila de transferência resolvida pela lista da conexão: ${firstQueueId}`
      );
      return firstQueueId;
    }
  } catch (error) {
    logger.warn(
      `[AI SERVICE] Não foi possível resolver fila pela conexão do ticket ${ticket.id}:`,
      serializeError(error)
    );
  }

  try {
    const firstCompanyQueue = await Queue.findOne({
      where: {
        companyId: ticket.companyId
      },
      order: [["id", "ASC"]]
    });

    const fallbackQueueId = Number(firstCompanyQueue?.id || 0);
    if (fallbackQueueId > 0) {
      logger.info(
        `[AI SERVICE] Fila de transferência resolvida por fallback da empresa: ${fallbackQueueId}`
      );
      return fallbackQueueId;
    }
  } catch (error) {
    logger.warn(
      `[AI SERVICE] Falha ao buscar fila fallback da empresa ${ticket.companyId}:`,
      serializeError(error)
    );
  }

  return null;
};

type Session = WASocket & {
  id?: number;
};

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  provider?: "openai" | "gemini";

  flowMode?: "permanent" | "temporary";
  maxInteractions?: number;
  continueKeywords?: string[];
  completionTimeout?: number;
  objective?: string;
  autoCompleteOnObjective?: boolean;

  // Resposta automática em áudio com OpenAI TTS
  aiAudioReplyEnabled?: boolean;
  aiAudioReplyOnlyWhenInputAudio?: boolean;
  aiAudioReplyModel?: string;
  aiAudioReplyVoice?: string;
  aiAudioReplySpeed?: number | string;
  aiAudioReplyMaxChars?: number | string;
  aiAudioReplySendTextWithLinks?: boolean;
  aiAudioReplyFallbackToText?: boolean;
  aiAudioReplyInstructions?: string;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}

interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

const deleteFileSync = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    logger.warn(`[AI SERVICE] Erro ao deletar arquivo ${filePath}:`, error);
  }
};

const normalizeOfficialMediaUrlToRelativePath = (mediaUrl?: string | null): string => {
  let value = String(mediaUrl || "").trim().replace(/\\/g, "/");

  if (!value) return "";

  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      value = parsed.pathname || "";
    }
  } catch (error) {
    logger.warn(`[AI SERVICE] Falha ao parsear mediaUrl como URL: ${value}`);
  }

  value = value.replace(/^\/+/, "");
  value = value.replace(/^official-public\//i, "");

  return value;
};

const sanitizeName = (name: string): string => {
  let sanitized = (name || "").split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60) || "Amigo";
};

const serializeError = (error: any): any => {
  if (!error) return error;

  return {
    message: error?.message,
    name: error?.name,
    stack: error?.stack,
    code: error?.code,
    status: error?.response?.status,
    data: error?.response?.data,
  };
};

const normalizeNumber = (number?: string | null): string => {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
};

const TRANSFER_ACTION = "Ação: Transferir para o setor de atendimento";

const normalizeText = (text: string = ""): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const detectTransferRequest = (message: string): boolean => {
  const normalized = normalizeText(message);

  const patterns = [
    /\bquero falar com (o )?atendente\b/,
    /\bquero falar com (o )?atendimento\b/,
    /\bquero falar com uma pessoa\b/,
    /\bquero falar com alguem\b/,
    /\bquero falar com humano\b/,
    /\bquero atendimento humano\b/,
    /\bquero suporte humano\b/,
    /\bpreciso de um atendente\b/,
    /\bpreciso falar com atendente\b/,
    /\bme transfere\b/,
    /\btransfira\b/,
    /\btransfere\b/,
    /\btransfira por favor\b/,
    /\bme transfere para (o )?(atendimento|suporte)\b/,
    /\bme passa para (o )?(atendimento|suporte)\b/,
    /\batendente humano\b/,
    /\bfalar com (o )?atendente\b/,
    /\bfalar com (o )?atendimento\b/,
    /\bfalar com uma pessoa\b/,
    /\bfalar com alguem\b/,
    /\bfalar com humano\b/,
    /\bnao quero falar com robo\b/,
    /\bquero falar com o suporte\b/,
    /\bquero falar com suporte\b/,
    /\batendente por favor\b/
  ];

  return patterns.some(pattern => pattern.test(normalized));
};

const hasTransferAction = (text: string = ""): boolean => {
  return /a[cç][aã]o:\s*transferir para o setor de atendimento/i.test(text || "");
};

const removeTransferAction = (text: string = ""): string => {
  return String(text || "")
    .replace(/a[cç][aã]o:\s*transferir para o setor de atendimento\s*/i, "")
    .trim();
};

const detectFlowContinuation = (
  message: string,
  continueKeywords: string[]
): boolean => {
  if (!continueKeywords || continueKeywords.length === 0) {
    return false;
  }

  const lowerMessage = (message || "").toLowerCase().trim();
  return continueKeywords.some(keyword =>
    lowerMessage.includes((keyword || "").toLowerCase())
  );
};

const extractInteractiveText = (msg: proto.IWebMessageInfo | null): string => {
  if (!msg?.message) return "";

  try {
    const m: any = msg.message;

    const irm = m?.interactiveResponseMessage;
    if (irm?.nativeFlowResponseMessage?.paramsJson) {
      const parsed = JSON.parse(irm.nativeFlowResponseMessage.paramsJson);
      const val = parsed?.id || parsed?.display_text;
      if (val) return String(val);
    }

    if (m?.buttonsResponseMessage?.selectedButtonId) {
      return String(m.buttonsResponseMessage.selectedButtonId);
    }

    if (m?.listResponseMessage?.singleSelectReply?.selectedRowId) {
      return String(m.listResponseMessage.singleSelectReply.selectedRowId);
    }

    const tbrm = m?.templateButtonReplyMessage;
    if (tbrm?.selectedDisplayText || tbrm?.selectedId) {
      return String(tbrm.selectedDisplayText || tbrm.selectedId);
    }

    if (m?.conversation) {
      return String(m.conversation);
    }

    if (m?.extendedTextMessage?.text) {
      return String(m.extendedTextMessage.text);
    }

    if (m?.imageMessage?.caption) {
      return String(m.imageMessage.caption);
    }

    if (m?.videoMessage?.caption) {
      return String(m.videoMessage.caption);
    }

    return getBodyMessage(msg) || "";
  } catch (error) {
    logger.warn("[AI SERVICE] Falha ao extrair texto interativo:", error);
    return getBodyMessage(msg) || "";
  }
};

const isAudioPlaceholderText = (text?: string | null): boolean => {
  const normalized = String(text || "")
    .trim()
    .toLowerCase();

  return [
    "🎵 áudio",
    "áudio",
    "audio",
    "🎵 audio",
  ].includes(normalized);
};

const hasAudioExtension = (fileName?: string | null): boolean => {
  const lower = String(fileName || "").toLowerCase();
  return [
    ".oga",
    ".ogg",
    ".opus",
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
    ".webm",
    ".mpeg",
    ".mp4",
  ].some(ext => lower.endsWith(ext));
};

const isAudioLikeMessage = (
  msg: proto.IWebMessageInfo | null,
  mediaSent?: Message | undefined,
  bodyMessage?: string
): boolean => {
  const mediaType = String((mediaSent as any)?.mediaType || "").toLowerCase();
  const mediaUrl = String((mediaSent as any)?.mediaUrl || "").toLowerCase();
  const mediaMimeType = String(
    (mediaSent as any)?.mimeType ||
    (mediaSent as any)?.mimetype ||
    (msg as any)?.message?.audioMessage?.mimetype ||
    ""
  ).toLowerCase();

  return Boolean(
    msg?.message?.audioMessage ||
    mediaType === "audio" ||
    mediaType === "audiomessage" ||
    mediaMimeType.startsWith("audio/") ||
    hasAudioExtension(mediaUrl) ||
    isAudioPlaceholderText(bodyMessage)
  );
};

const getBackendPublicRoot = (): string => {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );
};

const getPublicCompanyFolder = (companyId: number): string => {
  return path.join(getBackendPublicRoot(), `company${companyId}`);
};

const getOfficialPublicRoot = (): string => {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "api_oficial",
    "public"
  );
};

const resolveStoredAudioMessage = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo | null,
  mediaSent?: Message | undefined
): Promise<Message | null> => {
  if (mediaSent?.mediaUrl) {
    return mediaSent;
  }

  if (msg?.key?.id) {
    const currentMessage = await Message.findOne({
      where: {
        wid: msg.key.id,
        ticketId: ticket.id,
      },
      order: [["createdAt", "DESC"]],
    });

    if (currentMessage?.mediaUrl) {
      return currentMessage;
    }
  }

  const recentMessages = await Message.findAll({
    where: {
      ticketId: ticket.id,
      fromMe: false,
    },
    order: [["createdAt", "DESC"]],
    limit: 5,
  });

  const recentAudio = recentMessages.find(item =>
    Boolean(
      item?.mediaUrl &&
      (
        String((item as any)?.mediaType || "").toLowerCase() === "audio" ||
        String((item as any)?.mediaType || "").toLowerCase() === "audiomessage" ||
        hasAudioExtension(String(item?.mediaUrl || "")) ||
        isAudioPlaceholderText(String(item?.body || ""))
      )
    )
  );

  return recentAudio || null;
};

const resolveStoredAudioPath = (
  ticket: Ticket,
  messageRecord: Message
): string | null => {
  const rawMediaUrl = String(messageRecord?.mediaUrl || "").trim().replace(/\\/g, "/");

  if (!rawMediaUrl) {
    logger.error(`[AI SERVICE] mediaUrl vazio para ticket ${ticket.id}`);
    return null;
  }

  const relativePath = normalizeOfficialMediaUrlToRelativePath(rawMediaUrl);
  const fileName = path.posix.basename(relativePath);

  const candidates = [
    path.join(getOfficialPublicRoot(), relativePath),
    path.join(getOfficialPublicRoot(), fileName),
    path.join(getBackendPublicRoot(), relativePath),
    path.join(getBackendPublicRoot(), fileName),
    path.join(getPublicCompanyFolder(ticket.companyId), fileName),
  ];

  const foundPath = candidates.find(candidate => fs.existsSync(candidate));

  if (!foundPath) {
    logger.error(
      `[AI SERVICE] Arquivo de áudio não encontrado para ticket ${ticket.id}. mediaUrl=${rawMediaUrl} | relativePath=${relativePath} | candidates=${candidates.join(" | ")}`
    );
    return null;
  }

  logger.info(
    `[AI SERVICE] Arquivo de áudio resolvido para ticket ${ticket.id}: ${foundPath}`
  );

  return foundPath;
};

const convertAudioToTranscriptionCompatibleFile = async (
  sourcePath: string
): Promise<{ pathToUse: string; cleanupPath?: string }> => {
  const acceptedExtensions = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"];
  const ext = path.extname(sourcePath).toLowerCase();

  if (acceptedExtensions.includes(ext)) {
    return { pathToUse: sourcePath };
  }

  const parsed = path.parse(sourcePath);
  const convertedPath = path.join(
    parsed.dir,
    `${parsed.name}.transcription.mp3`
  );

  if (fs.existsSync(convertedPath)) {
    deleteFileSync(convertedPath);
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg(sourcePath)
      .audioCodec("libmp3lame")
      .toFormat("mp3")
      .save(convertedPath)
      .on("end", () => resolve())
      .on("error", err => reject(err));
  });

  return {
    pathToUse: convertedPath,
    cleanupPath: convertedPath,
  };
};

const transcribeIncomingAudio = async (
  openai: SessionOpenAi,
  ticket: Ticket,
  msg: proto.IWebMessageInfo | null,
  mediaSent?: Message | undefined
): Promise<string> => {
  const storedMessage = await resolveStoredAudioMessage(ticket, msg, mediaSent);

  if (!storedMessage) {
    throw new Error(
      `[AI SERVICE] Mensagem de áudio não encontrada no banco para ticket ${ticket.id}`
    );
  }

  logger.info(
    `[AI SERVICE] Mensagem de áudio localizada para ticket ${ticket.id}. mediaUrl=${storedMessage.mediaUrl}`
  );

  const originalAudioPath = resolveStoredAudioPath(ticket, storedMessage);

  if (!originalAudioPath) {
    throw new Error(
      `[AI SERVICE] Arquivo de áudio não encontrado para ticket ${ticket.id}. mediaUrl=${storedMessage.mediaUrl}`
    );
  }

  logger.info(
    `[AI SERVICE] Iniciando transcrição do ticket ${ticket.id} usando arquivo ${originalAudioPath}`
  );

  const { pathToUse, cleanupPath } =
    await convertAudioToTranscriptionCompatibleFile(originalAudioPath);

  try {
    const audioFile = fs.createReadStream(pathToUse) as any;

    const transcriptionResult = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
    });

    return transcriptionResult?.text?.trim() || "";
  } finally {
    if (cleanupPath) {
      deleteFileSync(cleanupPath);
    }
  }
};

const persistAudioTranscription = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo | null,
  transcription: string
): Promise<void> => {
  if (!transcription) return;

  try {
    if (msg?.key?.id) {
      const currentMessage = await Message.findOne({
        where: {
          wid: msg.key.id,
          ticketId: ticket.id,
        },
        order: [["createdAt", "DESC"]],
      });

      if (currentMessage) {
        await currentMessage.update({
          body: transcription,
        });
      }
    }

    await ticket.update({
      lastMessage: transcription,
    });
  } catch (error) {
    logger.warn(
      `[AI SERVICE] Erro ao persistir transcrição do ticket ${ticket.id}:`,
      serializeError(error)
    );
  }
};

const isOfficialChannel = (whatsapp: any): boolean => {
  const values = [
    whatsapp?.channel,
    whatsapp?.channelType,
    whatsapp?.provider,
    whatsapp?.type,
    whatsapp?.connectionType,
    whatsapp?.sessionType,
    whatsapp?.mode
  ]
    .filter(Boolean)
    .map((value: any) => String(value).toLowerCase().trim());

  if (
    whatsapp?.isOfficial === true ||
    whatsapp?.official === true ||
    whatsapp?.isCloudApi === true ||
    whatsapp?.cloudApi === true
  ) {
    return true;
  }

  if (
    values.some(
      value =>
        value === "whatsapp" ||
        value === "baileys" ||
        value === "whatsappweb" ||
        value === "web" ||
        value.includes("baileys")
    )
  ) {
    return false;
  }

  return values.some(
    value =>
      value.includes("oficial") ||
      value.includes("official") ||
      value.includes("cloud") ||
      value.includes("meta")
  );
};

const getOfficialToken = (whatsapp: any): string => {
  return String(
    whatsapp?.token ||
    whatsapp?.externalToken ||
    whatsapp?.tokenMeta ||
    whatsapp?.apiToken ||
    ""
  );
};

const getOfficialBaseUrl = (): string => {
  return (
    process.env.API_OFICIAL_URL ||
    process.env.API_OFICIAL_BASE_URL ||
    "http://127.0.0.1:6000"
  ).replace(/\/$/, "");
};

const getBaileysSession = (wbot: Session | null, ticket: Ticket): Session | null => {
  try {
    if (wbot) return wbot;
    return getWbot(ticket.whatsappId) as Session;
  } catch (error) {
    logger.warn(
      `[AI SERVICE] Não foi possível obter sessão Baileys para ticket ${ticket.id}:`,
      error
    );
    return null;
  }
};

// Função temporária para envio via API oficial até o módulo ser criado
const sendOfficialMessage = async ({
  body,
  ticket,
}: {
  body: string;
  ticket: Ticket;
  quotedMsg: null;
  type: string;
  media: null;
  vCard: null;
}): Promise<void> => {
  logger.info(`[AI SERVICE] Enviando via API oficial para ticket ${ticket.id}`);

  await SendWhatsAppOficialMessage({
    body,
    ticket,
    quotedMsg: null,
    type: "text",
    media: null,
    vCard: null
  });

  await ticket.update({
    lastMessage: body
  });

  logger.info(`[AI SERVICE] Resposta oficial registrada no sistema para ticket ${ticket.id}`);
};

const sendTextToChannel = async (
  text: string,
  msg: proto.IWebMessageInfo | null,
  wbot: Session | null,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  const whatsapp = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  const isOfficial = isOfficialChannel(whatsapp);

  if (isOfficial) {
    logger.info(
      `[AI SERVICE] Enviando resposta via API oficial para ticket ${ticket.id}`
    );

    await sendOfficialMessage({
      body: text,
      ticket,
      quotedMsg: null,
      type: "text",
      media: null,
      vCard: null
    });

    await ticket.update({
      lastMessage: text
    });

    return;
  }

  if (!wbot) {
    throw new Error(
      `[AI SERVICE] Sessão Baileys indisponível para ticket ${ticket.id}`
    );
  }

  const remoteJid =
    msg?.key?.remoteJid ||
    getJidOf(contact) ||
    `${String(contact?.number || "").replace(/\D/g, "")}@s.whatsapp.net`;

  const sentMessage = await wbot.sendMessage(remoteJid, {
    text: `\u200e ${text}`,
  });

  await verifyMessage(sentMessage!, ticket, contact);
};

const sendAudioMessage = async ({
  text,
  msg,
  wbot,
  ticket,
  contact,
  aiSettings,
  ticketTraking,
}: {
  text: string;
  msg: proto.IWebMessageInfo | null;
  wbot: Session | null;
  ticket: Ticket;
  contact: Contact;
  aiSettings: IOpenAi;
  ticketTraking?: TicketTraking;
}): Promise<void> => {
  const whatsapp = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  if (isOfficialChannel(whatsapp)) {
    logger.info(
      `[AI SERVICE] Canal oficial detectado para ticket ${ticket.id}; áudio TTS será enviado como texto`
    );
    await sendTextToChannel(text, msg, wbot, ticket, contact);
    return;
  }

  const session = getBaileysSession(wbot, ticket);

  if (!session) {
    logger.warn(
      `[AI SERVICE] Sessão Baileys indisponível para áudio no ticket ${ticket.id}; usando fallback texto`
    );
    await sendTextToChannel(text, msg, wbot, ticket, contact);
    return;
  }

  const publicFolder = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );

  if (!fs.existsSync(publicFolder)) {
    fs.mkdirSync(publicFolder, { recursive: true });
  }

  const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;

  try {
    await convertTextToSpeechAndSaveToFile(
      keepOnlySpecifiedChars(text),
      `${publicFolder}/${fileNameWithOutExtension}`,
      aiSettings.voiceKey,
      aiSettings.voiceRegion,
      aiSettings.voice,
      "mp3"
    );

    const remoteJid =
      msg?.key?.remoteJid ||
      getJidOf(contact) ||
      `${String(contact?.number || "").replace(/\D/g, "")}@s.whatsapp.net`;

    const sendMessage = await session.sendMessage(remoteJid, {
      audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
      mimetype: "audio/mpeg",
      ptt: true,
    });

    await verifyMediaMessage(
      sendMessage!,
      ticket,
      contact,
      ticketTraking as any,
      false,
      false,
      session
    );

    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
  } catch (error) {
    logger.error(
      `[AI SERVICE] Erro ao responder com áudio no ticket ${ticket.id}:`,
      serializeError(error)
    );

    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);

    await sendTextToChannel(text, msg, wbot, ticket, contact);
  }
};

const checkObjectiveCompletion = async (
  objective: string,
  conversation: Message[],
  openai: SessionOpenAi
): Promise<boolean> => {
  if (!objective || !openai) return false;

  try {
    const conversationText = conversation
      .slice(-5)
      .map(msg => `${msg.fromMe ? "Bot" : "User"}: ${msg.body}`)
      .join("\n");

    const analysisPrompt = `
Objetivo: ${objective}

Conversa:
${conversationText}

Pergunta: O objetivo foi completado com sucesso? Responda apenas "SIM" ou "NÃO".
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: analysisPrompt }],
      max_tokens: 10,
      temperature: 0,
    });

    const result = response.choices[0]?.message?.content?.trim().toUpperCase();
    return result === "SIM";
  } catch (error) {
    logger.error(
      "[AI SERVICE] Erro ao verificar completude do objetivo:",
      serializeError(error)
    );
    return false;
  }
};

const returnToFlow = async (
  ticket: Ticket,
  contact: Contact,
  wbot: Session | null,
  reason: string
): Promise<void> => {
  try {
    const dataWebhook =
      ticket.dataWebhook && typeof ticket.dataWebhook === "object"
        ? (ticket.dataWebhook as any)
        : {};

    const flowContinuation = dataWebhook?.flowContinuation;

    if (!flowContinuation || !flowContinuation.nextNodeId) {
      logger.warn(
        `[FLOW CONTINUATION] Informações de continuação não encontradas - ticket ${ticket.id}`
      );

      await ticket.update({
        useIntegration: false,
        isBot: false,
        dataWebhook: null,
      });

      return;
    }

    logger.info(
      `[FLOW CONTINUATION] Retornando ao fluxo - ticket ${ticket.id}, razão: ${reason}`
    );

    const transitionMessages: Record<string, string> = {
      user_requested: "Perfeito! Vou prosseguir com o atendimento.",
      max_interactions:
        "Obrigado pelas informações! Vou continuar com o próximo passo.",
      timeout: "Vou prosseguir com o atendimento.",
      objective_completed:
        "Ótimo! Completamos essa etapa. Vamos continuar!",
    };

    const transitionMessage =
      transitionMessages[reason] || "Continuando com o atendimento.";

    await sendTextToChannel(transitionMessage, null, wbot, ticket, contact);

    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: flowContinuation.originalDataWebhook || null,
    });

    if (flowContinuation.nextNodeId && ticket.flowStopped) {
      logger.info(
        `[FLOW CONTINUATION] Continuando fluxo no nó ${flowContinuation.nextNodeId} - ticket ${ticket.id}`
      );

      const { ActionsWebhookService } = await import(
        "../WebhookService/ActionsWebhookService"
      );

      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped,
          company_id: ticket.companyId,
        },
      });

      if (flow) {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];

        await ActionsWebhookService(
          ticket.whatsappId,
          parseInt(String(ticket.flowStopped)),
          ticket.companyId,
          nodes,
          connections,
          flowContinuation.nextNodeId,
          flowContinuation.originalDataWebhook || null,
          "",
          ticket.hashFlowId || "",
          null,
          ticket.id,
          {
            number: contact.number,
            name: contact.name,
            email: contact.email || "",
          }
        );
      }
    }
  } catch (error) {
    logger.error(
      `[FLOW CONTINUATION] Erro ao retornar ao fluxo no ticket ${ticket.id}:`,
      serializeError(error)
    );

    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null,
    });
  }
};

const prepareMessagesAI = (
  pastMessages: Message[],
  isGeminiModel: boolean,
  promptSystem: string
): any[] => {
  const messagesAI: any[] = [];

  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  for (const message of pastMessages) {
    if (
      message.mediaType === "conversation" ||
      message.mediaType === "extendedTextMessage" ||
      !message.mediaType
    ) {
      if (message.fromMe) {
        messagesAI.push({ role: "assistant", content: message.body });
      } else {
        messagesAI.push({ role: "user", content: message.body });
      }
    }
  }

  return messagesAI;
};

const transferTicketToHuman = async ({
  ticket,
  contact,
  msg,
  wbot,
  aiSettings,
  reason,
  messageToUser,
}: {
  ticket: Ticket;
  contact: Contact;
  msg: proto.IWebMessageInfo | null;
  wbot: Session | null;
  aiSettings: IOpenAi;
  reason: "user_requested" | "ai_requested";
  messageToUser?: string;
}): Promise<void> => {
  logger.info(
    `[AI SERVICE] Transferindo ticket ${ticket.id} para atendimento humano. Motivo: ${reason}`
  );

  const cleanedMessage = String(messageToUser || "")
    .replace(/^[\.\,\;\:\-\–\—\s]+|[\.\,\;\:\-\–\—\s]+$/g, "")
    .trim();

  const targetQueueId = await resolveTransferQueueId(ticket, aiSettings.queueId);

  if (!targetQueueId || targetQueueId <= 0) {
    logger.error(
      `[AI SERVICE] Nenhuma fila válida encontrada para transferir o ticket ${ticket.id}`
    );

    await sendTextToChannel(
      "Entendi que você quer falar com um atendente humano, mas no momento não encontrei uma fila configurada para a transferência. Verifique a fila padrão da conexão ou a fila definida no nó da IA.",
      msg,
      wbot,
      ticket,
      contact
    );

    return;
  }

  const finalMessage =
    cleanedMessage ||
    "Entendi que você gostaria de falar com um atendente humano. Estou transferindo você agora. Aguarde um momento!";

  await transferQueue(
    targetQueueId,
    ticket,
    contact
  );

  await ticket.reload();

  await ticket.update({
    useIntegration: false,
    integrationId: null,
    isBot: false,
    dataWebhook: null,
    flowWebhook: false,
    lastFlowId: null,
    hashFlowId: null,
    flowStopped: null
  });

  await sendTextToChannel(finalMessage, msg, wbot, ticket, contact);

  logger.info(
    `[AI SERVICE] Ticket ${ticket.id} transferido com sucesso para a fila ${targetQueueId}`
  );
};

const processResponse = async (
  responseText: string,
  wbot: Session | null,
  msg: proto.IWebMessageInfo | null,
  ticket: Ticket,
  contact: Contact,
  aiSettings: IOpenAi,
  ticketTraking?: TicketTraking,
  inputWasAudio: boolean = false
): Promise<void> => {
  let response = responseText;

  if (hasTransferAction(response)) {
    const cleanedResponse = removeTransferAction(response);

    await transferTicketToHuman({
      ticket,
      contact,
      msg,
      wbot,
      aiSettings,
      reason: "ai_requested",
      messageToUser: cleanedResponse,
    });

    return;
  }

  if (!response?.trim()) {
    return;
  }

  const whatsapp = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  const isOfficial = isOfficialChannel(whatsapp);

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );

  const effectiveProvider =
    aiSettings.provider ||
    (aiSettings.model.startsWith("gpt-") ? "openai" : "gemini");

  const useVoice =
    !isOfficial &&
    effectiveProvider === "openai" &&
    aiSettings.voice !== "texto";

  if (inputWasAudio && !isOfficial && effectiveProvider === "openai") {
    const session = getBaileysSession(wbot, ticket);

    if (session) {
      const remoteJid =
        msg?.key?.remoteJid ||
        getJidOf(contact) ||
        `${String(contact?.number || "").replace(/\D/g, "")}@s.whatsapp.net`;

      logger.info(
        `[AI-AUDIO-DEBUG] Config do nó OpenAI | ticketId=${ticket.id} enabled=${aiSettings.aiAudioReplyEnabled} model=${aiSettings.aiAudioReplyModel} voice=${aiSettings.aiAudioReplyVoice} speed=${aiSettings.aiAudioReplySpeed}`
      );

      const sentAsAudio = await SendAiAudioReplyService({
        wbot: session,
        ticket,
        jid: remoteJid,
        aiText: response,
        inputWasAudio,
        openAiApiKey: aiSettings.apiKey,

        aiAudioReplyEnabled: aiSettings.aiAudioReplyEnabled,
        aiAudioReplyOnlyWhenInputAudio: aiSettings.aiAudioReplyOnlyWhenInputAudio,
        aiAudioReplyFallbackToText: aiSettings.aiAudioReplyFallbackToText,
        aiAudioReplySendTextWithLinks: aiSettings.aiAudioReplySendTextWithLinks,
        aiAudioReplyMaxChars: aiSettings.aiAudioReplyMaxChars,

        aiAudioReplyModel: aiSettings.aiAudioReplyModel,
        aiAudioReplyVoice: aiSettings.aiAudioReplyVoice,
        aiAudioReplySpeed: aiSettings.aiAudioReplySpeed,
        aiAudioReplyInstructions: aiSettings.aiAudioReplyInstructions,

        verifyMediaMessageFn: async sentAudioMessage => {
          await verifyMediaMessage(
            sentAudioMessage!,
            ticket,
            contact,
            ticketTraking as any,
            false,
            false,
            session
          );
        },
        sendTextMessageFn: async text => {
          await sendTextToChannel(
            text,
            msg,
            session,
            ticket,
            contact
          );
        }
      });

      if (sentAsAudio) {
        logger.info(
          `[AI SERVICE] Resposta da IA enviada em áudio para ticket ${ticket.id}`
        );
        return;
      }
    } else {
      logger.warn(
        `[AI SERVICE] Sessão Baileys indisponível para resposta em áudio no ticket ${ticket.id}; usando fallback texto`
      );
    }
  }

  if (!useVoice) {
    await sendTextToChannel(
      response,
      msg,
      wbot,
      ticket,
      contact
    );
    return;
  }

  const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;

  try {
    await convertTextToSpeechAndSaveToFile(
      keepOnlySpecifiedChars(response),
      `${publicFolder}/${fileNameWithOutExtension}`,
      aiSettings.voiceKey,
      aiSettings.voiceRegion,
      aiSettings.voice,
      "mp3"
    );

    if (!wbot) {
      throw new Error(
        `[AI SERVICE] Sessão Baileys indisponível para envio de áudio no ticket ${ticket.id}`
      );
    }

    if (!msg?.key?.remoteJid) {
      throw new Error(`[AI SERVICE] remoteJid não disponível para ticket ${ticket.id}`);
    }

    const sendMessage = await wbot.sendMessage(msg.key.remoteJid, {
      audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
      mimetype: "audio/mpeg",
      ptt: true,
    });

    await verifyMediaMessage(
      sendMessage!,
      ticket,
      contact,
      ticketTraking,
      false,
      false,
      wbot
    );

    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
  } catch (error) {
    logger.error(`[AI SERVICE] Erro para responder com áudio no ticket ${ticket.id}:`, error);

    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);

    await sendTextToChannel(
      response,
      msg,
      wbot,
      ticket,
      contact
    );
  }
};

const handleOpenAIRequest = async (
  openai: SessionOpenAi,
  messagesAI: any[],
  aiSettings: IOpenAi
): Promise<string> => {
  const chat = await openai.chat.completions.create({
    model: aiSettings.model,
    messages: messagesAI as any,
    max_tokens: aiSettings.maxTokens,
    temperature: aiSettings.temperature,
  });

  return chat.choices[0]?.message?.content || "";
};

const handleGeminiRequest = async (
  gemini: SessionGemini,
  messagesAI: any[],
  aiSettings: IOpenAi,
  newMessage: string,
  promptSystem: string
): Promise<string> => {
  const model = gemini.getGenerativeModel({
    model: aiSettings.model,
    systemInstruction: promptSystem,
  });

  const geminiHistory: Content[] = messagesAI.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(newMessage);
  return result.response.text();
};

export const handleOpenAiFlow = async (
  aiSettings: IOpenAi,
  msg: proto.IWebMessageInfo | null,
  wbot: Session | null,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined,
  ticketTraking?: TicketTraking,
  incomingText?: string
): Promise<void> => {
  try {
    if (!aiSettings) {
      logger.error("[AI SERVICE] Configurações da IA não fornecidas");
      return;
    }

    if (contact.disableBot) {
      logger.info("[AI SERVICE] Bot desabilitado para este contato");
      return;
    }

    const dataWebhook =
      ticket.dataWebhook && typeof ticket.dataWebhook === "object"
        ? (ticket.dataWebhook as any)
        : {};

    const isTemporaryMode = aiSettings.flowMode === "temporary";
    const flowContinuation = dataWebhook?.flowContinuation;

    let bodyMessage = (incomingText || extractInteractiveText(msg) || "").trim();

    if (isTemporaryMode && flowContinuation) {
      if (detectFlowContinuation(bodyMessage, aiSettings.continueKeywords || [])) {
        logger.info(
          `[AI SERVICE] Usuário solicitou continuação do fluxo - ticket ${ticket.id}`
        );
        await returnToFlow(ticket, contact, wbot, "user_requested");
        return;
      }

      if (
        aiSettings.maxInteractions &&
        (flowContinuation.interactionCount || 0) >= aiSettings.maxInteractions
      ) {
        logger.info(
          `[AI SERVICE] Limite de interações atingido - ticket ${ticket.id}`
        );
        await returnToFlow(ticket, contact, wbot, "max_interactions");
        return;
      }

      if (aiSettings.completionTimeout && flowContinuation.startTime) {
        const startTime = new Date(flowContinuation.startTime);
        const now = new Date();
        const minutesElapsed =
          (now.getTime() - startTime.getTime()) / (1000 * 60);

        if (minutesElapsed >= aiSettings.completionTimeout) {
          logger.info(`[AI SERVICE] Timeout atingido - ticket ${ticket.id}`);
          await returnToFlow(ticket, contact, wbot, "timeout");
          return;
        }
      }

      const currentInteractionCount = flowContinuation.interactionCount || 0;

      await ticket.update({
        dataWebhook: {
          ...dataWebhook,
          flowContinuation: {
            ...flowContinuation,
            interactionCount: currentInteractionCount + 1,
          },
        },
      });
    }

    if (!bodyMessage && msg?.key?.id) {
      try {
        const messageFromDB = await Message.findOne({
          where: { wid: msg.key.id },
          order: [["createdAt", "DESC"]],
        });

        if (messageFromDB?.body) {
          bodyMessage = messageFromDB.body;
          logger.info(
            `[AI SERVICE] Usando mensagem do banco para ticket ${ticket.id}: "${bodyMessage}"`
          );
        }
      } catch (error) {
        logger.warn(
          `[AI SERVICE] Erro ao buscar mensagem no banco para ticket ${ticket.id}:`,
          serializeError(error)
        );
      }
    }

    if (!bodyMessage) {
      try {
        const lastMessage = await Message.findOne({
          where: {
            ticketId: ticket.id,
            fromMe: false,
          },
          order: [["createdAt", "DESC"]],
        });

        if (lastMessage?.body) {
          bodyMessage = lastMessage.body;
          logger.info(
            `[AI SERVICE] Usando última mensagem do ticket ${ticket.id} como fallback: "${bodyMessage}"`
          );
        }
      } catch (error) {
        logger.warn(
          `[AI SERVICE] Erro ao buscar última mensagem do ticket ${ticket.id}:`,
          serializeError(error)
        );
      }
    }

    if (!bodyMessage && !msg?.message?.audioMessage && !isAudioLikeMessage(msg, mediaSent, bodyMessage)) {
      logger.warn(
        `[AI SERVICE] Nenhum conteúdo de texto ou áudio encontrado para ticket ${ticket.id}`
      );
      return;
    }

    if (!aiSettings.model) {
      logger.error("[AI SERVICE] Modelo não definido nas configurações");
      return;
    }

    if (msg?.messageStubType) {
      logger.info("[AI SERVICE] Ignorando evento de grupo (messageStubType)");
      return;
    }

    const provider =
      aiSettings.provider ||
      (aiSettings.model.startsWith("gpt-") ? "openai" : "gemini");

    const isOpenAIModel = provider === "openai";
    const isGeminiModel = provider === "gemini";

    if (!isOpenAIModel && !isGeminiModel) {
      logger.error(`[AI SERVICE] Provider não suportado: ${provider}`);

      await sendTextToChannel(
        "Desculpe, o modelo de IA configurado não é suportado.",
        msg,
        wbot,
        ticket,
        contact
      );

      return;
    }

    let openai: SessionOpenAi | null = null;
    let gemini: SessionGemini | null = null;

    if (isOpenAIModel) {
      const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);

      if (openAiIndex === -1) {
        openai = new OpenAI({
          apiKey: aiSettings.apiKey,
        }) as SessionOpenAi;

        openai.id = ticket.id;
        sessionsOpenAi.push(openai);
      } else {
        openai = sessionsOpenAi[openAiIndex];
      }
    } else if (isGeminiModel) {
      const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);

      if (geminiIndex === -1) {
        gemini = new GoogleGenerativeAI(
          aiSettings.apiKey
        ) as SessionGemini;

        gemini.id = ticket.id;
        sessionsGemini.push(gemini);
      } else {
        gemini = sessionsGemini[geminiIndex];
      }
    }

    const hasIncomingAudio = isAudioLikeMessage(msg, mediaSent, bodyMessage);

    if (hasIncomingAudio) {
      if (!isOpenAIModel || !openai) {
        await sendTextToChannel(
          "Desculpe, no momento só posso processar áudio com o provedor OpenAI. Envie sua pergunta em texto ou ajuste o provedor da IA.",
          msg,
          wbot,
          ticket,
          contact
        );
        return;
      }

      try {
        logger.info(
          `[AI SERVICE] Áudio detectado para ticket ${ticket.id}, iniciando transcrição`
        );

        const transcription = await transcribeIncomingAudio(
          openai,
          ticket,
          msg,
          mediaSent
        );

        if (!transcription) {
          logger.warn(
            `[AI SERVICE] Transcrição vazia para ticket ${ticket.id}`
          );

          await sendTextToChannel(
            "Desculpe, não consegui entender o áudio. Tente novamente ou envie uma mensagem em texto.",
            msg,
            wbot,
            ticket,
            contact
          );
          return;
        }

        bodyMessage = transcription;

        await persistAudioTranscription(ticket, msg, transcription);

        logger.info(
          `[AI SERVICE] Transcrição concluída para ticket ${ticket.id}: ${transcription}`
        );
      } catch (audioError) {
        logger.error(
          `[AI SERVICE] Erro ao transcrever áudio do ticket ${ticket.id}:`,
          serializeError(audioError)
        );

        await sendTextToChannel(
          "Desculpe, não consegui processar seu áudio no momento. Tente novamente ou envie uma mensagem em texto.",
          msg,
          wbot,
          ticket,
          contact
        );
        return;
      }
    }

    if (bodyMessage && detectTransferRequest(bodyMessage)) {
      await transferTicketToHuman({
        ticket,
        contact,
        msg,
        wbot,
        aiSettings,
        reason: "user_requested",
      });
      return;
    }

    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "ASC"]],
      limit: aiSettings.maxMessages > 0 ? aiSettings.maxMessages : undefined,
    });

    const clientName = sanitizeName(contact.name || "Amigo(a)");
    const promptSystem = `Instruções do Sistema:
- Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido.
- Certifique-se de que a resposta tenha até ${aiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
- Sempre que possível, inclua o nome do cliente para tornar o atendimento mais pessoal e gentil.
- Se o cliente demonstrar que quer falar com uma pessoa, atendente, humano, suporte ou atendimento humano, comece a resposta com '${TRANSFER_ACTION}'.
- Considere como pedido de transferência frases como: "quero falar com o atendente", "quero falar com uma pessoa", "quero falar com alguém", "me transfere", "me passa para o suporte", "quero atendimento humano", "não quero falar com robô".
- Se não houver pedido claro de transferência, responda normalmente.

Prompt Específico:
${aiSettings.prompt}

Siga essas instruções com cuidado para garantir um atendimento claro e amigável em todas as respostas.`;

    if (bodyMessage) {
      const messagesAI = prepareMessagesAI(
        messages,
        isGeminiModel,
        promptSystem
      );

      try {
        let responseText = "";

        try {
          if (isOpenAIModel && openai) {
            logger.info(
              `[AI SERVICE] Gerando resposta OpenAI para ticket ${ticket.id}`
            );

            messagesAI.push({ role: "user", content: bodyMessage });
            responseText = await handleOpenAIRequest(
              openai,
              messagesAI,
              aiSettings
            );
          } else if (isGeminiModel && gemini) {
            logger.info(
              `[AI SERVICE] Gerando resposta Gemini para ticket ${ticket.id}`
            );

            responseText = await handleGeminiRequest(
              gemini,
              messagesAI,
              aiSettings,
              bodyMessage,
              promptSystem
            );
          }

          logger.info(
            `[AI SERVICE] Resposta da IA gerada com sucesso para ticket ${ticket.id}`
          );
        } catch (requestError) {
          logger.error(
            `[AI SERVICE] Falha ao gerar resposta da IA para ticket ${ticket.id}:`,
            serializeError(requestError)
          );
          throw requestError;
        }

        if (!responseText) {
          logger.error(
            `[AI SERVICE] Nenhuma resposta retornada pelo provedor de IA para ticket ${ticket.id}`
          );

          const fallbackMessage =
            "Desculpe, estou com dificuldades para processar sua mensagem no momento. Um atendente será chamado para ajudá-lo.";

          await sendTextToChannel(
            fallbackMessage,
            msg,
            wbot,
            ticket,
            contact
          );

          await ticket.update({
            useIntegration: false,
            isBot: false,
            dataWebhook: null,
            flowWebhook: false,
            lastFlowId: null,
            hashFlowId: null,
            flowStopped: null,
          });

          return;
        }

        try {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            aiSettings,
            ticketTraking,
            hasIncomingAudio
          );

          logger.info(
            `[AI SERVICE] Resposta da IA enviada com sucesso para ticket ${ticket.id}`
          );
        } catch (sendError) {
          logger.error(
            `[AI SERVICE] Falha ao enviar resposta da IA para ticket ${ticket.id}:`,
            serializeError(sendError)
          );
          throw sendError;
        }

        if (
          isTemporaryMode &&
          aiSettings.autoCompleteOnObjective &&
          aiSettings.objective &&
          openai
        ) {
          const recentMessages = await Message.findAll({
            where: { ticketId: ticket.id },
            order: [["createdAt", "DESC"]],
            limit: 10,
          });

          const objectiveCompleted = await checkObjectiveCompletion(
            aiSettings.objective,
            recentMessages,
            openai
          );

          if (objectiveCompleted) {
            logger.info(
              `[AI SERVICE] Objetivo completado automaticamente - ticket ${ticket.id}`
            );
            await returnToFlow(ticket, contact, wbot, "objective_completed");
            return;
          }
        }
      } catch (error: any) {
        logger.error(
          `[AI SERVICE] Falha na requisição/processamento da IA para ticket ${ticket.id}:`,
          serializeError(error)
        );

        let errorMessage =
          "Desculpe, estou com dificuldades técnicas para processar sua solicitação no momento. Um atendente será chamado para ajudá-lo.";

        if (
          error?.response?.status === 401 ||
          error?.message?.includes("API key")
        ) {
          errorMessage =
            "Desculpe, o serviço de IA não está configurado corretamente. Um atendente será chamado para ajudá-lo.";
          logger.error(
            `[AI SERVICE] Erro de autenticação na API da IA para ticket ${ticket.id}`
          );
        }

        if (
          error?.response?.status === 429 ||
          error?.message?.toLowerCase?.().includes("rate limit")
        ) {
          errorMessage =
            "Desculpe, o serviço de IA está temporariamente sobrecarregado. Um atendente será chamado para ajudá-lo.";
        }

        try {
          await sendTextToChannel(
            errorMessage,
            msg,
            wbot,
            ticket,
            contact
          );

          await ticket.update({
            useIntegration: false,
            isBot: false,
            dataWebhook: null,
            flowWebhook: false,
            lastFlowId: null,
            hashFlowId: null,
            flowStopped: null,
          });

          logger.info(
            `[AI SERVICE] Estado da IA limpo para ticket ${ticket.id} após erro`
          );
        } catch (sendError) {
          logger.error(
            `[AI SERVICE] Erro ao enviar mensagem de erro para ticket ${ticket.id}:`,
            serializeError(sendError)
          );
        }
      }

      return;
    }

    if (msg?.message?.audioMessage && mediaSent && isOpenAIModel) {
      if (!openai) {
        logger.error(
          "[AI SERVICE] Sessão OpenAI necessária para transcrição mas não inicializada"
        );

        await sendTextToChannel(
          "Desculpe, a transcrição de áudio não está configurada corretamente.",
          msg,
          wbot,
          ticket,
          contact
        );

        return;
      }

      try {
        const audioFilePath = resolveStoredAudioPath(ticket, mediaSent);

        if (!audioFilePath || !fs.existsSync(audioFilePath)) {
          logger.error(
            `[AI SERVICE] Arquivo de áudio não encontrado para ticket ${ticket.id}. mediaUrl=${mediaSent.mediaUrl}`
          );

          await sendTextToChannel(
            "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente.",
            msg,
            wbot,
            ticket,
            contact
          );

          return;
        }

        if (!audioFilePath || !fs.existsSync(audioFilePath)) {
          logger.error(
            `[AI SERVICE] Arquivo de áudio não encontrado: ${audioFilePath}`
          );

          await sendTextToChannel(
            "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente.",
            msg,
            wbot,
            ticket,
            contact
          );

          return;
        }

        const converted = await convertAudioToTranscriptionCompatibleFile(audioFilePath);
        const file = fs.createReadStream(converted.pathToUse) as any;

        const transcriptionResult = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file,
        });

        if (converted.cleanupPath) {
          deleteFileSync(converted.cleanupPath);
        }

        const transcription = transcriptionResult.text;

        if (!transcription) {
          logger.warn(
            `[AI SERVICE] Transcrição vazia recebida para ticket ${ticket.id}`
          );

          await sendTextToChannel(
            "Desculpe, não consegui entender o áudio. Tente novamente ou envie uma mensagem de texto.",
            msg,
            wbot,
            ticket,
            contact
          );

          return;
        }

        await persistAudioTranscription(ticket, msg, transcription);

        const messagesAI = prepareMessagesAI(
          messages,
          isGeminiModel,
          promptSystem
        );

        let responseText = "";

        messagesAI.push({ role: "user", content: transcription });
        responseText = await handleOpenAIRequest(openai, messagesAI, aiSettings);

        if (responseText) {
          await processResponse(
            responseText,
            wbot,
            msg,
            ticket,
            contact,
            aiSettings,
            ticketTraking,
            true
          );
        }
      } catch (error: any) {
        logger.error(
          `[AI SERVICE] Erro no processamento de áudio do ticket ${ticket.id}:`,
          serializeError(error)
        );

        const errorMessage =
          error?.response?.data?.error?.message ||
          error?.message ||
          "Erro desconhecido ao processar áudio";

        await sendTextToChannel(
          `Desculpe, houve um erro ao processar seu áudio: ${errorMessage}`,
          msg,
          wbot,
          ticket,
          contact
        );
      }

      return;
    }

    if (msg?.message?.audioMessage && isGeminiModel) {
      await sendTextToChannel(
        "Desculpe, no momento só posso processar mensagens de texto. Por favor, envie sua pergunta por escrito.",
        msg,
        wbot,
        ticket,
        contact
      );
    }
  } catch (error) {
    logger.error(
      `[AI SERVICE] Erro geral no serviço para ticket ${ticket.id}:`,
      serializeError(error)
    );

    try {
      await sendTextToChannel(
        "Desculpe, ocorreu um erro interno. Por favor, tente novamente mais tarde.",
        msg,
        wbot,
        ticket,
        contact
      );
    } catch (sendError) {
      logger.error(
        `[AI SERVICE] Erro ao enviar mensagem de erro final para ticket ${ticket.id}:`,
        serializeError(sendError)
      );
    }
  }
};

export default handleOpenAiFlow;