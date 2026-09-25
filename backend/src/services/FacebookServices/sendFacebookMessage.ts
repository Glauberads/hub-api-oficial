import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { sendText } from "./graphAPI";
import formatBody from "../../helpers/Mustache";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

interface RequestWithoutTicket {
  body: string;
  number: string;
  whatsapp: Whatsapp;
}

const resolveFacebookAccessToken = (whatsapp: Whatsapp | any): string => {
  const token =
    whatsapp?.facebookPageToken ||
    whatsapp?.pageAccessToken ||
    whatsapp?.facebookToken ||
    whatsapp?.accessToken ||
    whatsapp?.facebookUserToken;

  if (!token) {
    throw new AppError("ERR_FACEBOOK_TOKEN_NOT_FOUND");
  }

  return token;
};

const sendFacebookMessage = async ({ body, ticket, quotedMsg }: Request): Promise<any> => {
  try {
    const ticketWithRelations = await ShowTicketService(ticket.id, ticket.companyId);
    const { number } = ticketWithRelations.contact;

    const accessToken = resolveFacebookAccessToken(ticketWithRelations.whatsapp);

    const lastMessage = await Message.findOne({
      where: {
        ticketId: { [Op.lte]: ticket.id },
        companyId: ticket.companyId,
        contactId: ticket.contactId,
        fromMe: false
      },
      order: [["createdAt", "DESC"]],
      limit: 1
    });

    const twentyFourHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);
    let tag = null;

    if (!lastMessage || lastMessage.createdAt < twentyFourHoursAgo) {
      if (ticket.channel !== "instagram") {
        tag = "ACCOUNT_UPDATE";
      }
    }

    console.log("tag", tag);

    const processedBody = formatBody(body, ticketWithRelations);

    await sendText(
      number,
      processedBody,
      accessToken,
      tag
    );

    await ticket.update({ lastMessage: processedBody, fromMe: true });

    return { processedBody };
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }
};

const sendFacebookMessageWithoutTicket = async ({
  body,
  number,
  whatsapp
}: RequestWithoutTicket): Promise<any> => {
  try {
    const accessToken = resolveFacebookAccessToken(whatsapp);

    const send = await sendText(
      number,
      body,
      accessToken,
      null
    );

    return send;
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }
};

export { sendFacebookMessage, sendFacebookMessageWithoutTicket };