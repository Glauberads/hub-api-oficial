import { getIO } from "../../libs/socket";
import { sendPushToUser } from "../PushNotificationService";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

export interface MessageData {
  wid: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
  channel?: string;
  ticketTrakingId?: number;
  isPrivate?: boolean;
  ticketImported?: any;
  isForwarded?: boolean;
  companyId?: number;
  remoteJid?: string;
  participant?: string | null;
  dataJson?: string | null;
  quotedMsgId?: string | number | null;
  createdAt?: string | Date;
  remoteIdentifierType?: string | null;
  remoteIdentifierValue?: string | null;
  remoteUsername?: string | null;
  remoteWaId?: string | null;
  remotePhone?: string | null;
  rawMetaPayload?: Record<string, any> | null;
}

interface Request {
  messageData: MessageData;
  companyId: number;
}

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  const correctMediaType = (data: MessageData): MessageData => {
    if (data.mediaType === "audio") {
      return data;
    }

    const shouldBeAudio = (data: MessageData): boolean => {
      if (data.mediaUrl) {
        const audioExtensions = [".mp3", ".wav", ".ogg", ".webm", ".m4a", ".aac"];
        const url = data.mediaUrl.toLowerCase();

        if (audioExtensions.some(ext => url.includes(ext))) {
          return true;
        }

        if (url.includes("audio_")) {
          return true;
        }
      }

      if (data.body && typeof data.body === "string") {
        const body = data.body.toLowerCase();
        if (body.includes("áudio gravado") || body.includes("🎵 arquivo de áudio")) {
          return true;
        }
      }

      return false;
    };

    if (shouldBeAudio(data)) {
      console.log(`🎵 Corrigindo tipo de mídia de '${data.mediaType}' para 'audio'`);
      return {
        ...data,
        mediaType: "audio"
      };
    }

    return data;
  };

  const correctedMessageData = correctMediaType(messageData);

  const findMessageWithIncludes = async (): Promise<Message | null> => {
    return Message.findOne({
      where: {
        wid: correctedMessageData.wid,
        ticketId: correctedMessageData.ticketId
      },
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            {
              model: Contact,
              attributes: [
                "id",
                "name",
                "number",
                "email",
                "profilePicUrl",
                "acceptAudioMessage",
                "active",
                "urlPicture",
                "companyId"
              ],
              include: ["extraInfo", "tags"]
            },
            {
              model: Queue,
              attributes: ["id", "name", "color"]
            },
            {
              model: Whatsapp,
              attributes: ["id", "name", "groupAsTicket", "color"]
            },
            {
              model: User,
              attributes: ["id", "name"]
            },
            {
              model: Tag,
              as: "tags",
              attributes: ["id", "name", "color"]
            }
          ]
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });
  };

  let wasCreated = false;

  if (correctedMessageData.wid && correctedMessageData.ticketId) {
    const existingMessage = await findMessageWithIncludes();

    if (existingMessage) {
      if (!existingMessage.companyId) {
        await existingMessage.update({ companyId });
      }

      logger.info(
        `[DEDUP-MESSAGE] Mensagem já existe, ignorando duplicidade: wid=${correctedMessageData.wid}, ticketId=${correctedMessageData.ticketId}`
      );

      return existingMessage;
    }
  }

  try {
    const {
      ticketImported: _ticketImported,
      channel: _channel,
      ...rawMessageDefaults
    } = correctedMessageData as any;

    const messageDefaults = {
      ...rawMessageDefaults,
      companyId
    };

    const [, created] = await Message.findOrCreate({
      where: {
        wid: messageDefaults.wid,
        ticketId: messageDefaults.ticketId
      },
      defaults: messageDefaults
    });

    wasCreated = created;
  } catch (error: any) {
    if (
      error?.name === "SequelizeUniqueConstraintError" ||
      error?.parent?.code === "23505"
    ) {
      const existingMessage = await findMessageWithIncludes();

      if (existingMessage) {
        logger.info(
          `[DEDUP-MESSAGE] Duplicidade capturada pelo índice único, retornando existente: wid=${correctedMessageData.wid}, ticketId=${correctedMessageData.ticketId}`
        );

        return existingMessage;
      }
    }

    throw error;
  }

  const message = await findMessageWithIncludes();

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (!wasCreated) {
    logger.info(
      `[DEDUP-MESSAGE] Mensagem encontrada após findOrCreate, não emitindo duplicada: wid=${correctedMessageData.wid}, ticketId=${correctedMessageData.ticketId}`
    );

    return message;
  }

  try {
    const ticket = await Ticket.findByPk(correctedMessageData.ticketId);
    if (ticket?.whatsappId) {
      const field = correctedMessageData.fromMe ? "sentMessages" : "receivedMessages";
      await Whatsapp.increment(field, { where: { id: ticket.whatsappId } });
    }
  } catch (err) {
    console.warn("Erro ao incrementar contador de mensagens:", err);
  }

  if (
    message.ticket?.queueId !== null &&
    message.ticket?.queueId !== undefined &&
    message.queueId === null
  ) {
    await message.update({ queueId: message.ticket.queueId });
  }

  if (message.isPrivate) {
    await message.update({ wid: `PVT${message.id}` });
  }

  const io = getIO();

  if (!messageData?.ticketImported) {
    if (message.ticket && messageData.body && !message.ticket.lastMessage) {
      message.ticket.lastMessage = messageData.body;
    }

    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket?.contact
    });

    if (!message.fromMe && message.ticket?.userId && message.ticket?.companyId) {
      const contactName = message.ticket?.contact?.name || "Contato";

      console.log(
        `[PUSH DEBUG] ticketId=${message.ticket.id} userId=${message.ticket.userId} companyId=${message.ticket.companyId}`
      );

      sendPushToUser(message.ticket.userId, message.ticket.companyId, {
        title: `💬 ${contactName}`,
        body: message.body?.substring(0, 100) || "Nova mensagem",
        icon: message.ticket?.contact?.urlPicture || "/android-chrome-192x192.png",
        tag: `ticket-${message.ticket.id}`,
        url: `/tickets/${message.ticket.uuid}`,
        ticketId: message.ticket.id
      }).catch(err => {
        console.log("[PUSH DEBUG] erro ao enviar push:", err?.message || err);
      });
    }
  }

  return message;
};

export default CreateMessageService;