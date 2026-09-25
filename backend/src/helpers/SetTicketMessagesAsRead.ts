import { delay, proto, WASocket } from "@whiskeysockets/baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import { setReadMessageWhatsAppOficial } from "../libs/whatsAppOficial/whatsAppOficial.service";
import Whatsapp from "../models/Whatsapp";
import { getWbot } from "../libs/wbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  if (!["open", "group"].includes(ticket.status) || ticket.unreadMessages <= 0) {
    return;
  }

  const whatsapp = ticket.whatsappId
    ? await Whatsapp.findOne({
        where: { id: ticket.whatsappId, companyId: ticket.companyId }
      })
    : null;

  try {
    const getJsonMessage = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    if (getJsonMessage.length > 0) {
      if (ticket.channel === "whatsapp_oficial" && whatsapp?.token) {
        for (const message of getJsonMessage) {
          if (message.wid) {
            await setReadMessageWhatsAppOficial(whatsapp.token, message.wid);
          }
        }
      } else if (
        ticket.channel === "whatsapp" &&
        ticket.whatsappId &&
        whatsapp &&
        whatsapp.status === "CONNECTED"
      ) {
        const wbot = await getWbot(ticket.whatsappId);

        for (const message of getJsonMessage) {
          const msg: proto.IWebMessageInfo = JSON.parse(message.dataJson);

          if (
            msg.key &&
            msg.key.fromMe === false &&
            !ticket.isBot &&
            (ticket.userId || ticket.isGroup)
          ) {
            await wbot.readMessages([msg.key]);
          }
        }
      }
    }

    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          fromMe: false,
          read: false
        }
      }
    );

    await ticket.update({ unreadMessages: 0 });
    await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

    const io = getIO();

    io.of(ticket.companyId.toString()).emit(`company-${ticket.companyId}-ticket`, {
      action: "updateUnread",
      ticketId: ticket.id
    });
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }
};

export default SetTicketMessagesAsRead;