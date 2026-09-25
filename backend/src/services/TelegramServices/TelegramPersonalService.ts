import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ProcessTelegramFlowBuilderService from "./TelegramFlowBuilderService";
import SaveTelegramContactProfilePhotoService from "./SaveTelegramContactProfilePhotoService";
import logger from "../../utils/logger";

const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

type ClientEntry = {
  client: any;
  listening: boolean;
};

const clients = new Map<number, ClientEntry>();

const normalizePhone = (phone: string): string => {
  const value = String(phone || "").trim();
  if (!value.startsWith("+")) {
    return `+${value.replace(/\D/g, "")}`;
  }
  return `+${value.replace(/\D/g, "")}`;
};

const getApiCredentials = (whatsapp: Whatsapp) => {
  const apiId = Number((whatsapp as any).telegramApiId || 0);
  const apiHash = String((whatsapp as any).telegramApiHash || "").trim();

  if (!apiId || !apiHash) {
    throw new AppError("API ID/API Hash do Telegram não configurados", 400);
  }

  return { apiId, apiHash };
};

const buildClient = async (whatsapp: Whatsapp, forceNew = false): Promise<any> => {
  const existing = clients.get(whatsapp.id);

  if (existing && !forceNew) {
    return existing.client;
  }

  if (existing && forceNew) {
    try {
      await existing.client.disconnect();
    } catch {
      // ignore
    }
    clients.delete(whatsapp.id);
  }

  const { apiId, apiHash } = getApiCredentials(whatsapp);
  const stringSession = new StringSession(String((whatsapp as any).telegramSession || ""));

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5
  });

  await client.connect();

  clients.set(whatsapp.id, {
    client,
    listening: false
  });

  return client;
};

const getDisplayName = (sender: any, fallback: string): string => {
  const firstName = String(sender?.firstName || "").trim();
  const lastName = String(sender?.lastName || "").trim();
  const username = String(sender?.username || "").trim();

  return [firstName, lastName].filter(Boolean).join(" ") || username || fallback;
};

const getPeerId = (message: any): string | null => {
  const senderId =
    message?.senderId ||
    message?.fromId?.userId ||
    message?.peerId?.userId ||
    message?.chatId;

  if (!senderId) return null;

  return String(senderId);
};


const updateTelegramPersonalContactProfilePicture = async ({
  whatsapp,
  contact,
  sender
}: {
  whatsapp: Whatsapp;
  contact: Contact;
  sender: any;
}): Promise<void> => {
  try {
    if (!sender) return;

    if (contact.profilePicUrl) {
      return;
    }

    const client = await buildClient(whatsapp);

    let downloaded: any = null;

    try {
      downloaded = await client.downloadProfilePhoto(sender, {
        isBig: true
      });
    } catch (error) {
      logger.warn(`[TELEGRAM PERSONAL PROFILE] downloadProfilePhoto falhou contato=${contact.id}:`, error);
      return;
    }

    if (!downloaded) {
      return;
    }

    const buffer = Buffer.isBuffer(downloaded)
      ? downloaded
      : Buffer.from(downloaded);

    if (!buffer.length) {
      return;
    }

    await SaveTelegramContactProfilePhotoService({
      contact,
      companyId: whatsapp.companyId,
      buffer,
      extension: ".jpg",
      source: "telegram_personal"
    });
  } catch (error) {
    logger.warn(`[TELEGRAM PERSONAL PROFILE] Falha ao atualizar foto do contato ${contact.id}:`, error);
  }
};


const createOrUpdateTelegramPersonalContact = async ({
  whatsapp,
  sender,
  peerId
}: {
  whatsapp: Whatsapp;
  sender: any;
  peerId: string;
}): Promise<Contact> => {
  const companyId = whatsapp.companyId;
  const name = getDisplayName(sender, peerId);
  const username = String(sender?.username || "").trim();
  const number = `telegram_personal_${peerId}`;
  const remoteJid = `${peerId}@telegram_personal`;

  let contact = await Contact.findOne({
    where: {
      companyId,
      [Op.or]: [
        { number },
        { remoteJid }
      ]
    }
  });

  if (!contact) {
    contact = await Contact.create({
      name,
      number,
      email: "",
      profilePicUrl: "",
      isGroup: false,
      companyId,
      channel: "telegram",
      remoteJid,
      whatsappUsername: username,
      whatsappId: whatsapp.id,
      active: true
    } as any);
  } else {
    await contact.update({
      name: contact.name || name,
      channel: "telegram",
      remoteJid,
      whatsappUsername: username || contact.whatsappUsername,
      whatsappId: whatsapp.id,
      active: true
    } as any);
  }


  await updateTelegramPersonalContactProfilePicture({
    whatsapp,
    contact,
    sender
  });


  return contact;
};

const saveIncomingTextMessage = async ({
  whatsapp,
  contact,
  ticket,
  wid,
  body,
  raw,
  mediaType = "chat",
  mediaUrl = null
}: {
  whatsapp: Whatsapp;
  contact: Contact;
  ticket: Ticket;
  wid: string;
  body: string;
  raw: any;
  mediaType?: string;
  mediaUrl?: string | null;
}): Promise<void> => {
  const exists = await Message.findOne({
    where: {
      wid,
      companyId: whatsapp.companyId
    }
  });

  if (exists) return;

  await CreateMessageService({
    companyId: whatsapp.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: false,
      read: false,
      mediaType,
      mediaUrl,
      ack: 0,
      queueId: ticket.queueId,
      companyId: whatsapp.companyId,
      remoteJid: contact.remoteJid,
      participant: null,
      dataJson: JSON.stringify(raw || {}),
      remoteIdentifierType: "telegram_personal_user_id",
      remoteIdentifierValue: contact.remoteJid?.replace("@telegram_personal", ""),
      remoteUsername: contact.whatsappUsername || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: raw || {}
    } as any
  });

  await ticket.update({
    lastMessage: body,
    unreadMessages: Number(ticket.unreadMessages || 0) + 1
  } as any);
};


const getTelegramPersonalMimeExtension = (mimeType: string): string => {
  const mime = String(mimeType || "").toLowerCase();

  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "audio/ogg": ".oga",
    "audio/oga": ".oga",
    "audio/opus": ".oga",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "application/pdf": ".pdf",
    "application/zip": ".zip"
  };

  return map[mime] || "";
};

const getTelegramPersonalMediaType = (message: any): string | null => {
  if (!message?.media) return null;

  if (message?.photo) return "image";

  const mimeType = String(message?.document?.mimeType || "").toLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  return "document";
};

const getTelegramPersonalOriginalFileName = (message: any, fallback: string): string => {
  const attributes = message?.document?.attributes || [];

  for (const attr of attributes) {
    const fileName = attr?.fileName || attr?.filename;

    if (fileName) {
      return String(fileName);
    }
  }

  return fallback;
};

const downloadTelegramPersonalMediaIfNeeded = async ({
  whatsapp,
  message,
  peerId
}: {
  whatsapp: Whatsapp;
  message: any;
  peerId: string;
}): Promise<{
  mediaType: string;
  mediaUrl: string;
  fileName: string;
  fullPath: string;
  mimetype: string;
} | null> => {
  if (!message?.media) return null;

  const mediaType = getTelegramPersonalMediaType(message) || "document";
  const mimetype =
    String(message?.document?.mimeType || "") ||
    (mediaType === "image" ? "image/jpeg" : "application/octet-stream");

  const extension =
    getTelegramPersonalMimeExtension(mimetype) ||
    (mediaType === "image" ? ".jpg" : "");

  const originalName = getTelegramPersonalOriginalFileName(
    message,
    `telegram_personal_${mediaType}_${peerId}_${message.id}${extension}`
  );

  const safeOriginalName = String(originalName)
    .replace(/[^\w.\-()À-ÿ ]+/g, "_")
    .replace(/\s+/g, "_");

  const fileName = `${Date.now()}_telegram_personal_${mediaType}_${peerId}_${message.id}_${safeOriginalName}`;

  const folder = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${whatsapp.companyId}`
  );

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  const fullPath = path.join(folder, fileName);

  const client = await buildClient(whatsapp);

  logger.info(`[TELEGRAM PERSONAL MEDIA] Baixando mídia conexão=${whatsapp.id}, peer=${peerId}, type=${mediaType}, mime=${mimetype}`);

  let downloaded: any = null;

  try {
    downloaded = await client.downloadMedia(message.media, {
      workers: 1
    });
  } catch (firstError) {
    logger.warn("[TELEGRAM PERSONAL MEDIA] downloadMedia(message.media) falhou, tentando message completo");
    downloaded = await client.downloadMedia(message, {
      workers: 1
    });
  }

  if (!downloaded) {
    logger.warn(`[TELEGRAM PERSONAL MEDIA] Nenhum buffer retornado para messageId=${message.id}`);
    return null;
  }

  const buffer = Buffer.isBuffer(downloaded)
    ? downloaded
    : Buffer.from(downloaded);

  fs.writeFileSync(fullPath, buffer);
  fs.chmodSync(fullPath, 0o666);

  logger.info(`[TELEGRAM PERSONAL MEDIA] Mídia salva: ${fullPath}`);

  return {
    mediaType,
    mediaUrl: fileName,
    fileName,
    fullPath,
    mimetype
  };
};


const processIncomingPersonalMessage = async ({
  whatsappId,
  event
}: {
  whatsappId: number;
  event: any;
}): Promise<void> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) return;
    if (whatsapp.channel !== "telegram") return;
    if ((whatsapp as any).telegramConnectionType !== "personal") return;

    const message = event?.message;

    if (!message) return;

    // Evita duplicar mensagens enviadas pelo painel.
    if (message.out) return;

    const hasMedia = Boolean(message?.media);
    const body = String(message.message || "").trim();

    if (!body && !hasMedia) return;

    const peerId = getPeerId(message);
    if (!peerId) return;

    let sender: any = null;

    try {
      sender = await message.getSender();
    } catch {
      sender = {};
    }

    const contact = await createOrUpdateTelegramPersonalContact({
      whatsapp,
      sender,
      peerId
    });

    const settings = await CompaniesSettings.findOne({
      where: { companyId: whatsapp.companyId }
    });

    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      1,
      whatsapp.companyId,
      null,
      null,
      null,
      "telegram",
      false,
      false,
      settings
    );

    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      userId: null
    });

    const wid = `telegram-personal-${whatsapp.id}-${message.id}`;

    const mediaInfo = await downloadTelegramPersonalMediaIfNeeded({
      whatsapp,
      message,
      peerId
    });

    const finalBody =
      body ||
      mediaInfo?.fileName ||
      (mediaInfo ? "Mídia Telegram" : "");

    await saveIncomingTextMessage({
      whatsapp,
      contact,
      ticket,
      wid,
      body: finalBody,
      raw: message,
      mediaType: mediaInfo?.mediaType || "chat",
      mediaUrl: mediaInfo?.mediaUrl || null
    });

    logger.info(
      `[TELEGRAM PERSONAL] Mensagem recebida ticket=${ticket.id}, peer=${peerId}, type=${mediaInfo?.mediaType || "chat"}, body="${finalBody}"`
    );

    const ticketDataWebhook: any = (ticket as any).dataWebhook || {};
    const ticketIsAiMode =
      ticket.useIntegration &&
      ["openai", "gemini"].includes(String(ticketDataWebhook?.type || "")) &&
      ticket.status !== "open" &&
      ticket.isBot !== false;

    const shouldProcessFlow =
      finalBody &&
      (
        !mediaInfo ||
        !!body ||
        (mediaInfo?.mediaType === "audio" && ticketIsAiMode)
      );

    if (shouldProcessFlow) {
      await ProcessTelegramFlowBuilderService({
        whatsapp,
        ticket,
        contact,
        body: finalBody
      });
    }
  } catch (error) {
    logger.error("[TELEGRAM PERSONAL] Erro ao processar mensagem recebida:", error);
  }
};

export const startTelegramPersonalCodeService = async ({
  whatsapp
}: {
  whatsapp: Whatsapp;
}): Promise<any> => {
  if (whatsapp.channel !== "telegram") {
    throw new AppError("A conexão precisa ser do canal Telegram", 400);
  }

  await whatsapp.update({
    telegramConnectionType: "personal",
    status: "PAIRING",
    channel: "telegram"
  } as any);

  const { apiId, apiHash } = getApiCredentials(whatsapp);
  const phone = normalizePhone((whatsapp as any).telegramPhone);

  if (!phone) {
    throw new AppError("Telefone Telegram não informado", 400);
  }

  const client = await buildClient(whatsapp, true);

  logger.info(`[TELEGRAM PERSONAL] Solicitando código para conexão ${whatsapp.id}`);

  const result = await client.sendCode(
    { apiId, apiHash },
    phone
  );

  await whatsapp.update({
    telegramPhone: phone,
    telegramCodeHash: result.phoneCodeHash,
    telegramLastError: null,
    status: "PAIRING"
  } as any);

  return {
    whatsappId: whatsapp.id,
    phone,
    isCodeViaApp: result.isCodeViaApp,
    status: "PAIRING"
  };
};

export const confirmTelegramPersonalCodeService = async ({
  whatsapp,
  code,
  password
}: {
  whatsapp: Whatsapp;
  code: string;
  password?: string;
}): Promise<any> => {
  const { apiId, apiHash } = getApiCredentials(whatsapp);
  const phone = normalizePhone((whatsapp as any).telegramPhone);
  const phoneCodeHash = String((whatsapp as any).telegramCodeHash || "");

  if (!phoneCodeHash) {
    throw new AppError("Envie o código primeiro antes de confirmar", 400);
  }

  const client = await buildClient(whatsapp);

  let user: any = null;

  try {
    user = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: String(code || "").trim()
      })
    );
  } catch (error: any) {
    const message = String(error?.message || error || "");

    if (message.includes("SESSION_PASSWORD_NEEDED")) {
      if (!password) {
        await whatsapp.update({
          telegramLastError: "SESSION_PASSWORD_NEEDED",
          status: "PAIRING"
        } as any);

        return {
          whatsappId: whatsapp.id,
          status: "PAIRING",
          requiresPassword: true,
          message: "Senha 2FA necessária"
        };
      }

      user = await client.signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => String(password || ""),
          onError: (err: any) => {
            logger.error("[TELEGRAM PERSONAL] Erro na senha 2FA:", err);
          }
        }
      );
    } else {
      await whatsapp.update({
        telegramLastError: message,
        status: "DISCONNECTED"
      } as any);

      throw error;
    }
  }

  const session = client.session.save();
  const me = await client.getMe();

  const userId = String(me?.id || user?.user?.id || "");
  const username = String(me?.username || "").trim();
  const firstName = String(me?.firstName || "").trim();

  await whatsapp.update({
    telegramSession: session,
    telegramCodeHash: null,
    telegramPersonalUserId: userId,
    telegramPersonalUsername: username,
    telegramPersonalFirstName: firstName,
    number: username ? `@${username}` : phone,
    status: "CONNECTED",
    telegramLastError: null,
    qrcode: null
  } as any);

  await startTelegramPersonalSession(whatsapp.id);

  logger.info(`[TELEGRAM PERSONAL] Conexão ${whatsapp.id} autenticada como ${username || phone}`);

  return {
    whatsappId: whatsapp.id,
    status: "CONNECTED",
    userId,
    username,
    firstName,
    number: username ? `@${username}` : phone
  };
};

export const startTelegramPersonalSession = async (whatsappId: number): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp) {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  if (whatsapp.channel !== "telegram") return;
  if ((whatsapp as any).telegramConnectionType !== "personal") return;
  if (!(whatsapp as any).telegramSession) return;

  const client = await buildClient(whatsapp);
  const authorized = await client.isUserAuthorized();

  if (!authorized) {
    await whatsapp.update({
      status: "DISCONNECTED",
      telegramLastError: "Sessão Telegram não autorizada"
    } as any);
    return;
  }

  const entry = clients.get(whatsapp.id);

  if (entry && !entry.listening) {
    client.addEventHandler(
      (event: any) => processIncomingPersonalMessage({ whatsappId: whatsapp.id, event }),
      new NewMessage({})
    );

    entry.listening = true;
    clients.set(whatsapp.id, entry);
  }

  await whatsapp.update({
    status: "CONNECTED",
    telegramLastError: null
  } as any);

  logger.info(`[TELEGRAM PERSONAL] Listener iniciado para conexão ${whatsapp.id}`);
};

export const startAllTelegramPersonalSessions = async (): Promise<void> => {
  const connections = await Whatsapp.findAll({
    where: {
      channel: "telegram",
      telegramConnectionType: "personal",
      telegramSession: {
        [Op.ne]: null
      }
    } as any
  });

  logger.info(`[TELEGRAM PERSONAL] Iniciando ${connections.length} sessões pessoais`);

  for (const whatsapp of connections) {
    try {
      await startTelegramPersonalSession(whatsapp.id);
    } catch (error) {
      logger.error(`[TELEGRAM PERSONAL] Erro ao iniciar conexão ${whatsapp.id}:`, error);
    }
  }
};

export const stopTelegramPersonalSession = async (whatsappId: number): Promise<void> => {
  const entry = clients.get(whatsappId);

  if (entry) {
    try {
      await entry.client.destroy();
    } catch (error) {
      logger.warn(
        `[TELEGRAM PERSONAL] Falha ao destruir cliente da conexão ${whatsappId}:`,
        error
      );
    } finally {
      clients.delete(whatsappId);
    }
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (whatsapp) {
    await whatsapp.update({
      status: "DISCONNECTED"
    } as any);
  }

  logger.info(`[TELEGRAM PERSONAL] Sessão ${whatsappId} desconectada`);
};


const getMediaTypeFromMime = (mimetype?: string): string => {
  const mime = String(mimetype || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  return "document";
};


export const sendTelegramPersonalText = async ({
  ticket,
  body
}: {
  ticket: Ticket;
  body: string;
}): Promise<any> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  const contact = await Contact.findByPk(ticket.contactId);

  if (!whatsapp || whatsapp.channel !== "telegram" || (whatsapp as any).telegramConnectionType !== "personal") {
    throw new AppError("Conexão Telegram pessoal não encontrada", 404);
  }

  if (!contact) {
    throw new AppError("Contato Telegram não encontrado", 404);
  }

  const remoteJid = String(contact.remoteJid || "");
  const peerId = remoteJid.endsWith("@telegram_personal")
    ? remoteJid.replace("@telegram_personal", "")
    : String(contact.number || "").replace("telegram_personal_", "");

  if (!peerId) {
    throw new AppError("ID do contato Telegram pessoal não encontrado", 400);
  }

  await startTelegramPersonalSession(whatsapp.id);

  const client = await buildClient(whatsapp);
  const sent = await client.sendMessage(peerId, {
    message: String(body || "")
  });

  const wid = `telegram-personal-${whatsapp.id}-${sent?.id || Date.now()}`;

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
      remoteJid: contact.remoteJid,
      participant: null,
      dataJson: JSON.stringify(sent || {}),
      remoteIdentifierType: "telegram_personal_user_id",
      remoteIdentifierValue: peerId,
      remoteUsername: contact.whatsappUsername || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: sent || {}
    } as any
  });

  await ticket.update({
    lastMessage: body
  } as any);

  logger.info(`[TELEGRAM PERSONAL] Mensagem enviada ticket=${ticket.id}, peer=${peerId}`);

  return sent;
};


export const sendTelegramPersonalMedia = async ({
  ticket,
  body,
  media
}: {
  ticket: Ticket;
  body?: string;
  media: any;
}): Promise<any> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  const contact = await Contact.findByPk(ticket.contactId);

  if (!whatsapp || whatsapp.channel !== "telegram" || (whatsapp as any).telegramConnectionType !== "personal") {
    throw new AppError("Conexão Telegram pessoal não encontrada", 404);
  }

  if (!contact) {
    throw new AppError("Contato Telegram não encontrado", 404);
  }

  const remoteJid = String(contact.remoteJid || "");
  const peerId = remoteJid.endsWith("@telegram_personal")
    ? remoteJid.replace("@telegram_personal", "")
    : String(contact.number || "").replace("telegram_personal_", "");

  if (!peerId) {
    throw new AppError("ID do contato Telegram pessoal não encontrado", 400);
  }

  const mediaPath = String(media?.path || "").trim();

  if (!mediaPath || !fs.existsSync(mediaPath)) {
    throw new AppError("Arquivo da mídia Telegram pessoal não encontrado", 400);
  }

  await startTelegramPersonalSession(whatsapp.id);

  const client = await buildClient(whatsapp);

  const caption = String(body || "").trim();
  const sent = await client.sendFile(peerId, {
    file: mediaPath,
    caption
  });

  const mediaType = getMediaTypeFromMime(media?.mimetype);
  const mediaUrlToSave = String(
    media?.mediaUrl ||
    media?.filename ||
    path.basename(mediaPath)
  );

  const messageBody =
    caption ||
    String(media?.originalname || media?.filename || path.basename(mediaPath));

  const wid = `telegram-personal-${whatsapp.id}-${sent?.id || Date.now()}`;

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData: {
      wid,
      ticketId: ticket.id,
      contactId: contact.id,
      body: messageBody,
      fromMe: true,
      read: true,
      mediaType,
      mediaUrl: mediaUrlToSave,
      ack: 2,
      queueId: ticket.queueId,
      companyId: ticket.companyId,
      remoteJid: contact.remoteJid,
      participant: null,
      dataJson: JSON.stringify(sent || {}),
      remoteIdentifierType: "telegram_personal_user_id",
      remoteIdentifierValue: peerId,
      remoteUsername: contact.whatsappUsername || null,
      remoteWaId: null,
      remotePhone: null,
      rawMetaPayload: sent || {}
    } as any
  });

  await ticket.update({
    lastMessage: messageBody
  } as any);

  logger.info(`[TELEGRAM PERSONAL MEDIA] Mídia enviada ticket=${ticket.id}, peer=${peerId}, type=${mediaType}`);

  return sent;
};

