import { proto, WASocket, WAMessage } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

import path, { join } from "path";

import {
  getBodyMessage,
  verifyMediaMessage,
  verifyMessage
} from "./wbotMessageListener";
import ShowDialogChatBotsServices from "../DialogChatBotsServices/ShowDialogChatBotsServices";
import ShowQueueService from "../QueueService/ShowQueueService";
import ShowChatBotServices from "../ChatBotServices/ShowChatBotServices";
import DeleteDialogChatBotsServices from "../DialogChatBotsServices/DeleteDialogChatBotsServices";
import ShowChatBotByChatbotIdServices from "../ChatBotServices/ShowChatBotByChatbotIdServices";
import CreateDialogChatBotsServices from "../DialogChatBotsServices/CreateDialogChatBotsServices";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import formatBody from "../../helpers/Mustache";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Chatbot from "../../models/Chatbot";
import ShowFileService from "../../services/FileServices/ShowService";
import { isNil, isNull } from "lodash";
import moment from "moment";

import SendWhatsAppMedia, { getMessageOptions } from "./SendWhatsAppMedia";
import CompaniesSettings from "../../models/CompaniesSettings";
import TicketTraking from "../../models/TicketTraking";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import logger from "../../utils/logger";

const fs = require("fs");

type Session = WASocket & {
  id?: number;
};

const isNumeric = (value: string) => /^-?\d+$/.test(value);

export const deleteAndCreateDialogStage = async (
  contact: Contact,
  chatbotId: number,
  ticket: Ticket
) => {
  try {
    await DeleteDialogChatBotsServices(contact.id);

    const bots = await ShowChatBotByChatbotIdServices(chatbotId);

    if (!bots) {
      await ticket.update({ isBot: false });
    }
    return await CreateDialogChatBotsServices({
      awaiting: 1,
      contactId: contact.id,
      chatbotId,
      queueId: bots.queueId
    });
  } catch (error) {
    await ticket.update({ isBot: false });
  }
};

const sendMessage = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  body: string
) => {
  // ✅ CORREÇÃO: Sempre usar JID tradicional, nunca lid como destino
  const jid = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

  if (ENABLE_LID_DEBUG) {
    logger.info(`[RDS-LID] ChatBot - Enviando para JID tradicional: ${jid}`);
    logger.info(`[RDS-LID] ChatBot - Contact lid: ${contact.lid}`);
    logger.info(
      `[RDS-LID] ChatBot - Contact remoteJid: ${contact.remoteJid}`
    );
  }

  let sentMessage: WAMessage;

  if (ticket.isGroup) {
    if (ENABLE_LID_DEBUG) {
      logger.info(`[RDS-LID] ChatBot - Enviando mensagem para grupo: ${jid}`);
    }

    try {
      sentMessage = await wbot.sendMessage(jid, {
        text: formatBody(body, ticket)
      });

      if (ENABLE_LID_DEBUG) {
        logger.info(
          `[RDS-LID] ChatBot - Sucesso na primeira tentativa para grupo ${jid}`
        );
      }
    } catch (err1) {
      if (ENABLE_LID_DEBUG) {
        logger.warn(
          `[RDS-LID] ChatBot - Falha na primeira tentativa: ${err1.message}`
        );
      }

      // ✅ CORREÇÃO: Tratamento específico para erro de criptografia de grupo
      if (err1.message && err1.message.includes("senderMessageKeys")) {
        if (ENABLE_LID_DEBUG) {
          logger.error(
            `[RDS-LID] ChatBot - Erro de criptografia de grupo detectado: ${err1.message}`
          );
        }

        // Tentar enviar sem criptografia (último recurso)
        try {
          if (ENABLE_LID_DEBUG) {
            logger.info(
              `[RDS-LID] ChatBot - Tentando envio sem criptografia para grupo ${jid}`
            );
          }

          sentMessage = await wbot.sendMessage(jid, {
            text: formatBody(body, ticket)
          });

          if (ENABLE_LID_DEBUG) {
            logger.info(
              `[RDS-LID] ChatBot - Sucesso no envio sem criptografia para grupo ${jid}`
            );
          }
        } catch (finalErr) {
          if (ENABLE_LID_DEBUG) {
            logger.error(
              `[RDS-LID] ChatBot - Falha no envio sem criptografia: ${finalErr.message}`
            );
          }
          throw finalErr;
        }
      } else {
        // Tentativa 2: Envio com delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        sentMessage = await wbot.sendMessage(jid, {
          text: formatBody(body, ticket)
        });

        if (ENABLE_LID_DEBUG) {
          logger.info(
            `[RDS-LID] ChatBot - Sucesso na segunda tentativa para grupo ${jid}`
          );
        }
      }
    }
  } else {
    sentMessage = await wbot.sendMessage(jid, {
      text: formatBody(body, ticket)
    });
  }

  await verifyMessage(sentMessage, ticket, contact);
};

const sendMessageLink = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        document: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        mimetype: "application/pdf"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody(
          "\u200eNão consegui enviar o PDF, tente novamente!",
          ticket
        )
      }
    );
  }
  await verifyMessage(sentMessage, ticket, contact);
};

const sendMessageImage = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        image: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "image/jpeg"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody("Não consegui enviar o PDF, tente novamente!", ticket)
      }
    );
  }
  await verifyMessage(sentMessage, ticket, contact);
};

// const sendDialog = async (
//   choosenQueue: Chatbot,
//   wbot: Session,
//   contact: Contact,
//   ticket: Ticket
// ) => {
//   const showChatBots = await ShowChatBotServices(choosenQueue.id);
//   if (showChatBots.options) {

//     const buttonActive = await Setting.findOne({
//       where: {
//         key: "chatBotType",
//         companyId: ticket.companyId
//       }
//     });

//     const typeBot = buttonActive?.value || "text";

//     const botText = async () => {
//       let options = "";

//       showChatBots.options.forEach((option, index) => {
//         options += `*${index + 1}* - ${option.name}\n`;
//       });

//       const optionsBack =
//         options.length > 0
//           ? `${options}\n*#* Voltar para o menu principal`
//           : options;

//       if (options.length > 0) {
//         const body = `\u200e${choosenQueue.greetingMessage}\n\n${optionsBack}`;
//         const sendOption = await sendMessage(wbot, contact, ticket, body);
//         return sendOption;
//       }

//       const body = `\u200e${choosenQueue.greetingMessage}`;
//       const send = await sendMessage(wbot, contact, ticket, body);
//       return send;
//     };

//     const botButton = async () => {
//       const buttons = [];
//       showChatBots.options.forEach((option, index) => {
//         buttons.push({
//           buttonId: `${index + 1}`,
//           buttonText: { displayText: option.name },
//           type: 1
//         });
//       });

//       if (buttons.length > 0) {
//         const buttonMessage = {
//           text: `\u200e${choosenQueue.greetingMessage}`,
//           buttons,
//           headerType: 1
//         };

//         // const send = await wbot.sendMessage(
//         //   `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
//         //   buttonMessage
//         // );

//         await wbot.presenceSubscribe(`${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)
//         await sleep(1500)
//         await wbot.sendPresenceUpdate('composing', `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)
//         await sleep(1000)
//         await wbot.sendPresenceUpdate('paused', `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)
//         const send = await wbot.sendMessage(
//           `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
//           buttonMessage
//         );

//         await verifyMessage(send, ticket, contact);

//         return send;
//       }

//       const body = `\u200e${choosenQueue.greetingMessage}`;
//       const send = await sendMessage(wbot, contact, ticket, body);

//       return send;
//     };

//     const botList = async () => {
//       const sectionsRows = [];
//       showChatBots.options.forEach((queue, index) => {
//         sectionsRows.push({
//           title: queue.name,
//           rowId: `${index + 1}`
//         });
//       });

//       if (sectionsRows.length > 0) {
//         const sections = [
//           {
//             title: "Menu",
//             rows: sectionsRows
//           }
//         ];

//         const listMessage = {
//           text: formatBody(`\u200e${choosenQueue.greetingMessage}`, ticket),
//           buttonText: "Escolha uma opção",
//           sections
//         };

//         await wbot.presenceSubscribe(`${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)
//         await sleep(1500)
//         await wbot.sendPresenceUpdate('composing', `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)
//         await sleep(1000)
//         await wbot.sendPresenceUpdate('paused', `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,)

//         const sendMsg = await wbot.sendMessage(
//           `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
//           listMessage
//         );

//         await verifyMessage(sendMsg, ticket, contact);

//         return sendMsg;
//       }

//       const body = `\u200e${choosenQueue.greetingMessage}`;
//       const send = await sendMessage(wbot, contact, ticket, body);

//       return send;
//     };

//     if (typeBot === "text") {
//       return botText();
//     }

//     if (typeBot === "button" && showChatBots.options.length > 3) {
//       return botText();
//     }

//     if (typeBot === "button" && showChatBots.options.length <= 3) {
//       return botButton();
//     }

//     if (typeBot === "list") {
//       return botList();
//     }
//   }
// };

const sendDialog = async (
  choosenQueue: Chatbot,
  wbot: Session,
  contact: Contact,
  ticket: Ticket
) => {
  const showChatBots = await ShowChatBotServices(choosenQueue.id);
  if (showChatBots.options) {
    let companyId = ticket.companyId;
    const buttonActive = await CompaniesSettings.findOne({
      where: { companyId }
    });

    const typeBot = buttonActive?.chatBotType || "text";

    const botText = async () => {
      let options = "";

      showChatBots.options.forEach((option, index) => {
        options += `*[ ${index + 1} ]* - ${option.name}\n`;
      });

      const optionsBack =
        options.length > 0
          ? `${options}\n*[ # ]* Voltar para o menu principal\n*[ Sair ]* Encerrar atendimento`
          : `${options}\n*[ Sair ]* Encerrar atendimento`;

      if (options.length > 0) {
        const body = formatBody(
          `\u200e ${choosenQueue.greetingMessage}\n\n${optionsBack}`,
          ticket
        );
        const sendOption = await sendMessage(wbot, contact, ticket, body);

        return sendOption;
      }

      const body = formatBody(`\u200e ${choosenQueue.greetingMessage}`, ticket);
      const send = await sendMessage(wbot, contact, ticket, body);

      // if (choosenQueue.closeTicket) {
      //   await sendMsgAndCloseTicket(wbot, ticket.contact, ticket);
      // }

      return send;
    };

    const botButton = async () => {
      if (showChatBots.options.length > 0) {
        const jid = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
        const bodyText = `\u200e${choosenQueue.greetingMessage}`;
        
        const { sendInteractiveButtons } = await import("../../helpers/SendInteractiveMsg");
        const msg = await sendInteractiveButtons({
          wbot,
          jid,
          bodyText,
          buttons: showChatBots.options.map((option, index) => ({
            displayText: option.name,
            id: `${index + 1}`,
          })),
        });
        // Criar mensagem no sistema para registro
        const msgData = {
          key: msg.key,
          message: { conversation: bodyText },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: "",
          status: 2
        };
        await verifyMessage(msgData as any, ticket, contact);
        return msg;
      }

      const body = `\u200e${choosenQueue.greetingMessage}`;
      const send = await sendMessage(wbot, contact, ticket, body);

      return send;
    };

    const botList = async () => {
      const sectionsRows = [];
      showChatBots.options.forEach((queue, index) => {
        sectionsRows.push({
          header: "",
          title: queue.name,
          description: "",
          id: `${index + 1}`
        });
      });

      if (sectionsRows.length > 0) {
        const jid = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
        const bodyText = formatBody(`\u200e${choosenQueue.greetingMessage}`, ticket);

        const { sendInteractiveList } = await import("../../helpers/SendInteractiveMsg");
        const msg = await sendInteractiveList({
          wbot,
          jid,
          bodyText,
          buttonText: "Escolha uma opção",
          sections: [{
            title: "Menu",
            rows: sectionsRows,
          }],
        });
        const msgData = {
          key: msg.key,
          message: { conversation: bodyText },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: "",
          status: 2
        };
        await verifyMessage(msgData as any, ticket, contact);
        return msg;
      }

      const body = `\u200e${choosenQueue.greetingMessage}`;
      const send = await sendMessage(wbot, contact, ticket, body);

      return send;
    };

    if (typeBot === "text") {
      return await botText();
    }

    if (typeBot === "button" && showChatBots.options.length > 4) {
      return await botText();
    }

    if (typeBot === "button" && showChatBots.options.length <= 4) {
      return await botButton();
    }

    if (typeBot === "list") {
      return await botList();
    }
  }
};

const backToMainMenu = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  await UpdateTicketService({
    ticketData: { queueId: null, userId: null },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
  // console.log("GETTING WHATSAPP BACK TO MAIN MENU", ticket.whatsappId, wbot.id)
  const { queues, greetingMessage, greetingMediaAttachment } =
    await ShowWhatsAppService(wbot.id || ticket.whatsappId, ticket.companyId);

  const buttonActive = await CompaniesSettings.findOne({
    where: {
      companyId: ticket.companyId
    }
  });

  const botText = async () => {
    let options = "";

    queues.forEach((option, index) => {
      options += `*[ ${index + 1} ]* - ${option.name}\n`;
    });
    options += `\n*[ Sair ]* - Encerrar Atendimento`;

    const body = formatBody(`\u200e ${greetingMessage}\n\n${options}`, ticket);

    if (greetingMediaAttachment !== null) {
      const filePath = path.resolve(
        "public",
        `company${ticket.companyId}`,
        ticket.whatsapp.greetingMediaAttachment
      );

      const messagePath = ticket.whatsapp.greetingMediaAttachment;
      const optionsMsg = await getMessageOptions(
        messagePath,
        filePath,
        String(ticket.companyId),
        body
      );

      const sentMessage = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        { ...optionsMsg }
      );

      await verifyMediaMessage(
        sentMessage,
        ticket,
        contact,
        ticketTraking,
        false,
        false,
        wbot
      );
    } else {
      const sentMessage = await wbot.sendMessage(
        `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        {
          text: body
        }
      );

      await verifyMessage(sentMessage, ticket, contact);
    }

    const deleteDialog = await DeleteDialogChatBotsServices(contact.id);
    return deleteDialog;
  };

  if (buttonActive.chatBotType === "text") {
    return botText();
  }
};

function validaCpfCnpj(val) {
  if (val.length == 11) {
    var cpf = val.trim();

    cpf = cpf.replace(/\./g, "");
    cpf = cpf.replace("-", "");
    cpf = cpf.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cpf.length > i; i++) {
      if (cpf[i - 1] != cpf[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p = 10; cpf.length - 2 > i; i++, p--) {
      v1 += cpf[i] * p;
    }

    v1 = (v1 * 10) % 11;

    if (v1 == 10) {
      v1 = 0;
    }

    if (v1 != cpf[9]) {
      return false;
    }

    for (var i = 0, p = 11; cpf.length - 1 > i; i++, p--) {
      v2 += cpf[i] * p;
    }

    v2 = (v2 * 10) % 11;

    if (v2 == 10) {
      v2 = 0;
    }

    if (v2 != cpf[10]) {
      return false;
    } else {
      return true;
    }
  } else if (val.length == 14) {
    var cnpj = val.trim();

    cnpj = cnpj.replace(/\./g, "");
    cnpj = cnpj.replace("-", "");
    cnpj = cnpj.replace("/", "");
    cnpj = cnpj.split("");

    var v1 = 0;
    var v2 = 0;
    var aux = false;

    for (var i = 1; cnpj.length > i; i++) {
      if (cnpj[i - 1] != cnpj[i]) {
        aux = true;
      }
    }

    if (aux == false) {
      return false;
    }

    for (var i = 0, p1 = 5, p2 = 13; cnpj.length - 2 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v1 += cnpj[i] * p1;
      } else {
        v1 += cnpj[i] * p2;
      }
    }

    v1 = v1 % 11;

    if (v1 < 2) {
      v1 = 0;
    } else {
      v1 = 11 - v1;
    }

    if (v1 != cnpj[12]) {
      return false;
    }

    for (var i = 0, p1 = 6, p2 = 14; cnpj.length - 1 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v2 += cnpj[i] * p1;
      } else {
        v2 += cnpj[i] * p2;
      }
    }

    v2 = v2 % 11;

    if (v2 < 2) {
      v2 = 0;
    } else {
      v2 = 11 - v2;
    }

    if (v2 != cnpj[13]) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sleep(time) {
  await timeout(time);
}

function firstDayOfMonth(month) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - month, 1);
  return firstDay;
}

function lastDayOfMonth(month) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + month, 0);
  return lastDay;
}

function dataAtualFormatada(data) {
  var dia = data.getDate().toString(),
    diaF = dia.length == 1 ? "0" + dia : dia,
    mes = (data.getMonth() + 1).toString(),
    mesF = mes.length == 1 ? "0" + mes : mes,
    anoF = data.getFullYear();
  return diaF + "/" + mesF + "/" + anoF;
}

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, "g"), replace);
}

function formatDate(date) {
  return (
    date.substring(8, 10) +
    "/" +
    date.substring(5, 7) +
    "/" +
    date.substring(0, 4)
  );
}

function sortfunction(a, b) {
  return a.dueDate.localeCompare(b.dueDate);
}

async function sendMsgAndCloseTicket(wbot, contact, ticket) {
  const ticketUpdateAgent = {
    ticketData: {
      status: "closed",
      userId: ticket?.userId || null,
      sendFarewellMessage: false,
      amountUsedBotQueues: 0
    },
    ticketId: ticket.id,
    companyId: ticket.companyId
  };

  await sleep(2000);
  await UpdateTicketService(ticketUpdateAgent);
}

export const sayChatbot = async (
  queueId: number,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  msg: proto.IWebMessageInfo,
  ticketTraking: TicketTraking
): Promise<any> => {
  // ✅ VERIFICAÇÃO PREVENTIVA: Não processar se ticket estiver "open" (aceito por atendente)
  if (ticket.status === "open") {
    console.log(`[CHATBOT] Ticket ${ticket.id} está "open" - ChatBot não deve processar`);
    return;
  }

  const selectedOption =
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
    (() => { try { const irm = (msg.message as any)?.interactiveResponseMessage; if (irm?.nativeFlowResponseMessage?.paramsJson) { const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson); return p?.id || p?.display_text; } return null; } catch { return null; } })() ||
    getBodyMessage(msg);

  if (!queueId && selectedOption && msg.key.fromMe) return;

  const getStageBot = await ShowDialogChatBotsServices(contact.id);

  if (String(selectedOption).toLocaleLowerCase() === "sair") {
    const complationMessage = ticket.whatsapp?.complationMessage;
    if (!isNil(complationMessage)) {
      const textMessage = { text: formatBody(`\u200e${complationMessage}`, ticket) };
      const sendMsg = await wbot.sendMessage(
        `${ticket?.contact?.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        textMessage
      );
      await verifyMessage(sendMsg, ticket, ticket.contact);
    }

    await UpdateTicketService({
      ticketData: {
        status: "closed",
        // já enviamos a farewell acima
        sendFarewellMessage: false,
        amountUsedBotQueues: 0
      },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    await ticketTraking.update({
      userId: ticket.userId,
      closedAt: moment().toDate(),
      finishedAt: moment().toDate()
    });

    await CreateLogTicketService({
      ticketId: ticket.id,
      type: "clientClosed",
      queueId: ticket.queueId
    });

    try {
      await DeleteDialogChatBotsServices(contact.id);
    } catch (error) {
      console.error("Erro ao deletar dialogs", error);
    }

    return;
  }

  if (selectedOption === "#") {
    const backTo = await backToMainMenu(wbot, contact, ticket, ticketTraking);
    return;
  }

  if (!getStageBot) {
    // Serviço p/ escolher consultor aleatório para o ticket, ao selecionar fila.
    // let randomUserId;

    // try {
    //   const userQueue = await ListUserQueueServices(queueId);

    //   if (userQueue.userId > -1) {
    //     randomUserId = userQueue.userId;
    //   }

    // } catch (error) {
    //   console.error(error);
    // }

    // // Ativar ou desativar opção de escolher consultor aleatório.
    // let settingsUserRandom = await Setting.findOne({
    //   where: {
    //     key: "userRandom",
    //     companyId: ticket.companyId
    //   }
    // });

    // console.log('randomUserId', randomUserId)

    // if (settingsUserRandom?.value === "enabled") {
    //   await UpdateTicketService({
    //     ticketData: { userId: randomUserId },
    //     ticketId: ticket.id,
    //     companyId: ticket.companyId,
    //     ratingId: undefined
    //   });
    // }

    const queue = await ShowQueueService(queueId, ticket.companyId);

    const selectedOptions =
      msg?.message?.buttonsResponseMessage?.selectedButtonId ||
      msg?.message?.listResponseMessage?.singleSelectReply.selectedRowId ||
      (() => { try { const irm = (msg.message as any)?.interactiveResponseMessage; if (irm?.nativeFlowResponseMessage?.paramsJson) { const p = JSON.parse(irm.nativeFlowResponseMessage.paramsJson); return p?.id || p?.display_text; } return null; } catch { return null; } })() ||
      getBodyMessage(msg);

    const choosenQueue = queue.chatbots[+selectedOptions - 1];

    if (choosenQueue) {
      if (choosenQueue.queueType === "integration") {
        try {
          await ticket.update({
            integrationId: choosenQueue.optIntegrationId,
            useIntegration: true,
            status: "pending",
            queueId: null
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      } else if (choosenQueue.queueType === "queue") {
        try {
          const ticketUpdateAgent = {
            ticketData: {
              queueId: choosenQueue.optQueueId,
              status: "pending"
            },
            ticketId: ticket.id
          };
          await UpdateTicketService({
            ticketData: {
              ...ticketUpdateAgent.ticketData
            },
            ticketId: ticketUpdateAgent.ticketId,
            companyId: ticket.companyId
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      } else if (choosenQueue.queueType === "attendent") {
        try {
          const ticketUpdateAgent = {
            ticketData: {
              queueId: choosenQueue.optQueueId,
              userId: choosenQueue.optUserId,
              status: "pending"
            },
            ticketId: ticket.id
          };
          await UpdateTicketService({
            ticketData: {
              ...ticketUpdateAgent.ticketData
            },
            ticketId: ticketUpdateAgent.ticketId,
            companyId: ticket.companyId
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      }

      await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);

      let send;
      if (
        choosenQueue?.greetingMessage &&
        (!choosenQueue.optIntegrationId || ticket.typebotSessionTime === null)
      ) {
        send = await sendDialog(choosenQueue, wbot, contact, ticket);
      } // nao tem mensagem de boas vindas

      if (choosenQueue.queueType === "file") {
        try {
          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.optFileId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: path.basename(file.path),
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: file.name,
              isForwarded: false
            });
          }
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      }
      if (choosenQueue.closeTicket) {
        await sendMsgAndCloseTicket(wbot, ticket.contact, ticket);
      }

      return send;
    }
  }

  if (getStageBot) {
    const selected = isNumeric(selectedOption) ? selectedOption : 0;
    const bots = await ShowChatBotServices(getStageBot.chatbotId);

    if (selected === 0 || +selected > bots.options.length) {
      const body = "\u200eOpção inválida! Digite um número válido para continuar!";
      await sleep(2000);
      await sendMessage(wbot, ticket.contact, ticket, body);
      return;
    }
    const choosenQueue = bots.options[+selected - 1]
      ? bots.options[+selected - 1]
      : bots.options[0];
    // console.log("linha 1508")
    if (!choosenQueue.greetingMessage) {
      await DeleteDialogChatBotsServices(contact.id);
      return;
    } // nao tem mensagem de boas vindas

    if (choosenQueue) {
      if (choosenQueue.queueType === "integration") {
        try {
          const ticketUpdateAgent = {
            ticketData: {
              integrationId: choosenQueue.optIntegrationId,
              useIntegration: true,
              status: "pending"
            },
            ticketId: ticket.id
          };
          await UpdateTicketService({
            ticketData: {
              ...ticketUpdateAgent.ticketData
            },
            ticketId: ticketUpdateAgent.ticketId,
            companyId: ticket.companyId
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      } else if (choosenQueue.queueType === "queue") {
        try {
          const ticketUpdateAgent = {
            ticketData: {
              queueId: choosenQueue.optQueueId,
              status: "pending"
            },
            ticketId: ticket.id
          };
          await UpdateTicketService({
            ticketData: {
              ...ticketUpdateAgent.ticketData
            },
            ticketId: ticketUpdateAgent.ticketId,
            companyId: ticket.companyId
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      } else if (choosenQueue.queueType === "attendent") {
        try {
          const ticketUpdateAgent = {
            ticketData: {
              queueId: choosenQueue.optQueueId,
              userId: choosenQueue.optUserId,
              status: "pending"
            },
            ticketId: ticket.id
          };
          await UpdateTicketService({
            ticketData: {
              ...ticketUpdateAgent.ticketData
            },
            ticketId: ticketUpdateAgent.ticketId,
            companyId: ticket.companyId
          });
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      }

      await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);

      // let send
      // if (choosenQueue?.greetingMessage) {
      //   send = await sendDialog(choosenQueue, wbot, contact, ticket);
      // } // nao tem mensagem de boas vindas

      if (choosenQueue.queueType === "file") {
        try {
          const publicFolder = path.resolve(
            __dirname,
            "..",
            "..",
            "..",
            "public"
          );

          const files = await ShowFileService(
            choosenQueue.optFileId,
            ticket.companyId
          );

          const folder = path.resolve(
            publicFolder,
            `company${ticket.companyId}`,
            "fileList",
            String(files.id)
          );

          for (const [index, file] of files.options.entries()) {
            const mediaSrc = {
              fieldname: "medias",
              originalname: path.basename(file.path),
              encoding: "7bit",
              mimetype: file.mediaType,
              filename: file.path,
              path: path.resolve(folder, file.path)
            } as Express.Multer.File;

            await SendWhatsAppMedia({
              media: mediaSrc,
              ticket,
              body: file.name,
              isForwarded: false
            });
          }
        } catch (error) {
          await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
        }
      }
      if (choosenQueue.closeTicket) {
        await sendMsgAndCloseTicket(wbot, ticket.contact, ticket);
      }

      await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);

      const send = await sendDialog(choosenQueue, wbot, contact, ticket);

      return send;
    }
  }
};
