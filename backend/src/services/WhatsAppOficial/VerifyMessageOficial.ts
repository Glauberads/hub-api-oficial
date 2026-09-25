import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { generateVCard, IMessageReceived } from "./ReceivedWhatsApp";

const getTimestampMessage = (msgTimestamp: any) => {
  return msgTimestamp * 1;
};

const normalizeOfficialMediaUrl = (filePath?: string | null): string | null => {
  if (!filePath) {
    return null;
  }

  const rawPath = String(filePath).trim().replace(/\\/g, "/");

  if (!rawPath) {
    return null;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const cleanPath = rawPath.replace(/^\/+/, "");

  if (cleanPath.startsWith("official-public/")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("public/")) {
    return `official-public/${cleanPath.replace(/^public\//, "")}`;
  }

  return `official-public/${cleanPath}`;
};

const normalizeStringValue = (value?: any): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
};

const normalizeUsernameValue = (value?: any): string | null => {
  const normalized = normalizeStringValue(value);
  return normalized ? normalized.replace(/^@+/, "").toLowerCase() : null;
};

const resolveRemoteIdentifier = (
  message: IMessageReceived,
  fromNumber: string
): { type: string | null; value: string | null } => {
  const explicitType = normalizeStringValue(message.remoteIdentifierType);
  const explicitValue = normalizeStringValue(message.remoteIdentifierValue);

  if (explicitType && explicitValue) {
    return {
      type: explicitType,
      value: explicitValue
    };
  }

  const bsuid =
    normalizeStringValue(message.remoteBsuid) ||
    normalizeStringValue(message.remoteUserId);

  if (bsuid) {
    return {
      type: "bsuid",
      value: bsuid
    };
  }

  const username = normalizeUsernameValue(message.remoteUsername);
  if (username) {
    return {
      type: "username",
      value: username
    };
  }

  const phone = normalizeStringValue(message.remotePhone);
  if (phone) {
    return {
      type: "phone_e164",
      value: phone
    };
  }

  const waId = normalizeStringValue(message.remoteWaId);
  if (waId) {
    return {
      type: "wa_id",
      value: waId
    };
  }

  const fallback = normalizeStringValue(fromNumber);
  if (fallback) {
    return {
      type: "phone_e164",
      value: fallback
    };
  }

  return {
    type: null,
    value: null
  };
};

const resolveRemoteJid = (
  message: IMessageReceived,
  fromNumber: string
): string => {
  const target =
    normalizeStringValue(message.remoteWaId) ||
    normalizeStringValue(message.remotePhone) ||
    normalizeStringValue(fromNumber) ||
    "unknown";

  return `${target}@s.whatsapp.net`;
};

const resolveRawMetaPayload = (
  message: IMessageReceived,
  data: any
): Record<string, any> | null => {
  if (message.rawMetaPayload && typeof message.rawMetaPayload === "object") {
    return message.rawMetaPayload;
  }

  if (data?.message?.rawMetaPayload && typeof data.message.rawMetaPayload === "object") {
    return data.message.rawMetaPayload;
  }

  return null;
};

const resolveContactsPayload = (data: any): any[] => {
  if (Array.isArray(data?.message?.rawMetaPayload?.message?.contacts)) {
    return data.message.rawMetaPayload.message.contacts;
  }

  if (Array.isArray(data?.message?.contacts)) {
    return data.message.contacts;
  }

  if (Array.isArray(data?.message?.text?.contacts)) {
    return data.message.text.contacts;
  }

  return [];
};

const verifyMessageOficial = async (
  message: IMessageReceived,
  ticket: Ticket,
  contact: Contact,
  companyId: number,
  fileName: string,
  fromNumber: string,
  data: any,
  quoteMessageId?: string
) => {
  let bodyMessage: any = message.text;

  const contactsPayload = resolveContactsPayload(data);

  if (message.type === "contacts" && Array.isArray(contactsPayload) && contactsPayload.length > 0) {
    const firstContact = contactsPayload[0];
    bodyMessage = await generateVCard(firstContact);
  }

  let quotedMsgId = null;

  if (quoteMessageId) {
    const quotedMessage = await Message.findOne({
      where: {
        wid: quoteMessageId,
        companyId: companyId
      }
    });
    quotedMsgId = quotedMessage?.id || null;
  }

  const normalizedMediaUrl = normalizeOfficialMediaUrl(fileName);
  const remoteIdentifier = resolveRemoteIdentifier(message, fromNumber);
  const remoteJid = resolveRemoteJid(message, fromNumber);
  const rawMetaPayload = resolveRawMetaPayload(message, data);
  const isFromMe = data?.fromMe === true;

  const messageData = {
    wid: message.idMessage,
    ticketId: ticket.id,
    contactId: contact.id,
    body:
  message.type === "contacts"
    ? bodyMessage
    : message.text || (fileName ? String(fileName).split("/").pop() : "") || "",
    fromMe: isFromMe,
    mediaType: message.type === "contacts" ? "contactMessage" : message.type,
    mediaUrl: normalizedMediaUrl,
    read: isFromMe,
    quotedMsgId: quotedMsgId,
    ack: isFromMe ? 1 : 0,
    channel: "whatsapp_oficial",
    remoteJid,
    participant: null,
    dataJson: message.dataJson || JSON.stringify(data),
    rawMetaPayload,
    remoteIdentifierType: remoteIdentifier.type,
    remoteIdentifierValue: remoteIdentifier.value,
    remoteUsername: normalizeUsernameValue(message.remoteUsername),
    remoteWaId: normalizeStringValue(message.remoteWaId),
    remotePhone: normalizeStringValue(message.remotePhone) || normalizeStringValue(fromNumber),
    ticketTrakingId: null,
    isPrivate: false,
    createdAt: new Date(
      Math.floor(getTimestampMessage(message.timestamp) * 1000)
    ).toISOString(),
    ticketImported: null,
    isForwarded: false
  };

  await CreateMessageService({ messageData, companyId: companyId });

  if (!isFromMe && contact?.id) {
    try {
      const FloupService = (await import("../../plugins/floup/service")).default;
      await FloupService.verificarECancelarFloupsAoReceberMensagem(
        ticket.id,
        contact.id,
        companyId,
        messageData.body || ""
      );
    } catch (floupError) {
      console.warn(`[FLOUP] Erro ao verificar condições de parada (WhatsApp Oficial):`, floupError);
    }
  }
};

export default verifyMessageOficial;