import { WASocket, proto } from "@whiskeysockets/baileys";

import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";

import GenerateAiSpeechService from "./GenerateAiSpeechService";
import {
  getCompanySettingBool,
  getCompanySettingNumber
} from "../SettingServices/GetCompanySettingService";

import {
  cleanTextForAudio,
  extractLinks
} from "../../helpers/aiAudioReply";

interface Request {
  wbot: WASocket;
  ticket: Ticket;
  jid: string;
  aiText: string;
  inputWasAudio: boolean;
  openAiApiKey?: string;

  // Configuração vinda do nó OpenAI / Flowbuilder
  aiAudioReplyEnabled?: boolean | string;
  aiAudioReplyOnlyWhenInputAudio?: boolean | string;
  aiAudioReplyFallbackToText?: boolean | string;
  aiAudioReplySendTextWithLinks?: boolean | string;
  aiAudioReplyMaxChars?: number | string;

  aiAudioReplyModel?: string;
  aiAudioReplyVoice?: string;
  aiAudioReplySpeed?: number | string;
  aiAudioReplyInstructions?: string;

  verifyMediaMessageFn?: (
    sentAudioMessage: proto.IWebMessageInfo
  ) => Promise<void>;

  sendTextMessageFn?: (text: string) => Promise<void>;

  sendTextMessage?: (text: string) => Promise<void>;
}

const parseBool = (value: any, fallback = false): boolean => {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();

  return ["true", "1", "yes", "sim", "enabled", "ativo"].includes(normalized);
};

const parseNumber = (
  value: any,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) return fallback;

  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
};

const SendAiAudioReplyService = async ({
  wbot,
  ticket,
  jid,
  aiText,
  inputWasAudio,
  openAiApiKey,

  aiAudioReplyEnabled,
  aiAudioReplyOnlyWhenInputAudio,
  aiAudioReplyFallbackToText,
  aiAudioReplySendTextWithLinks,
  aiAudioReplyMaxChars,

  aiAudioReplyModel,
  aiAudioReplyVoice,
  aiAudioReplySpeed,
  aiAudioReplyInstructions,

  verifyMediaMessageFn,
  sendTextMessageFn,
  sendTextMessage
}: Request): Promise<boolean> => {
  const companyId = ticket.companyId;

  const enabled =
    aiAudioReplyEnabled !== undefined && aiAudioReplyEnabled !== null
      ? parseBool(aiAudioReplyEnabled, false)
      : await getCompanySettingBool(companyId, "aiAudioReplyEnabled", false);

  logger.info(
    `[AI-AUDIO-DEBUG] SendAiAudioReplyService iniciado | companyId=${companyId} ticketId=${ticket.id} enabled=${enabled} inputWasAudio=${inputWasAudio}`
  );

  if (!enabled) {
    logger.info(
      `[AI-AUDIO-DEBUG] Áudio da IA desativado | companyId=${companyId} ticketId=${ticket.id}`
    );
    return false;
  }

  const onlyWhenInputAudio =
    aiAudioReplyOnlyWhenInputAudio !== undefined &&
    aiAudioReplyOnlyWhenInputAudio !== null
      ? parseBool(aiAudioReplyOnlyWhenInputAudio, true)
      : await getCompanySettingBool(
          companyId,
          "aiAudioReplyOnlyWhenInputAudio",
          true
        );

  if (onlyWhenInputAudio && !inputWasAudio) {
    logger.info(
      `[AI-AUDIO-DEBUG] Áudio da IA ignorado porque entrada não foi áudio | companyId=${companyId} ticketId=${ticket.id}`
    );
    return false;
  }

  const maxChars =
    aiAudioReplyMaxChars !== undefined && aiAudioReplyMaxChars !== null
      ? parseNumber(aiAudioReplyMaxChars, 700, 100, 4000)
      : await getCompanySettingNumber(
          companyId,
          "aiAudioReplyMaxChars",
          700,
          100,
          4000
        );

  const audioText = cleanTextForAudio(aiText, maxChars);

  if (!audioText) {
    logger.warn(
      `[AI-AUDIO] Texto vazio após limpeza para áudio | companyId=${companyId} ticketId=${ticket.id}`
    );
    return false;
  }

  const audio = await GenerateAiSpeechService({
    companyId,
    text: audioText,
    openAiApiKey,
    model: aiAudioReplyModel,
    voice: aiAudioReplyVoice,
    speed: aiAudioReplySpeed,
    instructions: aiAudioReplyInstructions
  });

  if (!audio) {
    const fallbackToText =
      aiAudioReplyFallbackToText !== undefined &&
      aiAudioReplyFallbackToText !== null
        ? parseBool(aiAudioReplyFallbackToText, true)
        : await getCompanySettingBool(
            companyId,
            "aiAudioReplyFallbackToText",
            true
          );

    logger.warn(
      `[AI-AUDIO] Falha ao gerar áudio da IA | companyId=${companyId} ticketId=${ticket.id} fallbackToText=${fallbackToText}`
    );

    return !fallbackToText;
  }

  logger.info(
    `[AI-AUDIO-DEBUG] Enviando áudio da IA | companyId=${companyId} ticketId=${ticket.id} jid=${jid} file=${audio.filePath}`
  );

  const sentMessage = await wbot.sendMessage(jid, {
    audio: { url: audio.filePath },
    mimetype: audio.mimetype,
    ptt: true
  });

  if (!sentMessage) {
    logger.warn(
      `[AI-AUDIO] Falha ao enviar áudio | companyId=${companyId} ticketId=${ticket.id}`
    );

    return false;
  }

  if (verifyMediaMessageFn) {
    await verifyMediaMessageFn(sentMessage as proto.IWebMessageInfo);
  } else {
    await CreateMessageService({
      messageData: {
        wid: sentMessage?.key?.id,
        ticketId: ticket.id,
        body: "🎙️ Resposta da IA em áudio",
        fromMe: true,
        read: true,
        mediaType: "audio",
        mediaUrl: audio.fileName,
        ack: 1,
        remoteJid: jid,
        channel: ticket.channel || "whatsapp"
      },
      companyId
    });
  }

  const sendLinks =
    aiAudioReplySendTextWithLinks !== undefined &&
    aiAudioReplySendTextWithLinks !== null
      ? parseBool(aiAudioReplySendTextWithLinks, true)
      : await getCompanySettingBool(
          companyId,
          "aiAudioReplySendTextWithLinks",
          true
        );

  const links = extractLinks(aiText);
  const textSender = sendTextMessageFn || sendTextMessage;

  if (sendLinks && links.length && textSender) {
    await textSender(
      `Segue o link que comentei no áudio 👇\n\n${links.join("\n")}`
    );
  }

  logger.info(
    `[AI-AUDIO] Resposta em áudio enviada | companyId=${companyId} ticketId=${ticket.id}`
  );

  return true;
};

export default SendAiAudioReplyService;