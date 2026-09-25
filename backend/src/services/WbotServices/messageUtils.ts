import fs from "fs";
import path from "path";
import * as Sentry from "@sentry/node";
import {
  extractMessageContent,
  getContentType,
  proto,
  WAMessage,
  WAMessageStubType
} from "@whiskeysockets/baileys";
import logger from "../../utils/logger";
import OpenAI from "openai";

// ===== Interfaces =====
export interface IMe {
  name: string;
  id: string;
  lid?: string;
  senderPn?: string;
  notify?: string;
  verifiedName?: string;
}

export interface PhraseCondition {
  text: string;
  type: "exact" | "partial";
}

export interface CampaignPhrase {
  id: number;
  flowId: number;
  phrase: PhraseCondition[];
  whatsappId: number;
  status: boolean;
  companyId: number;
}

export interface SessionOpenAi extends OpenAI {
  id?: number;
}

// ===== Utility Functions =====

export function removeFile(directory: string) {
  fs.unlink(directory, error => {
    if (error) throw error;
  });
}

export const getTimestampMessage = (msgTimestamp: any) => {
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
  if (contact != "item1.TEL") {
    output = output + name + ": 📞" + contact + "" + "\n";
  } else output = output + name + ": 📞" + contactSemWhats + "" + "\n";
  return output;
};

const contactsArrayMessageGet = (msg: any) => {
  const contactsArray = msg.message?.contactsArrayMessage?.contacts || [];
  const vcardMulti = contactsArray.map(function (item: any) {
    return item.vcard;
  });

  let bodymessage = ``;
  vcardMulti.forEach(function (vcard: any) {
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

export const getTypeMessage = (msg: proto.IWebMessageInfo): string => {
  const message = (msg.message as any) || {};
  const nestedMessage =
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.ephemeralMessage?.message?.viewOnceMessage?.message ||
    message.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
    message.ephemeralMessage?.message ||
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

  if (
    message?.templateButtonReplyMessage ||
    nestedMessage?.templateButtonReplyMessage
  ) {
    return "templateButtonReplyMessage";
  }

  if (
    message?.interactiveResponseMessage ||
    nestedMessage?.interactiveResponseMessage
  ) {
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

const getAd = (msg: any): string | null => {
  if (
    msg.key.fromMe &&
    msg.message?.listResponseMessage?.contextInfo?.externalAdReply
  ) {
    let bodyMessage = `*${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title}*`;
    bodyMessage += `\n\n${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.body}`;
    return bodyMessage;
  }
  return null;
};

const getBodyButton = (msg: any): string | null => {
  try {
    if (
      msg?.messageType === "buttonsMessage" ||
      msg?.message?.buttonsMessage?.contentText
    ) {
      let bodyMessage = `[BUTTON]\n\n*${msg?.message?.buttonsMessage?.contentText}*\n\n`;
      for (const button of msg.message?.buttonsMessage?.buttons || []) {
        bodyMessage += `*${button.buttonId}* - ${button.buttonText.displayText}\n`;
      }
      return bodyMessage;
    }
    if (
      msg?.messageType === "listMessage" ||
      msg?.message?.listMessage?.description
    ) {
      let bodyMessage = `[LIST]\n\n*${msg?.message?.listMessage?.description}*\n\n`;
      for (const button of msg.message?.listMessage?.sections?.[0]?.rows || []) {
        bodyMessage += `${button.title}\n`;
      }
      return bodyMessage;
    }
  } catch (error) {
    logger.error(error);
  }

  return null;
};

export const msgLocation = (image: any, latitude: any, longitude: any) => {
  if (image) {
    const b64 = Buffer.from(image).toString("base64");
    const data = `data:image/png;base64, ${b64} | https://maps.google.com/maps?q=${latitude}%2C${longitude}&z=17&hl=pt-BR|${latitude}, ${longitude} `;
    return data;
  }
  return null;
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
  image: any,
  title: any,
  body: any,
  sourceUrl: any,
  messageUser: any
) => {
  if (!image) return null;

  const imageSource = normalizeAdImage(image);

  return `${imageSource}|${sourceUrl || ""}|${title || ""}|${body || ""}|${messageUser || ""}`;
};

const extractTemplateMessageBody = (templateMessage: any): string | null => {
  if (!templateMessage) return null;

  const tpl =
    templateMessage?.hydratedTemplate ||
    templateMessage?.hydratedFourRowTemplate ||
    templateMessage?.fourRowTemplate;

  if (!tpl) return null;

  return (
    tpl?.hydratedContentText ||
    [
      tpl?.hydratedTitleText,
      tpl?.hydratedContentText,
      tpl?.hydratedFooterText
    ]
      .filter(Boolean)
      .join("\n\n") ||
    tpl?.contentText ||
    tpl?.content?.text ||
    null
  );
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
  } catch {
    return null;
  }
};

export const getBodyMessage = (msg: proto.IWebMessageInfo): string | null => {
  try {
    const type = getTypeMessage(msg);
    if (type === undefined) console.log(JSON.stringify(msg));

    const nestedMessage =
      (msg.message as any)?.viewOnceMessage?.message ||
      (msg.message as any)?.viewOnceMessageV2?.message ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessage?.message ||
      (msg.message as any)?.ephemeralMessage?.message?.viewOnceMessageV2?.message ||
      (msg.message as any)?.ephemeralMessage?.message ||
      {};

    const types: Record<string, any> = {
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
        (msg.message as any)?.templateButtonReplyMessage?.selectedDisplayText ||
        (msg.message as any)?.templateButtonReplyMessage?.selectedId ||
        nestedMessage?.templateButtonReplyMessage?.selectedDisplayText ||
        nestedMessage?.templateButtonReplyMessage?.selectedId,
      templateMessage:
        extractTemplateMessageBody((msg.message as any)?.templateMessage) ||
        extractTemplateMessageBody(nestedMessage?.templateMessage),
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
            const vom = (msg.message as any)?.viewOnceMessage?.message;
            if (vom?.interactiveMessage?.body?.text) {
              return vom.interactiveMessage.body.text;
            }
            if (vom?.imageMessage?.caption) return vom.imageMessage.caption;
            if (vom?.videoMessage?.caption) return vom.videoMessage.caption;
            if (vom?.templateMessage) {
              return extractTemplateMessageBody(vom.templateMessage);
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
        (msg.message as any)?.viewOnceMessageV2?.message?.imageMessage?.caption ||
        (msg.message as any)?.viewOnceMessageV2?.message?.videoMessage?.caption ||
        extractTemplateMessageBody(
          (msg.message as any)?.viewOnceMessageV2?.message?.templateMessage
        ),
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
      interactiveMessage: null,
      interactiveResponseMessage: (() => {
        try {
          const irm =
            (msg.message as any)?.interactiveResponseMessage ||
            nestedMessage?.interactiveResponseMessage;

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
      pollCreationMessage:
        (msg.message as any)?.pollCreationMessage?.name || "📊 Enquete"
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

    return types[type] || null;
  } catch (error) {
    Sentry.setExtra("Error getTypeMessage", { msg, BodyMsg: msg?.message });
    Sentry.captureException(error);
    console.log(error);
    return null;
  }
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

export const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
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
      message.templateMessage ||
      message.interactiveResponseMessage ||
      message.buttonsResponseMessage ||
      message.listResponseMessage ||
      nestedMessage.templateButtonReplyMessage ||
      nestedMessage.templateMessage ||
      nestedMessage.interactiveResponseMessage ||
      nestedMessage.buttonsResponseMessage ||
      nestedMessage.listResponseMessage
    );

    if (hasInteractiveReplyShape) {
      return true;
    }

    const msgType = getTypeMessage(msg);
    const normalizedMsgType = String(msgType || "")
      .replace(/[^\w]/g, "")
      .trim()
      .toLowerCase();

    if (!normalizedMsgType) return false;

    if (
      normalizedMsgType.includes("templatebuttonreplymessage") ||
      normalizedMsgType.includes("templatemessage") ||
      normalizedMsgType.includes("interactiveresponsemessage") ||
      normalizedMsgType.includes("buttonsresponsemessage") ||
      normalizedMsgType.includes("listresponsemessage")
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
      "templatebuttonreplymessage",
      "templatemessage"
    ]);

    const ifType = validTypes.has(normalizedMsgType);

    if (!ifType) {
      logger.warn(
        `#### Nao achou o type em isValidMsg: ${normalizedMsgType}\n${JSON.stringify(msg?.message)}`
      );
      Sentry.setExtra("Mensagem", {
        BodyMsg: msg.message,
        msg,
        msgType: normalizedMsgType
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

export function findCaption(obj: any): string | null {
  if (typeof obj !== "object" || obj === null) return null;
  for (const key in obj) {
    if (key === "caption" || key === "text" || key === "conversation") {
      return obj[key];
    }
    const result = findCaption(obj[key]);
    if (result) return result;
  }
  return null;
}

export const getMediaTypeFromMimeType = (mimetype: string): string => {
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
  const archiveMimeTypes = [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/gzip",
    "application/x-bzip2"
  ];
  if (documentMimeTypes.includes(mimetype)) return "document";
  if (archiveMimeTypes.includes(mimetype)) return "document";
  return mimetype.split("/")[0];
};

export const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

export const formatDateTimeBrasilia = (date: Date): string => {
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
  return `${partValue("weekday")}, ${partValue("day")}/${partValue("month")}/${partValue("year")} ${partValue("hour")}:${partValue("minute")}:${partValue("second")}`;
};

export const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const keepOnlySpecifiedChars = (str: string) => {
  return str.replace(
    /[^a-zA-Z0-9áéíóúÁÉÍÓÚâêîôûÂÊÎÔÛãõÃÕçÇ!?.,;:\s]/g,
    ""
  );
};

export const filterMessages = (msg: WAMessage): boolean => {
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

export const allowedMimeTypes = [
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

// ===== Campaign Matching Utilities =====

export const matchesAnyPhrase = (
  campaignPhrases: PhraseCondition[],
  messageBody: string
): boolean => {
  if (
    !campaignPhrases ||
    !Array.isArray(campaignPhrases) ||
    campaignPhrases.length === 0
  )
    return false;
  if (!messageBody || typeof messageBody !== "string") return false;

  const bodyLower = messageBody.toLowerCase().trim();

  return campaignPhrases.some((condition: PhraseCondition) => {
    if (!condition.text || typeof condition.text !== "string") return false;
    const phraseLower = condition.text.toLowerCase().trim();
    if (condition.type === "exact") return bodyLower === phraseLower;
    if (condition.type === "partial") return bodyLower.includes(phraseLower);
    return false;
  });
};

export const normalizeCampaignPhrases = (phrase: any): PhraseCondition[] => {
  if (!phrase) return [];
  if (Array.isArray(phrase)) return phrase.filter(item => item && item.text);

  if (typeof phrase === "string") {
    try {
      const parsed = JSON.parse(phrase);
      if (Array.isArray(parsed)) return parsed.filter(item => item && item.text);
      if (typeof parsed === "string") return [{ text: parsed, type: "exact" }];
    } catch {
      return [{ text: phrase, type: "exact" }];
    }
  }

  return [];
};

export const findMatchingCampaign = (
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
      if (!campaign.status) return false;

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

export const transferQueue = async (
  queueId: number,
  ticket: any,
  contact: any
): Promise<void> => {
  const UpdateTicketService = (
    await import("../TicketServices/UpdateTicketService")
  ).default;

  await UpdateTicketService({
    ticketData: { queueId },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};