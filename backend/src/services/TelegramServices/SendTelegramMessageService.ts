import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { sendTelegramTextMessage } from "./TelegramApiService";
import CreateMessageService from "../MessageServices/CreateMessageService";

type Request = {
  body: string;
  ticket: Ticket;
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

const SendTelegramMessageService = async ({
  body,
  ticket
}: Request): Promise<any> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if ((whatsapp as any)?.telegramConnectionType === "personal") {
    const SendTelegramPersonalMessageService = (await import("./SendTelegramPersonalMessageService")).default;
    return SendTelegramPersonalMessageService({ ticket, body });
  }


  const contact = await Contact.findByPk(ticket.contactId);

  if (!whatsapp || whatsapp.channel !== "telegram") {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  if (!contact) {
    throw new AppError("Contato Telegram não encontrado", 404);
  }

  const chatId = extractTelegramChatId(contact);

  if (!chatId) {
    throw new AppError("Chat ID Telegram não encontrado", 400);
  }

  const sent = await sendTelegramTextMessage({
    token: whatsapp.token,
    chatId,
    text: body
  });

  const wid = `telegram-${sent?.message_id || Date.now()}`;

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: true,
      read: true,
      mediaType: "chat",
      ack: 2,
      queueId: ticket.queueId,
      companyId: ticket.companyId,
      remoteJid: chatId,
      participant: null,
      dataJson: JSON.stringify(sent || {}),
      remoteIdentifierType: "telegram_chat_id",
      remoteIdentifierValue: chatId,
      remoteUsername: contact.whatsappUsername || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: sent || {}
    }
  });

  await ticket.update({
    lastMessage: body,
    imported: null
  });

  return sent;
};

export default SendTelegramMessageService;
