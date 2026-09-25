import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import DownloadTelegramMediaService from "./DownloadTelegramMediaService";
import ProcessTelegramFlowBuilderService from "./TelegramFlowBuilderService";
import SaveTelegramContactProfilePhotoService from "./SaveTelegramContactProfilePhotoService";
import { answerTelegramCallbackQuery, getTelegramUserProfilePhotoBuffer } from "./TelegramApiService";

type Request = {
  whatsappId: string | number;
  secret: string;
  headerSecret?: string | string[];
  update: any;
};


const updateTelegramBotContactProfilePicture = async ({
  whatsapp,
  contact,
  userId
}: {
  whatsapp: Whatsapp;
  contact: Contact;
  userId?: string | number | null;
}): Promise<void> => {
  try {
    if (!userId) {
      logger.info(`[TELEGRAM PROFILE] Bot sem userId para contato ${contact.id}`);
      return;
    }

    if (contact.profilePicUrl) {
      logger.info(`[TELEGRAM PROFILE] Bot contato ${contact.id} já possui foto. Ignorando.`);
      return;
    }

    logger.info(`[TELEGRAM PROFILE] Buscando foto Bot userId=${userId}, contato=${contact.id}`);

    const photo = await getTelegramUserProfilePhotoBuffer({
      token: whatsapp.token,
      userId
    });

    if (!photo?.buffer) {
      logger.info(`[TELEGRAM PROFILE] Bot não retornou foto userId=${userId}, contato=${contact.id}`);
      return;
    }

    await SaveTelegramContactProfilePhotoService({
      contact,
      companyId: whatsapp.companyId,
      buffer: photo.buffer,
      extension: photo.extension,
      source: "telegram_bot"
    });
  } catch (error) {
    logger.warn(`[TELEGRAM PROFILE] Falha ao atualizar foto do contato ${contact.id}:`, error);
  }
};


const getTelegramMessage = (update: any): any | null => {
  if (update?.message) return update.message;
  if (update?.edited_message) return update.edited_message;

  if (update?.callback_query) {
    const callback = update.callback_query;
    const originalMessage = callback.message || {};

    return {
      ...originalMessage,
      from: callback.from || originalMessage.from,
      chat: originalMessage.chat,
      text: callback.data || "",
      message_id: `callback_${callback.id || update.update_id}`,
      callback_query_id: callback.id,
      _isCallbackQuery: true
    };
  }

  return null;
};

const getMessageText = (message: any, update: any): string => {
  const callbackData = update?.callback_query?.data;

  return (
    message?.text ||
    message?.caption ||
    callbackData ||
    "[Mensagem Telegram]"
  );
};

const normalizeName = (from: any, chat: any): string => {
  const firstName = from?.first_name || chat?.first_name || "";
  const lastName = from?.last_name || chat?.last_name || "";
  const username = from?.username || chat?.username || "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || (username ? `@${username}` : "Contato Telegram");
};

const findOrCreateTelegramContact = async ({
  whatsapp,
  message
}: {
  whatsapp: Whatsapp;
  message: any;
}): Promise<Contact> => {
  const chat = message.chat;
  const from = message.from || chat;
  const chatId = String(chat.id);
  const username = from?.username || chat?.username || "";
  const number = `telegram_${whatsapp.companyId}_${chatId}`;
  const remoteJid = `${chatId}@telegram`;

  const [contact] = await Contact.findOrCreate({
    where: {
      number
    },
    defaults: {
      name: normalizeName(from, chat),
      number,
      whatsappUsername: username,
      email: "",
      profilePicUrl: "",
      isGroup: chat.type === "group" || chat.type === "supergroup",
      channel: "telegram",
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      remoteJid,
      lastInteractionClient: new Date()
    }
  });

  await contact.update({
    name: contact.name || normalizeName(from, chat),
    whatsappUsername: username || contact.whatsappUsername,
    channel: "telegram",
    companyId: whatsapp.companyId,
    whatsappId: whatsapp.id,
    remoteJid,
    lastInteractionClient: new Date()
  });

  return contact;
};

const findOrCreateTelegramTicket = async ({
  whatsapp,
  contact,
  body
}: {
  whatsapp: Whatsapp;
  contact: Contact;
  body: string;
}): Promise<Ticket> => {
  const openTicket = await Ticket.findOne({
    where: {
      contactId: contact.id,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      status: {
        [Op.in]: ["open", "pending"]
      }
    },
    order: [["updatedAt", "DESC"]]
  });

  if (openTicket) {
    await openTicket.update({
      unreadMessages: (openTicket.unreadMessages || 0) + 1,
      lastMessage: body,
      channel: "telegram"
    });

    return openTicket;
  }

  const queueId =
    Array.isArray((whatsapp as any).queues) && (whatsapp as any).queues.length > 0
      ? (whatsapp as any).queues[0].id
      : null;

  const ticket = await Ticket.create({
    status: "pending",
    unreadMessages: 1,
    lastMessage: body,
    isGroup: contact.isGroup,
    contactId: contact.id,
    whatsappId: whatsapp.id,
    queueId,
    companyId: whatsapp.companyId,
    channel: "telegram",
    fromMe: false
  });

  return ticket;
};

const HandleTelegramWebhookService = async ({
  whatsappId,
  secret,
  headerSecret,
  update
}: Request): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      channel: "telegram",
      telegramWebhookSecret: secret
    },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (!whatsapp) {
    throw new AppError("Webhook Telegram inválido", 404);
  }

  const normalizedHeaderSecret = Array.isArray(headerSecret)
    ? headerSecret[0]
    : headerSecret;

  if (
    normalizedHeaderSecret &&
    whatsapp.telegramWebhookSecret &&
    normalizedHeaderSecret !== whatsapp.telegramWebhookSecret
  ) {
    throw new AppError("Secret Telegram inválido", 403);
  }

  if (update?.callback_query?.id) {
    try {
      await answerTelegramCallbackQuery({
        token: whatsapp.token,
        callbackQueryId: update.callback_query.id
      });
    } catch (callbackError) {
      logger.warn("[TELEGRAM WEBHOOK] Falha ao responder callback_query:", callbackError);
    }
  }

  const message = getTelegramMessage(update);

  if (!message?.chat?.id) {
    return;
  }

  const media = await DownloadTelegramMediaService({
    token: whatsapp.token,
    companyId: whatsapp.companyId,
    message
  });

  const body = media?.body || getMessageText(message, update);
  const contact = await findOrCreateTelegramContact({ whatsapp, message });

  await updateTelegramBotContactProfilePicture({
    whatsapp,
    contact,
    userId: message?.from?.id || message?.chat?.id
  });

  const ticket = await findOrCreateTelegramTicket({ whatsapp, contact, body });

  const wid = `telegram-${message.chat.id}-${message.message_id || update.update_id}`;

  const exists = await Message.findOne({
    where: {
      wid,
      ticketId: ticket.id
    }
  });

  if (exists) {
    return;
  }

  await CreateMessageService({
    companyId: whatsapp.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: false,
      read: false,
      mediaType: media?.mediaType || "chat",
      mediaUrl: media?.fileName || null,
      ack: 0,
      queueId: ticket.queueId,
      companyId: whatsapp.companyId,
      remoteJid: String(message.chat.id),
      participant: message.from?.id ? String(message.from.id) : null,
      dataJson: JSON.stringify(update),
      remoteIdentifierType: "telegram_chat_id",
      remoteIdentifierValue: String(message.chat.id),
      remoteUsername: message.from?.username || message.chat?.username || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: update
    }
  });
  try {
    await ProcessTelegramFlowBuilderService({
      whatsapp,
      ticket,
      contact,
      body
    });
  } catch (error) {
    logger.error("[TELEGRAM WEBHOOK] Erro ao acionar FlowBuilder Telegram:", error);
  }

};

export default HandleTelegramWebhookService;
