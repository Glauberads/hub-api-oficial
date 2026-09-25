import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import logger from "../../utils/logger";
import SendTelegramMessageService from "./SendTelegramMessageService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";

type Provider = "openai" | "gemini";

type AiSettings = {
  name?: string;
  prompt?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxMessages?: number;
  provider?: Provider;
  flowMode?: "permanent" | "temporary";
  continueKeywords?: string[];
  maxInteractions?: number;
  objective?: string;
  autoCompleteOnObjective?: boolean;

  aiAudioReplyEnabled?: boolean;
  aiAudioReplyOnlyWhenInputAudio?: boolean;
  aiAudioReplyModel?: string;
  aiAudioReplyVoice?: string;
  aiAudioReplySpeed?: number | string;
  aiAudioReplyMaxChars?: number | string;
  aiAudioReplySendTextWithLinks?: boolean;
  aiAudioReplyFallbackToText?: boolean;
  aiAudioReplyInstructions?: string;
};

type Request = {
  whatsapp: Whatsapp;
  ticket: Ticket;
  contact: Contact;
  body: string;
};

const normalizeText = (value = ""): string => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const splitTelegramText = (text: string, limit = 3900): string[] => {
  const value = String(text || "").trim();

  if (!value) return [];

  const parts: string[] = [];
  let remaining = value;

  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);

    if (cut < limit * 0.5) {
      cut = remaining.lastIndexOf(" ", limit);
    }

    if (cut < limit * 0.5) {
      cut = limit;
    }

    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
};

const sendTelegramAiText = async ({
  ticket,
  body
}: {
  ticket: Ticket;
  body: string;
}) => {
  const chunks = splitTelegramText(body);

  for (const chunk of chunks) {
    await SendTelegramMessageService({
      body: chunk,
      ticket
    });
  }
};


const hasLink = (text: string): boolean => {
  return /https?:\/\/|www\./i.test(String(text || ""));
};

const cleanTextForSpeech = (text: string, maxChars: number): string => {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, " link disponível na mensagem de texto ")
    .replace(/www\.\S+/gi, " link disponível na mensagem de texto ")
    .replace(/[*_`~>#\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
};

const isAudioMessageRecord = (message: Message | null): boolean => {
  if (!message) return false;

  const mediaType = String((message as any).mediaType || "").toLowerCase();
  const mediaUrl = String((message as any).mediaUrl || "").toLowerCase();

  return (
    mediaType === "audio" ||
    mediaType === "voice" ||
    mediaUrl.endsWith(".ogg") ||
    mediaUrl.endsWith(".oga") ||
    mediaUrl.endsWith(".opus") ||
    mediaUrl.endsWith(".mp3") ||
    mediaUrl.endsWith(".wav") ||
    mediaUrl.endsWith(".m4a") ||
    mediaUrl.endsWith(".aac") ||
    mediaUrl.endsWith(".webm")
  );
};

const shouldSendAudioReply = async ({
  ticket,
  settings
}: {
  ticket: Ticket;
  settings: AiSettings;
}): Promise<boolean> => {
  if (!settings.aiAudioReplyEnabled) {
    return false;
  }

  const onlyWhenInputAudio =
    settings.aiAudioReplyOnlyWhenInputAudio === undefined
      ? false
      : Boolean(settings.aiAudioReplyOnlyWhenInputAudio);

  if (!onlyWhenInputAudio) {
    return true;
  }

  const latestIncoming = await Message.findOne({
    where: {
      ticketId: ticket.id,
      fromMe: false
    },
    order: [["createdAt", "DESC"]]
  });

  return isAudioMessageRecord(latestIncoming);
};

const sendTelegramAiAudio = async ({
  ticket,
  settings,
  answer
}: {
  ticket: Ticket;
  settings: AiSettings;
  answer: string;
}): Promise<boolean> => {
  const shouldSend = await shouldSendAudioReply({ ticket, settings });

  if (!shouldSend) {
    return false;
  }

  const apiKey = String(settings.apiKey || "").trim();

  if (!apiKey) {
    logger.warn(`[TELEGRAM AI AUDIO] Sem apiKey para gerar áudio no ticket ${ticket.id}`);
    return false;
  }

  const maxChars = Number(settings.aiAudioReplyMaxChars || 700) || 700;
  const speechInput = cleanTextForSpeech(answer, maxChars);

  if (!speechInput) {
    return false;
  }

  const openai = new OpenAI({ apiKey });

  const folder = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`,
    "ai-audio-replies",
    "telegram"
  );

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  const fileName = `telegram_ai_${ticket.id}_${Date.now()}.mp3`;
  const fullPath = path.join(folder, fileName);

  logger.info(`[TELEGRAM AI AUDIO] Gerando áudio para ticket ${ticket.id}`);

  const rawSpeed = String(settings.aiAudioReplySpeed || "1").replace(",", ".");
  const model = String(settings.aiAudioReplyModel || "gpt-4o-mini-tts");
  const instructions = String(settings.aiAudioReplyInstructions || "").trim();

  const speechPayload: any = {
    model,
    voice: String(settings.aiAudioReplyVoice || "coral") as any,
    input: speechInput,
    speed: Number(rawSpeed) || 1
  };

  // Importante: a instrução de voz não pode ir dentro do input,
  // senão o TTS narra a própria instrução em vez da resposta da IA.
  if (instructions && model.includes("gpt-4o")) {
    speechPayload.instructions = instructions;
  }

  const speech = await openai.audio.speech.create(speechPayload);

  const buffer = Buffer.from(await speech.arrayBuffer());

  fs.writeFileSync(fullPath, buffer);
  fs.chmodSync(fullPath, 0o666);

  const SendTelegramMediaService = (await import("./SendTelegramMediaService")).default;

  await SendTelegramMediaService({
    ticket,
    body: "",
    media: {
      fieldname: "medias",
      originalname: fileName,
      encoding: "7bit",
      mimetype: "audio/mpeg",
      filename: fileName,
      path: fullPath,
      mediaUrl: `ai-audio-replies/telegram/${fileName}`
    }
  });

  logger.info(`[TELEGRAM AI AUDIO] Áudio enviado com sucesso para ticket ${ticket.id}`);

  return true;
};


const buildSystemPrompt = ({
  settings,
  contact,
  ticket
}: {
  settings: AiSettings;
  contact: Contact;
  ticket: Ticket;
}): string => {
  const agentName = settings.name || "Assistente";
  const basePrompt = settings.prompt || "";

  return `
Você é ${agentName}, atendente virtual da empresa.
Atenda em português do Brasil.
Use linguagem natural, objetiva, cordial e útil.
Nome do contato: ${contact.name || "Cliente"}.
Número/identificador do contato: ${contact.number || ""}.
Protocolo/ticket: ${ticket.id}.

${basePrompt}
`.trim();
};


const isGenericTelegramAudioBody = (value?: string | null): boolean => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return [
    "audio telegram",
    "áudio telegram",
    "audio",
    "áudio",
    "voz telegram",
    "mensagem de audio",
    "mensagem de áudio"
  ].includes(normalized);
};


const isLikelyTelegramMediaFileBody = (value?: string | null): boolean => {
  const body = String(value || "").trim().toLowerCase();

  if (!body) return false;

  return /\.(oga|ogg|opus|mp3|wav|m4a|aac|webm|jpg|jpeg|png|webp|gif|mp4|mov|pdf|zip|doc|docx|xls|xlsx)$/i.test(body);
};

const isLikelyTelegramAudioFileBody = (value?: string | null): boolean => {
  const body = String(value || "").trim().toLowerCase();

  if (!body) return false;

  return /\.(oga|ogg|opus|mp3|wav|m4a|aac|webm)$/i.test(body);
};


const resolveTelegramMediaPath = (ticket: Ticket, mediaUrl?: string | null): string | null => {
  const value = String(mediaUrl || "").trim().replace(/\\/g, "/");

  if (!value) return null;

  const publicRoot = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );

  const companyFolder = path.join(publicRoot, `company${ticket.companyId}`);

  const candidates = [
    path.join(companyFolder, value),
    path.join(publicRoot, value),
    path.join(companyFolder, path.basename(value))
  ];

  const found = candidates.find(item => fs.existsSync(item));

  return found || null;
};

const transcribeTelegramAudioIfNeeded = async ({
  ticket,
  settings
}: {
  ticket: Ticket;
  settings: AiSettings;
}): Promise<string | null> => {
  const latestIncoming = await Message.findOne({
    where: {
      ticketId: ticket.id,
      fromMe: false
    },
    order: [["createdAt", "DESC"]]
  });

  if (!latestIncoming) {
    return null;
  }

  const mediaType = String((latestIncoming as any).mediaType || "").toLowerCase();
  const mediaUrl = String((latestIncoming as any).mediaUrl || "").trim();

  const isAudio =
    mediaType === "audio" ||
    mediaType === "voice" ||
    mediaUrl.toLowerCase().endsWith(".ogg") ||
    mediaUrl.toLowerCase().endsWith(".oga") ||
    mediaUrl.toLowerCase().endsWith(".opus") ||
    mediaUrl.toLowerCase().endsWith(".mp3") ||
    mediaUrl.toLowerCase().endsWith(".wav") ||
    mediaUrl.toLowerCase().endsWith(".m4a") ||
    mediaUrl.toLowerCase().endsWith(".aac") ||
    mediaUrl.toLowerCase().endsWith(".webm");

  if (!isAudio) {
    return null;
  }

  const currentBody = String(latestIncoming.body || "").trim();

  const currentBodyIsAudioFile =
    isLikelyTelegramAudioFileBody(currentBody) ||
    (!!mediaUrl && currentBody === mediaUrl);

  // Se já existe texto real no body, reaproveita.
  // Mas se o body for apenas nome do arquivo de áudio, precisa transcrever.
  if (
    currentBody &&
    !isGenericTelegramAudioBody(currentBody) &&
    !currentBodyIsAudioFile
  ) {
    return currentBody;
  }

  const audioPath = resolveTelegramMediaPath(ticket, mediaUrl);

  if (!audioPath) {
    logger.error(`[TELEGRAM AI] Áudio não encontrado para transcrição. ticket=${ticket.id}, mediaUrl=${mediaUrl}`);
    return null;
  }

  const apiKey = String(settings.apiKey || "").trim();

  if (!apiKey) {
    logger.error(`[TELEGRAM AI] Sem apiKey para transcrever áudio do ticket ${ticket.id}`);
    return null;
  }

  logger.info(`[TELEGRAM AI] Transcrevendo áudio recebido no Telegram. ticket=${ticket.id}, arquivo=${audioPath}`);

  const openai = new OpenAI({ apiKey });
  const audioFile = fs.createReadStream(audioPath) as any;

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile
  });

  const text = String(transcription?.text || "").trim();

  if (text) {
    await latestIncoming.update({
      body: text
    });

    await ticket.update({
      lastMessage: text
    });

    logger.info(`[TELEGRAM AI] Transcrição concluída ticket=${ticket.id}: ${text}`);
  }

  return text || null;
};


const loadHistory = async ({
  ticket,
  settings
}: {
  ticket: Ticket;
  settings: AiSettings;
}) => {
  const maxMessages = Number(settings.maxMessages || 10);

  const rows = await Message.findAll({
    where: {
      ticketId: ticket.id
    },
    order: [["createdAt", "DESC"]],
    limit: Math.max(maxMessages * 2, 20)
  });

  return rows
    .reverse()
    .filter(message => {
      const body = String(message.body || "").trim();
      if (!body) return false;

      // Inclui texto normal e áudio já transcrito.
      // Remove placeholders ou nomes de arquivos sem conteúdo útil.
      if (isGenericTelegramAudioBody(body)) return false;

      const mediaType = String((message as any).mediaType || "chat").toLowerCase();

      if (mediaType !== "chat" && isLikelyTelegramMediaFileBody(body)) {
        return false;
      }

      return true;
    })
    .slice(-maxMessages)
    .map(message => ({
      role: message.fromMe ? "assistant" : "user",
      content: String(message.body || "")
    }));
};

const generateOpenAiAnswer = async ({
  settings,
  systemPrompt,
  history
}: {
  settings: AiSettings;
  systemPrompt: string;
  history: { role: string; content: string }[];
}): Promise<string> => {
  const openai = new OpenAI({
    apiKey: settings.apiKey
  });

  const messages: any[] = [
    {
      role: "system",
      content: systemPrompt
    },
    ...history.map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content
    }))
  ];

  const completion = await openai.chat.completions.create({
    model: String(settings.model || "gpt-4o-mini"),
    messages: messages as any,
    max_tokens: Number(settings.maxTokens || 1000),
    temperature: Number(settings.temperature ?? 0.7)
  });

  return completion.choices?.[0]?.message?.content?.trim() || "";
};

const generateGeminiAnswer = async ({
  settings,
  systemPrompt,
  history
}: {
  settings: AiSettings;
  systemPrompt: string;
  history: { role: string; content: string }[];
}): Promise<string> => {
  const genAI = new GoogleGenerativeAI(String(settings.apiKey || ""));
  const model = genAI.getGenerativeModel({
    model: String(settings.model || "gemini-1.5-flash")
  });

  const prompt = [
    systemPrompt,
    "",
    "Histórico da conversa:",
    ...history.map(item => `${item.role === "assistant" ? "Assistente" : "Cliente"}: ${item.content}`),
    "",
    "Responda à última mensagem do cliente."
  ].join("\n");

  const result = await model.generateContent(prompt);

  return result.response.text()?.trim() || "";
};

const shouldContinueTemporaryFlow = ({
  body,
  dataWebhook
}: {
  body: string;
  dataWebhook: any;
}): boolean => {
  if (dataWebhook?.mode !== "temporary") return false;

  const keywords = Array.isArray(dataWebhook?.settings?.continueKeywords)
    ? dataWebhook.settings.continueKeywords
    : [];

  if (!keywords.length) return false;

  const normalizedBody = normalizeText(body);

  return keywords.some(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    return normalizedKeyword && normalizedBody.includes(normalizedKeyword);
  });
};

const resumeTemporaryFlow = async ({
  whatsapp,
  ticket,
  contact,
  body,
  dataWebhook
}: {
  whatsapp: Whatsapp;
  ticket: Ticket;
  contact: Contact;
  body: string;
  dataWebhook: any;
}): Promise<boolean> => {
  const flowContinuation = dataWebhook?.flowContinuation || {};
  const nextNodeId = flowContinuation?.nextNodeId;
  const flowId = Number(flowContinuation?.flowId || ticket.flowStopped || 0);

  if (!flowId || !nextNodeId) {
    logger.warn(
      `[TELEGRAM AI] Não foi possível retomar fluxo temporário. flowId=${flowId}, nextNodeId=${nextNodeId || "N/A"}`
    );
    return false;
  }

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: flowId,
      company_id: ticket.companyId,
      active: true
    }
  });

  if (!flow) {
    logger.warn(`[TELEGRAM AI] Fluxo temporário ${flowId} não encontrado/inativo.`);
    return false;
  }

  const nodes: INodes[] = (flow.flow as any)["nodes"] || [];
  const connections: IConnections[] = (flow.flow as any)["connections"] || [];

  if (!nodes.length) {
    logger.warn(`[TELEGRAM AI] Fluxo temporário ${flowId} sem nós.`);
    return false;
  }

  await ticket.update({
    useIntegration: false,
    isBot: false,
    dataWebhook: flowContinuation?.originalDataWebhook || null,
    flowWebhook: true,
    flowStopped: String(flowId),
    lastFlowId: nextNodeId
  });

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email || ""
  };

  logger.info(
    `[TELEGRAM AI] Retomando FlowBuilder temporário ${flowId} no nó ${nextNodeId} para ticket ${ticket.id}`
  );

  await ActionsWebhookService(
    whatsapp.id,
    flowId,
    ticket.companyId,
    nodes,
    connections,
    nextNodeId,
    flowContinuation?.originalDataWebhook || null,
    "",
    ticket.hashFlowId || "",
    body,
    ticket.id,
    mountDataContact,
    true
  );

  return true;
};

const ProcessTelegramAiFlowService = async ({
  whatsapp,
  ticket,
  contact,
  body
}: Request): Promise<boolean> => {
  const dataWebhook: any = ticket.dataWebhook || {};
  const provider = dataWebhook?.type as Provider;

  if (!["openai", "gemini"].includes(provider)) {
    return false;
  }

  const settings: AiSettings = {
    ...(dataWebhook?.settings || {}),
    provider
  };

  if (!settings.apiKey || !settings.model) {
    logger.error(`[TELEGRAM AI] Configuração inválida. apiKey/model ausentes no ticket ${ticket.id}`);
    return false;
  }

  if (shouldContinueTemporaryFlow({ body, dataWebhook })) {
    return resumeTemporaryFlow({
      whatsapp,
      ticket,
      contact,
      body,
      dataWebhook
    });
  }

  try {
    logger.info(`[TELEGRAM AI] Processando ${provider.toUpperCase()} no ticket ${ticket.id}`);

    if (dataWebhook.awaitingUserResponse) {
      await ticket.update({
        dataWebhook: {
          ...dataWebhook,
          awaitingUserResponse: false
        }
      });
    }

    const refreshedTicket = await Ticket.findByPk(ticket.id);
    const effectiveDataWebhook: any = refreshedTicket?.dataWebhook || dataWebhook;

    const interactionCount =
      Number(effectiveDataWebhook?.interactionCount || effectiveDataWebhook?.flowContinuation?.interactionCount || 0) + 1;

    await transcribeTelegramAudioIfNeeded({
      ticket,
      settings
    });

    const systemPrompt = buildSystemPrompt({
      settings,
      contact,
      ticket
    });

    const history = await loadHistory({
      ticket,
      settings
    });

    const answer =
      provider === "gemini"
        ? await generateGeminiAnswer({ settings, systemPrompt, history })
        : await generateOpenAiAnswer({ settings, systemPrompt, history });

    const finalAnswer =
      answer ||
      "Desculpe, não consegui gerar uma resposta agora. Tente novamente em instantes.";

    let audioSent = false;

    try {
      audioSent = await sendTelegramAiAudio({
        ticket,
        settings,
        answer: finalAnswer
      });
    } catch (audioError) {
      logger.error(`[TELEGRAM AI AUDIO] Erro ao gerar/enviar áudio no ticket ${ticket.id}:`, audioError);

      if (settings.aiAudioReplyFallbackToText === false) {
        audioSent = true;
      }
    }

    if (!audioSent) {
      await sendTelegramAiText({
        ticket,
        body: finalAnswer
      });
    } else if (
      settings.aiAudioReplySendTextWithLinks !== false &&
      hasLink(finalAnswer)
    ) {
      await sendTelegramAiText({
        ticket,
        body: finalAnswer
      });
    }

    const updatedDataWebhook: any = {
      ...(effectiveDataWebhook || {}),
      awaitingUserResponse: false,
      interactionCount
    };

    if (updatedDataWebhook.flowContinuation) {
      updatedDataWebhook.flowContinuation = {
        ...updatedDataWebhook.flowContinuation,
        interactionCount
      };
    }

    await ticket.update({
      dataWebhook: updatedDataWebhook,
      lastMessage: finalAnswer
    });

    logger.info(`[TELEGRAM AI] Resposta enviada com sucesso no ticket ${ticket.id}`);

    return true;
  } catch (error: any) {
    logger.error(`[TELEGRAM AI] Erro ao processar IA no ticket ${ticket.id}:`, error);

    await sendTelegramAiText({
      ticket,
      body: "Desculpe, a IA está temporariamente indisponível. Tente novamente em instantes."
    });

    return false;
  }
};

export default ProcessTelegramAiFlowService;
