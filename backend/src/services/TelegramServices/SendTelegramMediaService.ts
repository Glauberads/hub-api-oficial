import path from "path";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendTelegramMediaMessage } from "./TelegramApiService";

type Request = {
  media: any;
  ticket: Ticket;
  body?: string;
};

const extractTelegramChatId = (contact: Contact): string => {
  const remoteJid = String(contact.remoteJid || "");

  if (remoteJid.endsWith("@telegram")) {
    return remoteJid.replace("@telegram", "");
  }

  const number = String(contact.number || "");

  if (number.startsWith("telegram_")) {
    const parts = number.split("_");
    return parts[parts.length - 1];
  }

  return number;
};

const getMediaType = (media: any): "image" | "audio" | "video" | "document" | "voice" => {
  const mimetype = String(media?.mimetype || "").toLowerCase();

  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype === "audio/ogg" || mimetype.includes("opus")) return "voice";
  if (mimetype.startsWith("audio/")) return "audio";

  return "document";
};

const resolveMediaPath = (media: any, companyId: number): string => {
  if (media?.path) {
    return media.path;
  }

  if (media?.filename) {
    return path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      `company${companyId}`,
      media.filename
    );
  }

  throw new AppError("Arquivo de mídia Telegram não encontrado", 400);
};

const SendTelegramMediaService = async ({
  media,
  ticket,
  body
}: Request): Promise<any> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if ((whatsapp as any)?.telegramConnectionType === "personal") {
    const { sendTelegramPersonalMedia } = await import("./TelegramPersonalService");
    return sendTelegramPersonalMedia({ ticket, body, media });
  }


  const contact = await Contact.findByPk(ticket.contactId);

  if (!whatsapp || whatsapp.channel !== "telegram") {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  if (!contact) {
    throw new AppError("Contato Telegram não encontrado", 404);
  }

  const chatId = extractTelegramChatId(contact);
  const filePath = resolveMediaPath(media, ticket.companyId);
  const fileName = media.filename || path.basename(filePath);
  const mediaUrlToSave = media.mediaUrl || fileName;
  const mediaType = getMediaType(media);
  const caption = String(body || "").trim();

  const sent = await sendTelegramMediaMessage({
    token: whatsapp.token,
    chatId,
    filePath,
    fileName,
    caption,
    mediaType
  });

  const wid = `telegram-${sent?.chat?.id || chatId}-${sent?.message_id || Date.now()}`;

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body: caption || fileName,
      fromMe: true,
      read: true,
      mediaType: mediaType === "voice" ? "audio" : mediaType,
      mediaUrl: mediaUrlToSave,
      ack: 2,
      queueId: ticket.queueId,
      companyId: ticket.companyId,
      remoteJid: String(chatId),
      participant: null,
      dataJson: JSON.stringify(sent || {}),
      remoteIdentifierType: "telegram_chat_id",
      remoteIdentifierValue: String(chatId),
      remoteUsername: contact.whatsappUsername || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: sent || {}
    }
  });

  await ticket.update({
    lastMessage: caption || fileName,
    imported: null
  });

  return sent;
};

export default SendTelegramMediaService;
