import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { sendTelegramButtonMessage } from "./TelegramApiService";
import AppError from "../../errors/AppError";

type TelegramMenuOption = {
  number: string | number;
  value: string;
};

type Request = {
  ticket: Ticket;
  body: string;
  options: TelegramMenuOption[];
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

const sanitizeTelegramHtml = (value: string): string => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const SendTelegramMenuService = async ({
  ticket,
  body,
  options
}: Request): Promise<any> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  const contact = await Contact.findByPk(ticket.contactId);

  if (!whatsapp || whatsapp.channel !== "telegram") {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  if (!contact) {
    throw new AppError("Contato Telegram não encontrado", 404);
  }

  const validOptions = (options || [])
    .filter(option => option?.number !== undefined && option?.value)
    .map(option => ({
      text: String(option.value),
      callback_data: String(option.number)
    }));

  if (!validOptions.length) {
    throw new AppError("Menu Telegram sem opções válidas", 400);
  }

  const chatId = extractTelegramChatId(contact);
  const safeBody = sanitizeTelegramHtml(body || "Selecione uma opção:");

  const sent = await sendTelegramButtonMessage({
    token: whatsapp.token,
    chatId,
    text: safeBody,
    buttons: validOptions
  });

  const bodyToSave = [
    body || "Selecione uma opção:",
    "",
    ...validOptions.map(option => `[${option.callback_data}] ${option.text}`)
  ].join("\n");

  const wid = `telegram-${sent?.chat?.id || chatId}-${sent?.message_id || Date.now()}`;

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body: bodyToSave,
      fromMe: true,
      read: true,
      mediaType: "chat",
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
    lastMessage: bodyToSave,
    imported: null
  });

  return sent;
};

export default SendTelegramMenuService;
