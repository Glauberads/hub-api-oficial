import path, { join } from "path";
import { createDecipheriv, createHmac } from "crypto";
import { readFile } from "fs";
import fs from "fs";
import { promises as fsp } from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull } from "lodash";
import { REDIS_URI_MSG_CONN } from "../../config/redis";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  GroupMetadata,
  jidNormalizedUser,
  delay,
  MediaType,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Mutex } from "async-mutex";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import HandleAiSdrMessageService from "../AiSdrServices/HandleAiSdrMessageService";
import { sendFacebookMessage } from "../FacebookServices/sendFacebookMessage";
import moment from "moment";
import Queue from "../../models/Queue";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import { sayChatbot } from "./ChatBotListener";
import MarkDeleteWhatsAppMessage from "./MarkDeleteWhatsAppMessage";
import ListUserQueueServices from "../UserQueueServices/ListUserQueueServices";
import cacheLayer from "../../libs/cache";
import { addLogs } from "../../helpers/addLogs";
import SendWhatsAppMedia, { getMessageOptions } from "./SendWhatsAppMedia";

import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { createDialogflowSessionWithModel } from "../QueueIntegrationServices/CreateSessionDialogflow";
import { queryDialogFlow } from "../QueueIntegrationServices/QueryDialogflow";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import Whatsapp from "../../models/Whatsapp";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowFileService from "../FileServices/ShowService";

import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import typebotListener from "../TypebotServices/typebotListener";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import pino from "pino";
import BullQueues from "../../libs/queue";
import { Transform } from "stream";
// import { msgDB } from "../../libs/wbot";
import { title } from "process";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import ContactTag from "../../models/ContactTag";
import ShowContactService from "../ContactServices/ShowContactService";
import WhatsappLidMap from "../../models/WhatsapplidMap";

import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import { handleOpenAiFlow } from "../IntegrationsServices/OpenAiService";
import { getJidOf } from "./getJidOf";
import { verifyContact } from "./verifyContact";
// import { verifyContact } from "./verifyContact";
import os from "os";
import request from "request";
import { Session } from "../../libs/wbot";
import { getGroupMetadataCache, groupMetadataCache, updateGroupMetadataCache } from "../../utils/RedisGroupCache";
import { SimpleObjectCache } from "../../utils/SimpleObjectCache";
import SendAiAudioReplyService from "../AiServices/SendAiAudioReplyService";
import { isIncomingAudioMessage } from "../../helpers/aiAudioReply";

const resolveLegacyTransferQueueId = async (
  ticket: Ticket,
  preferredQueueId?: number | null
): Promise<number | null> => {
  const preferred = Number(preferredQueueId || 0);
  if (preferred > 0) {
    return preferred;
  }

  const currentQueueId = Number(ticket.queueId || 0);
  if (currentQueueId > 0) {
    return currentQueueId;
  }

  try {
    const whatsapp = await ShowWhatsAppService(
      ticket.whatsappId,
      ticket.companyId
    );

    const connectionQueueId = Number((whatsapp as any)?.queueId || 0);
    if (connectionQueueId > 0) {
      return connectionQueueId;
    }

    const queues = Array.isArray((whatsapp as any)?.queues)
      ? (whatsapp as any).queues
      : [];

    const firstQueueId = Number(queues?.[0]?.id || 0);
    if (firstQueueId > 0) {
      return firstQueueId;
    }
  } catch (error) {
    logger.warn(
      `[LEGACY OPENAI] Não foi possível resolver fila para ticket ${ticket.id}: ${error}`
    );
  }

  return null;
};

// ✅ Cache de CompaniesSettings por companyId (TTL 5 min) — agora usando SimpleObjectCache
const settingsCache = new SimpleObjectCache<any>(300); // 5 min TTL

const getCachedCompanySettings = async (companyId: number) => {
  return settingsCache.getOrFetch(
    `settings:${companyId}`,
    async () => CompaniesSettings.findOne({ where: { companyId } }) as any,
    300
  );
};

let ffmpegPath: string;
if (os.platform() === "win32") {
  // Windows
  ffmpegPath = "C:\\ffmpeg\\ffmpeg.exe"; // Substitua pelo caminho correto no Windows
} else if (os.platform() === "darwin") {
  // macOS
  ffmpegPath = "/opt/homebrew/bin/ffmpeg"; // Substitua pelo caminho correto no macOS
} else {
  // Outros sistemas operacionais (Linux, etc.)
  ffmpegPath = "/usr/bin/ffmpeg"; // Substitua pelo caminho correto em sistemas Unix-like
}
ffmpeg.setFfmpegPath(ffmpegPath);

// Rate limiter para processamento de mensagens
let msgCounter = 0;
let msgCounterResetTimer: ReturnType<typeof setInterval> | null = null;

const ensureMsgCounterTimer = () => {
  if (!msgCounterResetTimer) {
    msgCounterResetTimer = setInterval(() => {
      msgCounter = 0;
    }, 5000);
  }
};

// Limpar timer ao descarregar módulo (evita acúmulo em hot-reload)
const cleanupMsgTimer = () => {
  if (msgCounterResetTimer) {
    clearInterval(msgCounterResetTimer);
    msgCounterResetTimer = null;
  }
};
process.once('SIGTERM', cleanupMsgTimer);
process.once('SIGINT', cleanupMsgTimer);

// Iniciar timer
ensureMsgCounterTimer();

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

// Na v7 oficial, não existem campos customizados sender_pn/participant_pn.
// LID → PN é resolvido via sock.signalRepository.lidMapping

export interface IMe {
  name: string;
  id: string;
  lid?: string;
  senderPn?: string;
  notify?: string;
  verifiedName?: string;
}

const lidUpdateMutex = new Mutex();

// ✅ Mutex separados por contato para criação de tickets (evita race conditions)
// Inspirado no Ticketz: usar mutex por contactId ao invés de criar um novo por mensagem
const ticketMutexMap = new Map<string, Mutex>();
const MUTEX_CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpar a cada 10 min
const mutexLastUsed = new Map<string, number>();

const getTicketMutex = (contactId: string | number): Mutex => {
  const key = String(contactId);
  mutexLastUsed.set(key, Date.now());
  if (!ticketMutexMap.has(key)) {
    ticketMutexMap.set(key, new Mutex());
  }
  return ticketMutexMap.get(key)!;
};

// Limpeza periódica de mutexes não utilizados
setInterval(() => {
  const now = Date.now();
  for (const [key, lastUsed] of mutexLastUsed) {
    if (now - lastUsed > MUTEX_CLEANUP_INTERVAL) {
      const mutex = ticketMutexMap.get(key);
      if (mutex && !mutex.isLocked()) {
        ticketMutexMap.delete(key);
        mutexLastUsed.delete(key);
      }
    }
  }
}, MUTEX_CLEANUP_INTERVAL).unref();

interface SessionOpenAi extends OpenAI {
  id?: number;
}
const sessionsOpenAi: SessionOpenAi[] = [];

// Adicionar depois das interfaces existentes:
interface PhraseCondition {
  text: string;
  type: "exact" | "partial";
}

interface CampaignPhrase {
  id: number;
  flowId: number;
  phrase: PhraseCondition[];
  whatsappId: number;
  status: boolean;
  companyId: number;
}



// Removido promisify(writeFile); usando fs.promises.writeFile

function removeFile(directory) {
  fs.unlink(directory, error => {
    if (error) throw error;
  });
}

const getTimestampMessage = (msgTimestamp: any) => {
  return msgTimestamp * 1;
};

const multVecardGet = function (param: any) {
  let output = " ";

  let name = param
    .split("\n")[2]
    .replace(";;;", "\n")
    .replace("N:", "")
    .replace(";", "")
    .replace(";", " ")
    .replace(";;", " ")
    .replace("\n", "");
  let inicio = param.split("\n")[4].indexOf("=");
  let fim = param.split("\n")[4].indexOf(":");
  let contact = param
    .split("\n")[4]
    .substring(inicio + 1, fim)
    .replace(";", "");
  let contactSemWhats = param.split("\n")[4].replace("item1.TEL:", "");
  //console.log(contact);
  if (contact != "item1.TEL") {
    output = output + name + ": 📞" + contact + "" + "\n";
  } else output = output + name + ": 📞" + contactSemWhats + "" + "\n";
  return output;
};

const contactsArrayMessageGet = (msg: any) => {
  let contactsArray = msg.message?.contactsArrayMessage?.contacts;
  let vcardMulti = contactsArray.map(function (item, indice) {
    return item.vcard;
  });

  let bodymessage = ``;
  vcardMulti.forEach(function (vcard, indice) {
    bodymessage += vcard + "\n\n" + "";
  });

  let contacts = bodymessage.split("BEGIN:");

  contacts.shift();
  let finalContacts = "";
  for (let contact of contacts) {
    finalContacts = finalContacts + multVecardGet(contact);
  }

  return finalContacts;
};

const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const message = (msg.message as any) || {};
  const nestedMessage =
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.ephemeralMessage?.message?.viewOnceMessage?.message ||
    message.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
    {};

  if (message?.extendedTextMessage?.contextInfo?.externalAdReply) {
    return "adMetaPreview";
  }

  if (message?.viewOnceMessageV2) {
    return "viewOnceMessageV2";
  }

  if (message?.templateMessage || nestedMessage?.templateMessage) {
    return "templateMessage";
  }

  if (message?.templateButtonReplyMessage || nestedMessage?.templateButtonReplyMessage) {
    return "templateButtonReplyMessage";
  }

  if (message?.interactiveResponseMessage || nestedMessage?.interactiveResponseMessage) {
    return "interactiveResponseMessage";
  }

  if (message?.buttonsResponseMessage || nestedMessage?.buttonsResponseMessage) {
    return "buttonsResponseMessage";
  }

  if (message?.listResponseMessage || nestedMessage?.listResponseMessage) {
    return "listResponseMessage";
  }

  const msgType = getContentType(msg.message);
  return msgType as string;
};
const getAd = (msg: any): string => {
  if (
    msg.key.fromMe &&
    msg.message?.listResponseMessage?.contextInfo?.externalAdReply
  ) {
    let bodyMessage = `*${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title}*`;

    bodyMessage += `\n\n${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.body}`;

    return bodyMessage;
  }
};

const getBodyButton = (msg: any): string => {
  try {
    if (
      msg?.messageType === "buttonsMessage" ||
      msg?.message?.buttonsMessage?.contentText
    ) {
      let bodyMessage = `[BUTTON]\n\n*${msg?.message?.buttonsMessage?.contentText}*\n\n`;
      // eslint-disable-next-line no-restricted-syntax
      for (const button of msg.message?.buttonsMessage?.buttons) {
        bodyMessage += `*${button.buttonId}* - ${button.buttonText.displayText}\n`;
      }

      return bodyMessage;
    }
    if (
      msg?.messageType === "listMessage" ||
      msg?.message?.listMessage?.description
    ) {
      let bodyMessage = `[LIST]\n\n*${msg?.message?.listMessage?.description}*\n\n`;
      // eslint-disable-next-line no-restricted-syntax
      for (const button of msg.message?.listMessage?.sections[0]?.rows) {
        bodyMessage += `${button.title}\n`;
      }

      return bodyMessage;
    }
  } catch (error) {
    logger.error(error);
  }
};

const msgLocation = (image, latitude, longitude) => {
  if (image) {
    var b64 = Buffer.from(image).toString("base64");

    let data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
};

// ✅ Descrição amigável para mídias no card do atendimento
const getMediaDescription = (msgType: string): string => {
  const descriptions: Record<string, string> = {
    imageMessage: "📷 Imagem",
    videoMessage: "🎥 Vídeo",
    audioMessage: "🎵 Áudio",
    documentMessage: "📄 Documento",
    documentWithCaptionMessage: "📄 Documento",
    stickerMessage: "🏷️ Figurinha",
    locationMessage: "📍 Localização",
    liveLocationMessage: "📍 Localização ao vivo",
    contactMessage: "👤 Contato",
    contactsArrayMessage: "👥 Contatos",
    viewOnceMessageV2: "📷 Visualização única",
  };
  return descriptions[msgType] || "";
};

const getMessageCandidates = (msg: proto.IWebMessageInfo): any[] => {
  const message = (msg.message as any) || {};

  return [
    message,
    message.ephemeralMessage?.message,
    message.viewOnceMessage?.message,
    message.viewOnceMessageV2?.message,
    message.ephemeralMessage?.message?.viewOnceMessage?.message,
    message.ephemeralMessage?.message?.viewOnceMessageV2?.message
  ].filter(Boolean);
};

// ========== HELPER 1: safeParseButtonParamsJson ==========
const safeParseButtonParamsJson = (value?: string): any => {
  if (!value) return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

// ========== HELPER 2: getTemplateInteractivePayload ==========
const getTemplateInteractivePayload = (msg: proto.IWebMessageInfo) => {
  const candidates = getMessageCandidates(msg);

  for (const candidate of candidates) {
    const interactiveTemplate = candidate?.templateMessage?.interactiveMessageTemplate;

    if (!interactiveTemplate) continue;

    const headerMedia =
      interactiveTemplate?.header?.imageMessage ||
      interactiveTemplate?.header?.documentMessage ||
      interactiveTemplate?.header?.videoMessage ||
      null;

    const headerType =
      interactiveTemplate?.header?.imageMessage
        ? "image"
        : interactiveTemplate?.header?.documentMessage
          ? "document"
          : interactiveTemplate?.header?.videoMessage
            ? "video"
            : null;

    const buttons = Array.isArray(interactiveTemplate?.nativeFlowMessage?.buttons)
      ? interactiveTemplate.nativeFlowMessage.buttons.map(
        (button: any, index: number) => {
          const params = safeParseButtonParamsJson(button?.buttonParamsJson);

          return {
            name: String(button?.name || ""),
            text: String(
              params?.display_text ||
              params?.title ||
              params?.text ||
              button?.name ||
              `Botão ${index + 1}`
            ),
            url: String(
              params?.url ||
              params?.landing_page_url ||
              params?.canonical_url ||
              ""
            ),
            params
          };
        }
      )
      : [];

    return {
      bodyText: String(interactiveTemplate?.body?.text || "").trim(),
      footerText: String(interactiveTemplate?.footer?.text || "").trim(),
      headerMedia,
      headerType,
      buttons
    };
  }

  return null;
};

// ========== HELPER 3: buildTemplateInteractiveBody ==========
const buildTemplateInteractiveBody = (
  msg: proto.IWebMessageInfo
): string | null => {
  const templatePayload = getTemplateInteractivePayload(msg);

  if (!templatePayload) return null;

  const baseText = templatePayload.bodyText || templatePayload.footerText || "";

  const buttonLines = templatePayload.buttons
    .map((button: any) => {
      const label = button?.text || button?.name || "Botão";
      return button?.url ? `${label}: ${button.url}` : label;
    })
    .filter(Boolean);

  const buttonsText = buttonLines.length
    ? `[BOTÕES]\n${buttonLines.join("\n")}`
    : "";

  const finalText = [baseText, buttonsText].filter(Boolean).join("\n\n").trim();

  return finalText || "[Template enviado]";
};

const extractInteractivePaymentBody = (
  msg: proto.IWebMessageInfo
): string | null => {
  try {
    const candidates = getMessageCandidates(msg);

    for (const candidate of candidates) {
      const interactive = candidate?.interactiveMessage;

      if (!interactive) continue;

      if (interactive?.body?.text) {
        return interactive.body.text;
      }

      const buttons = interactive?.nativeFlowMessage?.buttons;

      if (!Array.isArray(buttons) || buttons.length === 0) {
        continue;
      }

      for (const button of buttons) {
        if (!button?.buttonParamsJson) continue;

        let parsed: any = null;

        try {
          parsed = JSON.parse(button.buttonParamsJson);
        } catch {
          continue;
        }

        const paymentSettings = Array.isArray(parsed?.payment_settings)
          ? parsed.payment_settings
          : [];

        const pixStaticItem = paymentSettings.find(
          (item: any) =>
            item?.type === "pix_static_code" && item?.pix_static_code
        );

        if (pixStaticItem?.pix_static_code) {
          const pix = pixStaticItem.pix_static_code;
          const merchantName = pix?.merchant_name || "Não informado";
          const key = pix?.key || "Não informado";
          const keyType = pix?.key_type || "Não informado";
          const referenceId = parsed?.reference_id
            ? `\nRef: ${parsed.reference_id}`
            : "";

          return `💳 PIX RECEBIDO\nRecebedor: ${merchantName}\nChave: ${key}\nTipo: ${keyType}${referenceId}`;
        }

        if (button?.name && parsed) {
          return `[INTERACTIVE:${button.name}]`;
        }
      }
    }

    return null;
  } catch (error) {
    logger.error(`[PIX-INTERACTIVE] Erro ao extrair conteúdo da interactiveMessage: ${error}`);
    return null;
  }
};

const safeExtractPrimaryMessageContent = (message: any): any => {
  try {
    if (!message) return null;

    const extracted = extractMessageContent(message);

    if (!extracted || typeof extracted !== "object") {
      return null;
    }

    const firstKey = Object.keys(extracted)[0];

    if (!firstKey) {
      return null;
    }

    return extracted[firstKey] || null;
  } catch (error) {
    return null;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    const type = getTypeMessage(msg);

    if (type === undefined) console.log(JSON.stringify(msg));

    const types = {
      conversation: msg.message?.conversation,
      imageMessage: msg.message?.imageMessage?.caption,
      videoMessage: msg.message?.videoMessage?.caption,
      extendedTextMessage: msg?.message?.extendedTextMessage?.text,
      buttonsResponseMessage:
        msg.message?.buttonsResponseMessage?.selectedDisplayText,
      listResponseMessage:
        msg.message?.listResponseMessage?.title ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
      templateButtonReplyMessage:
        msg.message?.templateButtonReplyMessage?.selectedId,
      // ========== CORREÇÃO 2: templateMessage com buildTemplateInteractiveBody ==========
      templateMessage:
        buildTemplateInteractiveBody(msg) ||
        (() => {
          const tpl =
            msg.message?.templateMessage?.hydratedTemplate ||
            msg.message?.templateMessage?.hydratedFourRowTemplate ||
            msg.message?.templateMessage?.fourRowTemplate;

          if (!tpl) return null;

          return (
            tpl?.hydratedContentText ||
            [tpl?.hydratedTitleText, tpl?.hydratedContentText, tpl?.hydratedFooterText]
              .filter(Boolean)
              .join("\n\n") ||
            tpl?.contentText ||
            tpl?.content?.text ||
            null
          );
        })(),
      messageContextInfo:
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.listResponseMessage?.title,
      buttonsMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      stickerMessage: "sticker",
      contactMessage: msg.message?.contactMessage?.vcard,
      contactsArrayMessage:
        msg.message?.contactsArrayMessage?.contacts &&
        contactsArrayMessageGet(msg),
      locationMessage: msgLocation(
        msg.message?.locationMessage?.jpegThumbnail,
        msg.message?.locationMessage?.degreesLatitude,
        msg.message?.locationMessage?.degreesLongitude
      ),
      liveLocationMessage: `Latitude: ${msg.message?.liveLocationMessage?.degreesLatitude} - Longitude: ${msg.message?.liveLocationMessage?.degreesLongitude}`,
      documentMessage: msg.message?.documentMessage?.caption,
      audioMessage: "Áudio",
      listMessage:
        getBodyButton(msg) || msg.message?.listResponseMessage?.title,
      viewOnceMessage:
        getBodyButton(msg) ||
        (() => {
          try {
            const vom = msg.message?.viewOnceMessage?.message;
            if (vom?.interactiveMessage?.body?.text) return vom.interactiveMessage.body.text;
            if (vom?.imageMessage?.caption) return vom.imageMessage.caption;
            if (vom?.videoMessage?.caption) return vom.videoMessage.caption;
            if (vom?.templateMessage?.hydratedTemplate?.hydratedContentText) {
              return vom.templateMessage.hydratedTemplate.hydratedContentText;
            }
            return null;
          } catch {
            return null;
          }
        })(),
      reactionMessage: msg.message?.reactionMessage?.text || "reaction",
      senderKeyDistributionMessage:
        msg?.message?.senderKeyDistributionMessage
          ?.axolotlSenderKeyDistributionMessage,
      documentWithCaptionMessage:
        msg.message?.documentWithCaptionMessage?.message?.documentMessage
          ?.caption,
      viewOnceMessageV2:
        msg.message?.viewOnceMessageV2?.message?.imageMessage?.caption ||
        msg.message?.viewOnceMessageV2?.message?.videoMessage?.caption ||
        msg.message?.viewOnceMessageV2?.message?.templateMessage?.hydratedTemplate?.hydratedContentText,
      adMetaPreview: msgAdMetaPreview(
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.thumbnail,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.title,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.body,
        msg.message?.extendedTextMessage?.contextInfo?.externalAdReply?.sourceUrl,
        msg.message?.extendedTextMessage?.text
      ),
      editedMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation ||
        msg?.message?.editedMessage?.message?.protocolMessage?.editedMessage
          ?.conversation,
      ephemeralMessage:
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text,
      imageWhitCaptionMessage:
        msg?.message?.ephemeralMessage?.message?.imageMessage,
      highlyStructuredMessage: msg.message?.highlyStructuredMessage,
      protocolMessage:
        msg?.message?.protocolMessage?.editedMessage?.conversation,
      advertising:
        getAd(msg) ||
        msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title,
      interactiveMessage: extractInteractivePaymentBody(msg),
      interactiveResponseMessage: (() => {
        try {
          const irm = (msg.message as any)?.interactiveResponseMessage;
          if (irm?.nativeFlowResponseMessage?.paramsJson) {
            const params = JSON.parse(irm.nativeFlowResponseMessage.paramsJson);
            return params?.id || params?.display_text || irm?.body?.text || "";
          }
          return irm?.body?.text || "";
        } catch {
          return "";
        }
      })(),
      pollUpdateMessage: "Voto em enquete",
      pollCreationMessage: msg.message?.pollCreationMessage?.name || "📊 Enquete"
    };

    const objKey = Object.keys(types).find(key => key === type);

    if (!objKey) {
      logger.warn(
        `#### Nao achou o type 152: ${type} ${JSON.stringify(msg.message)}`
      );
      Sentry.setExtra("Mensagem", { BodyMsg: msg.message, msg, type });
      Sentry.captureException(
        new Error("Novo Tipo de Mensagem em getTypeMessage")
      );
    }

    return types[type as keyof typeof types] || null;
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg?.message });
    Sentry.captureException(error);
    console.log(error);
    return null;
  }
};

const normalizeAdImage = (image: any): string => {
  if (!image) return "";

  if (typeof image !== "string") {
    return `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
  }

  const value = image.trim();

  if (
    value.startsWith("data:image/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  const base64 = value.replace(/\s/g, "");

  let mimeType = "image/jpeg";

  if (base64.startsWith("UklG")) {
    mimeType = "image/webp";
  } else if (base64.startsWith("iVBOR")) {
    mimeType = "image/png";
  } else if (base64.startsWith("/9j/")) {
    mimeType = "image/jpeg";
  }

  return `data:${mimeType};base64,${base64}`;
};

const msgAdMetaPreview = (
  image,
  title,
  body,
  sourceUrl,
  messageUser
) => {
  if (!image) return null;

  const imageSource = normalizeAdImage(image);

  return `${imageSource}|${sourceUrl || ""}|${title || ""}|${body || ""}|${messageUser || ""}`;
};

export const getQuotedMessage = (msg: proto.IWebMessageInfo) => {
  const body = safeExtractPrimaryMessageContent(msg?.message);

  if (!body?.contextInfo?.quotedMessage) return;

  return safeExtractPrimaryMessageContent(body.contextInfo.quotedMessage);
};

export const getQuotedMessageId = (msg: proto.IWebMessageInfo) => {
  const reaction = msg?.message?.reactionMessage?.key?.id;

  if (reaction) {
    return reaction;
  }

  const body = safeExtractPrimaryMessageContent(msg?.message);

  return body?.contextInfo?.stanzaId;
};

const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;

  // Na v7 oficial, usar participant (para grupos) ou remoteJid (para 1:1)
  const senderId =
    msg.key.participant || msg.key.remoteJid || undefined;

  return senderId && jidNormalizedUser(senderId);
};

const normalizeContactIdentifier = (msg: proto.IWebMessageInfo): string => {
  return normalizeJid(msg.key.remoteJid);
};

const isPlaceholderContactName = (value?: string | null): boolean => {
  const name = String(value || "").trim();

  if (!name) return true;

  return (
    /^contato\s*\+?\d+$/i.test(name) ||
    /^\+?\d{8,15}$/.test(name)
  );
};

const pickBestContactName = (...values: Array<any>): string | undefined => {
  for (const value of values) {
    const normalized = String(value || "").trim();

    if (!normalized) continue;
    if (isPlaceholderContactName(normalized)) continue;

    return normalized;
  }

  return undefined;
};

const getStoredContactNames = (wbot: Session, jid?: string) => {
  if (!jid) {
    return {
      storedName: undefined,
      storedNotify: undefined,
      storedVerifiedName: undefined
    };
  }

  const stored = (wbot as any)?.store?.contacts?.[jid] || {};

  return {
    storedName: stored?.name,
    storedNotify: stored?.notify,
    storedVerifiedName: stored?.verifiedName
  };
};

const getContactMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session
): Promise<IMe> => {
  const remoteJid = msg.key.remoteJid || "";
  const isGroup = remoteJid.includes("g.us");
  const rawNumber = remoteJid.replace(/\D/g, "");

  const isLidJid = remoteJid.includes("@lid");
  let lid: string | null = null;
  let resolvedJid: string = remoteJid;

  if (isLidJid) {
    lid = remoteJid;

    try {
      const pn = await (wbot as any).signalRepository?.lidMapping?.getPNForLID?.(
        remoteJid
      );

      if (pn) {
        resolvedJid = pn;
        logger.info(`[LID-V7] Resolvido LID ${remoteJid} → PN ${pn}`);
      } else {
        logger.warn(
          `[LID-V7] Não foi possível resolver LID ${remoteJid} via lidMapping`
        );
      }
    } catch (e: any) {
      logger.warn(`[LID-V7] Erro ao resolver LID ${remoteJid}: ${e.message}`);
    }
  }

  if (isGroup) {
    const participantJid = msg.key.participant || "";
    let participantLid: string | null = null;
    let resolvedParticipant = participantJid;

    if (participantJid?.includes("@lid")) {
      participantLid = participantJid;

      try {
        const pn = await (wbot as any).signalRepository?.lidMapping?.getPNForLID?.(
          participantJid
        );

        if (pn) {
          resolvedParticipant = pn;
          logger.info(
            `[LID-V7] Resolvido participant LID ${participantJid} → PN ${pn}`
          );
        }
      } catch (e: any) {
        logger.warn(
          `[LID-V7] Erro ao resolver participant LID: ${e.message}`
        );
      }
    }

    const participantNumber = String(resolvedParticipant || "").replace(/\D/g, "");
    const participantStored = getStoredContactNames(wbot, resolvedParticipant);

    const resolvedParticipantName =
      pickBestContactName(
        msg.pushName,
        participantStored.storedNotify,
        participantStored.storedVerifiedName,
        participantStored.storedName
      ) || participantNumber || rawNumber;

    return {
      id: resolvedParticipant
        ? jidNormalizedUser(resolvedParticipant)
        : getSenderMessage(msg, wbot),
      name: resolvedParticipantName,
      lid: participantLid || lid
    };
  }

  const storedMain = getStoredContactNames(wbot, resolvedJid);

  const resolvedName = msg.key.fromMe
    ? (
      pickBestContactName(
        storedMain.storedNotify,
        storedMain.storedVerifiedName,
        storedMain.storedName
      ) || rawNumber
    )
    : (
      pickBestContactName(
        msg.pushName,
        storedMain.storedNotify,
        storedMain.storedVerifiedName,
        storedMain.storedName
      ) || rawNumber
    );

  return {
    id: resolvedJid,
    name: resolvedName,
    lid
  };
};

function findCaption(obj) {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }

  for (const key in obj) {
    if (key === "caption" || key === "text" || key === "conversation") {
      return obj[key];
    }

    const result = findCaption(obj[key]);
    if (result) {
      return result;
    }
  }

  return null;
}

const allowedMimeTypes = [
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/postscript",
  "application/x-zip-compressed",
  "application/zip",
  "application/octet-stream",
  "application/x-mtx",
  "application/x-aud",
  "application/x-rul",
  "application/x-exp",
  "application/x-plt",
  "application/x-mdl",
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "image/x-photoshop",
  "application/vnd.corel-draw",
  "application/illustrator",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-ret"
];

// ========== CORREÇÃO 3: downloadMedia ==========
const downloadMedia = async (
  msg: proto.IWebMessageInfo,
  isImported: Date = null,
  wbot: Session
) => {
  // Buscar payload de template interativo
  const templateInteractivePayload = getTemplateInteractivePayload(msg);

  const rawMessage: any = (msg as any)?.message || {};
  const wrappedInteractiveHeader =
    rawMessage?.viewOnceMessage?.message?.interactiveMessage?.header ||
    rawMessage?.viewOnceMessageV2?.message?.interactiveMessage?.header ||
    rawMessage?.ephemeralMessage?.message?.viewOnceMessage?.message?.interactiveMessage?.header ||
    rawMessage?.ephemeralMessage?.message?.viewOnceMessageV2?.message?.interactiveMessage?.header ||
    null;

  const wrappedInteractiveHeaderMedia =
    wrappedInteractiveHeader?.imageMessage ||
    wrappedInteractiveHeader?.documentMessage ||
    wrappedInteractiveHeader?.videoMessage ||
    null;

  const wrappedInteractiveHeaderType =
    wrappedInteractiveHeader?.imageMessage
      ? "image"
      : wrappedInteractiveHeader?.documentMessage
        ? "document"
        : wrappedInteractiveHeader?.videoMessage
          ? "video"
          : null;

  const templateInteractiveHeaderMedia =
    templateInteractivePayload?.headerMedia ||
    wrappedInteractiveHeaderMedia ||
    null;

  const templateInteractiveHeaderType =
    templateInteractivePayload?.headerType ||
    wrappedInteractiveHeaderType ||
    null;

  // Substituir mineType para incluir template interactive
  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.ephemeralMessage?.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.imageMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
      ?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
    msg.message?.interactiveMessage?.header?.imageMessage ||
    msg.message?.interactiveMessage?.header?.documentMessage ||
    msg.message?.interactiveMessage?.header?.videoMessage ||
    templateInteractiveHeaderMedia;

  let filename =
    msg.message?.documentMessage?.fileName ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage
      ?.fileName ||
    msg.message?.extendedTextMessage?.text ||
    "";

  if (!filename && msg.message?.documentMessage?.title) {
    filename = msg.message.documentMessage.title;
  }

  // Se for um documento e tiver extensão, verifica se é permitido
  // ✅ CORRIGIDO: Para mensagens do bot (fromMe=true), ser mais permissivo
  if (msg.message?.documentMessage && filename) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    // Se não tem extensão no filename, tentar usar mimetype do documento
    if (!ext && msg.message.documentMessage.mimetype) {
      const mimeType = msg.message.documentMessage.mimetype;
      // Se o mimetype é válido (está na lista permitida), permitir
      const isValidMimeType = allowedMimeTypes.includes(mimeType);
      if (isValidMimeType) {
        // Permitir se mimetype é válido, mesmo sem extensão no filename
        // O filename será gerado depois baseado no mimetype
      } else if (msg.key.fromMe) {
        // ✅ Para mensagens do bot, ser mais permissivo
        // Se foi enviado pelo bot, provavelmente é válido
        logger.info(`[DOWNLOAD MEDIA] Mensagem do bot sem extensão válida, mas permitindo (mimetype: ${mimeType})`);
      } else {
        throw new Error("Invalid file type");
      }
    } else if (ext) {
      const isAllowedExt = [
        "mtx",
        "aud",
        "rul",
        "exp",
        "zip",
        "plt",
        "mdl",
        "pdf",
        "psd",
        "cdr",
        "ai",
        "xls",
        "xlsx",
        "xlsm",
        "doc",
        "docx",
        "docm",
        "txt",
        // Novos formatos
        "odt",
        "ods",
        "odp",
        "odg",
        "xml",
        "ofx",
        "rtf",
        "csv",
        "html",
        "json",
        "rar",
        "7z",
        "tar",
        "gz",
        "bz2",
        "msg",
        "key",
        "numbers",
        "pages",
        "ppt",
        "pptx",
        // Executáveis e arquivos compactados
        "exe",
        // Imagens como documento
        "png",
        "jpg",
        "jpeg",
        "gif",
        "bmp",
        "webp",
        "dwg",
        "pfx",
        "p12",
        "ret"
      ].includes(ext);

      if (!isAllowedExt) {
        // ✅ Para mensagens do bot, verificar mimetype antes de rejeitar
        if (msg.key.fromMe && msg.message.documentMessage.mimetype) {
          const mimeType = msg.message.documentMessage.mimetype;
          const isValidMimeType = allowedMimeTypes.includes(mimeType);
          if (isValidMimeType) {
            logger.info(`[DOWNLOAD MEDIA] Mensagem do bot com extensão não permitida (${ext}), mas mimetype válido (${mimeType}) - permitindo`);
          } else {
            throw new Error("Invalid file type");
          }
        } else {
          throw new Error("Invalid file type");
        }
      }
    }
  }

  if (!filename) {
    const mimeToExt = {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/vnd.ms-excel": "xls",
      "application/msword": "doc",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "image/vnd.adobe.photoshop": "psd",
      "application/x-photoshop": "psd",
      "application/photoshop": "psd",
      "application/psd": "psd",
      "image/psd": "psd",
      "application/vnd.oasis.opendocument.text": "odt",
      "application/vnd.oasis.opendocument.spreadsheet": "ods",
      "application/vnd.oasis.opendocument.presentation": "odp",
      "application/vnd.oasis.opendocument.graphics": "odg",
      "application/xml": "xml",
      "text/xml": "xml",
      "application/ofx": "ofx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
      "application/rtf": "rtf",
      "text/csv": "csv",
      "text/html": "html",
      "application/json": "json",
      "application/zip": "zip",
      "application/x-rar-compressed": "rar",
      "application/x-7z-compressed": "7z",
      "application/x-tar": "tar",
      "application/gzip": "gz",
      "application/x-bzip2": "bz2",
      "application/vnd.ms-outlook": "msg",
      "application/vnd.apple.keynote": "key",
      "application/vnd.apple.numbers": "numbers",
      "application/vnd.apple.pages": "pages",
      "application/x-msdownload": "exe",
      "application/x-executable": "exe",
      "application/acad": "dwg",
      "image/vnd.dwg": "dwg",
      "application/dwg": "dwg",
      "application/x-dwg": "dwg",
      "image/x-dwg": "dwg",
      "application/x-pkcs12": "pfx",
      "application/pkcs-12": "pfx",
      "application/pkcs12": "pfx",
      "application/x-pkcs-12": "pfx",
      "application/pfx": "pfx"
    };

    const ext =
      mimeToExt[mineType.mimetype] ||
      mineType.mimetype.split("/")[1].split(";")[0];
    const shortId = String(new Date().getTime()).slice(-4);
    filename = `file_${shortId}.${ext}`;
  } else {
    const ext = filename.split(".").pop();
    const name = filename
      .split(".")
      .slice(0, -1)
      .join(".")
      .replace(/\s/g, "_")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const sanitizedName = `${name.trim()}.${ext}`;
    const folder = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      `company${msg.key.remoteJid?.split("@")[0]}`
    );

    if (fs.existsSync(path.join(folder, sanitizedName))) {
      let counter = 1;
      let newName = `${name.trim()}_${counter}.${ext}`;

      while (fs.existsSync(path.join(folder, newName)) && counter < 100) {
        counter++;
        newName = `${name.trim()}_${counter}.${ext}`;
      }

      filename = newName;
    } else {
      filename = sanitizedName;
    }
  }

  if (msg.message?.stickerMessage) {
    const urlAnt = "https://web.whatsapp.net";
    const directPath = msg.message?.stickerMessage?.directPath;
    const newUrl = "https://mmg.whatsapp.net";
    const final = newUrl + directPath;
    if (msg.message?.stickerMessage?.url?.includes(urlAnt)) {
      msg.message.stickerMessage.url = msg.message?.stickerMessage.url.replace(
        urlAnt,
        final
      );
    }
  }

  let buffer;
  // Construir objeto messageToDownload para template interactive
  let messageToDownload: any = msg;

  if (templateInteractiveHeaderMedia && templateInteractiveHeaderType) {
    if (templateInteractiveHeaderType === "image") {
      messageToDownload = {
        ...msg,
        message: {
          imageMessage: templateInteractiveHeaderMedia
        }
      } as any;
    } else if (templateInteractiveHeaderType === "document") {
      messageToDownload = {
        ...msg,
        message: {
          documentMessage: templateInteractiveHeaderMedia
        }
      } as any;
    } else if (templateInteractiveHeaderType === "video") {
      messageToDownload = {
        ...msg,
        message: {
          videoMessage: templateInteractiveHeaderMedia
        }
      } as any;
    }
  }

  try {
    buffer = await downloadMediaMessage(
      messageToDownload as any,
      "buffer",
      {},
      {
        logger,
        reuploadRequest: wbot.updateMediaMessage
      }
    );
  } catch (err) {
    if (isImported) {
      console.log(
        "Falha ao fazer o download de uma mensagem importada, provavelmente a mensagem já não esta mais disponível"
      );
    } else {
      console.error("Erro ao baixar mídia:", err);
    }
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

const checkLIDStatus = async (wbot: Session): Promise<boolean> => {
  try {
    const isLIDEnabled = wbot.user?.lid;
    return !!isLIDEnabled;
  } catch (error) {
    return false;
  }
};

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { wid: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const companyId = ticket.companyId;

  try {
    // ✅ CORRIGIDO: Para mensagens do bot (fromMe=true), tratar erro de download de forma mais elegante
    let media;
    try {
      media = await downloadMedia(msg, ticket?.imported, wbot);
    } catch (downloadError: any) {
      // Se for mensagem do bot e erro de tipo de arquivo, tentar continuar sem download
      if (msg.key.fromMe && downloadError.message === "Invalid file type") {
        logger.warn(`[VERIFY MEDIA] Erro ao baixar mídia do bot (tipo inválido), mas continuando processamento: ${downloadError.message}`);
        // Para mensagens do bot, podemos criar a mensagem sem baixar a mídia novamente
        // já que ela foi enviada pelo próprio sistema
        media = null;
      } else {
        // Re-lançar erro se não for do bot ou se for outro tipo de erro
        throw downloadError;
      }
    }

    if (!media && ticket.imported) {
      const body =
        "*System:* \nFalha no download da mídia verifique no dispositivo";
      const messageData = {
        //mensagem de texto
        wid: msg.key.id,
        ticketId: ticket.id,
        contactId: msg.key.fromMe ? undefined : ticket.contactId,
        body,
        reactionMessage: msg.message?.reactionMessage,
        fromMe: msg.key.fromMe,
        mediaType: getTypeMessage(msg),
        read: msg.key.fromMe,
        quotedMsgId: quotedMsg?.id || msg.message?.reactionMessage?.key?.id,
        ack: msg.status,
        companyId: companyId,
        remoteJid: msg.key.remoteJid,
        participant: msg.key.participant,
        timestamp: getTimestampMessage(msg.messageTimestamp),
        createdAt: new Date(
          Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
        ).toISOString(),
        dataJson: JSON.stringify(msg),
        ticketImported: ticket.imported,
        isForwarded,
        isPrivate
      };

      await ticket.update({
        lastMessage: body || getMediaDescription(getTypeMessage(msg))
      });
      logger.error(Error("ERR_WAPP_DOWNLOAD_MEDIA"));
      return CreateMessageService({ messageData, companyId: companyId });
    }

    // ✅ CORRIGIDO: Para mensagens do bot sem mídia baixada, criar mensagem usando dados do msg
    if (!media) {
      // Se for mensagem do bot e não conseguiu baixar mídia, criar mensagem usando dados do documento
      if (msg.key.fromMe && msg.message?.documentMessage) {
        const docMessage = msg.message.documentMessage;
        let filename = docMessage.fileName || docMessage.title || "documento";

        // ✅ CORRIGIDO: Extrair apenas o nome do arquivo do caminho completo
        // Remove caminho completo e mantém apenas o nome do arquivo
        if (filename.includes("/") || filename.includes("\\")) {
          // Suporta tanto / quanto \ como separadores
          const pathParts = filename.split("/").pop()?.split("\\").pop();
          filename = pathParts || filename;
        }

        const mimetype = docMessage.mimetype || "application/octet-stream";

        logger.info(`[VERIFY MEDIA] Criando mensagem do bot sem download de mídia - filename: ${filename}, mimetype: ${mimetype}`);

        const body = getBodyMessage(msg) || filename;

        const messageData = {
          wid: msg.key.id,
          ticketId: ticket.id,
          contactId: undefined, // Mensagem do bot não tem contactId
          body: body,
          fromMe: true,
          read: true,
          mediaUrl: filename,
          mediaType: getMediaTypeFromMimeType(mimetype),
          quotedMsgId: quotedMsg?.id,
          ack: Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) || 2,
          remoteJid: msg.key.remoteJid,
          participant: msg.key.participant,
          dataJson: JSON.stringify(msg),
          ticketTrakingId: ticketTraking?.id,
          createdAt: new Date(
            Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
          ).toISOString(),
          ticketImported: ticket.imported,
          isForwarded,
          isPrivate
        };

        await ticket.update({
          lastMessage: body || getMediaDescription(getTypeMessage(msg)) || filename
        });

        return CreateMessageService({
          messageData,
          companyId: companyId
        });
      }

      throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
    }

    // if (!media.filename || media.mimetype === "audio/mp4") {
    //   const ext = media.mimetype === "audio/mp4" ? "m4a" : media.mimetype.split("/")[1].split(";")[0];
    //   media.filename = `${new Date().getTime()}.${ext}`;
    // } else {
    //   // ext = tudo depois do ultimo .
    //   const ext = media.filename.split(".").pop();
    //   // name = tudo antes do ultimo .
    //   const name = media.filename.split(".").slice(0, -1).join(".").replace(/\s/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    //   media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
    // }
    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${new Date().getTime()}.${ext}`;
    } else {
      // Preserva o nome original do arquivo, apenas sanitizando caracteres especiais
      const ext = media.filename.split(".").pop();
      const name = media.filename
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/\s/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      // Verifica se já existe um arquivo com o mesmo nome
      const folder = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        `company${companyId}`
      );
      const sanitizedName = `${name.trim()}.${ext}`;

      if (fs.existsSync(path.join(folder, sanitizedName))) {
        // Se já existe um arquivo com o mesmo nome, adiciona timestamp
        media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
      } else {
        // Se não existe, mantém o nome original sanitizado
        media.filename = sanitizedName;
      }
    }

    try {
      const folder = path.resolve(
        __dirname,
        "..",
        "..",
        "..",
        "public",
        `company${companyId}`
      );

      // const folder = `public/company${companyId}`; // Correção adicionada por Altemir 16-08-2023
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true }); // Correção adicionada por Altemir 16-08-2023
        fs.chmodSync(folder, 0o777);
      }

      await fsp.writeFile(
        join(folder, media.filename),
        media.data.toString("base64"),
        "base64"
      ) // Correção adicionada por Altemir 16-08-2023
        .then(() => {
          // console.log("Arquivo salvo com sucesso!");
          if (media.mimetype.includes("audio")) {
            console.log(media.mimetype);
            const inputFile = path.join(folder, media.filename);
            let outputFile: string;

            if (inputFile.endsWith(".mpeg")) {
              outputFile = inputFile.replace(".mpeg", ".mp3");
            } else if (inputFile.endsWith(".ogg")) {
              outputFile = inputFile.replace(".ogg", ".mp3");
            } else {
              // Trate outros formatos de arquivo conforme necessário
              //console.error("Formato de arquivo não suportado:", inputFile);
              return;
            }

            return new Promise<void>((resolve, reject) => {
              ffmpeg(inputFile)
                .toFormat("mp3")
                .save(outputFile)
                .on("end", () => {
                  resolve();
                })
                .on("error", (err: any) => {
                  reject(err);
                });
            });
          }
        });
      // .then(() => {
      //   //console.log("Conversão concluída!");
      //   // Aqui você pode fazer o que desejar com o arquivo MP3 convertido.
      // })
    } catch (err) {
      Sentry.setExtra("Erro media", {
        companyId: companyId,
        ticket,
        contact,
        media,
        quotedMsg
      });
      Sentry.captureException(err);
      logger.error(err);
      console.log(msg);
    }

    const body = getBodyMessage(msg);

    // ✅ CORRIGIDO: Extrair apenas o nome do arquivo do caminho completo
    let mediaFilename = media.filename;
    if (mediaFilename && (mediaFilename.includes("/") || mediaFilename.includes("\\"))) {
      // Suporta tanto / quanto \ como separadores
      const pathParts = mediaFilename.split("/").pop()?.split("\\").pop();
      mediaFilename = pathParts || mediaFilename;
    }

    const messageData = {
      wid: msg.key.id,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: body || mediaFilename,
      fromMe: msg.key.fromMe,
      read: msg.key.fromMe,
      mediaUrl: mediaFilename,
      mediaType: getMediaTypeFromMimeType(media.mimetype),
      quotedMsgId: quotedMsg?.id,
      ack:
        Number(
          String(msg.status).replace("PENDING", "2").replace("NaN", "1")
        ) || 2,
      remoteJid: msg.key.remoteJid,
      participant: msg.key.participant,
      dataJson: JSON.stringify(msg),
      ticketTrakingId: ticketTraking?.id,
      createdAt: new Date(
        Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
      ).toISOString(),
      ticketImported: ticket.imported,
      isForwarded,
      isPrivate
    };

    await ticket.update({
      lastMessage: body || getMediaDescription(getTypeMessage(msg)) || mediaFilename
    });

    const newMessage = await CreateMessageService({
      messageData,
      companyId: companyId
    });

    if (!msg.key.fromMe && ticket.status === "closed") {
      await ticket.update({ status: "pending" });
      await ticket.reload({
        attributes: [
          "id",
          "uuid",
          "queueId",
          "isGroup",
          "channel",
          "status",
          "contactId",
          "useIntegration",
          "lastMessage",
          "updatedAt",
          "unreadMessages",
          "companyId",
          "whatsappId",
          "imported",
          "lgpdAcceptedAt",
          "amountUsedBotQueues",
          "useIntegration",
          "integrationId",
          "userId",
          "amountUsedBotQueuesNPS",
          "lgpdSendMessageAt",
          "isBot"
        ],
        include: [
          { model: Queue, as: "queue" },
          { model: User, as: "user" },
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ]
      });

      io.of(String(companyId))
        // .to("closed")
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticket,
          ticketId: ticket.id
        });
      // console.log("emitiu socket 902", ticket.id)
      io.of(String(companyId))
        // .to(ticket.status)
        //   .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }

    return newMessage;
  } catch (error) {
    console.log(error);
    logger.warn("Erro ao baixar media: ", JSON.stringify(msg));
  }
};

// ========== CORREÇÃO 5: verifyMessage com blindagem final ==========
export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking?: TicketTraking,
  isPrivate?: boolean,
  isForwarded: boolean = false
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const msgType = getTypeMessage(msg);
  const body = getBodyMessage(msg);
  const companyId = ticket.companyId;

  const safeBody =
    body ||
    (msgType === "templateMessage"
      ? "[Template enviado]"
      : getMediaDescription(msgType) || "Mensagem");

  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: safeBody,
    fromMe: msg.key.fromMe,
    mediaType: msgType,
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack:
      Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) ||
      2,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    ticketTrakingId: ticketTraking?.id,
    isPrivate,
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
    isForwarded
  };

  await ticket.update({
    lastMessage: safeBody || getMediaDescription(msgType)
  });

  await CreateMessageService({ messageData, companyId: companyId });

  // Verificar e cancelar Floups se contato enviou mensagem e condições de parada estão ativas
  if (!msg.key.fromMe && contact?.id) {
    try {
      const FloupService = (await import('../../plugins/floup/service')).default;
      await FloupService.verificarECancelarFloupsAoReceberMensagem(
        ticket.id,
        contact.id,
        companyId,
        body
      );
    } catch (floupError) {
      // Log mas não interrompe o fluxo se houver erro na verificação de Floup
      logger.warn(`[FLOUP] Erro ao verificar condições de parada:`, floupError);
    }
  }

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    // io.to("closed").emit(`company-${companyId}-ticket`, {
    //   action: "delete",
    //   ticket,
    //   ticketId: ticket.id
    // });

    if (!ticket.imported) {
      io.of(String(companyId))
        // .to(ticket.status)
        // .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }
  }
};

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;

  try {
    const message = (msg.message as any) || {};
    const nestedMessage =
      message.viewOnceMessage?.message ||
      message.viewOnceMessageV2?.message ||
      message.ephemeralMessage?.message?.viewOnceMessage?.message ||
      message.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
      message.ephemeralMessage?.message ||
      {};

    const hasInteractiveReplyShape = !!(
      message.templateButtonReplyMessage ||
      message.interactiveResponseMessage ||
      message.buttonsResponseMessage ||
      message.listResponseMessage ||
      nestedMessage.templateButtonReplyMessage ||
      nestedMessage.interactiveResponseMessage ||
      nestedMessage.buttonsResponseMessage ||
      nestedMessage.listResponseMessage
    );

    if (hasInteractiveReplyShape) {
      return true;
    }

    const safeRawMessage = (() => {
      try {
        return JSON.stringify(message || {});
      } catch {
        return "";
      }
    })();

    if (
      /templateButtonReplyMessage|interactiveResponseMessage|buttonsResponseMessage|listResponseMessage/i.test(
        safeRawMessage
      )
    ) {
      return true;
    }

    const msgType = getTypeMessage(msg);
    const normalizedMsgType = String(msgType || "")
      .replace(/[^\w]/g, "")
      .trim();
    const normalizedMsgTypeLower = normalizedMsgType.toLowerCase();

    if (!normalizedMsgTypeLower) {
      return false;
    }

    if (
      normalizedMsgTypeLower.includes("templatebuttonreplymessage") ||
      normalizedMsgTypeLower.includes("interactiveresponsemessage") ||
      normalizedMsgTypeLower.includes("buttonsresponsemessage") ||
      normalizedMsgTypeLower.includes("listresponsemessage")
    ) {
      return true;
    }

    const validTypes = new Set([
      "conversation",
      "extendedtextmessage",
      "audiomessage",
      "videomessage",
      "ptvmessage",
      "imagemessage",
      "documentmessage",
      "stickermessage",
      "buttonsresponsemessage",
      "buttonsmessage",
      "messagecontextinfo",
      "locationmessage",
      "livelocationmessage",
      "contactmessage",
      "voicemessage",
      "mediamessage",
      "contactsarraymessage",
      "reactionmessage",
      "ephemeralmessage",
      "protocolmessage",
      "listresponsemessage",
      "listmessage",
      "interactivemessage",
      "pollcreationmessagev3",
      "viewoncemessage",
      "documentwithcaptionmessage",
      "viewoncemessagev2",
      "editedmessage",
      "advertisingmessage",
      "highlystructuredmessage",
      "eventmessage",
      "admetapreview",
      "interactiveresponsemessage",
      "pollupdatemessage",
      "pollcreationmessage",
      "templatemessage",
      "hydratedcontenttext",
      "templatebuttonreplymessage"
    ]);

    const ifType = validTypes.has(normalizedMsgTypeLower);

    if (!ifType) {
      logger.warn(`#### Nao achou o type em isValidMsg: ${normalizedMsgTypeLower}\n${JSON.stringify(msg?.message)}`);
      Sentry.setExtra("Mensagem", {
        BodyMsg: msg.message,
        msg,
        msgType: normalizedMsgType,
        msgTypeLower: normalizedMsgTypeLower,
        msgKeys: Object.keys(message || {})
      });
      Sentry.captureException(new Error("Novo Tipo de Mensagem em isValidMsg"));
    }

    return ifType;
  } catch (error) {
    Sentry.setExtra("Error isValidMsg", { msg });
    Sentry.captureException(error);
    return false;
  }
};

const sendDialogflowAwswer = async (
  wbot: Session,
  ticket: Ticket,
  msg: WAMessage,
  contact: Contact,
  inputAudio: string | undefined,
  companyId: number,
  queueIntegration: QueueIntegrations
) => {
  const session = await createDialogflowSessionWithModel(queueIntegration);

  if (session === undefined) {
    return;
  }

  wbot.presenceSubscribe(contact.remoteJid);
  await delay(500);

  let dialogFlowReply = await queryDialogFlow(
    session,
    queueIntegration.projectName,
    contact.remoteJid,
    getBodyMessage(msg),
    queueIntegration.language,
    inputAudio
  );

  if (!dialogFlowReply) {
    wbot.sendPresenceUpdate("composing", contact.remoteJid);

    const bodyDuvida = formatBody(
      `\u200e *${queueIntegration?.name}:* Não consegui entender sua dúvida.`
    );

    await delay(1000);

    await wbot.sendPresenceUpdate("paused", contact.remoteJid);

    const sentMessage = await wbot.sendMessage(getJidOf(ticket.contact), {
      text: bodyDuvida
    });

    wbot.store(sentMessage);

    await verifyMessage(sentMessage, ticket, contact);
    return;
  }

  if (dialogFlowReply.endConversation) {
    await ticket.update({
      contactId: ticket.contact.id,
      useIntegration: false
    });
  }

  const image = dialogFlowReply.parameters.image?.stringValue ?? undefined;

  const react = dialogFlowReply.parameters.react?.stringValue ?? undefined;

  const audio = dialogFlowReply.encodedAudio.toString("base64") ?? undefined;

  wbot.sendPresenceUpdate("composing", contact.remoteJid);
  await delay(500);

  let lastMessage;

  for (let message of dialogFlowReply.responses) {
    lastMessage = message.text.text[0] ? message.text.text[0] : lastMessage;
  }
  for (let message of dialogFlowReply.responses) {
    if (message.text) {
      await sendDelayedMessages(
        wbot,
        ticket,
        contact,
        message.text.text[0],
        lastMessage,
        audio,
        queueIntegration
      );
    }
  }
};

async function sendDelayedMessages(
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  message: string,
  lastMessage: string,
  audio: string | undefined,
  queueIntegration: QueueIntegrations
) {
  const companyId = ticket.companyId;
  // console.log("GETTING WHATSAPP SEND DELAYED MESSAGES", ticket.whatsappId, wbot.id)
  if (!wbot.id) { logger.warn("[WBOT] wbot.id nulo em sendDelayedMessages, usando ticket.whatsappId"); }
  const whatsapp = await ShowWhatsAppService(wbot.id || ticket.whatsappId, companyId);
  const farewellMessage = whatsapp.farewellMessage.replace(/[_*]/g, "");

  // if (react) {
  //   const test =
  //     /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g.test(
  //       react
  //     );
  //   if (test) {
  //     msg.react(react);
  //     await delay(1000);
  //   }
  // }
  const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, {
    text: `\u200e *${queueIntegration?.name}:* ` + message
  });

  wbot.store(sentMessage);

  await verifyMessage(sentMessage, ticket, contact);
  if (message != lastMessage) {
    await delay(500);
    wbot.sendPresenceUpdate("composing", contact.remoteJid);
  } else if (audio) {
    wbot.sendPresenceUpdate("recording", contact.remoteJid);
    await delay(500);

    // if (audio && message === lastMessage) {
    //   const newMedia = new MessageMedia("audio/ogg", audio);

    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact);
    // }

    // if (sendImage && message === lastMessage) {
    //   const newMedia = await MessageMedia.fromUrl(sendImage, {
    //     unsafeMime: true
    //   });
    //   const sentMessage = await wbot.sendMessage(
    //     `${contact.number}@c.us`,
    //     newMedia,
    //     {
    //       sendAudioAsVoice: true
    //     }
    //   );

    //   await verifyMessage(sentMessage, ticket, contact);
    //   await ticket.update({ lastMessage: "📷 Foto" });
    // }

    if (farewellMessage && message.includes(farewellMessage)) {
      await delay(1000);
      setTimeout(async () => {
        await ticket.update({
          contactId: ticket.contact.id,
          useIntegration: true
        });
        await UpdateTicketService({
          ticketId: ticket.id,
          ticketData: { status: "closed" },
          companyId: companyId
        });
      }, 3000);
    }
  }
}

const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  settings?: any,
  ticketTraking?: TicketTraking
) => {
  const companyId = ticket.companyId;

  // console.log("GETTING WHATSAPP VERIFY QUEUE", ticket.whatsappId, wbot.id)
  const {
    queues,
    greetingMessage,
    maxUseBotQueues,
    timeUseBotQueues,
    complationMessage
  } = await ShowWhatsAppService(wbot.id || ticket.whatsappId, companyId);

  let chatbot = false;

  if (queues.length === 1) {
    chatbot = queues[0]?.chatbots.length > 1;
  }

  const enableQueuePosition = settings.sendQueuePosition === "enabled";

  if (queues.length === 1 && !chatbot) {
    const sendGreetingMessageOneQueues =
      settings.sendGreetingMessageOneQueues === "enabled" || false;

    //inicia integração dialogflow/n8n
    if (!msg.key.fromMe && !ticket.isGroup && queues[0].integrationId) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket
      );

      if (msg.key.fromMe) {
        await ticket.update({
          typebotSessionTime: moment().toDate(),
          useIntegration: true,
          integrationId: integrations.id
        });
      } else {
        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
      }

      // return;
    }

    if (greetingMessage.length > 1 && sendGreetingMessageOneQueues) {
      const body = formatBody(`${greetingMessage}`, ticket);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {
        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);

        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );
          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                getJidOf(ticket),
                { ...optionsMsg }
              );

              wbot.store(sentMessage);

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          await wbot.sendMessage(
            getJidOf(ticket),
            {
              text: body
            }
          );
        }
      } else {
        const sentMessage = await wbot.sendMessage(
          getJidOf(ticket),
          {
            text: body
          }
        );

        wbot.store(sentMessage);
      }
    }

    if (!isNil(queues[0].fileListId)) {
      try {
        const publicFolder = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "public"
        );

        const files = await ShowFileService(
          queues[0].fileListId,
          ticket.companyId
        );

        const folder = path.resolve(
          publicFolder,
          `company${ticket.companyId}`,
          "fileList",
          String(files.id)
        );

        for (const [index, file] of files.options.entries()) {
          const mediaSrc = {
            fieldname: "medias",
            originalname: path.basename(file.path),
            encoding: "7bit",
            mimetype: file.mediaType,
            filename: file.path,
            path: path.resolve(folder, file.path)
          } as Express.Multer.File;

          await SendWhatsAppMedia({
            media: mediaSrc,
            ticket,
            body: file.name,
            isPrivate: false,
            isForwarded: false
          });
        }
      } catch (error) {
        logger.info(error);
      }
    }

    if (queues[0].closeTicket) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          queueId: queues[0].id,
          sendFarewellMessage: false
        },
        ticketId: ticket.id,
        companyId
      });

      return;
    } else {
      await UpdateTicketService({
        ticketData: {
          queueId: queues[0].id,
          status: ticket.status === "lgpd" ? "pending" : ticket.status
        },
        ticketId: ticket.id,
        companyId
      });
    }

    const count = await Ticket.findAndCountAll({
      where: {
        userId: null,
        status: "pending",
        companyId,
        queueId: queues[0].id,
        isGroup: false
      }
    });

    if (enableQueuePosition) {
      // Lógica para enviar posição da fila de atendimento
      const qtd = count.count === 0 ? 1 : count.count;
      const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
      // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
      const bodyFila = formatBody(`${msgFila}`, ticket);
      const debouncedSentMessagePosicao = debounce(
        async () => {
          const sentMessage = await wbot.sendMessage(
            getJidOf(ticket),
            {
              text: bodyFila
            }
          );

          wbot.store(sentMessage);
        },
        3000,
        ticket.id
      );
      debouncedSentMessagePosicao();
    }

    return;
  }

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  let selectedOption = "";

  if (ticket.status !== "lgpd") {
    selectedOption =
      msg?.message?.buttonsResponseMessage?.selectedButtonId ||
      msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
      (() => { try { const irm = (msg.message as any)?.interactiveResponseMessage; if (irm?.nativeFlowResponseMessage?.paramsJson) { const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson); return p?.id || p?.display_text; } return null; } catch { return null; } })() ||
      getBodyMessage(msg);
  } else {
    if (!isNil(ticket.lgpdAcceptedAt))
      await ticket.update({
        status: "pending"
      });

    await ticket.reload();
  }

  if (String(selectedOption).toLocaleLowerCase() === "sair") {
    // Enviar mensagem de conclusão antes de fechar para aparecer no frontend
    if (complationMessage) {
      await SendWhatsAppMessage({ body: complationMessage, ticket });
    }

    // Fechar ticket via serviço central para emitir sockets adequadamente
    await UpdateTicketService({
      ticketData: {
        isBot: false,
        status: "closed",
        // já enviamos a farewell acima
        sendFarewellMessage: false,
        amountUsedBotQueues: 0
      },
      ticketId: ticket.id,
      companyId
    });

    await ticketTraking.update({
      userId: ticket.userId,
      closedAt: moment().toDate(),
      finishedAt: moment().toDate()
    });

    await CreateLogTicketService({
      ticketId: ticket.id,
      type: "clientClosed",
      queueId: ticket.queueId
    });

    return;
  }

  let choosenQueue =
    chatbot && queues.length === 1
      ? queues[+selectedOption]
      : queues[+selectedOption - 1];

  const typeBot = settings?.chatBotType || "text";

  // Serviço p/ escolher consultor aleatório para o ticket, ao selecionar fila.
  let randomUserId;

  if (choosenQueue) {
    try {
      const userQueue = await ListUserQueueServices(choosenQueue.id);
      console.log("userQueue", userQueue.userId);
      if (userQueue.userId > -1) {
        randomUserId = userQueue.userId;
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Ativar ou desativar opção de escolher consultor aleatório.
  /*   let settings = await CompaniesSettings.findOne({
      where: {
        companyId: companyId
      }
    }); */

  const botText = async () => {
    if (choosenQueue || (queues.length === 1 && chatbot)) {
      // console.log("entrou no choose", ticket.isOutOfHour, ticketTraking.chatbotAt)
      if (queues.length === 1) choosenQueue = queues[0];
      const queue = await Queue.findByPk(choosenQueue.id);

      if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
        await ticketTraking.update({
          chatbotAt: null
        });
        await ticket.update({
          amountUsedBotQueues: 0
        });
      }

      let currentSchedule;

      if (settings?.scheduleType === "queue") {
        currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
      }

      if (
        settings?.scheduleType === "queue" &&
        ticket.status !== "open" &&
        !isNil(currentSchedule) &&
        (ticket.amountUsedBotQueues < maxUseBotQueues ||
          maxUseBotQueues === 0) &&
        (!currentSchedule || currentSchedule.inActivity === false) &&
        (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
      ) {
        if (timeUseBotQueues !== "0") {
          //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
          //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
          let dataLimite = new Date();
          let Agora = new Date();

          if (ticketTraking.chatbotAt !== null) {
            dataLimite.setMinutes(
              ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
            );

            if (
              ticketTraking.chatbotAt !== null &&
              Agora < dataLimite &&
              timeUseBotQueues !== "0" &&
              ticket.amountUsedBotQueues !== 0
            ) {
              return;
            }
          }
          await ticketTraking.update({
            chatbotAt: null
          });
        }

        const outOfHoursMessage = queue.outOfHoursMessage;

        if (outOfHoursMessage !== "") {
          // console.log("entrei3");
          const body = formatBody(`${outOfHoursMessage}`, ticket);

          const debouncedSentMessage = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(
                getJidOf(ticket),
                {
                  text: body
                }
              );

              wbot.store(sentMessage);
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          // await ticket.update({
          //   queueId: queue.id,
          //   isOutOfHour: true,
          //   amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          // });

          // return;
        }
        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
        await ticket.update({
          queueId: queue.id,
          isOutOfHour: true,
          amountUsedBotQueues: ticket.amountUsedBotQueues + 1
        });
        return;
      }

      await UpdateTicketService({
        ticketData: { amountUsedBotQueues: 0, queueId: choosenQueue.id },
        // ticketData: { queueId: queues.length ===1 ? null : choosenQueue.id },
        ticketId: ticket.id,
        companyId
      });
      // }

      if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
        let options = "";
        choosenQueue.chatbots.forEach((chatbot, index) => {
          options += `*[ ${index + 1} ]* - ${chatbot.name}\n`;
        });

        const body = formatBody(
          `\u200e ${choosenQueue.greetingMessage}\n\n${options}\n*[ # ]* Voltar para o menu principal\n*[ Sair ]* Encerrar atendimento`,
          ticket
        );

        const sentMessage = await wbot.sendMessage(
          getJidOf(ticket),

          {
            text: body
          }
        );

        wbot.store(sentMessage);

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);

      }

      // Atribuir usuário imediatamente se randomização imediata estiver ativada
      if ((queue?.randomizeImmediate) || (settings?.settingsUserRandom === "enabled") && randomUserId) {
        await UpdateTicketService({
          ticketData: { userId: randomUserId },
          ticketId: ticket.id,
          companyId
        });
        console.log(`[IMMEDIATE RANDOMIZATION] Ticket ${ticket.id} atribuído imediatamente para usuário ${randomUserId}`);
      }

      if (
        !choosenQueue.chatbots.length &&
        choosenQueue.greetingMessage.length !== 0
      ) {
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket
        );
        const sentMessage = await wbot.sendMessage(
          getJidOf(ticket),
          {
            text: body
          }
        );

        wbot.store(sentMessage);

        await verifyMessage(sentMessage, ticket, contact, ticketTraking);
      }

      //inicia integração dialogflow/n8n/typebot
      if (!msg.key.fromMe && !ticket.isGroup && choosenQueue?.integrationId) {
        const integrations = await ShowQueueIntegrationService(
          choosenQueue.integrationId,
          companyId
        );

        await handleMessageIntegration(
          msg,
          wbot,
          companyId,
          integrations,
          ticket
        );

        if (msg.key.fromMe) {
          await ticket.update({
            typebotSessionTime: moment().toDate(),
            useIntegration: true,
            integrationId: choosenQueue.integrationId
          });
        } else {
          await ticket.update({
            useIntegration: true,
            integrationId: choosenQueue.integrationId
          });
        }
      }

      if (!isNil(choosenQueue.fileListId)) {
        try {
          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.fileListId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: path.basename(file.path),
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            // const debouncedSentMessagePosicao = debounce(
            //   async () => {
            const sentMessage = await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: `\u200e ${file.name}`,
              isPrivate: false,
              isForwarded: false
            });

            await verifyMediaMessage(
              sentMessage,
              ticket,
              ticket.contact,
              ticketTraking,
              false,
              false,
              wbot
            );
            //   },
            //   2000,
            //   ticket.id
            // );
            // debouncedSentMessagePosicao();
          }
        } catch (error) {
          logger.info(error);
        }
      }

      await delay(4000);

      //se fila está parametrizada para encerrar ticket automaticamente
      if (choosenQueue.closeTicket) {
        try {
          await UpdateTicketService({
            ticketData: {
              status: "closed",
              queueId: choosenQueue.id,
              sendFarewellMessage: false
            },
            ticketId: ticket.id,
            companyId
          });
        } catch (error) {
          logger.info(error);
        }

        return;
      }

      const count = await Ticket.findAndCountAll({
        where: {
          userId: null,
          status: "pending",
          companyId,
          queueId: choosenQueue.id,
          whatsappId: wbot.id,
          isGroup: false
        }
      });

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: choosenQueue.id
      });

      if (enableQueuePosition && !choosenQueue.chatbots.length) {
        // Lógica para enviar posição da fila de atendimento
        const qtd = count.count === 0 ? 1 : count.count;
        const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;
        // const msgFila = `*Assistente Virtual:*\n{{ms}} *{{name}}*, sua posição na fila de atendimento é: *${qtd}*`;
        const bodyFila = formatBody(`${msgFila}`, ticket);
        const debouncedSentMessagePosicao = debounce(
          async () => {
            const sentMessage = await wbot.sendMessage(
              getJidOf(ticket),
              {
                text: bodyFila
              }
            );

            wbot.store(sentMessage);
          },
          3000,
          ticket.id
        );
        debouncedSentMessagePosicao();
      }
    } else {
      if (ticket.isGroup) return;

      if (
        maxUseBotQueues &&
        maxUseBotQueues !== 0 &&
        ticket.amountUsedBotQueues >= maxUseBotQueues
      ) {
        // await UpdateTicketService({
        //   ticketData: { queueId: queues[0].id },
        //   ticketId: ticket.id
        // });

        return;
      }

      if (timeUseBotQueues !== "0") {
        //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
        //const ticketTraking = await FindOrCreateATicketTrakingService({ ticketId: ticket.id, companyId });
        let dataLimite = new Date();
        let Agora = new Date();

        if (ticketTraking.chatbotAt !== null) {
          dataLimite.setMinutes(
            ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
          );

          if (
            ticketTraking.chatbotAt !== null &&
            Agora < dataLimite &&
            timeUseBotQueues !== "0" &&
            ticket.amountUsedBotQueues !== 0
          ) {
            return;
          }
        }
        await ticketTraking.update({
          chatbotAt: null
        });
      }

      // if (wbot.waitForSocketOpen()) {
      //   console.log("AGUARDANDO")
      //   console.log(wbot.waitForSocketOpen())
      // }

      wbot.presenceSubscribe(contact.remoteJid);

      let options = "";

      wbot.sendPresenceUpdate("composing", contact.remoteJid);

      queues.forEach((queue, index) => {
        options += `*[ ${index + 1} ]* - ${queue.name}\n`;
      });
      options += `\n*[ Sair ]* - Encerrar atendimento`;

      const body = formatBody(`\u200e${greetingMessage}\n\n${options}`, ticket);

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "chatBot"
      });

      await delay(1000);

      await wbot.sendPresenceUpdate("paused", contact.remoteJid);

      if (ticket.whatsapp.greetingMediaAttachment !== null) {
        const filePath = path.resolve(
          "public",
          `company${companyId}`,
          ticket.whatsapp.greetingMediaAttachment
        );

        const fileExists = fs.existsSync(filePath);
        // console.log(fileExists);
        if (fileExists) {
          const messagePath = ticket.whatsapp.greetingMediaAttachment;
          const optionsMsg = await getMessageOptions(
            messagePath,
            filePath,
            String(companyId),
            body
          );

          const debouncedSentgreetingMediaAttachment = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                { ...optionsMsg }
              );

              wbot.store(sentMessage);

              await verifyMediaMessage(
                sentMessage,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            },
            1000,
            ticket.id
          );
          debouncedSentgreetingMediaAttachment();
        } else {
          const debouncedSentMessage = debounce(
            async () => {
              const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                {
                  text: body
                }
              );

              wbot.store(sentMessage);

              await verifyMessage(sentMessage, ticket, contact, ticketTraking);
            },
            1000,
            ticket.id
          );
          debouncedSentMessage();
        }
        await UpdateTicketService({
          ticketData: { amountUsedBotQueues: ticket.amountUsedBotQueues + 1 },
          ticketId: ticket.id,
          companyId
        });

        return;
      } else {
        const debouncedSentMessage = debounce(
          async () => {
            const sentMessage = await wbot.sendMessage(
              getJidOf(ticket),
              {
                text: body
              }
            );

            wbot.store(sentMessage);

            await verifyMessage(sentMessage, ticket, contact, ticketTraking);
          },
          1000,
          ticket.id
        );

        await UpdateTicketService({
          ticketData: { amountUsedBotQueues: ticket.amountUsedBotQueues + 1 },
          ticketId: ticket.id,
          companyId
        });

        debouncedSentMessage();
      }
    }
  };

  if (typeBot === "text") {
    return botText();
  }

  if (typeBot === "button" && queues.length > 3) {
    return botText();
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.closedAt !== null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt === null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();
  const companyId = ticket.companyId;

  // console.log("GETTING WHATSAPP HANDLE RATING", ticket.whatsappId, ticket.id)
  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,

    companyId
  );

  let finalRate = rate;

  if (rate < 0) {
    finalRate = 0;
  }
  if (rate > 10) {
    finalRate = 10;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (
    !isNil(complationMessage) &&
    complationMessage !== "" &&
    !ticket.isGroup
  ) {
    const body = formatBody(`\u200e${complationMessage}`, ticket);
    if (ticket.channel === "whatsapp") {
      const msg = await SendWhatsAppMessage({ body, ticket });

      await verifyMessage(msg, ticket, ticket.contact, ticketTraking);
    }

    if (["facebook", "instagram"].includes(ticket.channel)) {
      await sendFacebookMessage({ body, ticket });
    }
  }

  await ticket.update({
    isBot: false,
    status: "closed",
    amountUsedBotQueuesNPS: 0
  });

  //loga fim de atendimento
  await CreateLogTicketService({
    userId: ticket.userId,
    queueId: ticket.queueId,
    ticketId: ticket.id,
    type: "closed"
  });

  io.of(String(companyId))
    // .to("open")
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.of(String(companyId))
    // .to(ticket.status)
    // .to(ticket.id.toString())
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

const formatDateTimeBrasilia = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const partValue = (type: string) =>
    parts.find(part => part.type === type)?.value || "";

  const weekday = partValue("weekday");
  const day = partValue("day");
  const month = partValue("month");
  const year = partValue("year");
  const hour = partValue("hour");
  const minute = partValue("minute");
  const second = partValue("second");

  return `${weekday}, ${day}/${month}/${year} ${hour}:${minute}:${second}`;
};

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const convertTextToSpeechAndSaveToFile = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  audioToFormat: string = "mp3"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    );
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        if (result) {
          convertWavToAnotherFormat(
            `${filename}.wav`,
            `${filename}.${audioToFormat}`,
            audioToFormat
          )
            .then(output => {
              resolve();
            })
            .catch(error => {
              console.error(error);
              reject(error);
            });
        } else {
          reject(new Error("No result from synthesizer"));
        }
        synthesizer.close();
      },
      error => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

const convertWavToAnotherFormat = (
  inputPath: string,
  outputPath: string,
  toFormat: string
) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .toFormat(toFormat)
      .on("end", () => resolve(outputPath))
      .on("error", (err: { message: any }) =>
        reject(new Error(`Error converting file: ${err.message}`))
      )
      .save(outputPath);
  });
};

export const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g, "");
};

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: queueId },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

const matchesAnyPhrase = (
  campaignPhrases: PhraseCondition[],
  messageBody: string
): boolean => {
  if (
    !campaignPhrases ||
    !Array.isArray(campaignPhrases) ||
    campaignPhrases.length === 0
  ) {
    return false;
  }

  if (!messageBody || typeof messageBody !== "string") {
    return false;
  }

  const bodyLower = messageBody.toLowerCase().trim();

  return campaignPhrases.some((condition: PhraseCondition) => {
    if (!condition.text || typeof condition.text !== "string") {
      return false;
    }

    const phraseLower = condition.text.toLowerCase().trim();

    if (condition.type === "exact") {
      return bodyLower === phraseLower;
    } else if (condition.type === "partial") {
      return bodyLower.includes(phraseLower);
    }

    return false;
  });
};

/**
 * Normaliza frases de campanha para garantir backward compatibility
 */
const normalizeCampaignPhrases = (phrase: any): PhraseCondition[] => {
  if (!phrase) return [];

  if (Array.isArray(phrase)) {
    return phrase.filter(item => item && item.text);
  }

  if (typeof phrase === "string") {
    try {
      const parsed = JSON.parse(phrase);

      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && item.text);
      }

      if (typeof parsed === "string") {
        return [{ text: parsed, type: "exact" }];
      }
    } catch {
      return [{ text: phrase, type: "exact" }];
    }
  }

  return [];
};

/**
 * Encontra uma campanha que faça match com a mensagem
 */
const findMatchingCampaign = (
  campaigns: CampaignPhrase[],
  messageBody: string
): CampaignPhrase | null => {
  if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
    return null;
  }

  if (!messageBody || typeof messageBody !== "string") {
    return null;
  }

  return (
    campaigns.find((campaign: CampaignPhrase) => {
      if (!campaign.status) {
        return false;
      }

      const phrases = normalizeCampaignPhrases(campaign.phrase);
      const hasMatch = matchesAnyPhrase(phrases, messageBody);

      if (hasMatch) {
        console.log(
          `[CAMPANHA MATCH] ID: ${campaign.id}, Mensagem: "${messageBody}", Frases:`,
          phrases
        );
      }

      return hasMatch;
    }) || null
  );
};

const buildFlowbuilderTypebotPayload = (ticket: Ticket) => {
  const dataWebhook: any = ticket.dataWebhook || {};
  const saved = dataWebhook?.typebot || dataWebhook?.settings || {};

  const baseUrl = String(
    saved.typebotUrl ||
    saved.typebot ||
    saved.urlBase ||
    "https://typebot.io"
  )
    .trim()
    .replace(/\/+$/, "");

  const slug = String(
    saved.typebotSlug ||
    saved.botSlug ||
    ""
  )
    .trim()
    .replace(/^\/+/, "");

  const finalUrl =
    String(saved.fullUrl || saved.url || "").trim() ||
    (slug ? `${baseUrl}/${slug}` : baseUrl);

  return {
    type: "typebot",
    name: saved.name || "TypeBot",
    slug: saved.slug || "Novo Typebot",

    url: finalUrl,
    fullUrl: finalUrl,

    typebot: baseUrl,
    typebotUrl: baseUrl,
    urlBase: baseUrl,

    typebotSlug: slug,
    botSlug: slug,

    typebotId: saved.typebotId || saved.botId || "",
    botId: saved.botId || saved.typebotId || "",

    expireMinutes: Number(
      saved.expireMinutes ?? saved.sessionExpiryMinutes ?? 60
    ) || 60,
    sessionExpiryMinutes: Number(
      saved.sessionExpiryMinutes ?? saved.expireMinutes ?? 60
    ) || 60,

    messageInterval: Number(
      saved.messageInterval ?? saved.messageDelay ?? 1000
    ) || 1000,
    messageDelay: Number(
      saved.messageDelay ?? saved.messageInterval ?? 1000
    ) || 1000,

    keywordFinish: saved.keywordFinish || saved.finishKeyword || "#",
    finishKeyword: saved.finishKeyword || saved.keywordFinish || "#",

    keywordRestart: saved.keywordRestart || saved.restartKeyword || "00",
    restartKeyword: saved.restartKeyword || saved.keywordRestart || "00",

    invalidOptionMessage:
      saved.invalidOptionMessage ||
      saved.unknownMessage ||
      "Opção inválida, por favor envie #",

    unknownMessage:
      saved.unknownMessage ||
      saved.invalidOptionMessage ||
      "Opção inválida, por favor envie #",

    restartMessage: saved.restartMessage || "Vamos começar novamente?",
    waitForResponse: Boolean(saved.waitForResponse),
    variableName: saved.variableName || ""
  };
};

const normalizeCampaignWhatsappIds = (value: any): number[] => {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  let items: any[] = [];

  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = trimmed
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }
  } else {
    items = [value];
  }

  return [...new Set(
    items
      .map(item => {
        if (item && typeof item === "object") {
          return Number(item.id ?? item.whatsappId ?? item.value);
        }

        return Number(item);
      })
      .filter((id: number) => Number.isInteger(id) && id > 0)
  )];
};

const extractCampaignWhatsappIds = (campaign: any): number[] => {
  const ids = [
    ...normalizeCampaignWhatsappIds(campaign?.whatsappIds),
    ...normalizeCampaignWhatsappIds(campaign?.whatsappId),
    ...normalizeCampaignWhatsappIds(campaign?.dataValues?.whatsappIds),
    ...normalizeCampaignWhatsappIds(campaign?.dataValues?.whatsappId),
    ...normalizeCampaignWhatsappIds(campaign?.whatsapps),
    ...normalizeCampaignWhatsappIds(campaign?.dataValues?.whatsapps),
    ...normalizeCampaignWhatsappIds(campaign?.whatsapp),
    ...normalizeCampaignWhatsappIds(campaign?.dataValues?.whatsapp)
  ];

  return [...new Set(ids)];
};

const campaignAppliesToWhatsapp = (
  campaign: any,
  whatsappId: number
): boolean => {
  const ids = extractCampaignWhatsappIds(campaign);

  console.log(
    `[CAMPANHAS][DEBUG] campanha=${campaign?.id} nome="${campaign?.name}" idsExtraidos=${JSON.stringify(ids)} whatsappAtual=${whatsappId}`
  );

  // Se não conseguiu extrair ids, deixa passar para o matchesMessage decidir.
  if (ids.length === 0) {
    console.log(
      `[CAMPANHAS][DEBUG] Campanha ${campaign?.id} sem ids explícitos de conexão - usando fallback`
    );
    return true;
  }

  return ids.includes(Number(whatsappId));
};

export const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo | null,
  wbot: Session | null,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const io = getIO();

  // Extrai resposta interativa (nativeFlow/buttons/list) com prioridade sobre getBodyMessage
  const extractInteractiveResponse = (m: any): string | null => {
    if (!m?.message) return null;

    try {
      // 1) nativeFlowResponseMessage (listas e botões via nativeFlow)
      const irm = m.message?.interactiveResponseMessage;
      if (irm?.nativeFlowResponseMessage?.paramsJson) {
        const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson);
        const val = p?.id || p?.display_text;

        if (val) {
          logger.info(
            `[FLOW-INTERACTIVE] Resposta nativeFlow extraída: "${val}" (paramsJson: ${irm.nativeFlowResponseMessage.paramsJson})`
          );
          return String(val);
        }
      }

      // 2) buttonsResponseMessage (botões legados)
      if (m.message?.buttonsResponseMessage?.selectedButtonId) {
        return String(m.message.buttonsResponseMessage.selectedButtonId);
      }

      // 3) listResponseMessage (listas legadas)
      if (m.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return String(
          m.message.listResponseMessage.singleSelectReply.selectedRowId
        );
      }

      // 4) templateButtonReplyMessage
      const tbrm = m.message?.templateButtonReplyMessage;
      if (tbrm) {
        const val = tbrm.selectedDisplayText || tbrm.selectedId;
        if (val) {
          logger.info(
            `[FLOW-INTERACTIVE] Resposta templateButtonReply extraída: "${val}" (id: ${tbrm.selectedId})`
          );
          return String(val);
        }
      }
    } catch (e) {
      // fallback para getBodyMessage
    }

    return null;
  };

  const body = msg
    ? extractInteractiveResponse(msg) || getBodyMessage(msg)
    : ticket.lastMessage || "";

  logger.info(
    `[RDS-FLOW-DEBUG] flowbuilderIntegration iniciado para ticket ${ticket.id}`
  );
  logger.info(
    `[RDS-FLOW-DEBUG] Parâmetros: queueIntegration.type=${queueIntegration?.type}, flowWebhook=${ticket.flowWebhook}, lastFlowId=${ticket.lastFlowId}`
  );
  logger.info(`[RDS-FLOW-DEBUG] Mensagem: ${body}`);

  // ✅ PRIORIDADE 1: VERIFICAR MODO IA PERMANENTE (MESMO SEM INTEGRATIONID)
  if (
    !msg?.key?.fromMe &&
    ticket.useIntegration &&
    ticket.status !== "open" &&
    ticket.isBot !== false
  ) {
    const dataWebhook = ticket.dataWebhook as any;
    const isAIMode =
      dataWebhook?.type === "openai" || dataWebhook?.type === "gemini";

    if (isAIMode && dataWebhook?.settings) {
      logger.info(
        `[AI MODE] Processando mensagem em modo ${dataWebhook.type} - ticket ${ticket.id}`
      );

      try {
        const aiSettings = {
          ...dataWebhook.settings,
          provider: dataWebhook.type
        };

        if (dataWebhook.awaitingUserResponse) {
          logger.info(
            `[AI SERVICE] Primeira resposta do usuário para ${dataWebhook.type} - iniciando conversa - ticket ${ticket.id}`
          );

          await ticket.update({
            dataWebhook: {
              ...dataWebhook,
              awaitingUserResponse: false
            }
          });
        }

        await handleOpenAiFlow(
          aiSettings,
          msg,
          wbot,
          ticket,
          contact,
          null,
          null
        );

        return true;
      } catch (error) {
        logger.error("[AI MODE] Erro ao processar modo IA:", error);

        try {
          await ticket.update({
            useIntegration: false,
            isBot: false,
            dataWebhook: null,
            flowWebhook: false,
            lastFlowId: null,
            hashFlowId: null,
            flowStopped: null
          });

          const errorMessage =
            "Desculpe, o serviço de IA está temporariamente indisponível. Por favor, tente novamente mais tarde.";

          if (wbot && msg?.key?.remoteJid) {
            await wbot.sendMessage(msg.key.remoteJid, {
              text: errorMessage
            });
          }
        } catch (cleanupError) {
          logger.error(
            "[AI MODE] Erro ao limpar estado após falha da IA:",
            cleanupError
          );
        }

        return false;
      }
    }
  }

  // ✅ PRIORIDADE 1.5: TYPEBOT DO FLOWBUILDER
  if (
    !msg?.key?.fromMe &&
    ticket.useIntegration &&
    ticket.status !== "open" &&
    ticket.isBot !== false
  ) {
    const dataWebhook: any = ticket.dataWebhook || {};
    const isTypebotMode = dataWebhook?.type === "typebot";

    if (isTypebotMode) {
      logger.info(
        `[FLOW TYPEBOT] Processando mensagem em modo Typebot - ticket ${ticket.id}`
      );

      try {
        const flowContinuation = dataWebhook?.flowContinuation || {};
        const nextNodeId = flowContinuation?.nextNodeId || null;
        const flowIdToResume =
          flowContinuation?.flowId ||
          ticket.flowStopped ||
          null;
        const originalDataWebhook =
          flowContinuation?.originalDataWebhook ?? null;

        const typebotPayload = buildFlowbuilderTypebotPayload(ticket);

        await typebotListener({
          ticket,
          msg,
          wbot,
          typebot: typebotPayload as any
        });

        await ticket.reload();

        const refreshedDataWebhook: any = ticket.dataWebhook || {};
        const stillInTypebot =
          ticket.useIntegration &&
          refreshedDataWebhook?.type === "typebot";

        logger.info(
          `[FLOW TYPEBOT] stillInTypebot=${stillInTypebot} | nextNodeId=${nextNodeId || "nenhum"} | flowIdToResume=${flowIdToResume || "nenhum"}`
        );

        // ✅ Se o listener encerrou o Typebot, retoma o FlowBuilder
        if (!stillInTypebot && nextNodeId && flowIdToResume) {
          const flow = await FlowBuilderModel.findOne({
            where: {
              id: flowIdToResume,
              company_id: companyId,
              active: true
            }
          });

          if (flow) {
            const nodes: INodes[] = flow.flow["nodes"];
            const connections: IConnections[] = flow.flow["connections"];

            const mountDataContact = {
              number: contact.number,
              name: contact.name,
              email: contact.email
            };

            logger.info(
              `[FLOW TYPEBOT] Retomando fluxo ${flowIdToResume} no nó ${nextNodeId} para ticket ${ticket.id}`
            );

            await ActionsWebhookService(
              wbot?.id || ticket.whatsappId,
              Number(flowIdToResume),
              ticket.companyId,
              nodes,
              connections,
              nextNodeId,
              originalDataWebhook,
              "",
              ticket.hashFlowId || "",
              undefined,
              ticket.id,
              mountDataContact,
              false,
              msg
            );
          } else {
            logger.warn(
              `[FLOW TYPEBOT] Fluxo ${flowIdToResume} não encontrado ao tentar retomar ticket ${ticket.id}`
            );
          }
        }

        return true;
      } catch (error) {
        logger.error("[FLOW TYPEBOT] Erro ao processar modo Typebot:", error);

        try {
          await ticket.update({
            useIntegration: false,
            isBot: false,
            dataWebhook: null,
            flowWebhook: false,
            lastFlowId: null,
            hashFlowId: null,
            flowStopped: null
          });
        } catch (cleanupError) {
          logger.error(
            "[FLOW TYPEBOT] Erro ao limpar estado após falha:",
            cleanupError
          );
        }

        return false;
      }
    }
  }

  // ✅ PRIORIDADE 2: Se o fluxo está parado aguardando resposta do usuário, continuar IMEDIATAMENTE
  // Esta é a verificação ÚNICA e CORRETA para fluxos interrompidos
  if (ticket.flowStopped && ticket.lastFlowId && msg && !msg.key.fromMe) {
    logger.info(
      `[FLOW STOPPED] Ticket ${ticket.id} tem fluxo parado (flowStopped=${ticket.flowStopped}, lastFlowId=${ticket.lastFlowId}) - continuando IMEDIATAMENTE`
    );

    try {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped,
          company_id: companyId,
          active: true
        }
      });

      if (!flow) {
        logger.warn(
          `[FLOW STOPPED] Fluxo ${ticket.flowStopped} inativo - limpando ticket ${ticket.id}`
        );

        await ticket.update({
          flowStopped: null,
          lastFlowId: null,
          flowWebhook: false,
          hashFlowId: null,
          dataWebhook: null
        });

        return false;
      }

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      logger.info(
        `[FLOW STOPPED] Chamando ActionsWebhookService com pressKey: "${body}"`
      );

      await ActionsWebhookService(
        wbot?.id || ticket.whatsappId,
        Number(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact
      );

      logger.info("[FLOW STOPPED] ✅ Fluxo continuado com sucesso!");
      return true;
    } catch (error) {
      logger.error("[FLOW STOPPED] ❌ Erro ao continuar fluxo:", error);

      await ticket.update({
        flowStopped: null,
        lastFlowId: null,
        flowWebhook: false,
        hashFlowId: null,
        dataWebhook: null
      });

      return false;
    }
  }

  // Se chegou aqui, o ticket não tem fluxo interrompido aguardando resposta do usuário
  if (
    ticket.flowWebhook &&
    ticket.lastFlowId &&
    !ticket.flowStopped &&
    msg &&
    !msg.key.fromMe
  ) {
    logger.info(
      `[FLOW RUNNING] ⚠️ Ticket ${ticket.id} está executando fluxo (flowWebhook=true, lastFlowId=${ticket.lastFlowId}) - IGNORANDO mensagem do usuário durante execução`
    );
    return false;
  }

  // Só processar se não for mensagem minha (exceto quando msg é null = verificação pós-fluxo)
  // if (msg && msg.key.fromMe) {
  //   logger.info(`[RDS-FLOW-DEBUG] Mensagem é fromMe, ignorando fluxo para ticket ${ticket.id}`);
  //   return false;
  // }

  if (msg && msg.messageStubType) {
    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] FlowBuilder - Ignorando evento de grupo: ${msg.messageStubType}`
      );
    }
    return false;
  }

  // ✅ ADICIONAR CACHE/CONTROLE PARA EVITAR EXECUÇÃO REPETIDA
  const messageId = msg?.key?.id;
  const cacheKey = `campaign_check_${ticket.id}_${messageId || "manual"}`;

  if (messageId && (await cacheLayer.get(cacheKey))) {
    console.log(
      `[CAMPANHAS] Mensagem ${messageId} já processada para campanhas no ticket ${ticket.id}`
    );
    return false;
  }

  if (msg && !msg.key.fromMe && ticket.status === "closed") {
    console.log(`[FLOW INTEGRATION] Reabrindo ticket fechado ${ticket.id}`);

    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    await UpdateTicketService({
      ticketData: { status: "pending", integrationId: ticket.integrationId },
      ticketId: ticket.id,
      companyId
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
  }

  const whatsapp = await ShowWhatsAppService(
    wbot?.id || ticket.whatsappId,
    companyId
  );

  console.log(
    `[FLOW-DEBUG] Configurações de fluxo - flowIdNotPhrase: ${whatsapp.flowIdNotPhrase}, flowIdWelcome: ${whatsapp.flowIdWelcome}`
  );

  // *** PRIORIDADE MÁXIMA: CAMPANHAS SEMPRE SÃO VERIFICADAS PRIMEIRO ***
  console.log(
    `[CAMPANHAS] Verificando campanhas para: "${body}" na conexão ${whatsapp.id} (${whatsapp.name})`
  );

  try {
    const activeCampaigns = await FlowCampaignModel.findAll({
      where: {
        companyId: ticket.companyId,
        status: true
      }
    });

    console.log(
      `[CAMPANHAS] ${activeCampaigns.length} campanhas ativas encontradas`
    );

    const campaignsForThisWhatsapp = activeCampaigns.filter(campaign => {
      try {
        const includes = campaignAppliesToWhatsapp(
          campaign,
          Number(whatsapp.id)
        );

        if (includes) {
          console.log(
            `[CAMPANHAS] Campanha "${campaign.name}" (ID: ${campaign.id}) inclui conexão ${whatsapp.id}`
          );
        }

        return includes;
      } catch (error) {
        console.error(
          `[CAMPANHAS] Erro ao verificar campanha ${campaign.id}:`,
          error
        );
        return false;
      }
    });

    console.log(
      `[CAMPANHAS] ${campaignsForThisWhatsapp.length} campanhas aplicáveis para conexão ${whatsapp.id}`
    );

    let contactTagIds: number[] = [];
    try {
      const contactTags = await ContactTag.findAll({
        where: { contactId: contact.id }
      });
      contactTagIds = contactTags.map(ct => ct.tagId);
    } catch (err) {
      console.error("[CAMPANHAS] Erro ao buscar tags do contato:", err);
    }

    const matchingCampaign = campaignsForThisWhatsapp.find(campaign => {
      try {
        if (!campaign.status) {
          return false;
        }

        if (!campaign.matchesContactTags(contactTagIds)) {
          return false;
        }

        const matches = campaign.matchesMessage(body, whatsapp.id);

        if (matches) {
          console.log(
            `[CAMPANHAS] ✅ MATCH encontrado! Campanha "${campaign.name}" (ID: ${campaign.id}) para mensagem: "${body}"`
          );
        }

        return matches;
      } catch (error) {
        console.error(
          `[CAMPANHAS] Erro ao verificar match da campanha ${campaign.id}:`,
          error
        );
        return false;
      }
    });

    if (matchingCampaign) {
      console.log(
        `[CAMPANHAS] 🚀 EXECUTANDO FLUXO! Campanha: ${matchingCampaign.name} (ID: ${matchingCampaign.id}) | Fluxo: ${matchingCampaign.flowId} | Conexão: ${whatsapp.id} | Ticket: ${ticket.id}`
      );

      if (messageId) {
        await cacheLayer.set(cacheKey, "1", "EX", 300);
      }

      if (msg && ticket.flowWebhook && ticket.lastFlowId) {
        console.log(
          `[CAMPANHAS] ⚠️ Ticket ${ticket.id} já em fluxo ativo (lastFlowId: ${ticket.lastFlowId}), aguardando...`
        );
        return false;
      }

      console.log(
        `[CAMPANHAS] 🧹 Limpando fluxo anterior do ticket ${ticket.id}`
      );

      await ticket.update({
        flowWebhook: true,
        flowStopped: null,
        lastFlowId: null,
        hashFlowId: null,
        dataWebhook: null,
        isBot: true,
        status: "pending"
      });

      await ticket.reload();

      const flow = await FlowBuilderModel.findOne({
        where: {
          id: matchingCampaign.flowId,
          company_id: companyId,
          active: true
        }
      });

      if (!flow) {
        console.error(
          `[CAMPANHAS] ❌ Fluxo ${matchingCampaign.flowId} não encontrado para empresa ${companyId}`
        );

        await ticket.update({
          flowWebhook: false,
          isBot: false
        });

        return false;
      }

      console.log(
        `[CAMPANHAS] ✅ Fluxo encontrado: ${flow.name} (ID: ${flow.id})`
      );

      try {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];

        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
          console.error(`[CAMPANHAS] ❌ Fluxo ${flow.id} não possui nós válidos`);

          await ticket.update({
            flowWebhook: false,
            isBot: false
          });

          return false;
        }

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        console.log(
          `[CAMPANHAS] 🎯 Iniciando execução do fluxo com dados do contato:`,
          mountDataContact
        );

        await ActionsWebhookService(
          whatsapp.id,
          matchingCampaign.flowId,
          ticket.companyId,
          nodes,
          connections,
          flow.flow["nodes"][0].id,
          null,
          "",
          "",
          null,
          ticket.id,
          mountDataContact
        );

        console.log(
          `[CAMPANHAS] ✅ SUCESSO! Campanha ${matchingCampaign.id} executada com sucesso na conexão ${whatsapp.id}!`
        );

        return true;
      } catch (executionError) {
        console.error(
          `[CAMPANHAS] ❌ Erro ao executar fluxo da campanha ${matchingCampaign.id}:`,
          executionError
        );

        await ticket.update({
          flowWebhook: false,
          isBot: false,
          lastFlowId: null,
          hashFlowId: null,
          flowStopped: null
        });

        return false;
      }
    }

    console.log(
      `[CAMPANHAS] ℹ️ Nenhuma campanha fez match com "${body}" na conexão ${whatsapp.id}`
    );
  } catch (error) {
    console.error("[CAMPANHAS] ❌ Erro geral ao executar campanhas:", error);

    try {
      await ticket.update({
        flowWebhook: false,
        isBot: false,
        lastFlowId: null,
        hashFlowId: null,
        flowStopped: null
      });
    } catch (cleanupError) {
      console.error(
        "[CAMPANHAS] ❌ Erro ao limpar estado do ticket:",
        cleanupError
      );
    }
  }

  if (!msg) {
    console.log(
      `[FLOW INTEGRATION] Verificação pós-fluxo concluída para ticket ${ticket.id}`
    );
    return false;
  }

  const messageCount = await Message.count({
    where: {
      ticketId: ticket.id,
      fromMe: false
    }
  });

  const isNewContact =
    contact.createdAt &&
    Math.abs(new Date().getTime() - new Date(contact.createdAt).getTime()) <
    5000;

  console.log(
    `[FIRST CONTACT CHECK] Ticket ${ticket.id} - Mensagens do cliente: ${messageCount}`
  );
  console.log(
    `[CONTACT STATUS] Contato ${contact.id} - Novo na base: ${isNewContact}, Criado em: ${contact.createdAt}`
  );

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      companyId: ticket.companyId,
      status: true
    }
  });

  const hasAnyPhraseMatch = (
    campaigns: any[],
    messageBody: string,
    whatsappId: number
  ): boolean => {
    return campaigns.some(campaign => {
      try {
        if (!campaignAppliesToWhatsapp(campaign, Number(whatsappId))) {
          return false;
        }

        return campaign.matchesMessage(messageBody, Number(whatsappId));
      } catch (error) {
        console.error(
          `[PHRASE MATCH] Erro ao verificar campanha ${campaign.id}:`,
          error
        );
        return false;
      }
    });
  };

  console.log(`[FLOW-DEBUG] Verificando condições para flowIdNotPhrase:`);
  console.log(
    `[FLOW-DEBUG] - hasAnyPhraseMatch: ${hasAnyPhraseMatch(
      listPhrase,
      body,
      whatsapp.id
    )}`
  );
  console.log(
    `[FLOW-DEBUG] - whatsapp.flowIdNotPhrase: ${whatsapp.flowIdNotPhrase}`
  );
  console.log(`[FLOW-DEBUG] - messageCount: ${messageCount}`);
  console.log(`[FLOW-DEBUG] - isNewContact: ${isNewContact}`);

  const firstContactFlagKey = `first-contact-executed:${ticket.id}`;
  const firstContactAlreadyRan = await cacheLayer.get(firstContactFlagKey);

  if (firstContactAlreadyRan) {
    console.log(
      `[FIRST CONTACT] ⏭️ Já executado anteriormente para ticket ${ticket.id}, ignorando.`
    );
  }

  let welcomeOrFirstContactFlowExecuted = false;

  if (
    !hasAnyPhraseMatch(listPhrase, body, whatsapp.id) &&
    whatsapp.flowIdWelcome &&
    messageCount === 1 &&
    !isNewContact &&
    !firstContactAlreadyRan
  ) {
    console.log(
      `[WELCOME FLOW] 🚀 Iniciando flowIdWelcome (${whatsapp.flowIdWelcome}) - Contato existente na primeira mensagem`
    );

    try {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: whatsapp.flowIdWelcome,
          company_id: companyId,
          active: true
        }
      });

      if (!flow) {
        console.error(
          `[WELCOME FLOW] ❌ Fluxo flowIdWelcome ${whatsapp.flowIdWelcome} não encontrado`
        );
      } else {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];

        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
          console.error(
            `[WELCOME FLOW] ❌ Fluxo flowIdWelcome ${flow.id} não possui nós válidos`
          );
        } else {
          const mountDataContact = {
            number: contact.number,
            name: contact.name,
            email: contact.email
          };

          await ActionsWebhookService(
            whatsapp.id,
            whatsapp.flowIdWelcome,
            ticket.companyId,
            nodes,
            connections,
            flow.flow["nodes"][0].id,
            null,
            "",
            "",
            null,
            ticket.id,
            mountDataContact
          );

          console.log(
            `[WELCOME FLOW] ✅ Fluxo flowIdWelcome executado com sucesso!`
          );

          await cacheLayer.set(firstContactFlagKey, "1", "EX", 86400);
          welcomeOrFirstContactFlowExecuted = true;
        }
      }
    } catch (error) {
      console.error(
        "[WELCOME FLOW] ❌ Erro ao executar fluxo flowIdWelcome:",
        error
      );
    }
  } else if (
    !hasAnyPhraseMatch(listPhrase, body, whatsapp.id) &&
    whatsapp.flowIdNotPhrase &&
    messageCount === 1 &&
    isNewContact &&
    !firstContactAlreadyRan
  ) {
    console.log(
      `[FIRST CONTACT] 🚀 Iniciando flowIdNotPhrase (${whatsapp.flowIdNotPhrase}) - Contato NOVO na primeira mensagem sem match de campanha`
    );

    try {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: whatsapp.flowIdNotPhrase,
          company_id: companyId,
          active: true
        }
      });

      if (!flow) {
        console.error(
          `[FIRST CONTACT] ❌ Fluxo flowIdNotPhrase ${whatsapp.flowIdNotPhrase} não encontrado`
        );
      } else {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];

        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
          console.error(
            `[FIRST CONTACT] ❌ Fluxo flowIdNotPhrase ${flow.id} não possui nós válidos`
          );
        } else {
          const mountDataContact = {
            number: contact.number,
            name: contact.name,
            email: contact.email
          };

          await ActionsWebhookService(
            whatsapp.id,
            whatsapp.flowIdNotPhrase,
            ticket.companyId,
            nodes,
            connections,
            flow.flow["nodes"][0].id,
            null,
            "",
            "",
            null,
            ticket.id,
            mountDataContact
          );

          console.log(
            `[FIRST CONTACT] ✅ Fluxo flowIdNotPhrase executado com sucesso na primeira mensagem!`
          );

          await cacheLayer.set(firstContactFlagKey, "1", "EX", 86400);
          welcomeOrFirstContactFlowExecuted = true;
        }
      }
    } catch (error) {
      console.error(
        "[FIRST CONTACT] ❌ Erro ao executar fluxo flowIdNotPhrase:",
        error
      );
    }
  } else if (
    !hasAnyPhraseMatch(listPhrase, body, whatsapp.id) &&
    (whatsapp.flowIdNotPhrase || whatsapp.flowIdWelcome) &&
    messageCount > 1
  ) {
    console.log(
      `[FLOW SKIP] ℹ️ Pulando fluxos de primeiro contato - NÃO é primeira mensagem (count: ${messageCount})`
    );

    if (firstContactAlreadyRan) {
      await cacheLayer.del(firstContactFlagKey);
    }
  }

  // ✅ CORREÇÃO: Se acabamos de executar o welcome/firstContact flow, NÃO reprocessar a mesma mensagem
  if (welcomeOrFirstContactFlowExecuted) {
    logger.info(
      `[FLOW CHECK] ⏭️ Welcome/FirstContact flow acabou de ser executado - pulando reprocessamento da mesma mensagem`
    );
    return false;
  }

  await ticket.reload();

  logger.info(
    `[FLOW CHECK] ========== VERIFICANDO SE DEVE CONTINUAR FLUXO ==========`
  );
  logger.info(`[FLOW CHECK] Ticket ID: ${ticket.id}`);
  logger.info(`[FLOW CHECK] flowWebhook: ${ticket.flowWebhook}`);
  logger.info(`[FLOW CHECK] hashFlowId: ${ticket.hashFlowId}`);
  logger.info(`[FLOW CHECK] lastFlowId: ${ticket.lastFlowId}`);
  logger.info(`[FLOW CHECK] flowStopped: ${ticket.flowStopped}`);
  logger.info(
    `[FLOW CHECK] Condição (flowWebhook && hashFlowId): ${!!(
      ticket.flowWebhook && ticket.hashFlowId
    )}`
  );

  if (ticket.flowWebhook && ticket.hashFlowId) {
    logger.info(
      `[FLOW WEBHOOK] ========== PROCESSANDO FLUXO WEBHOOK EXISTENTE ==========`
    );
    logger.info(`[FLOW WEBHOOK] Ticket ID: ${ticket.id}`);
    logger.info(`[FLOW WEBHOOK] flowWebhook: ${ticket.flowWebhook}`);
    logger.info(`[FLOW WEBHOOK] hashFlowId: ${ticket.hashFlowId}`);

    if (!ticket.hashFlowId) {
      logger.error(
        `[FLOW WEBHOOK] ❌ Erro: ticket.hashFlowId é undefined para ticket ${ticket.id}`
      );
      return false;
    }

    try {
      const webhook = await WebhookModel.findOne({
        where: {
          company_id: ticket.companyId,
          hash_id: ticket.hashFlowId
        }
      });

      if (webhook && webhook.config["details"]) {
        if (msg && msg.key.fromMe) {
          logger.info(
            `[FLOW WEBHOOK] ⚠️ Mensagem é do bot (fromMe=true) - IGNORANDO para evitar loop`
          );
          logger.info(
            `[FLOW WEBHOOK] Aguardando resposta do USUÁRIO para ticket ${ticket.id}`
          );
          return false;
        }

        logger.info(
          `[FLOW WEBHOOK] ========== WEBHOOK ENCONTRADO ==========`
        );
        logger.info(`[FLOW WEBHOOK] Nome: ${webhook.name || "sem nome"}`);
        logger.info(
          `[FLOW WEBHOOK] Ticket ${ticket.id}, Mensagem: "${body}"`
        );

        const flow = await FlowBuilderModel.findOne({
          where: {
            id: webhook.config["details"].idFlow,
            company_id: companyId,
            active: true
          }
        });

        if (flow) {
          const nodes: INodes[] = flow.flow["nodes"];
          const connections: IConnections[] = flow.flow["connections"];

          await ActionsWebhookService(
            whatsapp.id,
            webhook.config["details"].idFlow,
            ticket.companyId,
            nodes,
            connections,
            ticket.lastFlowId,
            ticket.dataWebhook,
            webhook.config["details"],
            ticket.hashFlowId,
            body,
            ticket.id
          );

          logger.info("[FLOW WEBHOOK] ✅ Fluxo webhook executado!");
        } else {
          logger.error(
            `[FLOW WEBHOOK] ❌ Fluxo ${webhook.config["details"].idFlow} não encontrado`
          );
        }
      } else if (ticket.flowStopped && ticket.lastFlowId) {
        logger.info(
          `[FLOW WEBHOOK] Ticket ${ticket.id} está aguardando resposta do usuário (flowStopped=${ticket.flowStopped}, lastFlowId=${ticket.lastFlowId})`
        );
        logger.info(
          `[FLOW WEBHOOK] Continuação já é tratada no bloco prioritário do início da função`
        );
        return false;
      }
    } catch (error) {
      logger.error(
        "[FLOW WEBHOOK] ❌ Erro ao processar fluxo webhook:",
        error
      );
    }
  } else {
    logger.warn(
      `[FLOW CHECK] ❌ CONDIÇÃO NÃO ATENDIDA - Fluxo não será continuado`
    );
    logger.warn(
      `[FLOW CHECK] Motivo: flowWebhook=${ticket.flowWebhook}, hashFlowId=${ticket.hashFlowId || "null"}`
    );

    if (ticket.flowStopped && ticket.lastFlowId) {
      logger.info(
        `[FLOW CHECK] Ticket ${ticket.id} está aguardando resposta do usuário em flowStopped=${ticket.flowStopped}`
      );
      logger.info(
        `[FLOW CHECK] A continuação desse fluxo ocorre apenas no bloco prioritário do início, quando chegar mensagem do usuário`
      );
    }
  }

  logger.info(
    `[FLOW INTEGRATION] Processamento concluído para ticket ${ticket.id} - conexão ${whatsapp.id}`
  );
  return false;
};

export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (ticket?.contact?.disableBot) {
    return;
  }

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      // Adiciona campos da integração ao payload do n8n
      const integrationPayload = {
        ...msg,
        _integrationConfig: {
          enableTransfer: queueIntegration.enableTransfer,
          transferQueueId: queueIntegration.transferQueueId,
          transferUserId: queueIntegration.transferUserId,
          queueIdAssign: queueIntegration.queueIdAssign,
          whatsappId: queueIntegration.whatsappId,
          userIdAssign: queueIntegration.userIdAssign,
          enableCloseTicket: queueIntegration.enableCloseTicket,
          closeTicketMessage: queueIntegration.closeTicketMessage,
          enableOpenTicket: queueIntegration.enableOpenTicket,
          openTicketQueueId: queueIntegration.openTicketQueueId,
          openTicketUserId: queueIntegration.openTicketUserId,
          openTicketMessage: queueIntegration.openTicketMessage,
          ticketId: ticket.id,
          companyId: ticket.companyId,
        }
      };

      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: integrationPayload
      };
      try {
        request(options, function (error, response) {
          if (error) {
            throw new Error(error);
          } else {
            console.log(response.body);
          }
        });
      } catch (error) {
        throw new Error(error);
      }
    }
  } else if (queueIntegration.type === "dialogflow") {
    let inputAudio: string | undefined;

    if (msgType === "audioMessage") {
      let filename = `${msg.messageTimestamp}.ogg`;
      readFile(
        join(
          __dirname,
          "..",
          "..",
          "..",
          "public",
          `company${companyId}`,
          filename
        ),
        "base64",
        (err, data) => {
          inputAudio = data;
          if (err) {
            logger.error(err);
          }
        }
      );
    } else {
      inputAudio = undefined;
    }

    const debouncedSentMessage = debounce(
      async () => {
        await sendDialogflowAwswer(
          wbot,
          ticket,
          msg as any,
          ticket.contact,
          inputAudio,
          companyId,
          queueIntegration
        );
      },
      500,
      ticket.id
    );
    debouncedSentMessage();
  } else if (queueIntegration.type === "typebot") {
    console.log("[TYPEBOT 3010] Enviando mensagem para Typebot");
    // await typebots(ticket, msg, wbot, queueIntegration);
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  } else if (queueIntegration.type === "flowbuilder") {
    const contact = await ShowContactService(
      ticket.contactId,
      ticket.companyId
    );
    await flowbuilderIntegration(msg, wbot, companyId, queueIntegration, ticket, contact, null, null);
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  // Extrai resposta interativa (nativeFlow/buttons/list) com prioridade
  let body: string;
  try {
    const irm = (msg.message as any)?.interactiveResponseMessage;
    if (irm?.nativeFlowResponseMessage?.paramsJson) {
      const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson);
      body = p?.id || p?.display_text || getBodyMessage(msg);
      logger.info(`[FLOW-INTERACTIVE] handleFlowWebhook - resposta nativeFlow: "${body}"`);
    } else {
      body = msg?.message?.buttonsResponseMessage?.selectedButtonId
        || msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId
        || getBodyMessage(msg);
    }
  } catch {
    body = getBodyMessage(msg);
  }

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped,
      company_id: ticket.companyId,
      active: true
    }
  });

  if (!flow) {
    logger.warn(`[FLOW INPUT] Fluxo ${ticket.flowStopped} inativo ou não encontrado para ticket ${ticket.id} - limpando estado`);
    await ticket.update({
      flowStopped: null,
      lastFlowId: null,
      flowWebhook: false,
      hashFlowId: null,
      dataWebhook: null
    });
    return;
  }

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    null,
    msg
  );

  //const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  //await handleMessageIntegration(msg, wbot, companyId, integrations, ticket, contact, isFirstMsg)
};

const checkTemporaryAI = async (
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  msgContact: IMe,
  mediaSent: Message,
  ticketTraking: TicketTraking,
  msg: proto.IWebMessageInfo
) => {
  // Verificar se é modo temporário com flowContinuation
  const dataWebhook = ticket.dataWebhook as any;
  const flowContinuation = dataWebhook?.flowContinuation;

  // ✅ CORRIGIDO: IA temporária deve parar quando ticket é aceito (status = "open" ou isBot = false)
  if ((!flowContinuation || !ticket.useIntegration || !ticket.flowStopped || !ticket.lastFlowId) && ticket.status !== "open" && ticket.isBot !== false) {
    return false;
  }

  // Verificar se é node IA em modo temporário
  const isAIMode = dataWebhook?.type === "openai" || dataWebhook?.type === "gemini";
  if (!isAIMode || dataWebhook?.mode !== "temporary") {
    return false;
  }

  try {
    const aiSettings = {
      ...dataWebhook.settings,
      provider: dataWebhook.type
    };

    // ✅ SE FOR PRIMEIRA RESPOSTA, REMOVER FLAG
    if (dataWebhook.awaitingUserResponse) {
      await ticket.update({
        dataWebhook: {
          ...dataWebhook,
          awaitingUserResponse: false
        }
      });
    }

    // ✅ PROCESSAR ATRAVÉS DA IA
    await handleOpenAiFlow(
      aiSettings,
      msg,
      wbot,
      ticket,
      contact,
      mediaSent,
      ticketTraking
    );

    return true;

  } catch (error) {
    logger.error("[AI SERVICE] Erro ao processar IA temporário:", error);
    return false;
  }
};

const TRANSFER_ACTION = "Ação: Transferir para o setor de atendimento";

const normalizeTransferText = (text: string = ""): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const detectHumanTransferRequest = (message: string = ""): boolean => {
  const normalized = normalizeTransferText(message);

  const patterns = [
    /\bquero falar com (o )?atendente\b/,
    /\bquero falar com uma pessoa\b/,
    /\bquero falar com alguem\b/,
    /\bquero falar com humano\b/,
    /\bquero atendimento humano\b/,
    /\bquero suporte humano\b/,
    /\bpreciso de um atendente\b/,
    /\bpreciso falar com atendente\b/,
    /\bme transfere\b/,
    /\bme transfere para (o )?(atendimento|suporte)\b/,
    /\bme passa para (o )?(atendimento|suporte)\b/,
    /\batendente humano\b/,
    /\bfalar com (o )?atendente\b/,
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

const hasTransferActionText = (text: string = ""): boolean => {
  return /a[cç][aã]o:\s*transferir para o setor de atendimento/i.test(text || "");
};

const removeTransferActionText = (text: string = ""): string => {
  return String(text || "")
    .replace(/a[cç][aã]o:\s*transferir para o setor de atendimento\s*/i, "")
    .trim();
};

const transferTicketFromLegacyOpenAi = async ({
  wbot,
  msg,
  ticket,
  contact,
  ticketTraking,
  prompt,
  messageToUser
}: {
  wbot: Session;
  msg: proto.IWebMessageInfo;
  ticket: Ticket;
  contact: Contact;
  ticketTraking?: TicketTraking;
  prompt: any;
  messageToUser?: string;
}): Promise<void> => {
  const finalMessage =
    String(messageToUser || "")
      .replace(/^[\.\,\;\:\-\–\—\s]+|[\.\,\;\:\-\–\—\s]+$/g, "")
      .trim() ||
    "Entendi que você gostaria de falar com um atendente humano. Estou transferindo você agora. Aguarde um momento!";

  const targetQueueId = await resolveLegacyTransferQueueId(
    ticket,
    prompt?.queueId
  );

  await ticket.update({
    isBot: false,
    useIntegration: false,
    integrationId: null,
    status: "pending",
    amountUsedBotQueues: 0,
    dataWebhook: null,
    flowWebhook: false,
    lastFlowId: null,
    hashFlowId: null,
    flowStopped: null,
    userId: null,
    queueId: targetQueueId || null
  });

  const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
    text: `\u200e ${finalMessage}`
  });

  await verifyMessage(sentMessage!, ticket, contact, ticketTraking);

  if (targetQueueId) {
    logger.info(
      `[LEGACY OPENAI] Ticket ${ticket.id} enviado para fila ${targetQueueId}`
    );
  } else {
    logger.warn(
      `[LEGACY OPENAI] Ticket ${ticket.id} transferido sem fila definida`
    );
  }
};;

const handleOpenAi = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  if (contact.disableBot) {
    return;
  }

  const { prompt } = await ShowWhatsAppService(
    wbot.id || ticket.whatsappId,
    ticket.companyId
  );

  if (!prompt) return;
  if (msg.messageStubType) return;

  const bodyMessage = getBodyMessage(msg);

  if (!bodyMessage && !msg.message?.audioMessage) {
    return;
  }

  const inputWasAudio = isIncomingAudioMessage({
    typeMessage: getTypeMessage(msg),
    mediaType: mediaSent?.mediaType,
    msg
  });

  if (bodyMessage && detectHumanTransferRequest(bodyMessage)) {
    await transferTicketFromLegacyOpenAi({
      wbot,
      msg,
      ticket,
      contact,
      ticketTraking,
      prompt
    });
    return;
  }

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${ticket.companyId}`
  );

  let openai: OpenAI | any;
  const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);

  if (openAiIndex === -1) {
    openai = new OpenAI({ apiKey: prompt.apiKey });
    openai.id = ticket.id;
    sessionsOpenAi.push(openai);
  } else {
    openai = sessionsOpenAi[openAiIndex];
  }

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "ASC"]],
    limit: prompt.maxMessages
  });

  const agora = new Date();
  const currentDateTimeBrasilia = formatDateTimeBrasilia(agora);

  const promptSystem = `Nas respostas utilize o nome ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar o cliente.
Sua resposta deve usar no máximo ${prompt.maxTokens} tokens e cuide para não truncar o final.
Sempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado.
Se o cliente demonstrar que quer falar com uma pessoa, atendente, humano, suporte ou atendimento humano, comece sua resposta com '${TRANSFER_ACTION}'.
Considere como pedido de transferência frases como: "quero falar com o atendente", "quero falar com uma pessoa", "quero falar com alguém", "me transfere", "me passa para o suporte", "quero atendimento humano", "não quero falar com robô".
Se não houver pedido claro de transferência, responda normalmente.
Sempre usa o horário de Brasília (UTC-3). Agora são ${currentDateTimeBrasilia}. Sempre que questionado sobre hora ou data, responda utilizando esse fuso horário e considere o momento exato da solicitação.

${prompt.prompt}
`;

  const buildMessagesOpenAi = (userContent: string) => {
    const history: any[] = [{ role: "system", content: promptSystem }];

    for (let i = 0; i < Math.min(prompt.maxMessages, messages.length); i++) {
      const message = messages[i];

      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        history.push({
          role: message.fromMe ? "assistant" : "user",
          content: message.body
        });
      }
    }

    history.push({ role: "user", content: userContent });
    return history;
  };

  const sendAiResponse = async (responseText?: string | null) => {
  let response = String(responseText || "").trim();

  if (hasTransferActionText(response)) {
    const cleanedResponse = removeTransferActionText(response);

    await transferTicketFromLegacyOpenAi({
      wbot,
      msg,
      ticket,
      contact,
      ticketTraking,
      prompt,
      messageToUser: cleanedResponse
    });

    return;
  }

  if (!response) {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: "\u200e Desculpe, não consegui processar sua solicitação no momento. Pode tentar novamente?"
    });
    await verifyMessage(sentMessage!, ticket, contact, ticketTraking);
    return;
  }

  const sentAsGenericAudio = await SendAiAudioReplyService({
    wbot,
    ticket,
    jid: msg.key.remoteJid!,
    aiText: response,
    inputWasAudio,
    openAiApiKey: prompt?.apiKey,
    verifyMediaMessageFn: async (sentAudioMessage: any) => {
      await verifyMediaMessage(
        sentAudioMessage,
        ticket,
        contact,
        ticketTraking,
        false,
        false,
        wbot
      );
    },
    sendTextMessageFn: async (text: string) => {
      const sentTextMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${text}`
      });
      await verifyMessage(sentTextMessage, ticket, contact, ticketTraking);
    }
  });

  if (sentAsGenericAudio) {
    return;
  }

  if (prompt.voice === "texto") {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`
    });
    await verifyMessage(sentMessage!, ticket, contact, ticketTraking);
    return;
  }

  const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;

  try {
    await convertTextToSpeechAndSaveToFile(
      keepOnlySpecifiedChars(response),
      `${publicFolder}/${fileNameWithOutExtension}`,
      prompt.voiceKey,
      prompt.voiceRegion,
      prompt.voice,
      "mp3"
    );

    const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
      mimetype: "audio/mpeg",
      ptt: true
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
  } catch (error) {
    console.log(`Erro para responder com audio: ${error}`);

    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`
    });
    await verifyMessage(sentMessage!, ticket, contact, ticketTraking);
  } finally {
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
    deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
  }
};

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    const messagesOpenAi = buildMessagesOpenAi(bodyMessage!);

    const chat = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesOpenAi,
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature
    });

    await sendAiResponse(chat.choices[0].message?.content);
    return;
  }

  if (msg.message?.audioMessage) {
    if (!mediaSent?.mediaUrl) {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "\u200e Desculpe, não consegui localizar o áudio para processar. Tente novamente."
      });
      await verifyMessage(sentMessage!, ticket, contact, ticketTraking);
      return;
    }

    const mediaUrl = mediaSent.mediaUrl.split("/").pop();
    const filePath = `${publicFolder}/${mediaUrl}`;

    if (!mediaUrl || !fs.existsSync(filePath)) {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "\u200e Desculpe, não consegui localizar o arquivo de áudio para processar. Tente novamente."
      });
      await verifyMessage(sentMessage!, ticket, contact, ticketTraking);
      return;
    }

    const file = fs.createReadStream(filePath) as any;

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file
    });

    const transcriptionText = transcription.text || "";

    if (detectHumanTransferRequest(transcriptionText)) {
      await transferTicketFromLegacyOpenAi({
        wbot,
        msg,
        ticket,
        contact,
        ticketTraking,
        prompt
      });
      return;
    }

    const messagesOpenAi = buildMessagesOpenAi(transcriptionText);

    const chat = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesOpenAi,
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature
    });

    await sendAiResponse(chat.choices[0].message?.content);
  }
};


// ========== CORREÇÃO 4: handleMessage com hasMedia atualizado ==========
const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  isImported: boolean = false
): Promise<void> => {

  let campaignExecuted = false;

  // Buscar payload de template interativo para hasMedia
  const templateInteractivePayload = getTemplateInteractivePayload(msg);

  if (isImported) {
    addLogs({
      fileName: `processImportMessagesWppId${wbot.id}.txt`,
      text: `Importando Mensagem: ${JSON.stringify(
        msg,
        null,
        2
      )}>>>>>>>>>>>>>>>>>>>`
    });

    let wid = msg.key.id;
    let existMessage = await Message.findOne({
      where: { wid, companyId }
    });
    if (existMessage) {
      await new Promise(r => setTimeout(r, 150));
      console.log("Esta mensagem já existe");
      return;
    } else {
      await new Promise(r =>
        setTimeout(r, parseInt(process.env.TIMEOUT_TO_IMPORT_MESSAGE) || 330)
      );
    }
  }
  //  else {
  //   await new Promise(r => setTimeout(r, i * 150));
  //   i++
  // }

  if (!isValidMsg(msg)) {
    return;
  }

  // ✅ DEDUPLICAÇÃO: Verificar se a mensagem já existe (evitar duplicatas em tempo real)
  if (!isImported) {
    const existingMsg = await Message.findOne({ where: { wid: msg.key.id, companyId } });
    if (existingMsg) {
      logger.info(`[DEDUP-BAILEYS] Mensagem ${msg.key.id} já existe, ignorando duplicata`);
      return;
    }
  }

  // ✅ CORREÇÃO: Ignorar eventos de grupo (messageStubType)
  if (msg.messageStubType) {
    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] HandleMessage - Ignorando evento de grupo: ${msg.messageStubType}`
      );
    }
    return;
  }



  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;
    let queueId: number = null;
    let tagsId: number = null;
    let userId: number = null;

    // 🔍 DEBUG: Log da estrutura da mensagem para identificar tipo de resposta de botão interativo
    const msgKeys = msg.message ? Object.keys(msg.message) : [];
    if (msgKeys.some(k => k.toLowerCase().includes('interactive') || k.toLowerCase().includes('button') || k.toLowerCase().includes('list') || k.toLowerCase().includes('response') || k.toLowerCase().includes('native') || k.toLowerCase().includes('viewonce'))) {
      logger.info(`[DEBUG-INTERACTIVE] Mensagem recebida - keys: ${JSON.stringify(msgKeys)}`);
      logger.info(`[DEBUG-INTERACTIVE] Estrutura completa: ${JSON.stringify(msg.message, null, 2)}`);
    }

    let bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    // 🔍 DEBUG: Log do tipo e body extraídos
    if (msgKeys.some(k => k.toLowerCase().includes('interactive') || k.toLowerCase().includes('button') || k.toLowerCase().includes('list') || k.toLowerCase().includes('response') || k.toLowerCase().includes('native') || k.toLowerCase().includes('viewonce'))) {
      logger.info(`[DEBUG-INTERACTIVE] msgType: ${msgType}, bodyMessage: ${bodyMessage}`);
    }
    //if (msgType === "protocolMessage") return; // Tratar isso no futuro para excluir msgs se vor REVOKE

    // ========== CORREÇÃO 4: hasMedia com template interactive ==========
    const hasMedia =
      msg.message?.imageMessage ||
      msg.message?.audioMessage ||
      msg.message?.videoMessage ||
      msg.message?.stickerMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
      // msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.documentMessage ||
      msg.message?.ephemeralMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.stickerMessage ||
      msg.message?.ephemeralMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.imageMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.videoMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message
        ?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
      msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
      (msg.message as any)?.viewOnceMessage?.message?.interactiveMessage?.header?.imageMessage ||
      (msg.message as any)?.viewOnceMessage?.message?.interactiveMessage?.header?.documentMessage ||
      (msg.message as any)?.viewOnceMessage?.message?.interactiveMessage?.header?.videoMessage ||
      (msg.message as any)?.viewOnceMessageV2?.message?.interactiveMessage?.header?.imageMessage ||
      (msg.message as any)?.viewOnceMessageV2?.message?.interactiveMessage?.header?.documentMessage ||
      (msg.message as any)?.viewOnceMessageV2?.message?.interactiveMessage?.header?.videoMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessage?.message?.interactiveMessage?.header?.imageMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessage?.message?.interactiveMessage?.header?.documentMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessage?.message?.interactiveMessage?.header?.videoMessage ||
      msg.message?.interactiveMessage?.header?.imageMessage ||
      msg.message?.interactiveMessage?.header?.documentMessage ||
      msg.message?.interactiveMessage?.header?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.documentMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.videoMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.imageMessage ||
      msg.message?.highlyStructuredMessage?.hydratedHsm?.hydratedTemplate
        ?.locationMessage ||
      !!templateInteractivePayload?.headerMedia;
    // const isPrivate = /\u200d/.test(bodyMessage);

    // if (isPrivate) return;

    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "contactMessage" &&
        msgType !== "reactionMessage" &&
        msgType !== "ephemeralMessage" &&
        msgType !== "protocolMessage" &&
        msgType !== "viewOnceMessage" &&
        msgType !== "editedMessage" &&
        msgType !== "hydratedContentText" &&
        msgType !== "templateMessage"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }


    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    // IGNORAR MENSAGENS DE GRUPO
    // const msgIsGroupBlock = await Settings.findOne({
    //   where: { key: "CheckMsgIsGroup", companyId }
    // });
    // console.log("GETTING WHATSAPP SHOW WHATSAPP 2384", wbot.id, companyId)
    if (!wbot.id) { logger.warn(`[WBOT] wbot.id nulo em handleMessage, ignorando mensagem`); return; }
    const whatsapp = await ShowWhatsAppService(wbot.id, companyId);

    if (!whatsapp.allowGroup && isGroup) return;

    if (isGroup) {
      let grupoMeta = null;

      try {
        grupoMeta = await getGroupMetadataCache(whatsapp.id, msg.key.remoteJid);
      } catch (error) {
        logger.error(`Erro ao obter metadados do grupo: ${JSON.stringify(error)}`);
      }

      if (!grupoMeta) {
        try {
          await updateGroupMetadataCache(whatsapp.id, msg.key.remoteJid);
          grupoMeta = await getGroupMetadataCache(whatsapp.id, msg.key.remoteJid);
        } catch (error) {
          logger.error(`Erro ao atualizar cache do grupo: ${JSON.stringify(error)}`);
        }
      }


      if (grupoMeta === undefined || grupoMeta === null || !grupoMeta?.id) {
        try {
          grupoMeta = await wbot.groupMetadata(msg.key.remoteJid!)
        } catch (error) {
          logger.error(`Erro ao obter metadados do grupo: ${JSON.stringify(error)}`);
          return;
        }
      }

      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };

      groupContact = await verifyContact(msgGroupContact, wbot, companyId);

      if (!groupContact) {
        logger.info("Grupo não encontrado, buscando novamente no banco de dados...")
        groupContact = await Contact.findOne({
          where: {
            companyId,
            [Op.or]: [
              { number: msg.key.remoteJid.replace(/\D/g, '') },
              { number: msg.key.remoteJid.replace('@g.us', '') },
              { lid: msg.key.remoteJid.replace('@s.whatsapp.net', '') }
            ]
          }
        })
        if (!groupContact) {
          logger.info("Grupo não encontrado, descarta a mensagem para não abrir como contato...")
          return;
        }
      }
    }

    const contact = await verifyContact(msgContact, wbot, companyId);

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const settings = await getCachedCompanySettings(companyId);
    const enableLGPD = settings.enableLGPD === "enabled";

    // contador
    // if (msg.key.fromMe && count?.unreadCount > 0) {
    //   let remoteJid = msg.key.remoteJid;
    //   SendAckBYRemoteJid({ remoteJid, companyId });
    // }

    // ✅ Otimizado: apenas verificar existência, sem carregar modelo completo nem ordenar
    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      attributes: ["id"],
      order: [["id", "DESC"]],
      raw: true
    });

    // ✅ Mutex por contato (não mais por mensagem) — evita race conditions na criação de tickets
    const contactMutex = getTicketMutex(contact.id);
    const ticket = await contactMutex.runExclusive(async () => {
      const result = await FindOrCreateTicketService(
        contact,
        whatsapp,
        unreadMessages,
        companyId,
        queueId,
        userId,
        groupContact,
        "whatsapp",
        isImported,
        false,
        settings
      );
      return result;
    });

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      userId,
      whatsappId: whatsapp?.id
    });

    // ✅ ROTEAMENTO POR BOTÃO INTERATIVO → fila/atendente
    const hasInteractiveQueueReply = !!(
      (msg.message as any)?.templateButtonReplyMessage ||
      (msg.message as any)?.interactiveResponseMessage ||
      (msg.message as any)?.buttonsResponseMessage ||
      (msg.message as any)?.listResponseMessage ||
      (msg.message as any)?.viewOnceMessage?.message?.templateButtonReplyMessage ||
      (msg.message as any)?.viewOnceMessageV2?.message?.templateButtonReplyMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.templateButtonReplyMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessage?.message?.templateButtonReplyMessage ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessageV2?.message?.templateButtonReplyMessage
    );

    if (!msg.key.fromMe && (
      msgType === "templateButtonReplyMessage" ||
      msgType === "interactiveResponseMessage" ||
      msgType === "buttonsResponseMessage" ||
      hasInteractiveQueueReply
    )) {
      try {
        const rootMsg = (msg.message as any) || {};
        const nestedMsg =
          rootMsg.viewOnceMessage?.message ||
          rootMsg.viewOnceMessageV2?.message ||
          rootMsg.ephemeralMessage?.message?.viewOnceMessage?.message ||
          rootMsg.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
          rootMsg.ephemeralMessage?.message ||
          {};

        const tbrm = rootMsg.templateButtonReplyMessage || nestedMsg.templateButtonReplyMessage;
        const irm = rootMsg.interactiveResponseMessage || nestedMsg.interactiveResponseMessage;
        const brm = rootMsg.buttonsResponseMessage || nestedMsg.buttonsResponseMessage;
        const lrm = rootMsg.listResponseMessage || nestedMsg.listResponseMessage;

        let stanzaId: string | undefined =
          tbrm?.contextInfo?.stanzaId ||
          irm?.contextInfo?.stanzaId ||
          brm?.contextInfo?.stanzaId ||
          lrm?.contextInfo?.stanzaId;

        let selectedId: string | undefined =
          tbrm?.selectedId ||
          brm?.selectedButtonId ||
          lrm?.singleSelectReply?.selectedRowId;

        let selectedText: string | undefined = (
          tbrm?.selectedDisplayText ||
          brm?.selectedDisplayText ||
          lrm?.title ||
          ""
        ).toLowerCase().trim();

        if (irm?.nativeFlowResponseMessage?.paramsJson) {
          try {
            const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson);
            selectedId = selectedId || p?.id;
            selectedText = selectedText || String(p?.display_text || "").toLowerCase().trim();
          } catch {
            // ignore parse error
          }
        }

        if (!selectedText && selectedId) {
          selectedText = String(selectedId).toLowerCase().trim();
        }

        // Fallback: messageContextInfo (Baileys 7+), contextInfo raiz, quoted stanzaId
        if (!stanzaId) {
          stanzaId = rootMsg?.messageContextInfo?.stanzaId
            || rootMsg?.contextInfo?.stanzaId
            || (msg as any)?.contextInfo?.stanzaId;
        }

        // Fallback final: msg.message.extendedTextMessage?.contextInfo?.stanzaId
        if (!stanzaId) {
          stanzaId = rootMsg?.extendedTextMessage?.contextInfo?.stanzaId;
        }

        logger.info(`[INTERACTIVE-QUEUE-DEBUG] msgType=${msgType}, stanzaId=${stanzaId || "NONE"}, selectedId=${selectedId || "NONE"}, selectedText="${selectedText || ""}", msgKeys=${JSON.stringify(Object.keys(rootMsg || {}))}`);

        if (stanzaId && (selectedId || selectedText)) {
          const cacheKey = `interactive:queueMap:${stanzaId}`;
          const mappingStr = await cacheLayer.get(cacheKey);
          logger.info(`[INTERACTIVE-QUEUE-DEBUG] cacheKey=${cacheKey}, found=${!!mappingStr}`);
          if (mappingStr) {
            const mapping = JSON.parse(mappingStr);
            const queueMapping = mapping.queues || mapping;
            const userMapping = mapping.users || {};
            const targetQueueId = (selectedId && queueMapping[selectedId]) || (selectedText && queueMapping[selectedText]);
            const targetUserId = (selectedId && userMapping[selectedId]) || (selectedText && userMapping[selectedText]);

            logger.info(`[INTERACTIVE-QUEUE-DEBUG] targetQueueId=${targetQueueId || "NONE"}, targetUserId=${targetUserId || "NONE"}, queueMapping=${JSON.stringify(queueMapping)}, userMapping=${JSON.stringify(userMapping)}`);

            if (targetQueueId || targetUserId) {
              const updateData: any = {};
              if (targetQueueId) updateData.queueId = targetQueueId;
              if (targetUserId) {
                updateData.userId = targetUserId;
                updateData.status = "open";
              }
              if (!targetUserId && ticket.status === "closed") {
                updateData.status = "pending";
              }

              logger.info(`[INTERACTIVE-QUEUE] Roteando ticket ${ticket.id} → fila=${targetQueueId || "N/A"}, user=${targetUserId || "N/A"} (msgType=${msgType}, selectedId="${selectedId}", selectedText="${selectedText}")`);
              await ticket.update(updateData);

              const io = getIO();
              io.of(String(companyId))
                .emit(`company-${companyId}-ticket`, {
                  action: "update",
                  ticket
                });
            }
          }
        } else if (!stanzaId) {
          // Se não achou stanzaId, tentar buscar por qualquer mapeamento recente do contato
          logger.warn(`[INTERACTIVE-QUEUE] stanzaId não encontrado! msgType=${msgType}, msg.key.id=${msg.key?.id}, dump contextInfo=${JSON.stringify(rootMsg?.contextInfo || rootMsg?.messageContextInfo || "NONE")}`);
        }
      } catch (queueRouteErr) {
        logger.error(`[INTERACTIVE-QUEUE] Erro ao rotear por botão: ${queueRouteErr}`);
      }
    }

    let bodyRollbackTag = "";
    let bodyNextTag = "";
    let rollbackTag;
    let nextTag;
    let ticketTag = undefined;
    // console.log(ticket.id)
    if (ticket?.company?.plan?.useKanban) {
      ticketTag = await TicketTag.findOne({
        where: {
          ticketId: ticket.id
        }
      });

      if (ticketTag) {
        const tag = await Tag.findByPk(ticketTag.tagId);

        if (tag.nextLaneId) {
          nextTag = await Tag.findByPk(tag.nextLaneId);

          bodyNextTag = nextTag.greetingMessageLane;
        }
        if (tag.rollbackLaneId) {
          rollbackTag = await Tag.findByPk(tag.rollbackLaneId);

          bodyRollbackTag = rollbackTag.greetingMessageLane;
        }
      }
    }

    if (
      ticket.status === "closed" ||
      (unreadMessages === 0 &&
        whatsapp.complationMessage &&
        formatBody(whatsapp.complationMessage, ticket) === bodyMessage)
    ) {
      return;
    }

    if (
      rollbackTag &&
      formatBody(bodyNextTag, ticket) !== bodyMessage &&
      formatBody(bodyRollbackTag, ticket) !== bodyMessage
    ) {
      await TicketTag.destroy({
        where: { ticketId: ticket.id, tagId: ticketTag.tagId }
      });
      await TicketTag.create({ ticketId: ticket.id, tagId: rollbackTag.id });
    }

    if (isImported) {
      await ticket.update({
        queueId: whatsapp.queueIdImportMessages
      });
    }

    if (msgType === "editedMessage" || msgType === "protocolMessage") {
      const msgKeyIdEdited =
        msgType === "editedMessage"
          ? msg.message.editedMessage.message.protocolMessage.key.id
          : msg.message?.protocolMessage.key.id;
      let bodyEdited = findCaption(msg.message);

      // console.log("bodyEdited", bodyEdited)
      const io = getIO();
      try {
        const messageToUpdate = await Message.findOne({
          where: {
            wid: msgKeyIdEdited,
            companyId,
            ticketId: ticket.id
          }
        });

        if (!messageToUpdate) return;

        await messageToUpdate.update({ isEdited: true, body: bodyEdited });

        await ticket.update({ lastMessage: bodyEdited });

        io.of(String(companyId))
          // .to(String(ticket.id))
          .emit(`company-${companyId}-appMessage`, {
            action: "update",
            message: messageToUpdate
          });

        io.of(String(companyId))
          // .to(ticket.status)
          // .to("notification")
          // .to(String(ticket.id))
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket
          });
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Error handling message ack. Err: ${err}`);
      }
      return;
    }

    //const ticketTraking = await FindOrCreateATicketTrakingService({
    //  ticketId: ticket.id,
    //  companyId,
    //  userId,
    //  whatsappId: whatsapp?.id
    //});

    let useLGPD = false;

    try {
      if (!msg.key.fromMe) {
        //MENSAGEM DE FÉRIAS COLETIVAS

        if (!isNil(whatsapp.collectiveVacationMessage && !isGroup)) {
          const currentDate = moment();

          if (
            currentDate.isBetween(
              moment(whatsapp.collectiveVacationStart),
              moment(whatsapp.collectiveVacationEnd)
            )
          ) {
            if (hasMedia) {
              await verifyMediaMessage(
                msg,
                ticket,
                contact,
                ticketTraking,
                false,
                false,
                wbot
              );
            } else {
              await verifyMessage(msg, ticket, contact, ticketTraking);
            }

            wbot.sendMessage(getJidOf(ticket.contact), {
              text: whatsapp.collectiveVacationMessage
            });

            return;
          }
        }

        /**
         * Tratamento para avaliação do atendente
         */
        if (
          ticket.status === "nps" &&
          ticketTraking !== null &&
          verifyRating(ticketTraking)
        ) {
          if (hasMedia) {
            await verifyMediaMessage(
              msg,
              ticket,
              contact,
              ticketTraking,
              false,
              false,
              wbot
            );
          } else {
            await verifyMessage(msg, ticket, contact, ticketTraking);
          }

          if (!isNaN(parseFloat(bodyMessage))) {
            handleRating(parseFloat(bodyMessage), ticket, ticketTraking);

            await ticketTraking.update({
              ratingAt: moment().toDate(),
              finishedAt: moment().toDate(),
              rated: true
            });

            return;
          } else {
            if (ticket.amountUsedBotQueuesNPS < whatsapp.maxUseBotQueuesNPS) {
              let bodyErrorRating = `\u200eOpção inválida, tente novamente.\n`;
              const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                {
                  text: bodyErrorRating
                }
              );

              await verifyMessage(sentMessage, ticket, contact, ticketTraking);

              await delay(1000);

              let bodyRatingMessage = `\u200e${whatsapp.ratingMessage}\n`;

              const msg = await SendWhatsAppMessage({
                body: bodyRatingMessage,
                ticket
              });

              await verifyMessage(msg, ticket, ticket.contact);

              await ticket.update({
                amountUsedBotQueuesNPS: ticket.amountUsedBotQueuesNPS + 1
              });
            }

            return;
          }
        }

        //TRATAMENTO LGPD
        if (
          enableLGPD &&
          ticket.status === "lgpd" &&
          !isImported &&
          !msg.key.fromMe
        ) {
          if (hasMedia) {
            await verifyMediaMessage(
              msg,
              ticket,
              contact,
              ticketTraking,
              false,
              false,
              wbot
            );
          } else {
            await verifyMessage(msg, ticket, contact, ticketTraking);
          }

          useLGPD = true;

          if (
            isNil(ticket.lgpdAcceptedAt) &&
            !isNil(ticket.lgpdSendMessageAt)
          ) {
            let choosenOption = parseFloat(bodyMessage);

            //Se digitou opção numérica
            if (
              !Number.isNaN(choosenOption) &&
              Number.isInteger(choosenOption) &&
              !isNull(choosenOption) &&
              choosenOption > 0
            ) {
              //Se digitou 1, aceitou o termo e vai pro bot
              if (choosenOption === 1) {
                await contact.update({
                  lgpdAcceptedAt: moment().toDate()
                });
                await ticket.update({
                  lgpdAcceptedAt: moment().toDate(),
                  amountUsedBotQueues: 0,
                  isBot: true
                  // status: "pending"
                });
                //Se digitou 2, recusou o bot e encerra chamado
              } else if (choosenOption === 2) {
                if (
                  whatsapp.complationMessage !== "" &&
                  whatsapp.complationMessage !== undefined
                ) {
                  const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                    {
                      text: `\u200e ${whatsapp.complationMessage}`
                    }
                  );

                  await verifyMessage(
                    sentMessage,
                    ticket,
                    contact,
                    ticketTraking
                  );
                }

                await ticket.update({
                  status: "closed",
                  amountUsedBotQueues: 0
                });

                await ticketTraking.destroy;

                return;
                //se digitou qualquer opção que não seja 1 ou 2 limpa o lgpdSendMessageAt para
                //enviar de novo o bot respeitando o numero máximo de vezes que o bot é pra ser enviado
              } else {
                if (
                  ticket.amountUsedBotQueues < whatsapp.maxUseBotQueues &&
                  whatsapp.maxUseBotQueues > 0
                ) {
                  await ticket.update({
                    amountUsedBotQueues: ticket.amountUsedBotQueues + 1,
                    lgpdSendMessageAt: null
                  });
                }
              }
              //se digitou qualquer opção que não número o lgpdSendMessageAt para
              //enviar de novo o bot respeitando o numero máximo de vezes que o bot é pra ser enviado
            } else {
              if (
                (ticket.amountUsedBotQueues < whatsapp.maxUseBotQueues &&
                  whatsapp.maxUseBotQueues > 0) ||
                whatsapp.maxUseBotQueues === 0
              ) {
                await ticket.update({
                  amountUsedBotQueues: ticket.amountUsedBotQueues + 1,
                  lgpdSendMessageAt: null
                });
              }
            }
          }

          if (
            (contact.lgpdAcceptedAt === null ||
              settings?.lgpdConsent === "enabled") &&
            !contact.isGroup &&
            isNil(ticket.lgpdSendMessageAt) &&
            (whatsapp.maxUseBotQueues === 0 ||
              ticket.amountUsedBotQueues <= whatsapp.maxUseBotQueues) &&
            !isNil(settings?.lgpdMessage)
          ) {
            if (!isNil(settings?.lgpdMessage) && settings.lgpdMessage !== "") {
              const bodyMessageLGPD = formatBody(
                `\u200e ${settings?.lgpdMessage}`,
                ticket
              );

              const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                {
                  text: bodyMessageLGPD
                }
              );

              wbot.store(sentMessage);

              await verifyMessage(sentMessage, ticket, contact, ticketTraking);
            }
            await delay(1000);

            if (!isNil(settings?.lgpdLink) && settings?.lgpdLink !== "") {
              const bodyLink = formatBody(
                `\u200e ${settings?.lgpdLink}`,
                ticket
              );
              const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                {
                  text: bodyLink
                }
              );

              wbot.store(sentMessage);

              await verifyMessage(sentMessage, ticket, contact, ticketTraking);
            }

            await delay(1000);

            const bodyBot = formatBody(
              `\u200e Estou ciente sobre o tratamento dos meus dados pessoais. \n\n*[1]* Sim\n*[2]* Não`,
              ticket
            );

            const sentMessageBot = await wbot.sendMessage(getJidOf(ticket),
              {
                text: bodyBot
              }
            );

            wbot.store(sentMessageBot);

            await verifyMessage(sentMessageBot, ticket, contact, ticketTraking);

            await ticket.update({
              lgpdSendMessageAt: moment().toDate(),
              amountUsedBotQueues: ticket.amountUsedBotQueues + 1
            });

            await ticket.reload();

            return;
          }

          if (!isNil(ticket.lgpdSendMessageAt) && isNil(ticket.lgpdAcceptedAt))
            return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }
    const isMsgForwarded =
      msg.message?.extendedTextMessage?.contextInfo?.isForwarded ||
      msg.message?.imageMessage?.contextInfo?.isForwarded ||
      msg.message?.audioMessage?.contextInfo?.isForwarded ||
      msg.message?.videoMessage?.contextInfo?.isForwarded ||
      msg.message?.documentMessage?.contextInfo?.isForwarded;

    let mediaSent: Message | undefined;

    if (!useLGPD) {
      if (hasMedia) {
        mediaSent = await verifyMediaMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          isMsgForwarded,
          false,
          wbot
        );
        // Transferência automática para o agente ao receber imagem/foto
        const msgType = getTypeMessage(msg);
        // if (
        //   (msgType === "imageMessage" ||
        //     msgType === "videoMessage" ||
        //     msgType === "documentMessage" ||
        //     msgType === "documentWithCaptionMessage" ||
        //     // msgType === "audioMessage" ||
        //     msgType === "stickerMessage") &&
        //   whatsapp.prompt &&
        //   whatsapp.prompt.queueId
        // ) {
        //   await transferQueue(whatsapp.prompt.queueId, ticket, contact);
        // }
      } else {
        // console.log("antes do verifyMessage")
        await verifyMessage(
          msg,
          ticket,
          contact,
          ticketTraking,
          false,
          isMsgForwarded
        );
      }
    }

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    try {
      const aiSdrBody = String(bodyMessage || "").trim();

      const aiSdrMessageType = getTypeMessage(msg);

      const aiSdrIsAudio =
        !msg.key.fromMe &&
        (
          aiSdrMessageType === "audioMessage" ||
          Boolean(msg.message?.audioMessage)
        );

      const aiSdrMessageWid = String(
        mediaSent?.wid ||
        msg.key.id ||
        ""
      ).trim();

      const aiSdrHasProcessableContent =
        Boolean(aiSdrBody) ||
        Boolean(aiSdrIsAudio && aiSdrMessageWid);

      logger.info(
        `[AI-SDR AUDIO DEBUG] ticket=${ticket.id} type=${aiSdrMessageType} hasMedia=${hasMedia} isAudio=${aiSdrIsAudio} wid=${aiSdrMessageWid || "null"} mediaSentWid=${mediaSent?.wid || "null"}`
      );

      if (
        !msg.key.fromMe &&
        !ticket.imported &&
        !isGroup &&
        (!hasMedia || aiSdrIsAudio) &&
        aiSdrHasProcessableContent &&
        ticket.status !== "open" &&
        !ticket.useIntegration &&
        !ticket.flowWebhook &&
        !ticket.flowStopped
      ) {
        const aiSdrResult = await HandleAiSdrMessageService({
          ticketId: ticket.id,
          companyId,
          currentMessage: aiSdrBody,
          messageWid: aiSdrIsAudio
            ? aiSdrMessageWid
            : undefined,
          isAudioInput: aiSdrIsAudio,
          sendResponse: true
        });

        if (aiSdrResult.processed) {
          logger.info(
            `[AI-SDR] Ticket ${ticket.id} processado. sent=${aiSdrResult.sent} status=${aiSdrResult.evaluation?.status || "n/a"}`
          );

          if (aiSdrResult.sent) {
            return;
          }
        } else if (aiSdrIsAudio) {
          logger.warn(
            `[AI-SDR] Áudio do ticket ${ticket.id} não processado: ${aiSdrResult.reason || "motivo não informado"}`
          );
        }
      }
    } catch (error: any) {
      logger.error(
        `[AI-SDR] Erro ao processar ticket ${ticket.id}: ${error?.message || error}`
      );
      Sentry.captureException(error);
    }

    let currentSchedule;

    if (settings.scheduleType === "company") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
    } else if (settings.scheduleType === "connection") {
      currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
    }

    try {
      if (
        !msg.key.fromMe &&
        settings.scheduleType &&
        (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
        !["open", "group"].includes(ticket.status)
      ) {
        /**
         * Tratamento para envio de mensagem quando a empresa está fora do expediente
         */
        if (
          (settings.scheduleType === "company" ||
            settings.scheduleType === "connection") &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          if (
            whatsapp.maxUseBotQueues &&
            whatsapp.maxUseBotQueues !== 0 &&
            ticket.amountUsedBotQueues >= whatsapp.maxUseBotQueues
          ) {
            // await UpdateTicketService({
            //   ticketData: { queueId: queues[0].id },
            //   ticketId: ticket.id
            // });

            return;
          }

          if (whatsapp.timeUseBotQueues !== "0") {
            if (
              ticket.isOutOfHour === false &&
              ticketTraking.chatbotAt !== null
            ) {
              await ticketTraking.update({
                chatbotAt: null
              });
              await ticket.update({
                amountUsedBotQueues: 0
              });
            }

            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
            let dataLimite = new Date();
            let Agora = new Date();

            if (ticketTraking.chatbotAt !== null) {
              dataLimite.setMinutes(
                ticketTraking.chatbotAt.getMinutes() +
                Number(whatsapp.timeUseBotQueues)
              );
              if (
                ticketTraking.chatbotAt !== null &&
                Agora < dataLimite &&
                whatsapp.timeUseBotQueues !== "0" &&
                ticket.amountUsedBotQueues !== 0
              ) {
                return;
              }
            }

            await ticketTraking.update({
              chatbotAt: null
            });
          }

          if (whatsapp.outOfHoursMessage !== "" && !ticket.imported) {
            // console.log("entrei");
            const body = formatBody(`${whatsapp.outOfHoursMessage}`, ticket);

            const debouncedSentMessage = debounce(
              async () => {
                const sentMessage = await wbot.sendMessage(getJidOf(ticket),
                  {
                    text: body
                  }
                );

                wbot.store(sentMessage);
              },
              1000,
              ticket.id
            );
            debouncedSentMessage();
          }

          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          });

          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (!msg.key.fromMe && !ticket.imported && !isGroup && ticket.isBot !== false) {
      // Verificar se ticket.integrationId existe antes de continuar
      if (!ticket.integrationId) {
        logger.info("[HANDLE MESSAGE] Ticket sem integração, pulando verificação de campanhas");
      } else {
        console.log("[HANDLE MESSAGE] Verificando campanhas de fluxo...");

        const contactForCampaign = await ShowContactService(
          ticket.contactId,
          ticket.companyId
        );

        try {
          const queueIntegrations = await ShowQueueIntegrationService(
            ticket.integrationId,
            companyId
          );

          // ✅ EXECUTAR CAMPANHA APENAS PARA INTEGRAÇÕES DO TIPO FLOWBUILDER
          // Typebot, n8n, dialogflow NÃO devem passar por aqui
          if (queueIntegrations.type === "flowbuilder") {
            campaignExecuted = await flowbuilderIntegration(
              msg,
              wbot,
              companyId,
              queueIntegrations,
              ticket,
              contactForCampaign,
              null,
              null
            );

            if (campaignExecuted) {
              console.log("[RDS-4121 - HANDLE MESSAGE] ✅ Campanha executada, parando outros fluxos");
              return;
            }
          }
        } catch (error) {
          console.error("[RDS-4125 HANDLE MESSAGE] Erro ao verificar campanhas:", error);
        }
      }
    }


    // ✅ PRIORIDADE 1: Verificar se ticket está em modo IA (permanente ou temporário)
    // ✅ CORRIGIDO: IA deve parar quando ticket é aceito (status = "open" ou isBot = false)
    if (!msg.key.fromMe && ticket.useIntegration && ticket.status !== "open" && ticket.isBot !== false) {
      const dataWebhook = ticket.dataWebhook as any;
      const isAIMode = dataWebhook?.type === "openai" || dataWebhook?.type === "gemini";

      if (isAIMode && dataWebhook?.settings) {
        logger.info(`[AI MODE] Processando mensagem em modo ${dataWebhook.type} - ticket ${ticket.id}`);

        try {
          const aiSettings = {
            ...dataWebhook.settings,
            provider: dataWebhook.type
          };

          // ✅ VERIFICAR SE É A PRIMEIRA RESPOSTA DO USUÁRIO APÓS BOAS-VINDAS
          if (dataWebhook.awaitingUserResponse) {
            logger.info(`[AI SERVICE] Primeira resposta do usuário para ${dataWebhook.type} - iniciando conversa - ticket ${ticket.id}`);

            // ✅ REMOVER FLAG - AGORA A CONVERSA ESTÁ ATIVA
            await ticket.update({
              dataWebhook: {
                ...dataWebhook,
                awaitingUserResponse: false
              }
            });
          }

          // ✅ PROCESSAR MENSAGEM ATRAVÉS DA IA
          await handleOpenAiFlow(
            aiSettings,
            msg,
            wbot,
            ticket,
            contact,
            mediaSent,
            ticketTraking
          );

          return; // ✅ IMPORTANTE: RETORNAR PARA NÃO PROCESSAR OUTRAS LÓGICAS

        } catch (error) {
          logger.error("[AI MODE] Erro ao processar modo IA:", error);
        }
      }
    }

    const wasProcessedByTemporaryAI = await checkTemporaryAI(wbot, ticket, contact, msgContact, null, ticketTraking, msg);
    if (wasProcessedByTemporaryAI) {
      return;
    }

    if (
      !msg.key.fromMe &&
      (
        // Caminho padrão: aguardando input explicitamente
        ((ticket.dataWebhook as any)?.waitingInput === true &&
          (ticket.dataWebhook as any)?.inputVariableName)
        ||
        // Fallback resiliente: houve perda do flag, mas temos ponteiro de próximo nó e variável
        ((ticket.dataWebhook as any)?.nextNodeId &&
          (ticket.dataWebhook as any)?.inputVariableName)
      )
    ) {
      // Tickets abertos comuns não executam automações. Porém, quando o
      // fluxo foi iniciado manualmente pela conversa, o estado ativo deve continuar.
      const hasActiveManualInputFlow =
        ticket.flowWebhook === true &&
        Boolean(ticket.flowStopped) &&
        Boolean(ticket.lastFlowId) &&
        Boolean(ticket.hashFlowId);

      if (ticket.status === "open" && !hasActiveManualInputFlow) {
        logger.info(`[INPUT NODE] ⚠️ Ticket ${ticket.id} está OPEN sem fluxo manual ativo - Parando fluxo e limpando dados do Input`);
        try {
          // Limpar os dados do webhook relacionados ao Input
          await ticket.update({
            dataWebhook: {
              ...ticket.dataWebhook,
              waitingInput: false,
              inputVariableName: null,
              inputIdentifier: null,
              nextNodeId: null
            }
          });
          logger.info(`[INPUT NODE] Dados do Input limpos para ticket ${ticket.id}`);
        } catch (error) {
          logger.error(`[INPUT NODE] Erro ao limpar dados do Input para ticket ${ticket.id}:`, error);
        }
        return;
      }

      logger.info(`[INPUT NODE] Processando resposta para nó de input - ticket ${ticket.id}`);
      try {
        console.log("[inputNode] Processando resposta para nó de input");
        const body = getBodyMessage(msg);
        // @ts-ignore
        const inputVariableName = (ticket.dataWebhook as any).inputVariableName;
        // @ts-ignore
        const inputIdentifier =
          (ticket.dataWebhook as any).inputIdentifier ||
          `${ticket.id}_${inputVariableName}`;

        global.flowVariables = global.flowVariables || {};
        global.flowVariables[inputVariableName] = body;
        global.flowVariables[inputIdentifier] = body; // Salvar com o identificador também

        const nextNode = global.flowVariables[`${inputIdentifier}_next`];
        // Fallback: se o ponteiro em memória não existir, usa o salvo no ticket
        // @ts-ignore
        const fallbackNextNode = (ticket.dataWebhook as any)?.nextNodeId;
        const resolvedNextNode = nextNode || fallbackNextNode;
        // delete global.flowVariables[`${inputIdentifier}_next`];

        await ticket.update({
          dataWebhook: {
            ...ticket.dataWebhook,
            waitingInput: false,
            inputProcessed: true,
            inputVariableName: null,
            inputIdentifier: null,
            lastInputValue: body
          }
        });

        // Fallback de flowId: se flowStopped estiver ausente, tenta pegar de dataWebhook.flowId
        // @ts-ignore
        const resolvedFlowId = ticket.flowStopped || (ticket.dataWebhook as any)?.flowId;

        if (resolvedNextNode && resolvedFlowId) {
          const flow = await FlowBuilderModel.findOne({
            where: { id: resolvedFlowId, company_id: ticket.companyId, active: true }
          });

          if (flow) {
            const nodes: INodes[] = flow.flow["nodes"];
            const connections: IConnections[] = flow.flow["connections"];

            const mountDataContact = {
              number: contact.number,
              name: contact.name,
              email: contact.email
            };

            await ActionsWebhookService(
              whatsapp.id,
              parseInt(String(resolvedFlowId)),
              ticket.companyId,
              nodes,
              connections,
              resolvedNextNode,
              null,
              "",
              ticket.hashFlowId || "",
              null,
              ticket.id,
              mountDataContact,
              true // inputResponded true somete para node  input
            );

            return;
          }
        }
      } catch (error) {
        console.error(
          "[inputNode] Erro ao processar resposta do nó de input:",
          error
        );
      }
    }

    if (ticket.flowStopped && ticket.lastFlowId) {
      // ✅ CRÍTICO: Não processar mensagens do próprio bot
      if (msg && msg.key.fromMe) {
        logger.info(`[FLOW STOPPED] ⚠️ Mensagem do bot (fromMe=true) - IGNORANDO para ticket ${ticket.id}`);
        return;
      }

      // Um ticket aberto pode continuar quando o fluxo foi iniciado
      // manualmente pela tela da conversa e ainda aguarda resposta.
      const hasActiveManualFlow =
        ticket.flowWebhook === true &&
        Boolean(ticket.flowStopped) &&
        Boolean(ticket.lastFlowId) &&
        Boolean(ticket.hashFlowId);

      if (ticket.status === "open" && !hasActiveManualFlow) {
        logger.info(
          `[FLOW STOPPED] ⚠️ Ticket ${ticket.id} está OPEN sem fluxo manual ativo - Parando fluxo`
        );
        return;
      }

      if (ticket.status === "open" && hasActiveManualFlow) {
        logger.info(
          `[FLOW MANUAL] ✅ Ticket ${ticket.id} está OPEN com fluxo manual ativo - Continuando`
        );
      }

      logger.info(`[FLOW STOPPED] ========== CONTINUANDO FLUXO (SEGUNDA VERIFICAÇÃO) ==========`);
      logger.info(`[FLOW STOPPED] Ticket ${ticket.id}, Mensagem do usuário: "${getBodyMessage(msg)}"`);
      await flowBuilderQueue(ticket, msg, wbot, whatsapp, companyId, contact, ticket);
      return;
    }

    // ✅ NOVO: Ignorar mensagens do usuário quando o fluxo está em execução (flowWebhook=true mas flowStopped=false)
    // Isso evita que mensagens durante a execução do SingleBlock reiniciem o fluxo
    if (ticket.flowWebhook && ticket.lastFlowId && !ticket.flowStopped && msg && !msg.key.fromMe) {
      logger.info(`[FLOW RUNNING] ⚠️ Ticket ${ticket.id} está executando fluxo (flowWebhook=true, lastFlowId=${ticket.lastFlowId}) - IGNORANDO mensagem do usuário durante execução`);
      logger.info(`[FLOW RUNNING] Mensagem ignorada: "${getBodyMessage(msg)}"`);
      return;
    }

    if (
      ticket.status !== "open" &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.fromMe &&
      ticket.flowStopped &&
      ticket.flowWebhook &&
      !isNaN(parseInt(ticket.lastMessage))
    ) {
      await flowBuilderQueue(
        ticket,
        msg,
        wbot,
        whatsapp,
        companyId,
        contact,
        isFirstMsg
      );
    }


    //openai na conexao
    if (
      ticket.status !== "open" &&
      !ticket.imported &&
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent, ticketTraking);
    }

    //integraçao na conexao
    if (
      ticket.status !== "open" &&
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId)
      //ticket.isBot &&
      //!isNil(whatsapp.integrationId) &&
      //ticket.useIntegration
    ) {
      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket
      );

      if (msg.key.fromMe) {
        await ticket.update({
          typebotSessionTime: moment().toDate(),
          useIntegration: true,
          integrationId: integrations.id
        });
      } else {
        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
      }

      return;
    }

    if (
      !ticket.imported &&
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration
    ) {
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        companyId,
        integrations,
        ticket
      );
      if (msg.key.fromMe) {
        await ticket.update({
          typebotSessionTime: moment().toDate()
        });
      }
    }

    if (
      !ticket.imported &&
      !ticket.queue &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      // console.log("antes do verifyqueue")
      await verifyQueue(wbot, msg, ticket, contact, settings, ticketTraking);

      if (ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    if (ticket.queueId > 0) {
      await ticketTraking.update({
        queueId: ticket.queueId
      });
    }

    // Verificação se aceita audio do contato
    if (
      getTypeMessage(msg) === "audioMessage" &&
      !msg.key.fromMe &&
      (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
      (!contact?.acceptAudioMessage ||
        settings?.acceptAudioMessageContact === "disabled")
    ) {
      const sentMessage = await wbot.sendMessage(
        getJidOf(ticket.contact),
        {
          text: `\u200e*Assistente Virtual*:\nInfelizmente não conseguimos escutar nem enviar áudios por este canal de atendimento, por favor, envie uma mensagem de *texto*.`
        },
        {
          quoted: {
            key: msg.key,
            message: {
              extendedTextMessage: msg.message.extendedTextMessage
            }
          }
        }
      );

      wbot.store(sentMessage);

      await verifyMessage(sentMessage, ticket, contact, ticketTraking);
    }

    try {
      if (
        !msg.key.fromMe &&
        settings?.scheduleType &&
        ticket.queueId !== null &&
        (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
        ticket.status !== "open"
      ) {
        /**
         * Tratamento para envio de mensagem quando a empresa/fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);

        if (settings?.scheduleType === "queue") {
          currentSchedule = await VerifyCurrentSchedule(companyId, queue.id, 0);
        }

        if (
          settings?.scheduleType === "queue" &&
          !isNil(currentSchedule) &&
          ticket.amountUsedBotQueues < whatsapp.maxUseBotQueues &&
          (!currentSchedule || currentSchedule.inActivity === false) &&
          !ticket.imported
        ) {
          if (Number(whatsapp.timeUseBotQueues) > 0) {
            if (
              ticket.isOutOfHour === false &&
              ticketTraking.chatbotAt !== null
            ) {
              await ticketTraking.update({
                chatbotAt: null
              });
              await ticket.update({
                amountUsedBotQueues: 0
              });
            }

            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
            let dataLimite = new Date();
            let Agora = new Date();

            if (ticketTraking.chatbotAt !== null) {
              dataLimite.setMinutes(
                ticketTraking.chatbotAt.getMinutes() +
                Number(whatsapp.timeUseBotQueues)
              );

              if (
                ticketTraking.chatbotAt !== null &&
                Agora < dataLimite &&
                whatsapp.timeUseBotQueues !== "0" &&
                ticket.amountUsedBotQueues !== 0
              ) {
                return;
              }
            }

            await ticketTraking.update({
              chatbotAt: null
            });
          }

          const outOfHoursMessage = queue.outOfHoursMessage;

          if (outOfHoursMessage !== "") {
            // console.log("entrei2");
            const body = formatBody(`${outOfHoursMessage}`, ticket);

            const debouncedSentMessage = debounce(
              async () => {
                const sentMessage = await wbot.sendMessage(
                  getJidOf(ticket),
                  {
                    text: body
                  }
                );

                wbot.store(sentMessage);
              },
              1000,
              ticket.id
            );
            debouncedSentMessage();
          }
          //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
          await ticket.update({
            isOutOfHour: true,
            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
          });
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (
      ticket.queue &&
      ticket.queueId &&
      !msg.key.fromMe &&
      !ticket.useIntegration &&
      !ticket.integrationId
    ) {
      // ✅ CORRIGIDO: Executar ChatBot apenas se ticket não estiver "open" (aceito por atendente)
      if (ticket.status !== "open" && ticket.queue?.chatbots?.length > 0) {
        await sayChatbot(
          ticket.queueId,
          wbot,
          ticket,
          contact,
          msg,
          ticketTraking
        );
      }

      //atualiza mensagem para indicar que houve atividade e aí contar o tempo novamente para enviar mensagem de inatividade
      await ticket.update({
        sendInactiveMessage: false
      });
    }

    if (
      !campaignExecuted && // ✅ NOVA CONDIÇÃO
      !msg.key.fromMe &&
      !ticket.imported &&
      !isGroup &&
      ticket.status === "pending"
    ) {
      // Aguardar um pouco para garantir que outros processamentos terminaram
      setTimeout(async () => {
        try {
          logger.info(`[TICKET RELOAD] ========== ANTES DO RELOAD ==========`);
          logger.info(`[TICKET RELOAD] Ticket ${ticket.id} - flowWebhook: ${ticket.flowWebhook}, lastFlowId: ${ticket.lastFlowId}, hashFlowId: ${ticket.hashFlowId}`);

          await ticket.reload({
            include: [{ model: Contact, as: "contact" }]
          });

          logger.info(`[TICKET RELOAD] ========== DEPOIS DO RELOAD ==========`);
          logger.info(`[TICKET RELOAD] Ticket ${ticket.id} - flowWebhook: ${ticket.flowWebhook}, lastFlowId: ${ticket.lastFlowId}, hashFlowId: ${ticket.hashFlowId}`);

          // Só verificar se não entrou em fluxo
          if (!ticket.flowWebhook || !ticket.lastFlowId) {
            logger.info(`[TICKET RELOAD] Condição (!flowWebhook || !lastFlowId) = TRUE - vai executar flowbuilderIntegration`);
          } else {
            logger.info(`[TICKET RELOAD] Condição (!flowWebhook || !lastFlowId) = FALSE - NÃO vai executar flowbuilderIntegration`);
            logger.info(`[TICKET RELOAD] Ticket já está em fluxo - ignorando`);
            return;
          }

          if (!ticket.flowWebhook || !ticket.lastFlowId) {
            const contactForCampaign = await ShowContactService(
              ticket.contactId,
              ticket.companyId
            );

            // Verificar se existe integrationId antes de prosseguir
            try {
              if (!whatsapp.integrationId) {
                logger.info("[RDS-4573 - DEBUG] whatsapp.integrationId não está definido para a conexão WhatsApp ID: " + whatsapp.id);
                return; // Encerrar execução se não houver integrationId
              }

              const queueIntegrations = await ShowQueueIntegrationService(
                whatsapp.integrationId,
                companyId
              );

              // DEBUG - Verificar tipo de integração para diagnóstico
              logger.info(`[RDS-FLOW-DEBUG] Iniciando flowbuilder para ticket ${ticket.id}, integração tipo: ${queueIntegrations?.type || 'indefinido'}`);

              // ✅ VERIFICAÇÃO FINAL APENAS SE NECESSÁRIO
              await flowbuilderIntegration(
                msg,
                wbot,
                companyId,
                queueIntegrations,
                ticket,
                contactForCampaign
              );

              // DEBUG - Verificar se flowbuilder foi executado com sucesso
              logger.info(`[RDS-FLOW-DEBUG] flowbuilderIntegration executado para ticket ${ticket.id}`);
            } catch (integrationError) {
              logger.error("[RDS-4573 - INTEGRATION ERROR] Erro ao processar integração:", integrationError);
            }
          }
        } catch (error) {
          logger.error("[RDS-4573 - CAMPAIGN MESSAGE] Erro ao verificar campanhas:", error);
        }
      }, 1000);
    }

    await ticket.reload();

  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    // ✅ Otimizado: primeiro busca leve só para verificar se precisa atualizar
    const messageToUpdate = await Message.findOne({
      where: {
        wid: msg.key.id,
        fromMe: msg.key.fromMe
      },
      attributes: ["id", "ack", "ticketId", "companyId"]
    });
    if (!messageToUpdate || messageToUpdate.ack >= chat) return;

    await messageToUpdate.update({ ack: chat });

    // ✅ Só carrega os includes pesados DEPOIS de confirmar que precisa emitir
    const fullMessage = await Message.findByPk(messageToUpdate.id, {
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            {
              model: Contact,
              attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
              include: ["extraInfo", "tags"]
            },
            { model: Queue, attributes: ["id", "name", "color"] },
            { model: Whatsapp, attributes: ["id", "name", "groupAsTicket", "color"] },
            { model: User, attributes: ["id", "name"] },
            { model: Tag, as: "tags", attributes: ["id", "name", "color"] }
          ]
        },
        { model: Message, as: "quotedMsg", include: ["contact"] }
      ]
    });

    if (fullMessage) {
      io.of(fullMessage.companyId.toString())
        .emit(`company-${fullMessage.companyId}-appMessage`, {
          action: "update",
          message: fullMessage
        });
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyRecentCampaign = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  if (!isValidMsg(message)) {
    return;
  }
  if (!message.key.fromMe) {
    const number = message.key.remoteJid.replace(/\D/g, "");
    const campaigns = await Campaign.findAll({
      where: { companyId, status: "EM_ANDAMENTO", confirmation: true }
    });
    if (campaigns) {
      const ids = campaigns.map(c => c.id);
      const campaignShipping = await CampaignShipping.findOne({
        where: {
          campaignId: { [Op.in]: ids },
          number,
          confirmation: null,
          deliveredAt: { [Op.ne]: null }
        }
      });

      if (campaignShipping) {
        await campaignShipping.update({
          confirmedAt: moment(),
          confirmation: true
        });
        await campaignQueue.add(
          "DispatchCampaign",
          {
            campaignShippingId: campaignShipping.id,
            campaignId: campaignShipping.campaignId
          },
          {
            delay: parseToMilliseconds(randomValue(0, 10))
          }
        );
      }
    }
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number,
  wbot: Session
) => {
  if (!isValidMsg(message)) {
    return;
  }

  const io = getIO();
  const body = await getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);

  if (message.key.fromMe && isCampaign) {
    let msgContact: IMe;
    msgContact = await getContactMessage(message, wbot);
    const contact = await verifyContact(msgContact, wbot, companyId);

    const messageRecord = await Message.findOne({
      where: {
        [Op.or]: [{ wid: message.key.id! }, { contactId: contact.id }],
        companyId
      }
    });

    if (
      !isNull(messageRecord) ||
      !isNil(messageRecord) ||
      messageRecord !== null
    ) {
      const ticket = await Ticket.findByPk(messageRecord.ticketId);
      await ticket.update({ status: "closed", amountUsedBotQueues: 0 });

      io.of(String(companyId))
        // .to("open")
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticket,
          ticketId: ticket.id
        });

      io.of(String(companyId))
        // .to(ticket.status)
        // .to(ticket.id.toString())
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket,
          ticketId: ticket.id
        });
    }
  }
};

const messageEditHmacSign = (
  buffer: Uint8Array,
  key: Uint8Array
): Buffer => {
  return createHmac("sha256", Buffer.from(key))
    .update(Buffer.from(buffer))
    .digest();
};

const messageEditAesDecryptGCM = (
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Buffer => {
  const encrypted = Buffer.from(ciphertext);
  const tagLength = 16;

  if (encrypted.length <= tagLength) {
    throw new Error("Payload de edição criptografada inválido");
  }

  const content = encrypted.slice(
    0,
    encrypted.length - tagLength
  );

  const authTag = encrypted.slice(
    encrypted.length - tagLength
  );

  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key),
    Buffer.from(iv)
  );

  decipher.setAAD(Buffer.alloc(0));
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(content),
    decipher.final()
  ]);
};

const handleSecretEncryptedEdit = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<boolean> => {
  const secretEdit = (msg.message as any)?.secretEncryptedMessage;
  const secretType = secretEdit?.secretEncType;

  const isMessageEdit =
    secretType === 2 ||
    String(secretType || "").toUpperCase() === "MESSAGE_EDIT";

  if (!secretEdit || !isMessageEdit) {
    return false;
  }

  const targetKey = secretEdit.targetMessageKey as any;
  const targetWid = targetKey?.id;

  if (
    !targetWid ||
    !secretEdit.encPayload ||
    !secretEdit.encIv ||
    secretEdit.encIv.length !== 12
  ) {
    logger.warn(
      `[MESSAGE-EDIT] Envelope inválido para mensagem ${targetWid || "sem-id"}`
    );
    return true;
  }

  try {
    const originalMessage = await Message.findOne({
      where: {
        wid: targetWid,
        companyId
      }
    });

    if (!originalMessage) {
      logger.warn(
        `[MESSAGE-EDIT] Mensagem original ${targetWid} não encontrada`
      );
      return true;
    }

    let originalData: any;

    try {
      originalData = JSON.parse(originalMessage.dataJson || "{}");
    } catch {
      logger.warn(
        `[MESSAGE-EDIT] dataJson inválido para mensagem ${targetWid}`
      );
      return true;
    }

    const secretValue =
      originalData?.message?.messageContextInfo?.messageSecret;

    if (!secretValue) {
      logger.warn(
        `[MESSAGE-EDIT] messageSecret ausente para mensagem ${targetWid}`
      );
      return true;
    }

    const messageSecret =
      typeof secretValue === "string"
        ? Buffer.from(secretValue, "base64")
        : Buffer.from(
            secretValue?.data ||
            Object.values(secretValue || {}).map(Number)
          );

    if (messageSecret.length !== 32) {
      logger.warn(
        `[MESSAGE-EDIT] messageSecret inválido para mensagem ${targetWid}: ${messageSecret.length} bytes`
      );
      return true;
    }

    const currentKey: any = msg.key || {};
    const originalKey: any = originalData?.key || {};
    const myJid =
      (wbot as any)?.user?.id ||
      (wbot as any)?.myJid ||
      "";

    const envelopeAuthor =
      currentKey.fromMe
        ? myJid
        : currentKey.participant ||
          currentKey.remoteJid ||
          "";

    const primaryOriginalSender =
      targetKey.participant ||
      (targetKey.fromMe
        ? envelopeAuthor
        : targetKey.remoteJid) ||
      originalKey.participant ||
      originalKey.remoteJid ||
      "";

    const primaryEditor = envelopeAuthor;

    const rawCandidates = [
      primaryOriginalSender,
      primaryEditor,
      currentKey.participant,
      currentKey.participantAlt,
      currentKey.remoteJid,
      targetKey.participant,
      targetKey.participantAlt,
      targetKey.remoteJid,
      originalKey.participant,
      originalKey.participantAlt,
      originalKey.remoteJid,
      myJid
    ].filter(Boolean);

    const jidCandidates = Array.from(
      new Set(
        rawCandidates.flatMap((jid: string) => {
          const normalized = jidNormalizedUser(jid);
          const withoutDevice = String(jid).replace(
            /:\d+@/,
            "@"
          );

          return [
            normalized,
            jidNormalizedUser(withoutDevice)
          ].filter(Boolean);
        })
      )
    );

    const originalCandidates = Array.from(
      new Set([
        jidNormalizedUser(primaryOriginalSender),
        ...jidCandidates
      ].filter(Boolean))
    );

    const editorCandidates = Array.from(
      new Set([
        jidNormalizedUser(primaryEditor),
        ...jidCandidates
      ].filter(Boolean))
    );

    const encPayload = Buffer.from(secretEdit.encPayload);
    const encIv = Buffer.from(secretEdit.encIv);

    let decryptedMessage: any = null;
    let successfulOriginalJid = "";
    let successfulEditorJid = "";

    for (const originalSenderJid of originalCandidates) {
      for (const editorJid of editorCandidates) {
        try {
          const sign = Buffer.concat([
            Buffer.from(targetWid),
            Buffer.from(originalSenderJid),
            Buffer.from(editorJid),
            Buffer.from("Message Edit"),
            Buffer.from([1])
          ]);

          const key0 = messageEditHmacSign(
            messageSecret,
            new Uint8Array(32)
          );

          const decryptKey = messageEditHmacSign(
            sign,
            key0
          );

          const decryptedPayload = messageEditAesDecryptGCM(
            encPayload,
            decryptKey,
            encIv
          );

          decryptedMessage = proto.Message.decode(
            decryptedPayload
          );

          if (
            decryptedMessage?.protocolMessage?.editedMessage
          ) {
            successfulOriginalJid = originalSenderJid;
            successfulEditorJid = editorJid;
            break;
          }

          decryptedMessage = null;
        } catch {
          // Tenta a próxima combinação LID/PN.
        }
      }

      if (decryptedMessage) break;
    }

    if (!decryptedMessage) {
      logger.warn(
        `[MESSAGE-EDIT] Não foi possível descriptografar ${targetWid} com os identificadores disponíveis`
      );
      return true;
    }

    const editedContent =
      decryptedMessage.protocolMessage.editedMessage;

    const editedBody =
      editedContent?.conversation ||
      editedContent?.extendedTextMessage?.text ||
      editedContent?.imageMessage?.caption ||
      editedContent?.videoMessage?.caption ||
      editedContent?.documentMessage?.caption ||
      null;

    if (!editedBody) {
      logger.warn(
        `[MESSAGE-EDIT] Conteúdo editado vazio para ${targetWid}`
      );
      return true;
    }

    const previousBody = originalMessage.body;

    await originalMessage.update({
      isEdited: true,
      body: editedBody
    });

    let ticket: Ticket = null;

    if (originalMessage.ticketId) {
      ticket = await Ticket.findByPk(
        originalMessage.ticketId
      );

      if (ticket && ticket.lastMessage === previousBody) {
        await ticket.update({
          lastMessage: editedBody
        });
      }
    }

    const io = getIO();

    const realtimeMessage = {
      ...originalMessage.toJSON(),
      ticket: ticket
        ? {
            id: ticket.id,
            uuid: ticket.uuid
          }
        : undefined
    };

    io.of(String(companyId)).emit(
      `company-${companyId}-appMessage`,
      {
        action: "update",
        message: realtimeMessage
      }
    );

    logger.info(
      `[MESSAGE-EDIT] Mensagem ${targetWid} atualizada com sucesso ` +
      `(origem=${successfulOriginalJid}, editor=${successfulEditorJid})`
    );

    return true;
  } catch (error) {
    Sentry.captureException(error);
    logger.error(
      `[MESSAGE-EDIT] Erro ao processar edição criptografada ${targetWid}: ${error}`
    );
    return true;
  }
};

const filterMessages = (msg: WAMessage): boolean => {
  // msgDB.save(msg);

  if (msg.message?.protocolMessage?.editedMessage) return true;
  if (msg.message?.protocolMessage) return false;

  if (
    [
      WAMessageStubType.REVOKE,
      WAMessageStubType.E2E_DEVICE_CHANGED,
      WAMessageStubType.E2E_IDENTITY_CHANGED,
      WAMessageStubType.CIPHERTEXT
    ].includes(msg.messageStubType)
  )
    return false;

  return true;
};

// Logs de debug de eventos Baileys removidos para produção
const wbotMessageListener = (wbot: Session, companyId: number): void => {
  wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
    // ✅ Registrar atividade da sessão ao receber mensagens
    if (wbot.id) {
      const { touchSessionActivity } = await import("../../libs/wbot");
      touchSessionActivity(wbot.id);
    }

    const messagesWithoutEncryptedEdits: proto.IWebMessageInfo[] = [];

    for (const incomingMessage of messageUpsert.messages) {
      const encryptedEditHandled = await handleSecretEncryptedEdit(
        incomingMessage,
        wbot,
        companyId
      );

      if (!encryptedEditHandled) {
        messagesWithoutEncryptedEdits.push(incomingMessage);
      }
    }

    const messages = messagesWithoutEncryptedEdits
      .filter(filterMessages)
      .map(msg => msg);

    if (!messages) return;

    // console.log("CIAAAAAAA WBOT " , companyId)
    messages.forEach(async (message: proto.IWebMessageInfo) => {
      if (
        message?.messageStubParameters?.length &&
        message.messageStubParameters[0].includes("absent")
      ) {
        const msg = {
          companyId: companyId,
          whatsappId: wbot.id,
          message: message
        };
        logger.warn("MENSAGEM PERDIDA", JSON.stringify(msg));
      }
      // ✅ findOne com attributes mínimos é mais rápido que count() — evita full scan
      const messageExists = await Message.findOne({
        where: { wid: message.key.id!, companyId },
        attributes: ["id"],
        raw: true
      });

      if (!messageExists) {
        let isCampaign = false;
        let body = await getBodyMessage(message);
        const fromMe = message?.key?.fromMe;
        if (fromMe) {
          isCampaign = /\u200c/.test(body);
        } else {
          if (/\u200c/.test(body)) body = body.replace(/\u200c/, "");
          logger.debug(
            "Validação de mensagem de campanha enviada por terceiros: " + body
          );
        }

        if (!isCampaign) {
          if (REDIS_URI_MSG_CONN !== "") {
            //} && (!message.key.fromMe || (message.key.fromMe && !message.key.id.startsWith('BAE')))) {
            try {
              await BullQueues.add(
                `${process.env.DB_NAME}-handleMessage`,
                { message, wbot: wbot.id, companyId },
                {
                  priority: 1,
                  jobId: `${wbot.id}-handleMessage-${message.key.id}`
                }
              );
            } catch (e) {
              Sentry.captureException(e);
            }
          } else {
            await handleMessage(message, wbot, companyId);
          }
        }

        await verifyRecentCampaign(message, companyId);
        await verifyCampaignMessageAndCloseTicket(message, companyId, wbot);
      }

      if (message.key.remoteJid?.endsWith("@g.us")) {
        if (REDIS_URI_MSG_CONN !== "") {
          BullQueues.add(
            `${process.env.DB_NAME}-handleMessageAck`,
            { msg: message, chat: 2 },
            {
              priority: 1,
              jobId: `${wbot.id}-handleMessageAck-${message.key.id}`
            }
          );
        } else {
          handleMsgAck(message as any, 2);
        }
      }
    });

    // messages.forEach(async (message: proto.IWebMessageInfo) => {
    //   const messageExists = await Message.count({
    //     where: { id: message.key.id!, companyId }
    //   });

    //   if (!messageExists) {
    //     await handleMessage(message, wbot, companyId);
    //     await verifyRecentCampaign(message, companyId);
    //     await verifyCampaignMessageAndCloseTicket(message, companyId);
    //   }
    // });
  });

  wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
    if (messageUpdate.length === 0) return;
    messageUpdate.forEach(async (message: WAMessageUpdate) => {
      (wbot as WASocket)!.readMessages([message.key]);

      const msgUp = { ...messageUpdate };

      if (
        msgUp["0"]?.update.messageStubType === 1 &&
        msgUp["0"]?.key.remoteJid !== "status@broadcast"
      ) {
        MarkDeleteWhatsAppMessage(
          msgUp["0"]?.key.remoteJid,
          null,
          msgUp["0"]?.key.id,
          companyId
        );
      }

      let ack: number = message.update.status || 1;

      if (REDIS_URI_MSG_CONN !== "") {
        BullQueues.add(
          `${process.env.DB_NAME}-handleMessageAck`,
          { msg: message, chat: ack },
          {
            priority: 1,
            jobId: `${wbot.id}-handleMessageAck-${message.key.id}`
          }
        );
      } else {
        handleMsgAck(message, ack);
      }
    });
  });

  // ✅ Baileys v7: Escutar evento lid-mapping.update e persistir no WhatsappLidMap
  wbot.ev.on("lid-mapping.update" as any, async (mappings: Array<{ lid: string; pn: string }>) => {
    if (!mappings || mappings.length === 0) return;
    logger.info(`[LID-V7] Recebidos ${mappings.length} mapeamentos LID ↔ PN`);

    for (const { lid, pn } of mappings) {
      try {
        // Normalizar o número do telefone (remover @s.whatsapp.net se presente)
        const phoneNumber = pn.includes("@") ? pn.split("@")[0] : pn;
        // Normalizar o LID (manter formato completo com @lid se presente)
        const normalizedLid = lid.includes("@") ? lid : `${lid}@lid`;

        // Buscar contato pelo número de telefone
        const contact = await Contact.findOne({
          where: { companyId, number: phoneNumber }
        });

        if (contact) {
          // Atualizar o campo lid no contato
          if (!contact.lid || contact.lid !== normalizedLid) {
            await contact.update({ lid: normalizedLid });
            logger.info(`[LID-V7] Atualizado LID do contato ${contact.id}: ${normalizedLid}`);
          }

          // Criar/atualizar mapeamento no WhatsappLidMap
          const existingMap = await WhatsappLidMap.findOne({
            where: { companyId, contactId: contact.id }
          });

          if (!existingMap) {
            await WhatsappLidMap.create({
              companyId,
              lid: normalizedLid,
              contactId: contact.id
            });
            logger.info(`[LID-V7] Criado mapeamento LID para contato ${contact.id}: ${normalizedLid}`);
          } else if (existingMap.lid !== normalizedLid) {
            await existingMap.update({ lid: normalizedLid });
            logger.info(`[LID-V7] Atualizado mapeamento LID para contato ${contact.id}: ${normalizedLid}`);
          }
        } else {
          logger.debug(`[LID-V7] Contato não encontrado para PN ${phoneNumber}, mapeamento será criado quando o contato for registrado`);
        }
      } catch (error) {
        logger.error(`[LID-V7] Erro ao persistir mapeamento LID ${lid} → ${pn}: ${error.message}`);
      }
    }
  });

  // wbot.ev.on('message-receipt.update', (events: any) => {
  //   events.forEach(async (msg: any) => {
  //     const ack = msg?.receipt?.receiptTimestamp ? 3 : msg?.receipt?.readTimestamp ? 4 : 0;
  //     if (!ack) return;
  //     await handleMsgAck(msg, ack);
  //   });
  // })

  // ✅ Presence updates: emite "digitando..." e "online" para o frontend em tempo real
  wbot.ev.on("presence.update", async (presenceData: any) => {
    try {
      const { id: jid, presences } = presenceData;
      if (!jid || !presences) return;

      // Extrair número do JID
      const number = jid.replace(/[@:].*/g, "");
      if (!number) return;

      // Buscar contato correspondente
      const contact = await Contact.findOne({
        where: { companyId, number },
        attributes: ["id", "number"]
      });

      if (!contact) return;

      // Buscar ticket aberto para este contato
      const ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          whatsappId: wbot.id,
          status: ["open", "pending"]
        },
        attributes: ["id"]
      });

      if (!ticket) return;

      // Extrair estado de presença do primeiro participante
      const firstPresence = Object.values(presences)[0] as any;
      if (!firstPresence) return;

      const presenceState = firstPresence.lastKnownPresence || "unavailable";

      const io = getIO();
      io.of(String(companyId))
        .to(String(ticket.id))
        .emit(`company-${companyId}-presence`, {
          ticketId: ticket.id,
          contactId: contact.id,
          presence: presenceState, // "composing" | "recording" | "available" | "unavailable" | "paused"
        });
    } catch (err) {
      // Silenciar erros de presença para não poluir logs
    }
  });

  wbot.ev.on("contacts.update", async (contacts: any) => {
    if (process.env.IMPORT_ALL_WHATSAPP_CONTACTS !== "true") {
      const total = Array.isArray(contacts) ? contacts.length : 0;

      if (total > 0) {
        logger.info(
          `[CONTACTS UPDATE] Ignorado sync automático de ${total} contatos. ` +
          `IMPORT_ALL_WHATSAPP_CONTACTS=false`
        );
      }

      return;
    }

    // Logs de debug de contacts.update removidos para produção

    contacts.forEach(async (contact: any) => {

      if (!contact?.id) return;

      if (!contact.id.includes("@s.whatsapp.net") && !contact.id.includes("@g.us")) {

        return;
      }

      const isGroup = contact.id.includes("@g.us");
      const number = isGroup
        ? contact.id.replace("@g.us", "")
        : contact.id.replace("@s.whatsapp.net", "");

      if (!/^\d{10,15}$/.test(number)) {

        return;
      }

      // ✅ Usar nome real do contato (notify/verifiedName/name) ao invés do número
      const contactName =
        pickBestContactName(
          contact.notify,
          contact.verifiedName,
          contact.name
        ) || number;

      let profilePicUrl: string = "";
      try {
        // imgUrl pode ser undefined, null ou string vazia
        if (contact.imgUrl && contact.imgUrl !== "" && contact.imgUrl !== "changed") {
          profilePicUrl = contact.imgUrl;
        } else {
          profilePicUrl = await wbot.profilePictureUrl(contact.id, "image");
        }
      } catch (e) {
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      const contactData = {
        name: contactName,
        number,
        isGroup,
        companyId,
        remoteJid: contact.id,
        profilePicUrl,
        whatsappId: wbot.id,
        wbot
      };

      await CreateOrUpdateContactService(contactData);
    });
  });


  // Handlers extras removidos para produção

  wbot.ev.on('group-participants.update', async (event) => {
    const { id, participants, action, author } = event
    logger.info(`[GROUP] group-participants.update: ${action} em ${id}`);
    // console.log("group-participants.update.listener", id, participants, action, author)
    const metadata = await getGroupMetadataCache(wbot.id, id)

    if (!Array.isArray(metadata?.participants)) {
      return
    }

    if (action === 'add') {
      logger.info(`Adicionando participantes ao grupo ${id}, atualizando cache`)
      metadata.participants.push(...participants.map(p => ({
        id: p,
        admin: null
      })))
    } else if (action === 'demote' || action === 'promote') {
      logger.info(`Atualizando ${action === 'promote' ? 'admin' : 'participante'} do grupo ${id}, atualizando cache`)
      metadata.participants = metadata.participants.map(p => participants.includes(p.id) ? ({
        id: p.id,
        admin: action === 'promote' ? 'admin' : null
      }) : p)
    } else if (action === 'remove') {
      logger.info(`Removendo participante do grupo ${id}, atualizando cache`)
      metadata.participants = metadata.participants.filter(p => !participants.includes(p.id))
    } else if (action === 'modify') {
      logger.info(`Modificando participante do grupo ${id}, atualizando cache`)
      metadata.participants = metadata.participants.filter(p => p.id !== author)
      metadata.participants.push(...participants.map(p => ({
        id: p,
        admin: null
      })))
    }

    await groupMetadataCache.set(id, wbot.id, {
      timestamp: metadata.timestamp,
      data: metadata,
    })
  })

  wbot.ev.on("groups.update", (groupUpdate: GroupMetadata[]) => {
    if (process.env.IMPORT_ALL_WHATSAPP_CONTACTS !== "true") {
      const total = Array.isArray(groupUpdate) ? groupUpdate.length : 0;

      if (total > 0) {
        logger.info(
          `[GROUPS UPDATE] Ignorado sync automático de ${total} grupos. ` +
          `IMPORT_ALL_WHATSAPP_CONTACTS=false`
        );
      }

      return;
    }

    // Logs de debug de grupos removidos para produção

    if (!groupUpdate[0]?.id) return;
    if (groupUpdate.length === 0) return;
    groupUpdate.forEach(async (group: GroupMetadata) => {
      const number = group.id.substr(0, group.id.indexOf("@"));
      const nameGroup = group.subject || number;

      let profilePicUrl: string = "";
      // try {
      //   profilePicUrl = await wbot.profilePictureUrl(group.id, "image");
      // } catch (e) {
      //   Sentry.captureException(e);
      //   profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      // }
      const contactData = {
        name: nameGroup,
        number: number,
        isGroup: true,
        companyId: companyId,
        remoteJid: group.id,
        profilePicUrl,
        whatsappId: wbot.id,
        wbot: wbot
      };

      const contact = await CreateOrUpdateContactService(contactData);
    });
  });
};

export {
  wbotMessageListener,
  handleMessage,
  isValidMsg,
  getTypeMessage,
  handleMsgAck
};

// Função helper para mapear corretamente o mediaType baseado no MIME type completo
const getMediaTypeFromMimeType = (mimetype: string): string => {
  // Mapeamento específico para tipos de documento que devem ser tratados como "document"
  const documentMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.graphics",
    "application/rtf",
    "text/plain",
    "text/csv",
    "text/html",
    "text/xml",
    "application/xml",
    "application/json",
    "application/ofx",
    "application/vnd.ms-outlook",
    "application/vnd.apple.keynote",
    "application/vnd.apple.numbers",
    "application/vnd.apple.pages"
  ];

  // Mapeamento para tipos de arquivo compactado
  const archiveMimeTypes = [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/gzip",
    "application/x-bzip2"
  ];

  if (documentMimeTypes.includes(mimetype)) {
    return "document";
  }

  if (archiveMimeTypes.includes(mimetype)) {
    return "document"; // Tratar como documento para download
  }

  // Para outros tipos, usar a lógica padrão
  return mimetype.split("/")[0];
};