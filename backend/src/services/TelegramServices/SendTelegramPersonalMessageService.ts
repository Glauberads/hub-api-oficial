import Ticket from "../../models/Ticket";
import { sendTelegramPersonalText } from "./TelegramPersonalService";

type Request = {
  ticket: Ticket;
  body: string;
};

const SendTelegramPersonalMessageService = async ({
  ticket,
  body
}: Request): Promise<any> => {
  return sendTelegramPersonalText({
    ticket,
    body
  });
};

export default SendTelegramPersonalMessageService;
