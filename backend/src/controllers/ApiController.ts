import { Request, Response } from "express";
import * as Yup from "yup";
import fs from "fs";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import SendWhatsAppMedia, { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { getWbot } from "../libs/wbot";
import SendWhatsAppMessageLink from "../services/WbotServices/SendWhatsAppMessageLink";
import SendWhatsAppMessageAPI from "../services/WbotServices/SendWhatsAppMessageAPI";
import SendWhatsAppMediaImage from "../services/WbotServices/SendWhatsappMediaImage";
import ApiUsages from "../models/ApiUsages";
import { useDate } from "../utils/useDate";
import moment from "moment";
import CompaniesSettings from "../models/CompaniesSettings";
import ShowUserService from "../services/UserServices/ShowUserService";
import { isNil } from "lodash";
import { verifyMediaMessage, verifyMessage } from "../services/WbotServices/wbotMessageListener";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import path from "path";
import Contact from "../models/Contact";
import WhatsappLidMap from "../models/WhatsapplidMap";
import FindOrCreateATicketTrakingService from "../services/TicketServices/FindOrCreateATicketTrakingService";
import { Mutex } from "async-mutex";

type WhatsappData = {
  whatsappId: number;
};

export class OnWhatsAppDto {
  constructor(public readonly jid: string, public readonly exists: boolean) { }
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  queueId?: number;
  userId?: number;
  sendSignature?: boolean;
  closeTicket?: boolean;
  requireUserAcceptance?: boolean;
  ignoreTicket?: boolean;
  noRegister?: boolean;
};

interface ContactData {
  number: string;
  isGroup: boolean;
}

const createContact = async (
  whatsappId: number | undefined,
  companyId: number | undefined,
  newContact: string,
  userId?: number | 0,
  queueId?: number | 0,
  wbot?: any
) => {
  try {
    // await CheckIsValidContact(newContact, companyId);

    const validNumber: any = await CheckContactNumber(newContact, companyId, newContact.length > 17);

    const contactData = {
      name: `${validNumber.jid.replace(/\D/g, "")}`,
      number: validNumber.jid.split("@")[0],
      profilePicUrl: "",
      isGroup: false,
      companyId,
      whatsappId,
      remoteJid: validNumber.jid,
      wbot
    };

    const contact = await CreateOrUpdateContactService(contactData);

    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    }
    )    // return contact;

    let whatsapp: Whatsapp | null;

    if (whatsappId === undefined) {
      whatsapp = await GetDefaultWhatsApp(companyId);
    } else {
      whatsapp = await Whatsapp.findByPk(whatsappId);

      if (whatsapp === null) {
        throw new AppError(`whatsapp #${whatsappId} not found`);
      }
    }

    const mutex = new Mutex();
    // Inclui a busca de ticket aqui, se realmente não achar um ticket, então vai para o findorcreate
    const createTicket = await mutex.runExclusive(async () => {
      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        companyId,
        queueId,
        userId,
        null,
        whatsapp.channel,
        null,
        false,
        settings,
        false,
        false
      );
      return ticket;
    });

    if (createTicket && createTicket.channel === "whatsapp") {
      SetTicketMessagesAsRead(createTicket);

      await FindOrCreateATicketTrakingService({ ticketId: createTicket.id, companyId, whatsappId: whatsapp.id, userId });

    }

    return createTicket;
  } catch (error) {
    throw new AppError(error.message);
  }
};

function formatBRNumber(jid: string) {
  const regexp = new RegExp(/^(\d{2})(\d{2})\d{1}(\d{8})$/);
  if (regexp.test(jid)) {
    const match = regexp.exec(jid);
    if (match && match[1] === '55' && Number.isInteger(Number.parseInt(match[2]))) {
      const ddd = Number.parseInt(match[2]);
      if (ddd < 31) {
        return match[0];
      } else if (ddd >= 31) {
        return match[1] + match[2] + match[3];
      }
    }
  } else {
    return jid;
  }
}

function createJid(number: string) {
  if (number.includes('@g.us') || number.includes('@s.whatsapp.net')) {
    return formatBRNumber(number) as string;
  }
  return number.includes('-')
    ? `${number}@g.us`
    : `${formatBRNumber(number)}@s.whatsapp.net`;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;

  const { whatsappId }: WhatsappData = req.body;
  const { msdelay }: any = req.body;
  const {
    number,
    body,
    quotedMsg,
    userId,
    queueId,
    sendSignature = false,
    closeTicket = false,
    requireUserAcceptance = false,
    noRegister = false
  }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.", 401);
  const companyId = whatsapp.companyId;

  newContact.number = newContact.number.replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),
    sendSignature: Yup.boolean().notRequired().default(false),
    closeTicket: Yup.boolean().notRequired().default(false),
    requireUserAcceptance: Yup.boolean().notRequired().default(false)
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const wbot = await getWbot(whatsapp.id);

  let user
  if (userId?.toString() !== "" && !isNaN(userId)) {
    user = await ShowUserService(userId, companyId);
  }

  let queue
  if (queueId?.toString() !== "" && !isNaN(queueId)) {
    queue = await ShowQueueService(queueId, companyId);
  }

  let bodyMessage;

  // @ts-ignore: Unreachable code error
  if (sendSignature && !isNil(user)) {
    bodyMessage = `*${user.name}:*\n${body.trim()}`
  } else {
    bodyMessage = body.trim();
  }

  if (noRegister) {
    if (medias) {
      try {
        // console.log(medias)
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            const publicFolder = path.resolve(__dirname, "..", "..", "public");
            const filePath = path.join(publicFolder, `company${companyId}`, media.filename);

            const options = await getMessageOptions(media.filename, filePath, companyId.toString(), `\u200e ${bodyMessage}`);
            await wbot.sendMessage(
              `${newContact.number}@${newContact.number.length > 17 ? "g.us" : "s.whatsapp.net"}`,
              options);

            const fileExists = fs.existsSync(filePath);

            if (fileExists) {
              fs.unlinkSync(filePath);
            }
          })
        )
      } catch (error) {
        console.log(medias)
        throw new AppError("Error sending API media: " + error.message);
      }
    } else {
      await wbot.sendMessage(
        `${newContact.number}@${newContact.number.length > 17 ? "g.us" : "s.whatsapp.net"}`,
        {
          text: `\u200e ${bodyMessage}`
        })
    }
  } else {
    const contactAndTicket = await createContact(whatsapp.id, companyId, newContact.number, userId, queueId, wbot);

    let sentMessage

    if (medias) {
      try {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            sentMessage = await SendWhatsAppMedia({ body: `\u200e ${bodyMessage}`, media, ticket: contactAndTicket, isForwarded: false });

            const publicFolder = path.resolve(__dirname, "..", "..", "public");
            const filePath = path.join(publicFolder, `company${companyId}`, media.filename);
            const fileExists = fs.existsSync(filePath);

            if (fileExists) {
              fs.unlinkSync(filePath);
            }
          })
        );
        await verifyMediaMessage(sentMessage, contactAndTicket, contactAndTicket.contact, null, false, false, wbot);
      } catch (error) {
        throw new AppError("Error sending API media: " + error.message);
      }
    } else {
      sentMessage = await SendWhatsAppMessageAPI({ body: `\u200e${bodyMessage}`, whatsappId: whatsapp.id, contact: contactAndTicket.contact, quotedMsg, msdelay });
      await verifyMessage(sentMessage, contactAndTicket, contactAndTicket.contact)
    }
    // @ts-ignore: Unreachable code error
    if (closeTicket) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: { status: "closed", sendFarewellMessage: false, amountUsedBotQueues: 0, lastMessage: body },
          companyId,
        });
      }, 100);
    } else if (requireUserAcceptance) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: { status: "pending", amountUsedBotQueues: 0, lastMessage: body, queueId },
          companyId,
        });
      }, 100);
    } else if (userId?.toString() !== "" && !isNaN(userId)) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: contactAndTicket.id,
          ticketData: { status: "open", amountUsedBotQueues: 0, lastMessage: body, userId, queueId },
          companyId,
        });
      }, 100);
    }
  }

  setTimeout(async () => {
    const { dateToClient } = useDate();

    const hoje: string = dateToClient(new Date())
    const timestamp = moment().format();

    let exist = await ApiUsages.findOne({
      where: {
        dateUsed: hoje,
        companyId: companyId
      }
    });

    if (exist) {
      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            // const type = path.extname(media.originalname.replace('/','-'))

            if (media.mimetype.includes("pdf")) {
              await exist.update({
                usedPDF: exist.dataValues["usedPDF"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("image")) {
              await exist.update({
                usedImage: exist.dataValues["usedImage"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("video")) {
              await exist.update({
                usedVideo: exist.dataValues["usedVideo"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else {
              await exist.update({
                usedOther: exist.dataValues["usedOther"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            }

          })
        )
      } else {
        await exist.update({
          usedText: exist.dataValues["usedText"] + 1,
          UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
          updatedAt: timestamp
        });
      }
    } else {
      exist = await ApiUsages.create({
        companyId: companyId,
        dateUsed: hoje,
      });

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            // const type = path.extname(media.originalname.replace('/','-'))

            if (media.mimetype.includes("pdf")) {
              await exist.update({
                usedPDF: exist.dataValues["usedPDF"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("image")) {
              await exist.update({
                usedImage: exist.dataValues["usedImage"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else if (media.mimetype.includes("video")) {
              await exist.update({
                usedVideo: exist.dataValues["usedVideo"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            } else {
              await exist.update({
                usedOther: exist.dataValues["usedOther"] + 1,
                UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
                updatedAt: timestamp
              });
            }

          })
        )
      } else {
        await exist.update({
          usedText: exist.dataValues["usedText"] + 1,
          UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
          updatedAt: timestamp
        });
      }
    }

  }, 100);

  return res.send({ status: "SUCCESS" });
};

export const indexImage = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { whatsappId }: WhatsappData = req.body;
  const { msdelay }: any = req.body;
  const url = req.body.url;
  const caption = req.body.caption;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.", 401);
  const companyId = whatsapp.companyId;

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contactAndTicket = await createContact(whatsappId, companyId, newContact.number);

  if (url) {
    await SendWhatsAppMediaImage({ ticket: contactAndTicket, url, caption, msdelay });
  }

  setTimeout(async () => {
    await UpdateTicketService({
      ticketId: contactAndTicket.id,
      ticketData: { status: "closed", sendFarewellMessage: false, amountUsedBotQueues: 0 },
      companyId
    });
  }, 100);

  setTimeout(async () => {
    const { dateToClient } = useDate();

    const hoje: string = dateToClient(new Date())
    const timestamp = moment().format();

    const exist = await ApiUsages.findOne({
      where: {
        dateUsed: hoje,
        companyId: companyId
      }
    });

    if (exist) {
      await exist.update({
        usedImage: exist.dataValues["usedImage"] + 1,
        UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
        updatedAt: timestamp
      });
    } else {
      const usage = await ApiUsages.create({
        companyId: companyId,
        dateUsed: hoje,
      });

      await usage.update({
        usedImage: usage.dataValues["usedImage"] + 1,
        UsedOnDay: usage.dataValues["UsedOnDay"] + 1,
        updatedAt: timestamp
      });
    }

  }, 100);

  return res.send({ status: "SUCCESS" });
};

export const checkNumber = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) {
    return res.status(401).json({ error: "Token inválido ou WhatsApp não encontrado" });
  }
  const companyId = whatsapp.companyId;

  const number = newContact.number.replace("-", "").replace(" ", "");

  const whatsappDefault = await GetDefaultWhatsApp(companyId);
  const wbot = getWbot(whatsappDefault.id);
  const jid = createJid(number);

  try {
    // ✅ v7: Consultar WhatsappLidMap localmente antes de chamar onWhatsApp
    const contact = await Contact.findOne({ where: { number, companyId } });
    if (contact) {
      const localMap = await WhatsappLidMap.findOne({
        where: { companyId, contactId: contact.id }
      });
      if (localMap) {
        const result = { exists: true, jid: jid };

        setTimeout(async () => {
          const { dateToClient } = useDate();
          const hoje: string = dateToClient(new Date());
          const timestamp = moment().format();
          const exist = await ApiUsages.findOne({ where: { dateUsed: hoje, companyId } });
          if (exist) {
            await exist.update({ usedCheckNumber: exist.dataValues["usedCheckNumber"] + 1, UsedOnDay: exist.dataValues["UsedOnDay"] + 1, updatedAt: timestamp });
          } else {
            const usage = await ApiUsages.create({ companyId, dateUsed: hoje });
            await usage.update({ usedCheckNumber: usage.dataValues["usedCheckNumber"] + 1, UsedOnDay: usage.dataValues["UsedOnDay"] + 1, updatedAt: timestamp });
          }
        }, 100);

        return res.status(200).json({ existsInWhatsapp: true, number, numberFormatted: result.jid });
      }
    }

    // Fallback: consultar onWhatsApp
    const [result] = (await wbot.onWhatsApp(jid)) as {
      exists: boolean;
      jid: string;
    }[];

    if (result?.exists) {

      setTimeout(async () => {
        const { dateToClient } = useDate();

        const hoje: string = dateToClient(new Date())
        const timestamp = moment().format();

        const exist = await ApiUsages.findOne({
          where: {
            dateUsed: hoje,
            companyId: companyId
          }
        });

        if (exist) {
          await exist.update({
            usedCheckNumber: exist.dataValues["usedCheckNumber"] + 1,
            UsedOnDay: exist.dataValues["UsedOnDay"] + 1,
            updatedAt: timestamp
          });
        } else {
          const usage = await ApiUsages.create({
            companyId: companyId,
            dateUsed: hoje,
          });

          await usage.update({
            usedCheckNumber: usage.dataValues["usedCheckNumber"] + 1,
            UsedOnDay: usage.dataValues["UsedOnDay"] + 1,
            updatedAt: timestamp
          });
        }

      }, 100);

      return res.status(200).json({ existsInWhatsapp: true, number: number, numberFormatted: result.jid });
    }

  } catch (error) {
    return res.status(400).json({ existsInWhatsapp: false, number: jid, error: "Not exists on Whatsapp" });
  }

};

export const indexWhatsappsId = async (req: Request, res: Response): Promise<Response> => {

  return res.status(200).json('oi');

  // const { companyId } = req.user;
  // const whatsapps = await ListWhatsAppsService({ companyId });

  // let wpp = [];

  // if (whatsapps.length > 0) {
  //     whatsapps.forEach(whatsapp => {

  //         let wppString;
  //         wppString = {
  //             id: whatsapp.id,
  //             name: whatsapp.name,
  //             status: whatsapp.status,
  //             isDefault: whatsapp.isDefault,
  //             number: whatsapp.number
  //         }

  //         wpp.push(wppString)

  //     });
  // }

  // return res.status(200).json(wpp);
};

// ===================== NOVO: Envio de texto sem criar ticket =====================
export const sendNoTicket = async (req: Request, res: Response): Promise<Response> => {
  const { number, body, whatsappId, sendSignature = false, closeTicket = false, requireUserAcceptance = false, userId, queueId }: any = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.");
  const companyId = whatsapp.companyId;

  const schema = Yup.object().shape({
    number: Yup.string().required().matches(/^\d+$/, "Apenas números são permitidos."),
    body: Yup.string().required(),
    sendSignature: Yup.boolean().notRequired().default(false),
    closeTicket: Yup.boolean().notRequired().default(false),
    requireUserAcceptance: Yup.boolean().notRequired().default(false)
  });

  try {
    await schema.validate({ number, body });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const wbot = getWbot(whatsapp.id);
  const jid = createJid(number);

  let bodyMessage = body;
  if (sendSignature && userId) {
    try {
      const user = await ShowUserService(userId, companyId);
      if (user) bodyMessage = `*${user.name}:*\n${body.trim()}`;
    } catch (e) {}
  }

  try {
    await wbot.sendMessage(jid, { text: `\u200e${bodyMessage}` });
  } catch (err) {
    throw new AppError("Erro ao enviar mensagem: " + err.message);
  }

  return res.status(200).json({ status: "SUCCESS", message: "Mensagem enviada sem registro de ticket." });
};

// ===================== NOVO: Envio em lote =====================
export const sendBulk = async (req: Request, res: Response): Promise<Response> => {
  const { messages, delay: msDelay = 2000, sendSignature = false, closeTicket = false, requireUserAcceptance = false, userId, queueId }: {
    messages: { number: string; body: string }[];
    delay?: number;
    sendSignature?: boolean;
    closeTicket?: boolean;
    requireUserAcceptance?: boolean;
    userId?: number;
    queueId?: number;
  } = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.");
  const companyId = whatsapp.companyId;

  const schema = Yup.object().shape({
    messages: Yup.array().of(
      Yup.object().shape({
        number: Yup.string().required().matches(/^\d+$/, "Apenas números são permitidos."),
        body: Yup.string().required()
      })
    ).min(1, "O campo 'messages' deve ser um array não vazio.").max(100, "Limite máximo de 100 mensagens por lote.").required(),
    sendSignature: Yup.boolean().notRequired().default(false),
    closeTicket: Yup.boolean().notRequired().default(false),
    requireUserAcceptance: Yup.boolean().notRequired().default(false)
  });

  try {
    await schema.validate({ messages, sendSignature, closeTicket, requireUserAcceptance });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let user;
  if (sendSignature && userId) {
    try {
      user = await ShowUserService(userId, companyId);
    } catch (e) {}
  }

  const results: { number: string; status: string; error?: string }[] = [];
  const wbot = getWbot(whatsapp.id);

  for (const msg of messages) {
    const { number, body } = msg;
    try {
      const jid = createJid(number);
      await new Promise(resolve => setTimeout(resolve, msDelay));

      let bodyMessage = body;
      if (sendSignature && user) {
        bodyMessage = `*${user.name}:*\n${body.trim()}`;
      }

      await wbot.sendMessage(jid, { text: `\u200e${bodyMessage}` });
      results.push({ number, status: "SUCCESS" });
    } catch (err) {
      results.push({ number, status: "ERROR", error: err.message });
    }
  }

  return res.status(200).json({ results, total: messages.length, sent: results.filter(r => r.status === "SUCCESS").length });
};

// ===================== NOVO: Listar conexões disponíveis =====================
export const listConnections = async (req: Request, res: Response): Promise<Response> => {
  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.");
  const companyId = whatsapp.companyId;

  const connections = await Whatsapp.findAll({
    where: { companyId, deleted: false },
    attributes: ["id", "name", "status", "isDefault", "number", "channel"]
  });

  return res.status(200).json({ connections });
};

// ===================== NOVO: Envio de mensagens interativas (botões/lista) =====================
export const sendButtons = async (req: Request, res: Response): Promise<Response> => {
  const {
    number,
    body,
    footer,
    buttons,
    type = "buttons",
    // Campos para lista
    buttonText,
    sections,
    // Campos para URL
    url,
    urlText,
    // Campos para PIX/copy
    copyCode,
    // Opcionais
    userId,
    queueId,
    closeTicket = false,
    sendSignature = false,
  }: any = req.body;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const whatsapp = await Whatsapp.findOne({ where: { token } });
  if (!whatsapp) throw new AppError("Token inválido.", 401);
  const companyId = whatsapp.companyId;

  if (!number) throw new AppError("Necessário informar o número do destinatário.");

  const cleanNumber = number.replace(/\D/g, "");

  const schema = Yup.object().shape({
    number: Yup.string().required().matches(/^\d+$/, "Formato inválido. Apenas números."),
    body: Yup.string().required("Necessário informar o texto da mensagem."),
  });

  try {
    await schema.validate({ number: cleanNumber, body });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Importar o service dinamicamente para não afetar imports existentes
  const InteractiveMessageService = (await import("../services/WbotServices/InteractiveMessageService")).default;

  const jid = createJid(cleanNumber);

  try {
    const data: any = {
      text: body,
      footer,
      buttons,
      buttonText,
      sections,
      url,
      displayText: urlText,
      copyCode,
    };

    await InteractiveMessageService({
      companyId,
      whatsappId: whatsapp.id,
      jid,
      type,
      data,
    });
  } catch (err: any) {
    throw new AppError("Erro ao enviar mensagem interativa: " + err.message);
  }

  // Registrar uso na API
  setTimeout(async () => {
    const { dateToClient } = useDate();
    const hoje: string = dateToClient(new Date());
    const timestamp = moment().format();
    const exist = await ApiUsages.findOne({ where: { dateUsed: hoje, companyId } });
    if (exist) {
      await exist.update({ usedText: exist.dataValues["usedText"] + 1, UsedOnDay: exist.dataValues["UsedOnDay"] + 1, updatedAt: timestamp });
    } else {
      const usage = await ApiUsages.create({ companyId, dateUsed: hoje });
      await usage.update({ usedText: usage.dataValues["usedText"] + 1, UsedOnDay: usage.dataValues["UsedOnDay"] + 1, updatedAt: timestamp });
    }
  }, 100);

  return res.status(200).json({ status: "SUCCESS", message: "Mensagem interativa enviada com sucesso." });
};

