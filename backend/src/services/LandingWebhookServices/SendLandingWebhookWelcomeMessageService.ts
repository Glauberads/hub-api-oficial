import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

interface Request {
  ticketId: number;
  companyId: number;
  body: string;
}

const getTicketWbot = async (ticket: any): Promise<any> => {
  try {
    const helper = require("../../helpers/GetTicketWbot");
    const fn = helper.default || helper;

    if (typeof fn === "function") {
      return await fn(ticket);
    }
  } catch (err) {
    // Continua para tentar fallback abaixo.
  }

  try {
    const wbotLib = require("../../libs/wbot");

    if (typeof wbotLib.getWbot === "function") {
      return wbotLib.getWbot(ticket.whatsappId);
    }
  } catch (err) {
    // Sem fallback disponível.
  }

  throw new AppError("Não foi possível obter a conexão WhatsApp do ticket.", 500);
};

const getCreateMessageService = (): any => {
  try {
    const service = require("../MessageServices/CreateMessageService");
    return service.default || service;
  } catch (err) {
    return null;
  }
};

const SendLandingWebhookWelcomeMessageService = async ({
  ticketId,
  companyId,
  body
}: Request): Promise<any> => {
  const messageBody = String(body || "").trim();

  if (!messageBody) {
    return null;
  }

  const ticket: any = await Ticket.findOne({
    where: {
      id: ticketId,
      companyId
    },
    include: [
      {
        model: Contact,
        as: "contact"
      }
    ]
  });

  if (!ticket) {
    throw new AppError("Ticket não encontrado para envio da mensagem.", 404);
  }

  if (!ticket.contact) {
    throw new AppError("Contato do ticket não encontrado.", 404);
  }

  if (!ticket.whatsappId) {
    throw new AppError("Ticket sem conexão WhatsApp vinculada.", 400);
  }

  const wbot = await getTicketWbot(ticket);

  const getBrazilPhoneVariants = (phone: string): string[] => {
  const normalized = String(phone || "").replace(/\D/g, "");
  const variants = new Set<string>();

  if (normalized) {
    variants.add(normalized);
  }

  if (normalized.startsWith("55")) {
    const withoutDdi = normalized.substring(2);

    if (withoutDdi.length === 11 && withoutDdi[2] === "9") {
      const ddd = withoutDdi.substring(0, 2);
      const numberWithoutNine = withoutDdi.substring(3);

      variants.add(`55${ddd}${numberWithoutNine}`);
    }

    if (withoutDdi.length === 10) {
      const ddd = withoutDdi.substring(0, 2);
      const number = withoutDdi.substring(2);

      variants.add(`55${ddd}9${number}`);
    }
  }

  return Array.from(variants);
};

const phoneVariants = getBrazilPhoneVariants(ticket.contact.number);
let jid = `${phoneVariants[0]}@s.whatsapp.net`;

for (const phoneVariant of phoneVariants) {
  const possibleJid = `${phoneVariant}@s.whatsapp.net`;

  try {
    if (typeof wbot.onWhatsApp === "function") {
      const [result] = await wbot.onWhatsApp(possibleJid);

      if (result?.exists) {
        jid = result.jid || possibleJid;
        break;
      }
    }
  } catch (err) {
    // Se não conseguir validar, usa o primeiro formato.
  }
}

  const sentMessage = await wbot.sendMessage(jid, {
    text: messageBody
  });

  const wid =
    sentMessage?.key?.id ||
    sentMessage?.messageTimestamp?.toString() ||
    `${Date.now()}`;

  const remoteJid = sentMessage?.key?.remoteJid || jid;

  const CreateMessageService = getCreateMessageService();

  if (CreateMessageService) {
    await CreateMessageService({
      messageData: {
        wid,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        body: messageBody,
        fromMe: true,
        read: true,
        mediaType: "chat",
        ack: 1,
        queueId: ticket.queueId,
        channel: "whatsapp",
        remoteJid,
        createdAt: new Date()
      },
      companyId
    });
  }

  await ticket.update({
    lastMessage: messageBody
  });

  return sentMessage;
};

export default SendLandingWebhookWelcomeMessageService;