import AppError from "../../errors/AppError";
import { WebhookModel } from "../../models/Webhook";
import { obterNomeEExtensaoDoArquivo, sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
import CreateTicketService from "../TicketServices/CreateTicketService";
// import CreateTicketServiceWebhook from "../TicketServices/CreateTicketServiceWebhook";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import fs from "fs";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import path from "path";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMediaFlow, { typeSimulation } from "../WbotServices/SendWhatsAppMediaFlow";
import { randomizarCaminho } from "../../utils/randomizador";
// import { SendMessageFlow } from "../../helpers/SendMessageFlow";
import formatBody from "../../helpers/Mustache";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { getJidOf } from "../WbotServices/getJidOf";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService, {
  MessageData
} from "../MessageServices/CreateMessageService";
import { randomString } from "../../utils/randomCode";
import ShowQueueService from "../QueueService/ShowQueueService";
import { getIO } from "../../libs/socket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ShowTicketUUIDService from "../TicketServices/ShowTicketFromUUIDService";
import logger from "../../utils/logger";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SyncTags from "../TagServices/SyncTagsService";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import flowBuilderQueue from "./flowBuilderQueue";
import { proto } from "@whiskeysockets/baileys";
import { getWbot } from "../../libs/wbot";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import SendTelegramMessageService from "../TelegramServices/SendTelegramMessageService";
import SendTelegramMediaService from "../TelegramServices/SendTelegramMediaService";
import SendTelegramMenuService from "../TelegramServices/SendTelegramMenuService";
import Whatsapp from "../../models/Whatsapp";
import axios from "axios";
import https from "https";
import { flowbuilderIntegration } from "../WbotServices/wbotMessageListener";
import typebotListener from "../TypebotServices/typebotListener";
import typebotListenerOficial from "../TypebotServices/typebotListenerOficial";
import ExecuteAsaasSecondCopyFlowService from "../AsaasServices/ExecuteAsaasSecondCopyFlowService";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
import { handleOpenAiFlow } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";
import { FlowBuilderModel } from "../../models/FlowBuilder";

declare global {
  namespace NodeJS {
    interface Global {
      flowVariables: Record<string, any>;
    }
  }
}

if (!global.flowVariables) {
  global.flowVariables = {};
}


const buildTelegramNumberedMenuText = ({
  body,
  options
}: {
  body: string;
  options: Array<{ number: string | number; value: string }>;
}): string => {
  const lines = [
    String(body || "Selecione uma opção:").trim(),
    "",
    ...((options || []).map(option => `[${option.number}] ${option.value}`))
  ];

  return lines.filter(line => line !== undefined && line !== null).join("\n");
};

const sendTelegramFlowMenu = async ({
  whatsapp,
  ticket,
  body,
  options
}: {
  whatsapp: Whatsapp;
  ticket: Ticket;
  body: string;
  options: Array<{ number: string | number; value: string }>;
}): Promise<boolean> => {
  if (whatsapp.channel !== "telegram") return false;

  // Bot Telegram usa botões reais.
  if ((whatsapp as any).telegramConnectionType !== "personal") {
    await SendTelegramMenuService({
      ticket,
      body: String(body || "Selecione uma opção:"),
      options
    });

    return true;
  }

  // Perfil pessoal usa menu numerado, igual WhatsApp/Baileys.
  await sendTelegramFlowText({
    whatsapp,
    ticket,
    body: buildTelegramNumberedMenuText({
      body,
      options
    })
  });

  return true;
};


const sendTelegramFlowText = async ({
  whatsapp,
  ticket,
  body
}: {
  whatsapp: Whatsapp;
  ticket: Ticket;
  body: string;
}): Promise<boolean> => {
  if (whatsapp.channel !== "telegram") return false;

  await SendTelegramMessageService({
    body: String(body || ""),
    ticket
  });

  return true;
};


const getTelegramFlowMimeType = (fileName: string, fallbackMime = "application/octet-stream"): string => {
  const ext = path.extname(String(fileName || "")).toLowerCase();

  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
    ".rar": "application/vnd.rar",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  };

  return map[ext] || fallbackMime;
};

const sendTelegramFlowMedia = async ({
  whatsapp,
  ticket,
  filePath,
  body,
  fallbackMime = "application/octet-stream"
}: {
  whatsapp: Whatsapp;
  ticket: Ticket;
  filePath: string;
  body?: string;
  fallbackMime?: string;
}): Promise<boolean> => {
  if (whatsapp.channel !== "telegram") return false;

  const fsModule = await import("fs");
  const fileName = obterNomeEExtensaoDoArquivo(filePath);

  if (!fsModule.existsSync(filePath)) {
    logger.error(`[FLOW MEDIA - TELEGRAM] ❌ Arquivo não encontrado: ${filePath}`);
    return false;
  }

  const mediaSrc = {
    fieldname: "medias",
    originalname: fileName,
    encoding: "7bit",
    mimetype: getTelegramFlowMimeType(fileName, fallbackMime),
    filename: fileName,
    path: filePath,
    mediaUrl: `flow/${fileName}`
  } as Express.Multer.File & { mediaUrl?: string };

  await SendTelegramMediaService({
    media: mediaSrc,
    ticket,
    body
  });

  return true;
};


interface IAddContact {
  companyId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  dataMore?: any;
}

interface DataNoWebhook {
  nome: string;
  numero: string;
  email: string;
}

// ✅ Função auxiliar: busca ticket com whatsapp incluído (necessário para SendWhatsAppOficialMessage)
const getTicketWithWhatsapp = async (ticketId: number, whatsappId?: number, companyId?: number): Promise<Ticket | null> => {
  const where: any = { id: ticketId };
  if (whatsappId) where.whatsappId = whatsappId;
  if (companyId) where.companyId = companyId;
  return Ticket.findOne({
    where,
    include: [
      { model: Contact, as: "contact", attributes: ["id", "name", "number", "email", "profilePicUrl"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "token", "channel", "status", "tokenMeta", "send_token"] }
    ]
  });
};

const escapeRegExp = (value = ""): string => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const normalizeTemplateKey = (value = ""): string => {
  const clean = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9\s_]/g, " ")
    .trim();

  if (!clean) return "";

  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
};

const getSafeTemplateValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const buildFlowContactExtraVars = (contact: any): Record<string, string> => {
  const extraVars: Record<string, string> = {};

  const extraInfoList = Array.isArray(contact?.extraInfo)
    ? contact.extraInfo
    : Array.isArray(contact?.contactCustomFields)
      ? contact.contactCustomFields
      : [];

  for (const item of extraInfoList) {
    const rawKey = item?.name || item?.fieldName || "";
    const rawValue = item?.value || item?.fieldValue || "";
    const key = normalizeTemplateKey(rawKey);

    if (key) {
      extraVars[key] = getSafeTemplateValue(rawValue);
    }
  }

  return extraVars;
};

const buildOfficialFlowTemplateVars = (ticketData: any): Record<string, string> => {
  const contact = ticketData?.contact || {};
  const fullName = getSafeTemplateValue(contact?.name);
  const firstName = fullName.trim().split(/\s+/)[0] || "";

  return {
    name: fullName,
    firstName,
    number: getSafeTemplateValue(contact?.number),
    email: getSafeTemplateValue(contact?.email),
    userName: getSafeTemplateValue(ticketData?.user?.name),
    queue: getSafeTemplateValue(ticketData?.queue?.name),
    companyName: getSafeTemplateValue(ticketData?.company?.name),
    whatsappName: getSafeTemplateValue(ticketData?.whatsapp?.name),
    protocol: getSafeTemplateValue(ticketData?.protocol || ticketData?.id || ""),
    ticketId: getSafeTemplateValue(ticketData?.id || ""),
    ...buildFlowContactExtraVars(contact)
  };
};

const renderOfficialFlowTemplate = (content = "", ticketData: any = null): string => {
  let result = String(content || "");

  if (!result.includes("{{")) {
    return result;
  }

  const variables = buildOfficialFlowTemplateVars(ticketData);

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "gi");
    result = result.replace(regex, getSafeTemplateValue(value));
  });

  return result;
};

const prepareFlowText = async ({
  rawText,
  ticketData,
  ticketId,
  whatsappId,
  companyId,
  details,
  dataWebhook,
  dataLocal
}: {
  rawText: string;
  ticketData?: any;
  ticketId?: number;
  whatsappId: number;
  companyId: number;
  details?: any;
  dataWebhook?: any;
  dataLocal?: any;
}): Promise<{ text: string; ticketData: any }> => {
  let fullTicket = ticketData;
  const content = String(rawText || "");
  const hasDoubleBraceVars = /{{\s*[^}]+\s*}}/.test(content);

  const needsReload =
    !fullTicket ||
    (hasDoubleBraceVars &&
      (
        !fullTicket?.contact ||
        typeof fullTicket?.user === "undefined" ||
        typeof fullTicket?.queue === "undefined" ||
        typeof fullTicket?.company === "undefined" ||
        typeof fullTicket?.whatsapp === "undefined"
      ));

  if (needsReload && ticketId) {
    try {
      fullTicket = await ShowTicketService(ticketId, companyId);
    } catch (error) {
      logger.warn(`[FLOW TEMPLATE] Não foi possível carregar ticket completo pelo ShowTicketService`);
    }

    if (!fullTicket) {
      fullTicket = await getTicketWithWhatsapp(ticketId, whatsappId, companyId);
    }
  }

  let text = content;

  text = replaceMessages(text, details, dataWebhook, dataLocal, ticketId);
  text = renderOfficialFlowTemplate(text, fullTicket);

  if (fullTicket?.contact) {
    text = formatBody(text, fullTicket.contact);
  }

  return {
    text,
    ticketData: fullTicket || ticketData
  };
};

const processVariableValue = (text: string, dataWebhook: any, ticketId?: number): string => {
  if (!text) return "";


  if (text.includes("${")) {
    const regex = /\${([^}]+)}/g;
    let match;
    let processedText = text;

    while ((match = regex.exec(text)) !== null) {
      const variableName = match[1];


      let variableValue = null;

      if (ticketId) {
        const ticketSpecificVar = `${ticketId}_${variableName}`;
        variableValue = global.flowVariables[ticketSpecificVar];
      }


      if (variableValue === null || variableValue === undefined) {
        variableValue = global.flowVariables[variableName];
      }


      if (variableValue !== null && variableValue !== undefined) {
        // Normalizar o valor: trim + remover caracteres invisíveis
        const cleanValue = variableValue.toString()
          .trim()
          .replace(/[\r\n\u200e\u200f\u200b]/g, "");
        processedText = processedText.replace(
          match[0],
          cleanValue
        );
      }
    }

    return processedText;
  }

  return text;
};

const compareValues = (value1: string, value2: string, operator: string): boolean => {
  // Normalizar valores — nunca null/undefined nas comparações
  const v1 = value1 !== null && value1 !== undefined ? String(value1) : "";
  const v2 = value2 !== null && value2 !== undefined ? String(value2) : "";

  // Versões lowercase para comparações case-insensitive
  const low1 = v1.toLowerCase().trim();
  const low2 = v2.toLowerCase().trim();

  // Versões numéricas (tentativa)
  const num1 = parseFloat(v1.replace(",", "."));
  const num2 = parseFloat(v2.replace(",", "."));
  const bothNumeric = !isNaN(num1) && !isNaN(num2);

  logger.info(`[IF/ELSE] "${v1}" ${operator} "${v2}" | numeric: ${bothNumeric ? `${num1} vs ${num2}` : "n/a"}`);

  switch (operator) {
    // ── Igualdade ────────────────────────────────────────────────────────────
    case "equals":
      // Tenta comparação numérica primeiro, depois textual
      if (bothNumeric) return num1 === num2;
      return low1 === low2;

    case "notEquals":
      if (bothNumeric) return num1 !== num2;
      return low1 !== low2;

    // ── Texto ────────────────────────────────────────────────────────────────
    case "contains":
      return low1.includes(low2);

    case "notContains":
      return !low1.includes(low2);

    case "startsWith":
      return low1.startsWith(low2);

    case "endsWith":
      return low1.endsWith(low2);

    case "containsAny": {
      // Valor2 pode ser lista separada por vírgula: "sim,s,yes"
      const tokens = low2.split(",").map(t => t.trim()).filter(Boolean);
      return tokens.some(t => low1.includes(t));
    }

    // ── Numérico ─────────────────────────────────────────────────────────────
    case "greaterThan":
      if (!bothNumeric) {
        logger.warn(`[IF/ELSE] greaterThan: valores não numéricos ("${v1}", "${v2}") — retorna false`);
        return false;
      }
      return num1 > num2;

    case "lessThan":
      if (!bothNumeric) {
        logger.warn(`[IF/ELSE] lessThan: valores não numéricos ("${v1}", "${v2}") — retorna false`);
        return false;
      }
      return num1 < num2;

    case "greaterOrEqual":
      if (!bothNumeric) return false;
      return num1 >= num2;

    case "lessOrEqual":
      if (!bothNumeric) return false;
      return num1 <= num2;

    // ── Vazio / Não vazio ────────────────────────────────────────────────────
    case "isEmpty":
      return v1.trim() === "";

    case "isNotEmpty":
      return v1.trim() !== "";

    // ── Regex ────────────────────────────────────────────────────────────────
    case "regex":
      try {
        const re = new RegExp(v2, "i");
        return re.test(v1);
      } catch (e) {
        logger.error(`[IF/ELSE] Regex inválido: "${v2}" — ${e.message}`);
        return false;
      }

    default:
      logger.error(`[IF/ELSE] Operador desconhecido: "${operator}"`);
      return false;
  }
};

const finalizeTriggeredFlow = async (
  ticket: Ticket,
  nodeSelected: any,
  companyId: number,
  finalStatus: string = "open"
) => {
  try {
    // ✅ CORRIGIDO: Para tickets pending (fluxo automático), também limpar estado do fluxo e marcar como executado
    if (ticket.status === "pending") {
      logger.info(`[TICKET UPDATE] Finalizando fluxo automático para ticket ${ticket.id} (status: pending)`);
      try {
        await ticket.update({
          flowWebhook: false,
          lastFlowId: null,
          hashFlowId: null,
          flowStopped: null,
          dataWebhook: null,
          useIntegration: null,
          integrationId: null,
          isBot: false,
          // ✅ CHAVE: Incrementar amountUsedBotQueues para marcar que o fluxo já foi executado
          // Isso impede que o fluxo reinicie quando o contato mandar nova mensagem
          amountUsedBotQueues: (ticket.amountUsedBotQueues || 0) + 1
        });
        logger.info(`[TICKET UPDATE] Ticket ${ticket.id} (pending) - estado do fluxo limpo, amountUsedBotQueues incrementado`);
      } catch (err) {
        logger.error(`[TICKET UPDATE] Erro ao finalizar fluxo automático para ticket ${ticket.id}:`, err);
      }
      return;
    }

    // Verificar se o ticket está com status "open" (fluxo disparado manualmente)
    if (ticket.status === "open") {
      logger.info(`[TICKET UPDATE] Finalizando fluxo disparado manualmente para ticket ${ticket.id}`);

      // Determinar status final baseado no nó ou usar "pending" como padrão
      let targetStatus = finalStatus;

      // Se o nó tem configuração de status final, usar essa configuração
      if (nodeSelected?.data?.finalStatus) {
        targetStatus = nodeSelected.data.finalStatus;
        logger.info(`[TICKET UPDATE] Status final definido pelo nó: ${targetStatus}`);
      }

      logger.info(`[TICKET UPDATE] Ticket ${ticket.id} será alterado para status: ${targetStatus}`);

      // Atualizar ticket para o status final
      await UpdateTicketService({
        ticketData: {
          status: targetStatus,
          userId: ticket.userId,
          flowWebhook: false,
          lastFlowId: null,
          hashFlowId: null,
          flowStopped: null,
          dataWebhook: null,
          isBot: false,
          isTransfered: false
        },
        ticketId: ticket.id,
        companyId
      });

      logger.info(`[TICKET UPDATE] Ticket ${ticket.id} atualizado com sucesso - Status: ${targetStatus}, FlowWebhook: false, LastFlowId: null`);

      // Criar log da finalização
      await CreateLogTicketService({
        userId: ticket.userId,
        ticketId: ticket.id,
        type: "open",
        queueId: ticket.queueId
      });

      logger.info(`[TICKET UPDATE] Log criado para finalização do fluxo - Ticket ${ticket.id}`);
    }
    logger.info(`[TICKET UPDATE] Log criado para finalização do fluxo - Ticket ${ticket.id}`);

  } catch (error) {
    logger.error(`[TICKET UPDATE ERROR] Erro ao finalizar fluxo disparado manualmente para ticket ${ticket.id}:`, error);
  }
};

export const ActionsWebhookService = async (
  whatsappId: number,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase: "" | { number: string; name: string; email: string } = "",
  inputResponded: boolean = false,
  msg?: proto.IWebMessageInfo,
  isManualTrigger: boolean = false
): Promise<string> => {


  logger.info(`[ACTIONS WEBHOOK] ========== INICIANDO SERVIÇO ==========`);
  logger.info(`[ACTIONS WEBHOOK] WhatsApp ID: ${whatsappId}, Company ID: ${companyId}`);
  logger.info(`[ACTIONS WEBHOOK] Ticket ID: ${idTicket || 'N/A'}, Flow ID: ${idFlowDb}`);
  logger.info(`[ACTIONS WEBHOOK] Next Stage: ${nextStage}, PressKey: ${pressKey || 'N/A'}`);
  logger.info(`[ACTIONS WEBHOOK] Hash Webhook ID: ${hashWebhookId || 'N/A'}`);
  logger.info(`[ACTIONS WEBHOOK] Total de nós: ${nodes?.length || 0}, Total de conexões: ${connects?.length || 0}`);

  // ✅ Garantir hash válido para continuidade do fluxo (evita hash vazio em flowIdWelcome/flowIdNotPhrase)
  if (!hashWebhookId || !String(hashWebhookId).trim()) {
    hashWebhookId = randomString(32);
    logger.warn(`[ACTIONS WEBHOOK] hashWebhookId ausente/vazio - gerado novo hash: ${hashWebhookId}`);
  }

  // ✅ VALIDAÇÃO DOS PARÂMETROS ESSENCIAIS
  if (!nodes || nodes.length === 0) {
    logger.error(`[ACTIONS WEBHOOK] ❌ Nenhum nó foi fornecido ao serviço!`);
    return "no_nodes";
  }

  if (!whatsappId || !companyId) {
    logger.error(`[ACTIONS WEBHOOK] ❌ WhatsApp ID ou Company ID não fornecidos!`);
    return "missing_ids";
  }

  try {
    const io = getIO()
    let next = nextStage;

    let createFieldJsonName = "";
    let ticket = null;
    const connectStatic = connects;
    if (numberPhrase === "") {
      const nameInput = details.inputs.find(item => item.keyValue === "nome");
      nameInput.data.split(",").map(dataN => {
        const lineToData = details.keysFull.find(item => item === dataN);
        let sumRes = "";
        if (!lineToData) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToData, dataWebhook);
        }
        createFieldJsonName = createFieldJsonName + sumRes
      });
    } else {
      createFieldJsonName = numberPhrase.name;
    }


    if (idTicket) {
      const currentTicket = await Ticket.findByPk(idTicket);

      console.log(`[RDS-FLOW-DEBUG] Estado do ticket ${idTicket}: flowWebhook=${currentTicket?.flowWebhook}, lastFlowId=${currentTicket?.lastFlowId}, flowStopped=${currentTicket?.flowStopped}, inputResponded=${inputResponded}, pressKey=${pressKey || 'undefined'}`);

      const isInitialStage = nextStage === "start" || nextStage === "1"; // normalmente o nó inicial é "start" ou "1"

      console.log(`[RDS-FLOW-DEBUG] Verificando início de fluxo: isInitialStage=${isInitialStage}, nextStage=${nextStage}`);

      // ✅ CRÍTICO: Verificar se o fluxo está realmente executando (não apenas se tem flowWebhook)
      // Se flowWebhook=true, lastFlowId existe, mas não há pressKey (resposta do usuário) ou inputResponded,
      // então o fluxo está em execução e não devemos iniciar uma nova execução paralela
      // EXCEÇÃO: Se há pressKey ou inputResponded, é uma resposta legítima do usuário e deve continuar
      const hasUserResponse = !!pressKey || !!inputResponded;
      const isFlowActive = currentTicket?.flowWebhook && currentTicket?.lastFlowId;

      // Se o fluxo está ativo mas não há resposta do usuário e não é estágio inicial, bloquear
      if (isFlowActive && !hasUserResponse && !isInitialStage) {
        console.log(`[FLOW SERVICE] ⚠️ Ticket ${idTicket} já está executando fluxo (flowWebhook=true, lastFlowId=${currentTicket.lastFlowId}) sem resposta do usuário - BLOQUEANDO execução paralela`);
        return "already_running";
      }

      if (!currentTicket?.flowWebhook || !currentTicket?.lastFlowId || isInitialStage || hasUserResponse) {
        console.log(`[RDS-FLOW-DEBUG] Permitindo execução de fluxo para ticket ${idTicket} (isInitialStage=${isInitialStage}, hasUserResponse=${hasUserResponse})`);
      }
      else {
        console.log(`[FLOW SERVICE] Ticket ${idTicket} já em execução de fluxo, ignorando nova execução`);
        return "already_running";
      }

      if (pressKey) {
        console.log(`[FLOW SERVICE] Ticket ${idTicket} recebeu resposta do usuário: "${pressKey}", continuando fluxo`);
      } else if (isInitialStage) {
        console.log(`[FLOW SERVICE] Iniciando novo fluxo para o ticket ${idTicket} no estágio ${nextStage}`);
      }
    }

    ticket = await Ticket.findByPk(idTicket);
    if (ticket && !ticket.flowWebhook) {
      await ticket.update({
        flowWebhook: true,
        flowStopped: idFlowDb.toString(),
        hashFlowId: hashWebhookId
      });
    }



    let numberClient = "";

    if (numberPhrase === "") {
      const numberInput = details.inputs.find(
        item => item.keyValue === "celular"
      );

      numberInput.data.split(",").map(dataN => {
        const lineToDataNumber = details.keysFull.find(item => item === dataN);
        let createFieldJsonNumber = "";
        if (!lineToDataNumber) {
          createFieldJsonNumber = dataN;
        } else {
          createFieldJsonNumber = constructJsonLine(
            lineToDataNumber,
            dataWebhook
          );
        }

        numberClient = numberClient + createFieldJsonNumber;
      });
    } else {
      numberClient = numberPhrase.number;
    }

    numberClient = removerNaoLetrasNumeros(numberClient);

    if (numberClient.substring(0, 2) === "55") {
      if (parseInt(numberClient.substring(2, 4)) >= 31) {
        if (numberClient.length === 13) {
          numberClient =
            numberClient.substring(0, 4) + numberClient.substring(5, 13);
        }
      }
    }

    let createFieldJsonEmail = "";

    if (numberPhrase === "") {
      const emailInput = details.inputs.find(item => item.keyValue === "email");
      emailInput.data.split(",").map(dataN => {

        const lineToDataEmail = details.keysFull.find(item =>
          item.endsWith("email")
        );

        let sumRes = "";
        if (!lineToDataEmail) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToDataEmail, dataWebhook);
        }

        createFieldJsonEmail = createFieldJsonEmail + sumRes;
      });
    } else {
      createFieldJsonEmail = numberPhrase.email;
    }

    const lengthLoop = nodes.length;

    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (whatsapp.status !== "CONNECTED") {
      return;
    }

    let execCount = 0;

    let execFn = "";



    let noAlterNext = false;
    let isMenu: boolean;

    // ✅ 2) Helper para reenviar qualquer menu (deve ficar acima do if (nodeSelected.type === "menu"))
    const sendSpecificMenuNode = async ({
      menuNode,
      ticketDetails,
      saveAsRoot = false
    }: {
      menuNode: any;
      ticketDetails: any;
      saveAsRoot?: boolean;
    }) => {
      let optionsMenu = "";
      (menuNode.data.arrayOption || []).forEach(item => {
        optionsMenu += `[${item.number}] ${item.value}\n`;
      });

      const menuCreate = `${menuNode.data.message}\n\n${optionsMenu}`;

      let msg;

      const dataLocal = {
        nome: createFieldJsonName,
        numero: numberClient,
        email: createFieldJsonEmail
      };

      const preparedMenu = await prepareFlowText({
        rawText: menuCreate,
        ticketData: ticketDetails,
        ticketId: ticketDetails?.id || idTicket,
        whatsappId,
        companyId,
        details,
        dataWebhook,
        dataLocal
      });

      const preparedBodyOnly = await prepareFlowText({
        rawText: menuNode.data.message || "Selecione uma opção",
        ticketData: preparedMenu.ticketData || ticketDetails,
        ticketId: ticketDetails?.id || idTicket,
        whatsappId,
        companyId,
        details,
        dataWebhook,
        dataLocal
      });

      msg = {
        body: preparedMenu.text,
        number: numberClient,
        companyId: companyId
      };

      if (whatsapp.channel === "whatsapp") {
        await SendWhatsAppMessage({
          body: msg.body,
          ticket: ticketDetails,
          quotedMsg: null
        });
      }

      if (whatsapp.channel === "whatsapp_oficial") {
        const options = menuNode.data.arrayOption || [];
        const bodyText = preparedBodyOnly.text || "Selecione uma opção";

        if (options.length > 0 && options.length <= 3) {
          const interative = {
            type: "button" as const,
            body: { text: bodyText },
            action: {
              buttons: options.map(opt => ({
                type: "reply" as const,
                reply: {
                  id: String(opt.number),
                  title: String(opt.value).slice(0, 20)
                }
              }))
            }
          };

          await SendWhatsAppOficialMessage({
            body: bodyText,
            bodyToSave: msg.body,
            ticket: ticketDetails,
            quotedMsg: null,
            type: "interactive",
            media: null,
            vCard: null,
            interative: interative as any
          });
        } else if (options.length > 3) {
          const interative = {
            type: "list" as const,
            body: { text: bodyText },
            action: {
              button: "Selecionar",
              sections: [
                {
                  title: "Opções",
                  rows: options.map(opt => ({
                    id: String(opt.number),
                    title: String(opt.value).slice(0, 24),
                    description: ""
                  }))
                }
              ]
            }
          };

          await SendWhatsAppOficialMessage({
            body: bodyText,
            bodyToSave: msg.body,
            ticket: ticketDetails,
            quotedMsg: null,
            type: "interactive",
            media: null,
            vCard: null,
            interative: interative as any
          });
        } else {
          await SendWhatsAppOficialMessage({
            body: msg.body,
            ticket: ticketDetails,
            quotedMsg: null,
            type: "text",
            media: null,
            vCard: null
          });
        }
      }

      if (whatsapp.channel === "telegram") {
        await sendTelegramFlowMenu({
          whatsapp,
          ticket: ticketDetails,
          body: preparedBodyOnly.text || menuNode.data.message || "Selecione uma opção:",
          options: menuNode.data.arrayOption || []
        });
      }

      await ticketDetails.update({
        lastMessage: msg.body,
        status: "pending",
        queueId: ticket.queueId ? ticket.queueId : null,
        userId: null,
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: menuNode.id,
        dataWebhook: dataWebhook,
        hashFlowId: hashWebhookId || ticketDetails.hashFlowId || randomString(32),
        flowStopped: idFlowDb.toString()
      });

      if (idTicket) {
        if (
          saveAsRoot ||
          !global.flowVariables[`${idTicket}_rootMenuNodeId`]
        ) {
          global.flowVariables[`${idTicket}_rootMenuNodeId`] = menuNode.id;
        }

        global.flowVariables[`${idTicket}_currentMenuNodeId`] = menuNode.id;
        delete global.flowVariables[`${idTicket}_menuInvalidState`];
      }

      logger.info(
        `[MENU NODE] ✅ Menu ${menuNode.id} enviado e ticket configurado para aguardar resposta`
      );

      return msg.body;
    };

    for (var i = 0; i < lengthLoop; i++) {
      logger.info(`[FLOW LOOP] ========== Iteração ${i + 1}/${lengthLoop} - Next: ${next}, ExecCount: ${execCount} ==========`);

      // ✅ Verificar se ainda há próximo nó válido
      if (!next || next === "") {
        logger.warn(`[FLOW LOOP] Next está vazio na iteração ${i + 1} - finalizando loop`);
        break;
      }

      let nodeSelected: any;
      let ticketInit: Ticket;
      if (idTicket) {
        ticketInit = await Ticket.findOne({
          where: { id: idTicket, whatsappId }
        });

        if (!ticketInit) {
          logger.warn(`[FLOW LOOP] Ticket ${idTicket} não encontrado. Encerrando fluxo.`);
          break;
        }

        if (ticketInit.status === "closed") {
          if (numberPhrase === "") {
            logger.info(`[FLOW LOOP] Ticket ${idTicket} está fechado - encerrando fluxo`);
            break;
          }
        }

      }

      if (pressKey) {
        logger.info(`[FLOW] ========== PROCESSANDO COM PRESSKEY ==========`);
        logger.info(`[FLOW] PressKey: ${pressKey}`);
        logger.info(`[FLOW] ExecFn: ${execFn || 'undefined'}`);
        logger.info(`[FLOW] Next: ${next}`);

        if (pressKey === "parar") {
          if (idTicket) {
            ticketInit = await Ticket.findOne({
              where: { id: idTicket, whatsappId }
            });

            if (ticketInit) {
              logger.info(`[TICKET UPDATE] Parando fluxo para ticket ${ticketInit.id} - Status alterado para closed`);

              await ticketInit.update({
                status: "closed"
              });

              logger.info(`[TICKET UPDATE] Ticket ${ticketInit.id} fechado com sucesso`);
            } else {
              logger.warn(`[TICKET UPDATE] Ticket ${idTicket} não encontrado para fechar`);
            }
          }
          break;
        }

        // ✅ 3) Trate “voltar”, “menu”, “retornar”, “inicio” antes da busca por conexão
        const normalizedCommand = String(pressKey || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();

        const rootMenuNodeId = idTicket
          ? global.flowVariables[`${idTicket}_rootMenuNodeId`]
          : null;

        const currentMenuNodeId = idTicket
          ? global.flowVariables[`${idTicket}_currentMenuNodeId`]
          : null;

        const returnToRootCommands = [
          "voltar",
          "menu",
          "retornar",
          "retorno",
          "inicio",
          "inicial",
          "comeco",
          "comeco",
          "home"
        ];

        if (returnToRootCommands.includes(normalizedCommand)) {
          logger.info(
            `[MENU NODE] 🔁 Comando especial recebido: "${normalizedCommand}" - retornando ao menu inicial`
          );

          const firstMenuNode = nodes.find(
            item => item.type === "menu" || item.type === "interactiveMenu"
          );

          const persistedRootMenuNodeId =
            ticket?.dataWebhook?.asaas?.rootMenuNodeId ||
            ticket?.dataWebhook?.rootMenuNodeId ||
            null;

          const ticketLastMenuNode = nodes.find(
            item => item.id === ticket?.lastFlowId &&
              (item.type === "menu" || item.type === "interactiveMenu")
          );

          const nextMenuNode = nodes.find(
            item => item.id === next &&
              (item.type === "menu" || item.type === "interactiveMenu")
          );

          const menuIdToReturn =
            rootMenuNodeId ||
            persistedRootMenuNodeId ||
            currentMenuNodeId ||
            ticketLastMenuNode?.id ||
            nextMenuNode?.id ||
            firstMenuNode?.id ||
            nodeSelected?.id ||
            next;

          logger.info(
            `[MENU NODE] Menu resolvido para retorno: ${menuIdToReturn} ` +
            `(memRoot=${rootMenuNodeId || "-"}, persisted=${persistedRootMenuNodeId || "-"}, ` +
            `current=${currentMenuNodeId || "-"}, ticketLast=${ticketLastMenuNode?.id || "-"})`
          );

          const targetMenuNode = nodes.find(
            item => item.id === menuIdToReturn &&
              (item.type === "menu" || item.type === "interactiveMenu")
          );

          if (targetMenuNode?.type === "interactiveMenu") {
            logger.info(
              `[INTERACTIVE MENU] 🔁 Reprocessando menu interativo inicial ${targetMenuNode.id}`
            );
            await ticket.update({
              flowWebhook: true,
              flowStopped: idFlowDb.toString(),
              lastFlowId: targetMenuNode.id,
              hashFlowId: hashWebhookId || ticket.hashFlowId || randomString(32)
            });
            next = targetMenuNode.id;
            execFn = undefined;
            pressKey = undefined;
            continue;
          }

          if (targetMenuNode) {
            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await sendSpecificMenuNode({
              menuNode: targetMenuNode,
              ticketDetails,
              saveAsRoot: false
            });

            return "returned_to_root_menu";
          }

          logger.warn(
            `[MENU NODE] ⚠️ Não foi possível localizar o menu inicial ${menuIdToReturn}. Reenviando menu atual.`
          );

          // Buscar o nó atual
          const currentNode = nodes.find(item => item.id === next);
          if (currentNode) {
            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await sendSpecificMenuNode({
              menuNode: currentNode,
              ticketDetails,
              saveAsRoot: false
            });
          }

          return "returned_to_current_menu";
        }

        // ✅ CORRIGIDO: Buscar o nó real ao invés de criar temporário
        if (execFn === "" || !execFn) {
          // Se execFn está vazio, significa que estamos no mesmo nó (menu aguardando resposta)
          // Buscar o nó usando 'next' que contém o ID do nó menu
          logger.info(`[FLOW] ExecFn vazio - buscando nó usando next: ${next}`);
          nodeSelected = nodes.filter(node => node.id === next)[0];

          if (nodeSelected) {
            logger.info(`[FLOW] ✅ Nó encontrado via next: ${nodeSelected.id} (tipo: ${nodeSelected.type})`);
          } else {
            logger.error(`[FLOW] ❌ Nó ${next} NÃO ENCONTRADO! Criando nó temporário`);
            nodeSelected = { type: "menu" };
          }
        } else {
          logger.info(`[FLOW] Buscando nó com ID: ${execFn}`);
          nodeSelected = nodes.filter(node => node.id === execFn)[0];
          if (nodeSelected) {
            logger.info(`[FLOW] ✅ Nó encontrado: ${nodeSelected.id} (tipo: ${nodeSelected.type})`);
          } else {
            logger.error(`[FLOW] ❌ Nó ${execFn} NÃO ENCONTRADO!`);
          }
        }
      } else {
        logger.info(`[FLOW] ========== PROCESSANDO SEM PRESSKEY ==========`);
        logger.info(`[FLOW] Buscando nó com ID: ${next}`);
        const otherNode = nodes.filter((node) => node.id === next)[0]
        if (otherNode) {
          nodeSelected = otherNode;
          logger.info(`[FLOW] ✅ Nó encontrado: ${nodeSelected.id} (tipo: ${nodeSelected.type})`);
        } else {
          logger.error(`[FLOW] ❌ Nó ${next} NÃO ENCONTRADO!`);
        }
      }

      // ✅ CORRIGIDO: Verificar se nodeSelected foi encontrado antes de continuar
      if (!nodeSelected) {
        logger.error(`[FLOW ERROR] Nó não encontrado - Next: ${next}, ExecFn: ${execFn}`);
        logger.error(`[FLOW ERROR] Nós disponíveis: ${nodes.map(n => n.id).join(', ')}`);
        break;
      }

      console.log(`[FLOW LOOP] Nó selecionado: ${nodeSelected?.id} (${nodeSelected?.type})`);

      let msg;

      // Função auxiliar para garantir que o ticket esteja disponível
      const ensureTicket = async () => {
        if (!ticket && idTicket) {
          console.log(`Recuperando ticket ${idTicket} para o nó tipo ${nodeSelected.type}`);
          ticket = await getTicketWithWhatsapp(idTicket, whatsappId);

          if (!ticket) {
            console.error(`Não foi possível encontrar o ticket ${idTicket} para o nó ${nodeSelected.type}`);
            return false;
          }
        }
        return true;
      };

      logger.info(`[FLOW NODE] Processando nó - ID: ${nodeSelected.id}, Tipo: ${nodeSelected.type}`);

      // ✅ Log adicional para debug de erros
      if (nodeSelected.type === "httpRequest") {
        logger.info(`[HTTP REQUEST NODE] Dados do nó: ${JSON.stringify({
          id: nodeSelected.id,
          url: nodeSelected.data?.url || 'undefined',
          method: nodeSelected.data?.method || 'undefined',
          hasHeaders: !!nodeSelected.data?.headersString,
          hasBody: !!nodeSelected.data?.requestBody
        })}`);
      }

      if (nodeSelected.type === "tag") {
        if (!(await ensureTicket())) continue;

        const tagFind = await Tag.findByPk(nodeSelected.data.tag.id);

        const teste = { contactId: ticket.contactId, tags: [tagFind], companyId: companyId }

        const tags = await SyncTags(teste);

        logger.info(`[TICKET TAG] Tag ${tagFind?.name} adicionada ao contato ${ticket.contactId} do ticket ${ticket.id}`);
      }

      if (nodeSelected.type === "removeTag") {
        await ensureTicket();

        if (!ticket) {
          logger.error(`[REMOVE TAG NODE] Ticket não encontrado para processar remoção de tag`);
          return;
        }

        try {
          const tagFind = await Tag.findByPk(nodeSelected.data.tag.id);

          if (!tagFind) {
            logger.error(`[REMOVE TAG NODE] Tag com ID ${nodeSelected.data.tag.id} não encontrada`);
            return;
          }

          // Importar o serviço de remoção de tags
          const { RemoveTagsService } = await import("../TagServices/RemoveTagsService");

          // Remover a tag do contato
          await RemoveTagsService({
            contactId: ticket.contactId,
            tags: [tagFind],
            companyId: companyId
          });

          logger.info(`[REMOVE TAG NODE] Tag ${tagFind.name} removida do contato ${ticket.contactId} do ticket ${ticket.id}`);

        } catch (error) {
          logger.error(`[REMOVE TAG NODE] Erro ao remover tag do contato:`, error);
        }
      }

      if (nodeSelected.type === "message") {
        // Garantir que ticket tenha whatsapp para envio via API Oficial
        if (!ticket?.whatsapp && idTicket) {
          ticket = await getTicketWithWhatsapp(idTicket, whatsappId, companyId);
        }

        const dataLocal = {
          nome: createFieldJsonName,
          numero: numberClient,
          email: createFieldJsonEmail
        };

        const preparedMessage = await prepareFlowText({
          rawText: nodeSelected.data.label || "",
          ticketData: ticket,
          ticketId: ticket?.id || idTicket,
          whatsappId,
          companyId,
          details,
          dataWebhook,
          dataLocal
        });

        ticket = preparedMessage.ticketData || ticket;

        msg = {
          body: preparedMessage.text,
          number: numberClient,
          companyId: companyId
        };

        console.log("msg", msg);

        if (whatsapp.channel === "whatsapp") {
          await SendWhatsAppMessage({
            body: msg.body,
            ticket: ticket,
            quotedMsg: null
          });
        }

        if (whatsapp.channel === "whatsapp_oficial") {
          await SendWhatsAppOficialMessage({
            body: msg.body,
            ticket: ticket,
            quotedMsg: null,
            type: 'text',
            media: null,
            vCard: null
          });
        }

        if (whatsapp.channel === "telegram") {
          await sendTelegramFlowText({
            whatsapp,
            ticket,
            body: msg.body
          });
        }

        await intervalWhats("1");
      }

      if (nodeSelected.type === "openai" || nodeSelected.type === "gemini") {
        try {
          // ✅ CORRIGIDO: Verificar se o ticket foi aceito antes de ativar IA
          // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
          if (ticket.status === "open" && ticket.userId && !isManualTrigger) {
            logger.info(`[${nodeSelected.type.toUpperCase()} NODE] Ticket ${ticket.id} já foi aceito por usuário ${ticket.userId} - pulando ativação de IA`);
            continue;
          }

          const {
            name = "",
            prompt = "",
            voice = "texto",
            voiceKey = "",
            voiceRegion = "",
            maxTokens = 1000,
            temperature = 0.7,
            apiKey = "",
            queueId = 0,
            maxMessages = 10,
            model = "",
            provider = nodeSelected.type,
            flowMode = "permanent",
            maxInteractions = 0,
            continueKeywords = ["continuar", "próximo", "avançar", "prosseguir"],
            completionTimeout = 0,
            objective = "",
            autoCompleteOnObjective = false,

            // Resposta automática em áudio com OpenAI TTS
            aiAudioReplyEnabled = false,
            aiAudioReplyOnlyWhenInputAudio = true,
            aiAudioReplyModel = "gpt-4o-mini-tts",
            aiAudioReplyVoice = "coral",
            aiAudioReplySpeed = 1,
            aiAudioReplyMaxChars = 700,
            aiAudioReplySendTextWithLinks = true,
            aiAudioReplyFallbackToText = true,
            aiAudioReplyInstructions = "Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo."
          } = nodeSelected.data.typebotIntegration as IOpenAi;

          if (!apiKey || !model) {
            logger.error(`[${provider.toUpperCase()} NODE] Configurações obrigatórias não encontradas`);
            continue;
          }

          const finalVoice = provider === "gemini" ? "texto" : voice;

          const parseBoolean = (value: any, fallback = false): boolean => {
            if (typeof value === "boolean") return value;

            if (typeof value === "string") {
              return ["true", "1", "yes", "sim", "on"].includes(
                value.toLowerCase().trim()
              );
            }

            if (typeof value === "number") return value === 1;

            return fallback;
          };

          const aiSettings: IOpenAi = {
            name,
            prompt,
            voice: finalVoice,
            voiceKey: provider === "openai" ? voiceKey : "",
            voiceRegion: provider === "openai" ? voiceRegion : "",
            maxTokens: Number(maxTokens) || 1000,
            temperature: Number(temperature) || 0.7,
            apiKey,
            queueId: Number(queueId) || 0,
            maxMessages: Number(maxMessages) || 10,
            model,
            provider,
            flowMode,
            maxInteractions: Number(maxInteractions) || 0,
            continueKeywords,
            completionTimeout: Number(completionTimeout) || 0,
            objective,
            autoCompleteOnObjective,

            // Configurações novas de resposta automática em áudio
            aiAudioReplyEnabled:
              provider === "openai" ? parseBoolean(aiAudioReplyEnabled, false) : false,
            aiAudioReplyOnlyWhenInputAudio: parseBoolean(
              aiAudioReplyOnlyWhenInputAudio,
              true
            ),
            aiAudioReplyModel: String(aiAudioReplyModel || "gpt-4o-mini-tts"),
            aiAudioReplyVoice: String(aiAudioReplyVoice || "coral"),
            aiAudioReplySpeed: Number(aiAudioReplySpeed) || 1,
            aiAudioReplyMaxChars: Number(aiAudioReplyMaxChars) || 700,
            aiAudioReplySendTextWithLinks: parseBoolean(
              aiAudioReplySendTextWithLinks,
              true
            ),
            aiAudioReplyFallbackToText: parseBoolean(
              aiAudioReplyFallbackToText,
              true
            ),
            aiAudioReplyInstructions: String(
              aiAudioReplyInstructions ||
              "Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo."
            )
          };

          // Detectar o idioma configurado no prompt da IA.
          // País, nacionalidade e palavras compartilhadas entre idiomas
          // não devem definir sozinhos o idioma da saudação.
          const aiLanguageContext = [
            prompt,
            objective,
            aiAudioReplyInstructions
          ]
            .filter(Boolean)
            .join(" ")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

          const hasExplicitPortuguese =
            /\b(fale em portugues|responda em portugues|responder em portugues|portugues do brasil|idioma portugues|in portuguese)\b/.test(
              aiLanguageContext
            );

          const hasExplicitSpanish =
            /\b(habla en espanol|responde en espanol|responder en espanol|idioma espanol|en castellano|speak spanish|respond in spanish)\b/.test(
              aiLanguageContext
            );

          const hasExplicitEnglish =
            /\b(speak in english|speak english|respond in english|answer in english|idioma ingles|responda em ingles)\b/.test(
              aiLanguageContext
            );

          const portugueseWords = [
            "ola",
            "ajudar",
            "voce",
            "vendas",
            "atendente",
            "prosseguir",
            "portugues",
            "brasil",
            "obrigado"
          ];

          const spanishWords = [
            "hola",
            "ayudar",
            "usted",
            "ventas",
            "asesor",
            "espanol",
            "castellano",
            "continuar",
            "gracias"
          ];

          const englishWords = [
            "hello",
            "help",
            "customer",
            "always",
            "sales",
            "assistant",
            "english",
            "continue",
            "thanks"
          ];

          const portugueseScore = portugueseWords.filter(word =>
            aiLanguageContext.includes(word)
          ).length;

          const spanishScore = spanishWords.filter(word =>
            aiLanguageContext.includes(word)
          ).length;

          const englishScore = englishWords.filter(word =>
            aiLanguageContext.includes(word)
          ).length;

          let aiLanguage: "pt" | "es" | "en" = "pt";

          if (hasExplicitPortuguese) {
            aiLanguage = "pt";
          } else if (hasExplicitSpanish) {
            aiLanguage = "es";
          } else if (hasExplicitEnglish) {
            aiLanguage = "en";
          } else if (
            spanishScore >= 2 &&
            spanishScore > portugueseScore &&
            spanishScore > englishScore
          ) {
            aiLanguage = "es";
          } else if (
            englishScore >= 2 &&
            englishScore > portugueseScore &&
            englishScore > spanishScore
          ) {
            aiLanguage = "en";
          }

          logger.info(
            `[AI LANGUAGE] ticket=${ticket.id} language=${aiLanguage} scores=pt:${portugueseScore},es:${spanishScore},en:${englishScore}`
          );

          const welcomeIntro =
            aiLanguage === "es"
              ? `¡Hola! Soy ${name}.`
              : aiLanguage === "en"
                ? `Hello! I am ${name}.`
                : `Olá! Sou ${name}.`;

          const welcomeQuestion =
            aiLanguage === "es"
              ? "¿Cómo puedo ayudarte?"
              : aiLanguage === "en"
                ? "How can I help you?"
                : "Como posso ajudá-lo?";

          const continueInstruction = (keyword: string): string =>
            aiLanguage === "es"
              ? `(Escribe "${keyword}" cuando quieras continuar)`
              : aiLanguage === "en"
                ? `(Type "${keyword}" when you want to continue)`
                : `(Digite "${keyword}" quando quiser prosseguir)`;

          logger.info(`[${provider.toUpperCase()} NODE] Ativando modo ${provider.toUpperCase()} para ticket ${ticket.id} (${flowMode})`);

          if (flowMode === "permanent") {
            // MODO PERMANENTE: Para o fluxo e fica em IA

            // ✅ VERIFICAR SE JÁ ENVIOU BOAS-VINDAS ANTERIORMENTE
            const alreadySentWelcome = ticket.dataWebhook?.aiWelcomeSent === true;

            await ticket.update({
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: null,
              useIntegration: true,
              isBot: true,
              status: "pending",
              dataWebhook: {
                type: provider,
                settings: aiSettings,
                mode: "permanent",
                awaitingUserResponse: true,
                aiWelcomeSent: alreadySentWelcome // ✅ PRESERVAR O ESTADO ANTERIOR
              }
            });

            logger.info(`[${provider.toUpperCase()} NODE] Modo permanente ativado`);

            // ✅ ENVIAR MENSAGEM DE BOAS-VINDAS APENAS SE NÃO TIVER SIDO ENVIADA ANTES
            if (name && !alreadySentWelcome) {
              const welcomeMessage = objective
                ? `${welcomeIntro} ${objective}`
                : `${welcomeIntro} ${welcomeQuestion}`;

              logger.info(`[${provider.toUpperCase()} NODE] Enviando boas-vindas para ticket ${ticket.id}`);

              if (whatsapp.channel === "whatsapp") {
                await SendWhatsAppMessage({ body: welcomeMessage, ticket, quotedMsg: null });
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                await SendWhatsAppOficialMessage({
                  body: welcomeMessage,
                  ticket: ticket,
                  quotedMsg: null,
                  type: 'text',
                  media: null,
                  vCard: null
                });
              }

              if (whatsapp.channel === "telegram") {
                await sendTelegramFlowText({
                  whatsapp,
                  ticket,
                  body: welcomeMessage
                });
              }

              // ✅ MARCAR QUE JÁ ENVIOU AS BOAS-VINDAS
              await ticket.update({
                dataWebhook: {
                  ...ticket.dataWebhook,
                  aiWelcomeSent: true
                }
              });
            }

            // ✅ PARAR FLUXO E AGUARDAR RESPOSTA DO USUÁRIO
            break;

          } else {
            // MODO TEMPORÁRIO: Mantém informações do fluxo
            const nextConnection = connects.filter(
              connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
            )[0];

            const alreadySentWelcome = ticket.dataWebhook?.aiWelcomeSent === true;

            await ticket.update({
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString(),
              useIntegration: true,
              isBot: true,
              dataWebhook: {
                type: provider,
                settings: aiSettings,
                mode: "temporary",
                awaitingUserResponse: true,
                aiWelcomeSent: alreadySentWelcome,
                flowContinuation: {
                  nextNodeId: nextConnection?.target,
                  interactionCount: 0,
                  startTime: new Date().toISOString(),
                  originalDataWebhook: dataWebhook
                }
              }
            });

            logger.info(`[${provider.toUpperCase()} NODE] Modo temporário ativado`);

            // ✅ ENVIAR MENSAGEM DE BOAS-VINDAS APENAS SE NÃO TIVER SIDO ENVIADA ANTES
            if (name && !alreadySentWelcome) {
              const welcomeMessage = objective
                ? `${welcomeIntro} ${objective}`
                : flowMode === "temporary" && continueKeywords?.length > 0
                  ? `${welcomeIntro} ${welcomeQuestion} ${continueInstruction(continueKeywords[0])}`
                  : `${welcomeIntro} ${welcomeQuestion}`;

              logger.info(`[${provider.toUpperCase()} NODE] Enviando boas-vindas para ticket ${ticket.id}`);

              if (whatsapp.channel === "whatsapp") {
                await SendWhatsAppMessage({ body: welcomeMessage, ticket, quotedMsg: null });
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                await SendWhatsAppOficialMessage({
                  body: welcomeMessage,
                  ticket: ticket,
                  quotedMsg: null,
                  type: 'text',
                  media: null,
                  vCard: null
                });
              }

              if (whatsapp.channel === "telegram") {
                await sendTelegramFlowText({
                  whatsapp,
                  ticket,
                  body: welcomeMessage
                });
              }

              // ✅ MARCAR QUE JÁ ENVIOU AS BOAS-VINDAS
              await ticket.update({
                dataWebhook: {
                  ...ticket.dataWebhook,
                  aiWelcomeSent: true
                }
              });
            }
          }

          continue;

        } catch (error) {
          logger.error(`[AI NODE] Erro ao processar nó ${nodeSelected.type}:`, error);
          continue;
        }
      }

      if (nodeSelected.type === "input") {
        try {
          // Garantir que o ticket esteja disponível
          if (!ticket && idTicket) {
            ticket = await getTicketWithWhatsapp(idTicket, whatsappId);

            if (!ticket) {
              continue;
            }
          }

          let question = nodeSelected.data.question || "";
          const variableName = nodeSelected.data.variableName || "";

          if (!variableName) {
            continue;
          }

          // Verifica se este input específico já foi respondido
          const inputIdentifier = `${ticket.id}_${variableName}`;
          const thisInputResponded = global.flowVariables[inputIdentifier];
          const alwaysAsk = nodeSelected.data?.alwaysAsk || false;

          // ✅ API OFICIAL / FALLBACK: se o ticket já estava aguardando este input
          // e chegou uma nova mensagem do usuário em pressKey, então isso é a RESPOSTA
          // do input, não uma nova execução para perguntar novamente.
          const currentDataWebhook: any = ticket?.dataWebhook || {};

          const isAnsweringCurrentInput =
            !!pressKey &&
            currentDataWebhook?.waitingInput === true &&
            (
              currentDataWebhook?.inputIdentifier === inputIdentifier ||
              currentDataWebhook?.inputVariableName === variableName ||
              ticket?.lastFlowId === nodeSelected.id
            );

          if (isAnsweringCurrentInput) {
            const answerValue = String(pressKey || "")
              .trim()
              .replace(/[\r\n\u200e\u200f\u200b]/g, "");

            logger.info(
              `[INPUT NODE] ✅ Resposta recebida para input ${inputIdentifier}: ${answerValue}`
            );

            global.flowVariables = global.flowVariables || {};

            // Salva específico por ticket
            global.flowVariables[inputIdentifier] = answerValue;

            // Mantém compatibilidade com blocos antigos que buscam só pelo nome da variável
            global.flowVariables[variableName] = answerValue;

            const savedNext =
              global.flowVariables[`${inputIdentifier}_next`] ||
              currentDataWebhook?.nextNodeId;

            logger.info(
              `[INPUT NODE] Próximo nó após resposta do input: ${savedNext || "não definido"}`
            );

            await ticket.update({
              dataWebhook: {
                ...(ticket.dataWebhook || {}),
                waitingInput: false,
                inputVariableName: null,
                inputIdentifier: null,
                nextNodeId: null
              }
            });

            if (savedNext) {
              next = savedNext;
              noAlterNext = true;
              pressKey = undefined;
              execFn = undefined;

              delete global.flowVariables[`${inputIdentifier}_next`];

              logger.info(
                `[INPUT NODE] Continuando fluxo para próximo nó: ${next}`
              );

              continue;
            }

            logger.warn(
              `[INPUT NODE] Resposta capturada, mas nenhum próximo nó foi encontrado para ${inputIdentifier}`
            );

            break;
          }

          logger.info(`[INPUT NODE] Debug - Ticket ${ticket.id}, Variable: ${variableName}, InputIdentifier: ${inputIdentifier}`);
          logger.info(`[INPUT NODE] Debug - inputResponded: ${inputResponded}, thisInputResponded: ${thisInputResponded}, alwaysAsk: ${alwaysAsk}`);

          // Se inputResponded é true E este input específico já foi respondido,
          // significa que estamos retomando o fluxo após uma resposta deste input específico
          if (inputResponded && thisInputResponded && !alwaysAsk) {
            logger.info(`[INPUT NODE] Retomando fluxo após resposta deste input específico - Ticket ${ticket.id}`);

            // Recuperar o valor do próximo nó salvo anteriormente
            const savedNext = global.flowVariables[`${inputIdentifier}_next`];
            logger.info(`[INPUT NODE] Próximo nó salvo: ${savedNext}`);

            if (savedNext) {
              next = savedNext;
              // Limpar a variável após uso
              delete global.flowVariables[`${inputIdentifier}_next`];
              logger.info(`[INPUT NODE] Continuando para próximo nó: ${next}`);
            } else {
              logger.warn(`[INPUT NODE] Nenhum próximo nó encontrado para ${inputIdentifier}`);
            }

            await ticket.update({
              dataWebhook: {
                ...ticket.dataWebhook,
                waitingInput: false
              }
            });

            // Pular para o próximo nó sem processar mais este nó
            continue;
          } else if (!inputResponded && thisInputResponded && !alwaysAsk) {
            // Se não estamos retomando o fluxo mas o input já foi respondido, pular
            // EXCETO se alwaysAsk estiver ativado
            logger.info(`[INPUT NODE] Input já respondido anteriormente - pulando - Ticket ${ticket.id}`);
            continue;
          } else {
            logger.info(`[INPUT NODE] Processando novo input - Ticket ${ticket.id}`);

            // ✅ CORRIGIDO: Verificar se o ticket está "open" antes de enviar mensagem do Input
            // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
            // Recarregar o ticket para obter o status mais atualizado
            if (idTicket) {
              const currentTicket = await Ticket.findByPk(idTicket);
              if (currentTicket && currentTicket.status === "open" && !isManualTrigger) {
                logger.info(`[INPUT NODE] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não enviando mensagem do Input`);
                // Limpar os dados do webhook relacionados ao Input
                await currentTicket.update({
                  dataWebhook: {
                    ...currentTicket.dataWebhook,
                    waitingInput: false,
                    inputVariableName: null,
                    inputIdentifier: null,
                    nextNodeId: null
                  }
                });
                return "stopped_by_open_ticket";
              }
              // Atualizar a referência do ticket
              ticket = currentTicket;
            }

            const dataLocal = {
              nome: createFieldJsonName,
              numero: numberClient,
              email: createFieldJsonEmail
            };

            const preparedQuestion = await prepareFlowText({
              rawText: question || "",
              ticketData: ticket,
              ticketId: ticket?.id || idTicket,
              whatsappId,
              companyId,
              details,
              dataWebhook,
              dataLocal
            });

            ticket = preparedQuestion.ticketData || ticket;
            question = preparedQuestion.text;

            // Enviar a pergunta e aguardar resposta
            await intervalWhats("1");

            // API Oficial precisa do ticket com contact + whatsapp carregados
            const ticketDetailsInput =
              whatsapp.channel === "whatsapp_oficial"
                ? await getTicketWithWhatsapp(ticket.id, whatsappId, companyId)
                : ticket;

            if (!ticketDetailsInput) {
              logger.error(
                `[INPUT NODE] Ticket ${ticket?.id || idTicket} não encontrado para envio do input`
              );
              continue;
            }

            logger.info(
              `[INPUT NODE] Enviando pergunta do input via canal=${whatsapp.channel} | ticket=${ticketDetailsInput.id}`
            );

            if (whatsapp.channel === "whatsapp") {
              logger.info("[INPUT NODE] Enviando input via Baileys");

              typeSimulation(ticketDetailsInput, "composing");

              await SendWhatsAppMessage({
                body: question,
                ticket: ticketDetailsInput,
                quotedMsg: null
              });
            } else if (whatsapp.channel === "whatsapp_oficial") {
              logger.info("[INPUT NODE] Enviando input via API Oficial");

              await SendWhatsAppOficialMessage({
                body: question,
                ticket: ticketDetailsInput,
                quotedMsg: null,
                type: "text",
                media: null,
                vCard: null
              });
            } else if (whatsapp.channel === "telegram") {
              logger.info("[INPUT NODE] Enviando input via Telegram");

              await sendTelegramFlowText({
                whatsapp,
                ticket: ticketDetailsInput,
                body: question
              });
            } else {
              logger.info("[INPUT NODE] Enviando input via fallback");

              await SendMessage(whatsapp, {
                number: numberClient,
                body: question
              });
            }

            ticket = ticketDetailsInput;


            if (ticket) {
              // Salvar a conexão de saída para ser usada quando o fluxo for retomado
              const outputConnection = connects.filter(
                connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
              )[0];

              const nextNodeId = outputConnection ? outputConnection.target : next;

              logger.info(`[TICKET UPDATE] Preparando ticket ${ticket.id} para aguardar input - Status: pending, LastFlowId: ${nodeSelected.id}, WaitingInput: true`);

              await ticket.update({
                status: "pending",
                lastFlowId: nodeSelected.id,
                flowWebhook: true,
                hashFlowId: hashWebhookId,
                flowStopped: idFlowDb.toString(),
                dataWebhook: {
                  ...ticket.dataWebhook,
                  flowId: idFlowDb, // persistir flowId para retomadas resilientes
                  waitingInput: true,
                  inputVariableName: variableName,
                  inputIdentifier: inputIdentifier,
                  nextNodeId: nextNodeId // Salvar no dataWebhook também como backup
                }
              });

              logger.info(`[TICKET UPDATE] Ticket ${ticket.id} configurado para aguardar input - Variable: ${variableName}, NextNodeId: ${nextNodeId}`);

              global.flowVariables = global.flowVariables || {};
              global.flowVariables[`${inputIdentifier}_next`] = nextNodeId;

              break; // Parar o fluxo para aguardar a resposta
            }
          }
        } catch (error) {
          logger.error(`[INPUT NODE] Erro ao processar input:`, error);
          continue;
        }
      }

      // [conditionCompare legado removido — o bloco principal com suporte a AND/OR e múltiplas condições está abaixo]

      if (nodeSelected.type === "asaas") {
        try {
          logger.info(`[ASAAS NODE] ========== PROCESSANDO NÓ ASAAS ==========`);
          logger.info(`[ASAAS NODE] Nó ID: ${nodeSelected.id}, Ticket ID: ${ticket?.id || idTicket}`);

          if (!(await ensureTicket())) {
            logger.warn(`[ASAAS NODE] Ticket não disponível - pulando nó`);
            continue;
          }

          ticket = await getTicketWithWhatsapp(ticket.id, whatsappId, companyId);

          if (!ticket) {
            logger.error(`[ASAAS NODE] Ticket não encontrado após reload`);
            continue;
          }

          const action =
            nodeSelected.data?.action ||
            nodeSelected.data?.asaasAction ||
            "secondCopyBoleto";

          if (action !== "secondCopyBoleto") {
            logger.warn(`[ASAAS NODE] Ação não suportada: ${action}`);
            continue;
          }

          const variableName = String(
            nodeSelected.data?.cpfCnpjVariable ||
            nodeSelected.data?.variableName ||
            nodeSelected.data?.inputVariable ||
            "cpfCnpj"
          ).trim();

          let cpfCnpj = "";

          if (ticket?.id && variableName) {
            cpfCnpj =
              global.flowVariables?.[`${ticket.id}_${variableName}`] ||
              global.flowVariables?.[variableName] ||
              "";
          }

          if (!cpfCnpj && pressKey) {
            cpfCnpj = String(pressKey || "");
          }

          if (!cpfCnpj) {
            cpfCnpj = String(
              nodeSelected.data?.cpfCnpj ||
              nodeSelected.data?.document ||
              ""
            );
          }

          cpfCnpj = String(cpfCnpj || "").replace(/\D/g, "");

          logger.info(
            `[ASAAS NODE] Consultando segunda via. Variable=${variableName}, DocumentoLength=${cpfCnpj.length}`
          );

          const asaasResult = await ExecuteAsaasSecondCopyFlowService({
            companyId,
            cpfCnpj
          });

          global.flowVariables = global.flowVariables || {};

          global.flowVariables["asaasFound"] = asaasResult.found;
          global.flowVariables["asaasReason"] = asaasResult.reason;
          global.flowVariables["asaasReplyMessage"] = asaasResult.replyMessage;
          global.flowVariables["asaasPaymentsCount"] = asaasResult.paymentsCount;

          if (ticket?.id) {
            global.flowVariables[`${ticket.id}_asaasFound`] = asaasResult.found;
            global.flowVariables[`${ticket.id}_asaasReason`] = asaasResult.reason;
            global.flowVariables[`${ticket.id}_asaasReplyMessage`] = asaasResult.replyMessage;
            global.flowVariables[`${ticket.id}_asaasPaymentsCount`] = asaasResult.paymentsCount;

            global.flowVariables[`${ticket.id}_asaasCustomerId`] = asaasResult.customerId || "";
            global.flowVariables[`${ticket.id}_asaasCustomerName`] = asaasResult.customerName || "";
            global.flowVariables[`${ticket.id}_asaasCustomerCpfCnpj`] = asaasResult.customerCpfCnpj || "";

            global.flowVariables[`${ticket.id}_asaasPaymentId`] = asaasResult.paymentId || "";
            global.flowVariables[`${ticket.id}_asaasPaymentValue`] = asaasResult.paymentValue || "";
            global.flowVariables[`${ticket.id}_asaasPaymentStatus`] = asaasResult.paymentStatus || "";
            global.flowVariables[`${ticket.id}_asaasPaymentDueDate`] = asaasResult.paymentDueDate || "";
            global.flowVariables[`${ticket.id}_asaasInvoiceUrl`] = asaasResult.invoiceUrl || "";
            global.flowVariables[`${ticket.id}_asaasBankSlipUrl`] = asaasResult.bankSlipUrl || "";
            global.flowVariables[`${ticket.id}_asaasIdentificationField`] = asaasResult.identificationField || "";
          }

          const shouldSendMessage =
            nodeSelected.data?.sendMessage === undefined
              ? true
              : Boolean(nodeSelected.data?.sendMessage);

          if (shouldSendMessage && asaasResult.replyMessage) {
            await intervalWhats("1");

            // typeSimulation usa Baileys/getWbot.
            // Não pode rodar em API Oficial, senão gera ERR_WAPP_NOT_INITIALIZED.
            if (whatsapp.channel === "whatsapp") {
              typeSimulation(ticket, "composing");
            }

            if (whatsapp.channel === "whatsapp_oficial") {
              await SendWhatsAppOficialMessage({
                body: asaasResult.replyMessage,
                ticket: ticket,
                quotedMsg: null,
                type: "text",
                media: null,
                vCard: null
              });
            } else if (whatsapp.channel === "whatsapp") {
              await SendWhatsAppMessage({
                body: asaasResult.replyMessage,
                ticket: ticket,
                quotedMsg: null
              });
            } else if (whatsapp.channel === "telegram") {
              await sendTelegramFlowText({
                whatsapp,
                ticket,
                body: asaasResult.replyMessage
              });
            } else {
              await SendMessage(whatsapp, {
                number: numberClient,
                body: asaasResult.replyMessage
              });
            }
          }

          const parseFlowBool = (value: any, fallback = false): boolean => {
            if (typeof value === "boolean") return value;

            if (typeof value === "string") {
              return ["true", "1", "yes", "sim", "on"].includes(
                value.toLowerCase().trim()
              );
            }

            if (typeof value === "number") return value === 1;

            return fallback;
          };

          const keepMenuCommandsEnabled = parseFlowBool(
            nodeSelected.data?.keepMenuCommandsEnabled,
            true
          );

          const holdAfterSend = parseFlowBool(
            nodeSelected.data?.holdAfterSend,
            false
          );

          const continueAfterSend = !holdAfterSend;

          const rootMenuNodeId = ticket?.id
            ? global.flowVariables?.[`${ticket.id}_rootMenuNodeId`]
            : null;

          const currentMenuNodeId = ticket?.id
            ? global.flowVariables?.[`${ticket.id}_currentMenuNodeId`]
            : null;

          const lastFlowIdToKeep = keepMenuCommandsEnabled
            ? rootMenuNodeId || currentMenuNodeId || ticket.lastFlowId || nodeSelected.id
            : nodeSelected.id;

          logger.info(
            `[ASAAS NODE] Mantendo comandos de menu: ${keepMenuCommandsEnabled} | LastFlowId: ${lastFlowIdToKeep}`
          );

          await ticket.update({
            lastMessage: asaasResult.replyMessage,
            status: "pending",
            flowWebhook: true,
            lastFlowId: lastFlowIdToKeep,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString(),
            useIntegration: false,
            isBot: true,
            dataWebhook: {
              ...(ticket.dataWebhook || {}),
              flowId: idFlowDb,
              waitingMenuCommands: keepMenuCommandsEnabled,
              asaas: {
                type: "secondCopyBoleto",
                found: asaasResult.found,
                reason: asaasResult.reason,
                paymentsCount: asaasResult.paymentsCount,
                paymentId: asaasResult.paymentId || null,
                customerId: asaasResult.customerId || null,
                keepMenuCommandsEnabled,
                rootMenuNodeId: rootMenuNodeId || null,
                currentMenuNodeId: currentMenuNodeId || null
              }
            }
          });

          if (continueAfterSend) {
            const nextConnection = connects.find(
              connect =>
                connect.source === nodeSelected.id &&
                (
                  connect.sourceHandle === "a" ||
                  connect.sourceHandle === "success" ||
                  connect.sourceHandle === "default"
                )
            );

            if (nextConnection?.target) {
              logger.info(`[ASAAS NODE] Avançando para próximo nó: ${nextConnection.target}`);
              next = nextConnection.target;
              noAlterNext = true;
              continue;
            }
          }

          logger.info(
            `[ASAAS NODE] Segunda via enviada. Fluxo mantido em pending para aceitar comandos: menu, voltar, início.`
          );

          break;
        } catch (error) {
          logger.error(`[ASAAS NODE] Erro ao processar segunda via Asaas:`, error);

          global.flowVariables = global.flowVariables || {};
          global.flowVariables["asaasFound"] = false;
          global.flowVariables["asaasReason"] = "ASAAS_NODE_ERROR";

          if (ticket?.id) {
            global.flowVariables[`${ticket.id}_asaasFound`] = false;
            global.flowVariables[`${ticket.id}_asaasReason`] = "ASAAS_NODE_ERROR";
          }

          continue;
        }
      }

      if (nodeSelected.type === "variable") {
        try {
          const variableName = nodeSelected.data.variableName;
          let variableValue = nodeSelected.data.variableValue;

          if (variableName) {
            // Processar o valor da variável usando replaceMessages se contiver variáveis
            if (typeof variableValue === "string" && variableValue.includes("${")) {
              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              variableValue = replaceMessages(
                variableValue,
                details,
                dataWebhook,
                dataLocal,
                idTicket
              );
            }

            global.flowVariables = global.flowVariables || {};

            // Salvar a variável globalmente
            global.flowVariables[variableName] = variableValue;

            // Se temos um ticketId, salvar também como variável específica do ticket
            if (idTicket) {
              const ticketSpecificVar = `${idTicket}_${variableName}`;
              global.flowVariables[ticketSpecificVar] = variableValue;
            }
          }
        } catch (error) {
        }
      }

      if (nodeSelected.type === "typebot") {
        logger.info(`[TYPEBOT NODE] ========== PROCESSANDO NÓ TYPEBOT ==========`);
        logger.info(`[TYPEBOT NODE] Ticket: ${ticket?.id || idTicket}`);

        if (!(await ensureTicket())) {
          logger.warn(`[TYPEBOT NODE] Ticket não disponível - pulando nó`);
          continue;
        }

        ticket = await getTicketWithWhatsapp(ticket.id, whatsappId, companyId);
        if (!ticket) {
          logger.error(`[TYPEBOT NODE] Ticket não encontrado após reload`);
          continue;
        }

        const typebotBaseUrl = String(
          nodeSelected.data?.url ||
          nodeSelected.data?.typebotUrl ||
          nodeSelected.data?.typebot ||
          "https://typebot.co"
        ).trim().replace(/\/+$/, "");

        const typebotSlug = String(
          nodeSelected.data?.typebotSlug ||
          nodeSelected.data?.slug ||
          ""
        ).trim().replace(/^\/+|\/+$/g, "");

        const typebotId = String(
          nodeSelected.data?.typebotId ||
          nodeSelected.data?.idTypebot ||
          ""
        ).trim();

        const typebotName = String(
          nodeSelected.data?.name ||
          "TypeBot"
        ).trim();

        const blockLabel = String(
          nodeSelected.data?.label ||
          nodeSelected.data?.text ||
          "Novo Typebot"
        ).trim();

        const initialMessage = String(
          nodeSelected.data?.initialMessage ||
          nodeSelected.data?.message ||
          ""
        ).trim();

        const variableName = String(
          nodeSelected.data?.variableName ||
          ""
        ).trim();

        const waitForResponse = Boolean(
          nodeSelected.data?.waitForResponse ?? true
        );

        const typebotExpires = Number(
          nodeSelected.data?.expireMinutes ??
          nodeSelected.data?.typebotExpires ??
          60
        ) || 60;

        const typebotDelayMessage = Number(
          nodeSelected.data?.messageInterval ??
          nodeSelected.data?.typebotDelayMessage ??
          1000
        ) || 1000;

        const typebotKeywordFinish = String(
          nodeSelected.data?.keywordFinish ??
          nodeSelected.data?.typebotKeywordFinish ??
          "#"
        ).trim() || "#";

        const typebotKeywordRestart = String(
          nodeSelected.data?.keywordRestart ??
          nodeSelected.data?.typebotKeywordRestart ??
          "00"
        ).trim() || "00";

        const typebotUnknownMessage = String(
          nodeSelected.data?.invalidOptionMessage ??
          nodeSelected.data?.typebotUnknownMessage ??
          "Opção inválida, por favor envie #"
        ).trim() || "Opção inválida, por favor envie #";

        const typebotRestartMessage = String(
          nodeSelected.data?.restartMessage ??
          nodeSelected.data?.typebotRestartMessage ??
          "Vamos começar novamente?"
        ).trim() || "Vamos começar novamente?";

        if (!typebotBaseUrl || !typebotSlug) {
          logger.error(
            `[TYPEBOT NODE] URL base ou slug não informado. url="${typebotBaseUrl}" slug="${typebotSlug}"`
          );
          continue;
        }

        const fullUrl = `${typebotBaseUrl}/${typebotSlug}`;

        const nextConnection = connects.find(
          connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
        );

        logger.info(`[TYPEBOT NODE] URL final: ${fullUrl}`);
        logger.info(
          `[TYPEBOT NODE] Próximo nó após Typebot: ${nextConnection?.target || "nenhum"}`
        );

        const globalAny = global as any;
        const allFlowVariables = globalAny.flowVariables || {};
        const ticketPrefix = `${ticket.id}_`;
        const ticketFlowVariables: Record<string, any> = {};

        Object.keys(allFlowVariables).forEach(key => {
          if (key.startsWith(ticketPrefix)) {
            ticketFlowVariables[key.replace(ticketPrefix, "")] = allFlowVariables[key];
          }
        });

        const sameTypebotSession =
          ticket.lastFlowId === nodeSelected.id && !!ticket.typebotSessionId;

        const incomingBody = String(
          pressKey ||
          msg?.message?.conversation ||
          msg?.message?.extendedTextMessage?.text ||
          msg?.message?.imageMessage?.caption ||
          msg?.message?.videoMessage?.caption ||
          msg?.message?.buttonsResponseMessage?.selectedButtonId ||
          msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          ""
        ).trim();

        const typebotBody = sameTypebotSession ? incomingBody : "";

        const typebotConfig: any = {
          id: 0,
          type: "typebot",
          name: typebotName,
          label: blockLabel,
          urlN8N: typebotBaseUrl,
          fullUrl,
          typebotSlug,
          typebotId,
          typebotExpires,
          typebotKeywordFinish,
          typebotKeywordRestart,
          typebotUnknownMessage,
          typebotDelayMessage,
          typebotRestartMessage,
          initialMessage,
          variableName,
          waitForResponse,
          prefilledVariables: ticketFlowVariables
        };

        await ticket.update({
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString(),
          useIntegration: true,
          isBot: true,
          status: "pending",
          typebotStatus: true,
          typebotSessionId: sameTypebotSession ? ticket.typebotSessionId || null : null,
          typebotSessionTime: sameTypebotSession ? ticket.typebotSessionTime || null : null,
          dataWebhook: {
            ...(ticket.dataWebhook || {}),
            type: "typebot",
            waitingTypebot: true,
            awaitingUserResponse: waitForResponse,
            typebot: {
              ...typebotConfig,
              flowId: idFlowDb,
              nextNodeId: nextConnection?.target || null
            }
          }
        });

        logger.info(
          sameTypebotSession
            ? `[TYPEBOT NODE] Sessão ativa detectada para ticket ${ticket.id}. sessionId=${ticket.typebotSessionId}. Encaminhando para continueChat.`
            : `[TYPEBOT NODE] Estado Typebot salvo no ticket ${ticket.id}`
        );

        let currentWbot = null;

        if (whatsapp.channel === "whatsapp") {
          currentWbot = await getWbot(ticket.whatsappId || whatsappId);
        }

        if (whatsapp.channel === "whatsapp_oficial") {
          await typebotListenerOficial({
            msg,
            body: typebotBody,
            ticket,
            typebot: typebotConfig
          });
        } else {
          await typebotListener({
            wbot: currentWbot,
            msg,
            body: typebotBody,
            ticket,
            typebot: typebotConfig
          });
        }

        logger.info(
          sameTypebotSession
            ? `[TYPEBOT NODE] Mensagem do usuário encaminhada ao Typebot existente com sucesso`
            : `[TYPEBOT NODE] Typebot iniciado/continuado com sucesso para ticket ${ticket.id}`
        );

        // recarrega o ticket após o typebotListener, porque ele pode ter alterado
        // sessionId, typebotStatus e dataWebhook
        await ticket.reload();

        // não reutilizar a mesma resposta do usuário nas próximas iterações
        pressKey = undefined;
        execFn = undefined;

        const nextNodeId = nextConnection?.target || null;

        // Se ainda existe sessão ativa, o Typebot está aguardando nova resposta.
        // Então precisamos PARAR o loop do ActionsWebhookService aqui.
        if (ticket.typebotStatus && ticket.typebotSessionId) {
          logger.info(
            `[TYPEBOT NODE] Typebot continua ativo para ticket ${ticket.id}. Aguardando próxima resposta do usuário.`
          );
          break;
        }

        // Se o Typebot terminou e existe um próximo nó no FlowBuilder, avançar
        if (nextNodeId) {
          logger.info(
            `[TYPEBOT NODE] Typebot finalizado. Avançando para o próximo nó: ${nextNodeId}`
          );
          next = nextNodeId;
          noAlterNext = true;
          continue;
        }

        // Se terminou e não existe próximo nó, encerrar este processamento
        logger.info(
          `[TYPEBOT NODE] Typebot finalizado sem próximo nó. Encerrando execução atual.`
        );
        break;
      }

      if (nodeSelected.type === "httpRequest") {
        try {
          const {
            url,
            method,
            requestBody,
            headersString,
            queryParams,
            saveVariables,
            responseVariables,
            timeout
          } = nodeSelected.data;

          // ✅ VALIDAÇÃO MELHORADA: Verificar se URL é válida antes de continuar
          if (!url || typeof url !== 'string' || url.trim().length === 0) {
            logger.warn(`[HTTP REQUEST NODE] URL vazia ou inválida no nó ${nodeSelected.id} - pulando execução`);
            continue;
          }

          // ✅ Verificar se URL contém variáveis não substituídas
          if (url.includes("${") && url.includes("}")) {
            const unresolvedVars = url.match(/\${([^}]+)}/g);
            if (unresolvedVars) {
              logger.warn(`[HTTP REQUEST NODE] URL contém variáveis não resolvidas: ${unresolvedVars.join(', ')} - pulando execução`);
              continue;
            }
          }

          let headers = {};
          try {
            if (headersString && typeof headersString === "string") {
              headers = JSON.parse(headersString);
            } else if (typeof headersString === "object") {
              headers = headersString;
            }
          } catch (err) {
            console.error(
              "[httpRequestNode] Erro ao parsear headers JSON:",
              err
            );
          }

          let body = null;
          if (
            ["POST", "PUT", "PATCH", "DELETE"].includes(
              method?.toUpperCase() || "GET"
            )
          ) {
            try {
              body =
                requestBody && typeof requestBody === "string"
                  ? requestBody.trim().startsWith("{")
                    ? JSON.parse(requestBody)
                    : requestBody
                  : null;
            } catch (err) {
              console.error(
                "[httpRequestNode] Erro ao parsear body JSON, usando como string:",
                err
              );
              body = requestBody;
            }
          }

          const requestTimeout = timeout || 10000;

          logger.info(`[HTTP REQUEST NODE] Executando requisição - URL: ${url}, Method: ${method || "GET"}`);

          const response = await makeHttpRequest(
            url,
            method || "GET",
            headers,
            body,
            queryParams,
            requestTimeout
          );

          // ✅ Verificar se houve erro na resposta
          if (response.error) {
            logger.error(`[HTTP REQUEST NODE] Requisição falhou: ${response.message} - Status: ${response.status}`);
            // Continuar o fluxo mesmo com erro
            global.flowVariables = global.flowVariables || {};
            global.flowVariables["apiResponse"] = null;
            global.flowVariables["apiError"] = response.message;
            continue;
          }

          logger.info(`[HTTP REQUEST NODE] Requisição bem-sucedida - Status: ${response.status}`);

          global.flowVariables = global.flowVariables || {};
          global.flowVariables["apiResponse"] = response.data;

          if (response.data) {
            let variablesToProcess = [];

            if (
              responseVariables &&
              Array.isArray(responseVariables) &&
              responseVariables.length > 0
            ) {
              variablesToProcess = responseVariables;
            } else if (
              saveVariables &&
              Array.isArray(saveVariables) &&
              saveVariables.length > 0
            ) {
              variablesToProcess = saveVariables.map(item => ({
                path: item.path,
                variableName: item.variable
              }));
            } else if (
              nodeSelected.data.responseVariables &&
              Array.isArray(nodeSelected.data.responseVariables)
            ) {
              variablesToProcess = nodeSelected.data.responseVariables;
            } else if (
              nodeSelected.data.saveVariables &&
              Array.isArray(nodeSelected.data.saveVariables)
            ) {
              variablesToProcess = nodeSelected.data.saveVariables.map(
                item => ({
                  path: item.path,
                  variableName: item.variable || item.variableName
                })
              );
            }

            if (variablesToProcess && variablesToProcess.length > 0) {
              for (let i = 0; i < variablesToProcess.length; i++) {
                const extractor = variablesToProcess[i];

                if (extractor && extractor.path && extractor.variableName) {
                  const parts = extractor.path.split(".");
                  let value = response.data;
                  let pathValid = true;

                  for (const part of parts) {
                    if (value && typeof value === "object" && part in value) {
                      value = value[part];
                    } else {
                      pathValid = false;
                      break;
                    }
                  }

                  if (pathValid && value !== undefined && value !== null) {
                    if (typeof setFlowVariable === "function") {
                      setFlowVariable(extractor.variableName, value);
                    } else {
                      global.flowVariables[extractor.variableName] = value;
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.error(`[HTTP REQUEST NODE] Erro ao processar nó HTTP Request: ${error.message}`);
          logger.error(`[HTTP REQUEST NODE] Stack: ${error.stack}`);

          // ✅ Salvar informações do erro nas variáveis globais
          global.flowVariables = global.flowVariables || {};
          global.flowVariables["apiResponse"] = null;
          global.flowVariables["apiError"] = error.message;

          // ✅ Continuar o fluxo mesmo com erro (não quebrar o fluxo inteiro)
          logger.info(`[HTTP REQUEST NODE] Continuando fluxo apesar do erro no nó ${nodeSelected.id}`);
        }
      }

      if (nodeSelected.type === "ticket") {
        logger.info(`[TICKET NODE] ========== PROCESSANDO NÓ FILA ==========`);
        logger.info(`[TICKET NODE] Nó ID: ${nodeSelected.id}, Ticket ID: ${ticket?.id || idTicket}`);
        if (!(await ensureTicket())) continue;

        const queueId = nodeSelected?.data?.queue?.id;
        const targetUserId = nodeSelected?.data?.user?.id || null;

        // ✅ CORRIGIDO: Permitir transferência mesmo sem fila (apenas com usuário ou para pending sem fila)
        if (!queueId && !targetUserId) {
          logger.warn(`[TICKET NODE] Nó ${nodeSelected.id} sem fila e sem usuário configurado. Transferindo ticket para pending sem fila.`);

          // Transferir para pending sem fila - ticket fica aguardando atribuição manual
          await ticket.update({
            status: 'pending',
            queueId: null,
            userId: null,
            companyId: companyId,
            flowWebhook: true,
            lastFlowId: nodeSelected.id,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString(),
            isBot: false,
            useIntegration: false
          });

          await UpdateTicketService({
            ticketData: {
              status: "pending",
              queueId: null,
              userId: null,
              isBot: false,
              useIntegration: false
            },
            ticketId: ticket.id,
            companyId
          });

          logger.info(`[TICKET NODE] Ticket ${ticket.id} transferido para pending sem fila`);

          await CreateLogTicketService({
            ticketId: ticket.id,
            type: "queue"
          });
        } else if (!queueId && targetUserId) {
          // Transferência direta para um usuário sem fila
          logger.info(`[TICKET NODE] Nó ${nodeSelected.id} sem fila mas com usuário ${targetUserId}. Transferindo diretamente para o usuário.`);

          const targetStatus = targetUserId ? "open" : "pending";

          await ticket.update({
            status: targetStatus,
            queueId: null,
            userId: targetUserId,
            companyId: companyId,
            flowWebhook: true,
            lastFlowId: nodeSelected.id,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString(),
            isBot: false,
            useIntegration: false
          });

          await UpdateTicketService({
            ticketData: {
              status: targetStatus,
              queueId: null,
              userId: targetUserId,
              isBot: false,
              useIntegration: false
            },
            ticketId: ticket.id,
            companyId
          });

          logger.info(`[TICKET NODE] Ticket ${ticket.id} transferido para usuário ${targetUserId} - Status: ${targetStatus}`);

          await CreateLogTicketService({
            ticketId: ticket.id,
            type: "open",
            userId: targetUserId
          });
        } else {
          // Fluxo original com fila
          logger.info(`[TICKET NODE] Ticket=${ticket?.id}, QueueId=${queueId}, CompanyId=${companyId}, FlowId=${idFlowDb}, Hash=${hashWebhookId}`);

          const queue = await ShowQueueService(queueId, companyId);

          logger.info(`[TICKET UPDATE] Atualizando ticket ${ticket.id} para fila ${queue.id} (${queue.name}) - Status: pending, FlowWebhook: true`);

          await ticket.update({
            status: 'pending',
            queueId: queue.id,
            userId: ticket.userId,
            companyId: companyId,
            flowWebhook: true,
            lastFlowId: nodeSelected.id,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString()
          });

          logger.info(`[TICKET UPDATE] Ticket ${ticket.id} atualizado para fila ${queue.name} - LastFlowId: ${nodeSelected.id}, HashFlowId: ${hashWebhookId}`);

          await FindOrCreateATicketTrakingService({
            ticketId: ticket.id,
            companyId,
            whatsappId: ticket.whatsappId,
            userId: ticket.userId
          });

          await UpdateTicketService({
            ticketData: {
              status: "pending",
              queueId: queue.id
            },
            ticketId: ticket.id,
            companyId
          });

          logger.info(`[TICKET UPDATE] UpdateTicketService chamado para ticket ${ticket.id} - QueueId: ${queue.id}`);

          await CreateLogTicketService({
            ticketId: ticket.id,
            type: "queue",
            queueId: queue.id
          });

          logger.info(`[TICKET LOG] Log de fila criado para ticket ${ticket.id} - QueueId: ${queue.id}`);
        }

        let settings = await CompaniesSettings.findOne({
          where: {
            companyId: companyId
          }
        })

        // const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } = await ShowWhatsAppService(whatsappId, companyId);

        // if (greetingMessage.length > 1) {
        //   const body = formatBody(`${greetingMessage}`, ticket);

        //   const ticketDetails = await ShowTicketService(ticket.id, companyId);

        //   logger.info(`[TICKET UPDATE] Atualizando lastMessage do ticket ${ticket.id} com mensagem de saudação da fila`);

        //   await ticketDetails.update({
        //     lastMessage: formatBody(queue.greetingMessage, ticket.contact)
        //   });

        //   logger.info(`[TICKET UPDATE] LastMessage atualizada para ticket ${ticket.id}`);

        //   if (whatsapp.channel === "whatsapp") {
        //     await SendWhatsAppMessage({
        //       body,
        //       ticket: ticketDetails,
        //       quotedMsg: null
        //     });
        //   }

        //   if (whatsapp.channel === "whatsapp_oficial") {
        //     await SendWhatsAppOficialMessage({
        //       body: body,
        //       ticket: ticketDetails,
        //       quotedMsg: null,
        //       type: 'text',
        //       media: null,
        //       vCard: null
        //     });
        //   }

        //   SetTicketMessagesAsRead(ticketDetails);
        // }
      }

      if (nodeSelected.type === "singleBlock") {
        logger.info(`[SINGLE BLOCK] ========== PROCESSANDO NÓ SINGLEBLOCK ==========`);
        logger.info(`[SINGLE BLOCK] Node ID: ${nodeSelected.id}`);
        logger.info(`[SINGLE BLOCK] Ticket ID: ${ticket?.id}`);

        if (!(await ensureTicket())) {
          logger.warn(`[SINGLE BLOCK] ❌ Ticket não disponível, pulando bloco`);
          continue;
        }

        const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
        logger.info(`[SINGLE BLOCK] Public Folder: ${publicFolder}`);

        const sequence = nodeSelected.data.seq;
        logger.info(`[SINGLE BLOCK] Sequência de elementos: ${JSON.stringify(sequence)}`);
        logger.info(`[SINGLE BLOCK] Total de elementos: ${sequence?.length || 0}`);

        if (!sequence || sequence.length === 0) {
          logger.warn(`[SINGLE BLOCK] ⚠️ Nenhum elemento na sequência, pulando bloco`);
          continue;
        }

        for (var iLoc = 0; iLoc < sequence.length; iLoc++) {
          let elementNowSelected;
          try {
            elementNowSelected = sequence[iLoc];

            // ✅ CRÍTICO: Verificar status do ticket antes de processar cada elemento
            // Se o ticket foi aceito (status = "open"), parar imediatamente a execução
            // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
            const currentTicket = await Ticket.findByPk(ticket.id);
            if (currentTicket && currentTicket.status === "open" && !isManualTrigger) {
              logger.warn(`[SINGLE BLOCK] ⚠️ Ticket ${ticket.id} foi aceito (status=open) - PARANDO execução imediatamente`);
              logger.warn(`[SINGLE BLOCK] Elemento ${iLoc + 1}/${sequence.length} (${elementNowSelected || 'N/A'}) não será processado`);

              // Limpar estado do fluxo
              await currentTicket.update({
                flowWebhook: false,
                lastFlowId: null,
                hashFlowId: null,
                flowStopped: null,
                dataWebhook: null,
                isBot: false
              });

              // Sair do loop e continuar para o próximo nó (ou finalizar)
              break;
            }

            // ✅ Se o fluxo foi disparado manualmente e o ticket está "open", permitir execução
            if (currentTicket && currentTicket.status === "open" && isManualTrigger) {
              logger.info(`[SINGLE BLOCK] ✅ Fluxo disparado manualmente - permitindo execução mesmo com ticket em status "open"`);
            }

            logger.info(`[SINGLE BLOCK] ========== Processando elemento ${iLoc + 1}/${sequence.length}: ${elementNowSelected} ==========`);

            if (elementNowSelected.includes("message")) {
              logger.info(`[SINGLE BLOCK - MESSAGE] Processando mensagem de texto`);

              try {
                const bodyFor = nodeSelected.data.elements.filter(
                  item => item.number === elementNowSelected
                )[0].value;

                logger.info(`[SINGLE BLOCK - MESSAGE] Corpo da mensagem: ${bodyFor?.substring(0, 100)}...`);

                const ticketDetails = await ShowTicketService(ticket.id, companyId);
                logger.info(`[SINGLE BLOCK - MESSAGE] Ticket Details obtido: ${ticketDetails.id}`);

                const dataLocal = {
                  nome: createFieldJsonName,
                  numero: numberClient,
                  email: createFieldJsonEmail
                };

                const preparedBlockMessage = await prepareFlowText({
                  rawText: bodyFor || "",
                  ticketData: ticketDetails,
                  ticketId: ticket?.id || idTicket,
                  whatsappId,
                  companyId,
                  details,
                  dataWebhook,
                  dataLocal
                });

                msg = preparedBlockMessage.text;

                logger.info(`[SINGLE BLOCK - MESSAGE] Mensagem processada (${msg?.length || 0} caracteres)`);
                logger.info(`[SINGLE BLOCK - MESSAGE] Canal: ${whatsapp.channel}`);

                if (whatsapp.channel === "whatsapp") {
                  logger.info(`[SINGLE BLOCK - MESSAGE] Enviando via Baileys`);
                  await SendWhatsAppMessage({
                    body: msg,
                    ticket: ticketDetails,
                    quotedMsg: null
                  });
                  logger.info(`[SINGLE BLOCK - MESSAGE] ✅ Enviado via Baileys`);
                }

                if (whatsapp.channel === "whatsapp_oficial") {
                  logger.info(`[SINGLE BLOCK - MESSAGE] Enviando via API Oficial`);
                  await SendWhatsAppOficialMessage({
                    body: msg,
                    ticket: ticketDetails,
                    quotedMsg: null,
                    type: 'text',
                    media: null,
                    vCard: null
                  });
                  logger.info(`[SINGLE BLOCK - MESSAGE] ✅ Enviado via API Oficial`);
                }

                if (whatsapp.channel === "telegram") {
                  logger.info(`[SINGLE BLOCK - MESSAGE] Enviando via Telegram`);
                  await sendTelegramFlowText({
                    whatsapp,
                    ticket: ticketDetails,
                    body: msg
                  });
                  logger.info(`[SINGLE BLOCK - MESSAGE] ✅ Enviado via Telegram`);
                }

                SetTicketMessagesAsRead(ticketDetails);

                logger.info(`[SINGLE BLOCK - MESSAGE] Atualizando lastMessage do ticket ${ticket.id}`);

                await ticketDetails.update({
                  lastMessage: msg
                });

                logger.info(`[SINGLE BLOCK - MESSAGE] ✅ LastMessage atualizada`);

                await intervalWhats("1");
              } catch (error) {
                logger.error(`[SINGLE BLOCK - MESSAGE] ❌ Erro ao processar mensagem: ${error?.message || error}`);
                logger.error(`[SINGLE BLOCK - MESSAGE] Stack: ${error?.stack || 'N/A'}`);
                throw error; // Re-lançar para ser capturado pelo catch principal
              }
            }

            if (elementNowSelected.includes("interval")) {
              try {
                const intervalValue = nodeSelected.data.elements.filter(
                  item => item.number === elementNowSelected
                )[0].value;

                logger.info(`[SINGLE BLOCK - INTERVAL] Aguardando ${intervalValue} segundos`);

                // ✅ CRÍTICO: Durante o intervalo, verificar periodicamente se o ticket foi aceito
                const intervalSeconds = parseInt(intervalValue) || 0;
                const checkInterval = 1; // Verificar a cada 1 segundo
                let elapsed = 0;

                while (elapsed < intervalSeconds) {
                  await intervalWhats(checkInterval.toString());
                  elapsed += checkInterval;

                  // Verificar status do ticket durante o intervalo
                  // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
                  const ticketDuringInterval = await Ticket.findByPk(ticket.id);
                  if (ticketDuringInterval && ticketDuringInterval.status === "open" && !isManualTrigger) {
                    logger.warn(`[SINGLE BLOCK - INTERVAL] ⚠️ Ticket ${ticket.id} foi aceito durante intervalo - PARANDO imediatamente`);
                    throw new Error("FLOW_STOPPED_TICKET_OPEN");
                  }
                }

                logger.info(`[SINGLE BLOCK - INTERVAL] ✅ Intervalo concluído`);
              } catch (error: any) {
                // Se o erro foi por ticket aberto, propagar para parar o fluxo
                if (error?.message === "FLOW_STOPPED_TICKET_OPEN") {
                  // Limpar estado do fluxo
                  const ticketToUpdate = await Ticket.findByPk(ticket.id);
                  if (ticketToUpdate) {
                    await ticketToUpdate.update({
                      flowWebhook: false,
                      lastFlowId: null,
                      hashFlowId: null,
                      flowStopped: null,
                      dataWebhook: null,
                      isBot: false
                    });
                  }
                  // Sair do loop
                  break;
                }
                logger.error(`[SINGLE BLOCK - INTERVAL] ❌ Erro no intervalo: ${error?.message || error}`);
                throw error;
              }
            }

            if (elementNowSelected.includes("img")) {
              logger.info(`[FLOW MEDIA - IMG] ========== PROCESSANDO ENVIO DE IMAGEM ==========`);

              const currentElement = nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0];
              const filePath = path.join(publicFolder, `company${companyId}/flow`, currentElement.value);
              const captionRaw = currentElement.caption || "";

              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              const preparedCaption = await prepareFlowText({
                rawText: captionRaw,
                ticketData: ticket,
                ticketId: ticket?.id || idTicket,
                whatsappId,
                companyId,
                details,
                dataWebhook,
                dataLocal
              });

              const caption = captionRaw ? preparedCaption.text : "";

              logger.info(`[FLOW MEDIA - IMG] FilePath: ${filePath}`);
              logger.info(`[FLOW MEDIA - IMG] Caption: ${caption}`);
              logger.info(`[FLOW MEDIA - IMG] Company ID: ${companyId}`);
              logger.info(`[FLOW MEDIA - IMG] WhatsApp Channel: ${whatsapp.channel}`);

              const ticketInt = await ShowTicketService(ticket.id, companyId);
              logger.info(`[FLOW MEDIA - IMG] Ticket ID: ${ticketInt?.id}`);

              if (whatsapp.channel === "whatsapp") {
                logger.info(`[FLOW MEDIA - IMG] Enviando via Baileys (WhatsApp Web)`);
                await SendWhatsAppMediaFlow({
                  media: filePath,
                  ticket: ticketInt,
                  whatsappId: whatsapp.id,
                  body: caption,
                  isRecord: currentElement.record
                });
                logger.info(`[FLOW MEDIA - IMG] ✅ Imagem enviada com sucesso via Baileys`);
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                logger.info(`[FLOW MEDIA - IMG] Enviando via API Oficial`);

                const fileName = obterNomeEExtensaoDoArquivo(filePath);
                logger.info(`[FLOW MEDIA - IMG] FileName: ${fileName}`);

                // Determinar mimetype pela extensão
                const lower = (fileName || "").toLowerCase();
                let mime = "image/jpeg";
                if (lower.endsWith(".png")) mime = "image/png";
                else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
                else if (lower.endsWith(".gif")) mime = "image/gif";
                else if (lower.endsWith(".webp")) mime = "image/webp";

                logger.info(`[FLOW MEDIA - IMG] MimeType detectado: ${mime}`);

                // Verificar se arquivo existe antes de enviar
                try {
                  const fs = await import("fs");
                  if (!fs.existsSync(filePath)) {
                    logger.error(`[FLOW MEDIA - IMG] ❌ Arquivo de imagem não encontrado: ${filePath}`);
                  } else {
                    logger.info(`[FLOW MEDIA - IMG] ✅ Arquivo existe, preparando envio...`);

                    const mediaSrc = {
                      fieldname: 'medias',
                      originalname: fileName,
                      encoding: '7bit',
                      mimetype: mime,
                      filename: fileName,
                      path: filePath
                    } as Express.Multer.File

                    logger.info(`[FLOW MEDIA - IMG] MediaSrc: ${JSON.stringify(mediaSrc)}`);

                    await SendWhatsAppOficialMessage({
                      body: caption,
                      ticket: ticketInt,
                      quotedMsg: null,
                      type: 'image',
                      media: mediaSrc,
                      vCard: null
                    });

                    logger.info(`[FLOW MEDIA - IMG] ✅ Imagem enviada com sucesso via API Oficial`);
                  }
                } catch (e) {
                  logger.error(`[FLOW MEDIA - IMG] ❌ Erro ao validar/enviar imagem ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - IMG] Stack: ${e?.stack || 'N/A'}`);
                }
              }

              
              if (whatsapp.channel === "telegram") {
                logger.info(`[FLOW MEDIA - IMG] Enviando via Telegram`);

                try {
                  await sendTelegramFlowMedia({
                    whatsapp,
                    ticket: ticketInt,
                    filePath,
                    body: caption,
                    fallbackMime: "image/jpeg"
                  });

                  logger.info(`[FLOW MEDIA - IMG] ✅ Mídia enviada com sucesso via Telegram`);
                } catch (e) {
                  logger.error(`[FLOW MEDIA - IMG] ❌ Erro ao enviar mídia Telegram ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - IMG] Stack: ${e?.stack || 'N/A'}`);
                }
              }

await intervalWhats("1");
            }

            if (elementNowSelected.includes("audio")) {
              logger.info(`[FLOW MEDIA - AUDIO] ========== PROCESSANDO ENVIO DE ÁUDIO ==========`);

              const currentElement = nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0];
              const filePath = path.join(publicFolder, `company${companyId}/flow`, currentElement.value);
              const captionRaw = currentElement.caption || "";

              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              const preparedCaption = await prepareFlowText({
                rawText: captionRaw,
                ticketData: ticket,
                ticketId: ticket?.id || idTicket,
                whatsappId,
                companyId,
                details,
                dataWebhook,
                dataLocal
              });

              const caption = captionRaw ? preparedCaption.text : "";

              logger.info(`[FLOW MEDIA - AUDIO] FilePath: ${filePath}`);
              logger.info(`[FLOW MEDIA - AUDIO] Caption: ${caption}`);
              logger.info(`[FLOW MEDIA - AUDIO] Company ID: ${companyId}`);
              logger.info(`[FLOW MEDIA - AUDIO] WhatsApp Channel: ${whatsapp.channel}`);

              const ticketInt = await ShowTicketService(ticket.id, companyId);
              logger.info(`[FLOW MEDIA - AUDIO] Ticket ID: ${ticketInt?.id}`);

              if (whatsapp.channel === "whatsapp") {
                logger.info(`[FLOW MEDIA - AUDIO] Enviando via Baileys (WhatsApp Web)`);
                await SendWhatsAppMediaFlow({
                  media: filePath,
                  ticket: ticketInt,
                  whatsappId: whatsapp.id,
                  body: caption,
                  isRecord: currentElement.record
                });
                logger.info(`[FLOW MEDIA - AUDIO] ✅ Áudio enviado com sucesso via Baileys`);
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                logger.info(`[FLOW MEDIA - AUDIO] Enviando via API Oficial`);

                const fileName = obterNomeEExtensaoDoArquivo(filePath);
                logger.info(`[FLOW MEDIA - AUDIO] FileName: ${fileName}`);

                try {
                  const fs = await import("fs");
                  if (!fs.existsSync(filePath)) {
                    logger.error(`[FLOW MEDIA - AUDIO] ❌ Arquivo de áudio não encontrado: ${filePath}`);
                  } else {
                    logger.info(`[FLOW MEDIA - AUDIO] ✅ Arquivo existe, preparando envio...`);

                    const mediaSrc = {
                      fieldname: 'medias',
                      originalname: fileName,
                      encoding: '7bit',
                      mimetype: 'audio/mpeg',
                      filename: fileName,
                      path: filePath
                    } as Express.Multer.File

                    logger.info(`[FLOW MEDIA - AUDIO] MediaSrc: ${JSON.stringify(mediaSrc)}`);

                    await SendWhatsAppOficialMessage({
                      body: caption,
                      ticket: ticketInt,
                      quotedMsg: null,
                      vCard: null,
                      type: 'audio',
                      media: mediaSrc
                    });

                    logger.info(`[FLOW MEDIA - AUDIO] ✅ Áudio enviado com sucesso via API Oficial`);
                  }
                } catch (e) {
                  logger.error(`[FLOW MEDIA - AUDIO] ❌ Erro ao validar/enviar áudio ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - AUDIO] Stack: ${e?.stack || 'N/A'}`);
                }
              }

              
              if (whatsapp.channel === "telegram") {
                logger.info(`[FLOW MEDIA - AUDIO] Enviando via Telegram`);

                try {
                  await sendTelegramFlowMedia({
                    whatsapp,
                    ticket: ticketInt,
                    filePath,
                    body: caption,
                    fallbackMime: "audio/mpeg"
                  });

                  logger.info(`[FLOW MEDIA - AUDIO] ✅ Mídia enviada com sucesso via Telegram`);
                } catch (e) {
                  logger.error(`[FLOW MEDIA - AUDIO] ❌ Erro ao enviar mídia Telegram ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - AUDIO] Stack: ${e?.stack || 'N/A'}`);
                }
              }

await intervalWhats("1");
            }

            if (elementNowSelected.includes("video")) {
              logger.info(`[FLOW MEDIA - VIDEO] ========== PROCESSANDO ENVIO DE VÍDEO ==========`);

              const currentElement = nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0];
              const filePath = path.join(publicFolder, `company${companyId}/flow`, currentElement.value);
              const captionRaw = currentElement.caption || "";

              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              const preparedCaption = await prepareFlowText({
                rawText: captionRaw,
                ticketData: ticket,
                ticketId: ticket?.id || idTicket,
                whatsappId,
                companyId,
                details,
                dataWebhook,
                dataLocal
              });

              const caption = captionRaw ? preparedCaption.text : "";

              logger.info(`[FLOW MEDIA - VIDEO] FilePath: ${filePath}`);
              logger.info(`[FLOW MEDIA - VIDEO] Caption: ${caption}`);
              logger.info(`[FLOW MEDIA - VIDEO] Company ID: ${companyId}`);
              logger.info(`[FLOW MEDIA - VIDEO] WhatsApp Channel: ${whatsapp.channel}`);

              const ticketInt = await ShowTicketService(ticket.id, companyId);
              logger.info(`[FLOW MEDIA - VIDEO] Ticket ID: ${ticketInt?.id}`);

              if (whatsapp.channel === "whatsapp") {
                logger.info(`[FLOW MEDIA - VIDEO] Enviando via Baileys (WhatsApp Web)`);
                await SendWhatsAppMediaFlow({
                  media: filePath,
                  ticket: ticketInt,
                  whatsappId: whatsapp.id,
                  body: caption,
                });
                logger.info(`[FLOW MEDIA - VIDEO] ✅ Vídeo enviado com sucesso via Baileys`);
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                logger.info(`[FLOW MEDIA - VIDEO] Enviando via API Oficial`);

                const fileName = obterNomeEExtensaoDoArquivo(filePath);
                logger.info(`[FLOW MEDIA - VIDEO] FileName: ${fileName}`);

                try {
                  const fs = await import("fs");
                  if (!fs.existsSync(filePath)) {
                    logger.error(`[FLOW MEDIA - VIDEO] ❌ Arquivo de vídeo não encontrado: ${filePath}`);
                  } else {
                    logger.info(`[FLOW MEDIA - VIDEO] ✅ Arquivo existe, preparando envio...`);

                    const mediaSrc = {
                      fieldname: 'medias',
                      originalname: fileName,
                      encoding: '7bit',
                      mimetype: 'video/mp4',
                      filename: fileName,
                      path: filePath
                    } as Express.Multer.File

                    logger.info(`[FLOW MEDIA - VIDEO] MediaSrc: ${JSON.stringify(mediaSrc)}`);

                    await SendWhatsAppOficialMessage({
                      body: caption,
                      ticket: ticketInt,
                      quotedMsg: null,
                      vCard: null,
                      type: 'video',
                      media: mediaSrc
                    });

                    logger.info(`[FLOW MEDIA - VIDEO] ✅ Vídeo enviado com sucesso via API Oficial`);
                  }
                } catch (e) {
                  logger.error(`[FLOW MEDIA - VIDEO] ❌ Erro ao validar/enviar vídeo ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - VIDEO] Stack: ${e?.stack || 'N/A'}`);
                }
              }

              
              if (whatsapp.channel === "telegram") {
                logger.info(`[FLOW MEDIA - VIDEO] Enviando via Telegram`);

                try {
                  await sendTelegramFlowMedia({
                    whatsapp,
                    ticket: ticketInt,
                    filePath,
                    body: caption,
                    fallbackMime: "video/mp4"
                  });

                  logger.info(`[FLOW MEDIA - VIDEO] ✅ Mídia enviada com sucesso via Telegram`);
                } catch (e) {
                  logger.error(`[FLOW MEDIA - VIDEO] ❌ Erro ao enviar mídia Telegram ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - VIDEO] Stack: ${e?.stack || 'N/A'}`);
                }
              }

await intervalWhats("1");
            }

            if (elementNowSelected.includes("document")) {
              logger.info(`[FLOW MEDIA - DOCUMENT] ========== PROCESSANDO ENVIO DE DOCUMENTO ==========`);

              const filePath = path.join(publicFolder, `company${companyId}/flow`, nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0].value);

              const captionRaw = nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0].caption || "";

              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              const preparedCaption = await prepareFlowText({
                rawText: captionRaw,
                ticketData: ticket,
                ticketId: ticket?.id || idTicket,
                whatsappId,
                companyId,
                details,
                dataWebhook,
                dataLocal
              });

              const caption = captionRaw ? preparedCaption.text : "";

              logger.info(`[FLOW MEDIA - DOCUMENT] FilePath: ${filePath}`);
              logger.info(`[FLOW MEDIA - DOCUMENT] Caption: ${caption}`);
              logger.info(`[FLOW MEDIA - DOCUMENT] Company ID: ${companyId}`);
              logger.info(`[FLOW MEDIA - DOCUMENT] WhatsApp Channel: ${whatsapp.channel}`);

              const ticketInt = await ShowTicketService(ticket.id, companyId);
              logger.info(`[FLOW MEDIA - DOCUMENT] Ticket ID: ${ticketInt?.id}`);

              if (whatsapp.channel === "whatsapp") {
                logger.info(`[FLOW MEDIA - DOCUMENT] Enviando via Baileys (WhatsApp Web)`);
                await SendWhatsAppMediaFlow({
                  media: filePath,
                  ticket: ticketInt,
                  whatsappId: whatsapp.id,
                  body: caption
                });
                logger.info(`[FLOW MEDIA - DOCUMENT] ✅ Documento enviado com sucesso via Baileys`);
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                logger.info(`[FLOW MEDIA - DOCUMENT] Enviando via API Oficial`);

                const fileName = obterNomeEExtensaoDoArquivo(filePath);
                logger.info(`[FLOW MEDIA - DOCUMENT] FileName: ${fileName}`);

                try {
                  const fs = await import("fs");
                  if (!fs.existsSync(filePath)) {
                    logger.error(`[FLOW MEDIA - DOCUMENT] ❌ Arquivo de documento não encontrado: ${filePath}`);
                  } else {
                    logger.info(`[FLOW MEDIA - DOCUMENT] ✅ Arquivo existe, preparando envio...`);

                    const mediaSrc = {
                      fieldname: 'medias',
                      originalname: fileName,
                      encoding: '7bit',
                      mimetype: 'application/pdf',
                      filename: fileName,
                      path: filePath
                    } as Express.Multer.File

                    logger.info(`[FLOW MEDIA - DOCUMENT] MediaSrc: ${JSON.stringify(mediaSrc)}`);

                    await SendWhatsAppOficialMessage({
                      body: caption,
                      ticket: ticketInt,
                      quotedMsg: null,
                      vCard: null,
                      type: 'document',
                      media: mediaSrc
                    });

                    logger.info(`[FLOW MEDIA - DOCUMENT] ✅ Documento enviado com sucesso via API Oficial`);
                  }
                } catch (e) {
                  logger.error(`[FLOW MEDIA - DOCUMENT] ❌ Erro ao validar/enviar documento ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - DOCUMENT] Stack: ${e?.stack || 'N/A'}`);
                }
              }

              
              if (whatsapp.channel === "telegram") {
                logger.info(`[FLOW MEDIA - DOCUMENT] Enviando via Telegram`);

                try {
                  await sendTelegramFlowMedia({
                    whatsapp,
                    ticket: ticketInt,
                    filePath,
                    body: caption,
                    fallbackMime: "application/pdf"
                  });

                  logger.info(`[FLOW MEDIA - DOCUMENT] ✅ Mídia enviada com sucesso via Telegram`);
                } catch (e) {
                  logger.error(`[FLOW MEDIA - DOCUMENT] ❌ Erro ao enviar mídia Telegram ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - DOCUMENT] Stack: ${e?.stack || 'N/A'}`);
                }
              }

await intervalWhats("1");
            }

            if (elementNowSelected.includes("application")) {
              logger.info(`[FLOW MEDIA - APPLICATION] ========== PROCESSANDO ENVIO DE APLICAÇÃO/PDF ==========`);

              const filePath = path.join(publicFolder, `company${companyId}/flow`, nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0].value);

              const captionRaw = nodeSelected.data.elements.filter(item => item.number === elementNowSelected)[0].caption || "";

              const dataLocal = {
                nome: createFieldJsonName,
                numero: numberClient,
                email: createFieldJsonEmail
              };

              const preparedCaption = await prepareFlowText({
                rawText: captionRaw,
                ticketData: ticket,
                ticketId: ticket?.id || idTicket,
                whatsappId,
                companyId,
                details,
                dataWebhook,
                dataLocal
              });

              const caption = captionRaw ? preparedCaption.text : "";

              logger.info(`[FLOW MEDIA - APPLICATION] FilePath: ${filePath}`);
              logger.info(`[FLOW MEDIA - APPLICATION] Caption: ${caption}`);
              logger.info(`[FLOW MEDIA - APPLICATION] Company ID: ${companyId}`);
              logger.info(`[FLOW MEDIA - APPLICATION] WhatsApp Channel: ${whatsapp.channel}`);

              const ticketInt = await ShowTicketService(ticket.id, companyId);
              logger.info(`[FLOW MEDIA - APPLICATION] Ticket ID: ${ticketInt?.id}`);

              if (whatsapp.channel === "whatsapp") {
                logger.info(`[FLOW MEDIA - APPLICATION] Enviando via Baileys (WhatsApp Web)`);
                await SendWhatsAppMediaFlow({
                  media: filePath,
                  ticket: ticketInt,
                  whatsappId: whatsapp.id,
                  body: caption
                });
                logger.info(`[FLOW MEDIA - APPLICATION] ✅ Application enviado com sucesso via Baileys`);
              }

              if (whatsapp.channel === "whatsapp_oficial") {
                logger.info(`[FLOW MEDIA - APPLICATION] Enviando via API Oficial`);

                const fileName = obterNomeEExtensaoDoArquivo(filePath);
                logger.info(`[FLOW MEDIA - APPLICATION] FileName: ${fileName}`);

                try {
                  const fs = await import("fs");
                  if (!fs.existsSync(filePath)) {
                    logger.error(`[FLOW MEDIA - APPLICATION] ❌ Arquivo não encontrado: ${filePath}`);
                  } else {
                    logger.info(`[FLOW MEDIA - APPLICATION] ✅ Arquivo existe, preparando envio...`);

                    const mediaSrc = {
                      fieldname: 'medias',
                      originalname: fileName,
                      encoding: '7bit',
                      mimetype: 'application/pdf',
                      filename: fileName,
                      path: filePath
                    } as Express.Multer.File

                    logger.info(`[FLOW MEDIA - APPLICATION] MediaSrc: ${JSON.stringify(mediaSrc)}`);

                    await SendWhatsAppOficialMessage({
                      body: caption,
                      ticket: ticketInt,
                      quotedMsg: null,
                      vCard: null,
                      type: 'document',
                      media: mediaSrc
                    });

                    logger.info(`[FLOW MEDIA - APPLICATION] ✅ Application enviado com sucesso via API Oficial`);
                  }
                } catch (e) {
                  logger.error(`[FLOW MEDIA - APPLICATION] ❌ Erro ao validar/enviar application ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - APPLICATION] Stack: ${e?.stack || 'N/A'}`);
                }
              }

              
              if (whatsapp.channel === "telegram") {
                logger.info(`[FLOW MEDIA - APPLICATION] Enviando via Telegram`);

                try {
                  await sendTelegramFlowMedia({
                    whatsapp,
                    ticket: ticketInt,
                    filePath,
                    body: caption,
                    fallbackMime: "application/pdf"
                  });

                  logger.info(`[FLOW MEDIA - APPLICATION] ✅ Mídia enviada com sucesso via Telegram`);
                } catch (e) {
                  logger.error(`[FLOW MEDIA - APPLICATION] ❌ Erro ao enviar mídia Telegram ${filePath}: ${e?.message || e}`);
                  logger.error(`[FLOW MEDIA - APPLICATION] Stack: ${e?.stack || 'N/A'}`);
                }
              }

await intervalWhats("1");
            }
          } catch (elementError) {
            logger.error(`[SINGLE BLOCK] ❌ Erro ao processar elemento ${iLoc + 1}: ${elementNowSelected}`);
            logger.error(`[SINGLE BLOCK] Erro: ${elementError?.message || elementError}`);
            logger.error(`[SINGLE BLOCK] Stack: ${elementError?.stack || 'N/A'}`);
            // Re-lançar para ser capturado pelo catch principal
            throw elementError;
          }
        }

        logger.info(`[SINGLE BLOCK] ✅ SingleBlock processado com sucesso - ${sequence.length} elementos`);
      }

      let isRandomizer: boolean;
      if (nodeSelected.type === "randomizer") {
        const selectedRandom = randomizarCaminho(nodeSelected.data.percent / 100);

        const resultConnect = connects.filter(
          connect => connect.source === nodeSelected.id
        );
        if (selectedRandom === "A") {
          next = resultConnect.filter(item => item.sourceHandle === "a")[0]
            .target;
          noAlterNext = true;
        } else {
          next = resultConnect.filter(item => item.sourceHandle === "b")[0]
            .target;
          noAlterNext = true;
        }
        isRandomizer = true;
      }

      // ✅ NÓ CONDITIONCOMPARE — Se/Senão com suporte a múltiplas condições (AND/OR)
      let isConditionCompare: boolean = false;
      if (nodeSelected.type === "conditionCompare") {
        logger.info(`[CONDITION COMPARE] ========== PROCESSANDO NÓ SE/SENÃO ==========`);
        logger.info(`[CONDITION COMPARE] ID do nó: ${nodeSelected.id}`);

        const nodeData = nodeSelected.data || {};
        const logicOperator: "AND" | "OR" = nodeData.logicOperator || "AND";

        // Suporte a múltiplas condições (novo formato) e condição única (legado)
        let conditions: Array<{ leftValue: string; operator: string; rightValue: string }>;

        if (nodeData.conditions && Array.isArray(nodeData.conditions) && nodeData.conditions.length > 0) {
          conditions = nodeData.conditions;
        } else {
          // Formato legado (única condição)
          conditions = [{
            leftValue: nodeData.leftValue || "",
            operator: nodeData.operator || "equals",
            rightValue: nodeData.rightValue || "",
          }];
        }

        logger.info(`[CONDITION COMPARE] Lógica: ${logicOperator}, Condições: ${conditions.length}`);

        // Avaliar cada condição
        const results = conditions.map((cond, idx) => {
          const resolvedLeft = processVariableValue(cond.leftValue, dataWebhook, idTicket);
          const resolvedRight = processVariableValue(cond.rightValue, dataWebhook, idTicket);
          const result = compareValues(resolvedLeft, resolvedRight, cond.operator);
          logger.info(`[CONDITION COMPARE] Condição ${idx + 1}: "${resolvedLeft}" ${cond.operator} "${resolvedRight}" => ${result}`);
          return result;
        });

        // Aplicar operador lógico
        let conditionResult: boolean;
        if (logicOperator === "OR") {
          conditionResult = results.some(r => r === true);
        } else {
          // AND (padrão)
          conditionResult = results.every(r => r === true);
        }

        logger.info(`[CONDITION COMPARE] Resultado final (${logicOperator}): ${conditionResult}`);

        // Selecionar saída: "true" ou "false"
        const resultConnects = connects.filter(c => c.source === nodeSelected.id);
        const trueConnect = resultConnects.find(c => c.sourceHandle === "true");
        const falseConnect = resultConnects.find(c => c.sourceHandle === "false");

        if (conditionResult && trueConnect) {
          next = trueConnect.target;
          logger.info(`[CONDITION COMPARE] ✅ Verdadeiro → próximo nó: ${next}`);
        } else if (!conditionResult && falseConnect) {
          next = falseConnect.target;
          logger.info(`[CONDITION COMPARE] ❌ Falso → próximo nó: ${next}`);
        } else {
          logger.warn(`[CONDITION COMPARE] Nenhuma conexão encontrada para resultado ${conditionResult}`);
          next = "";
        }

        noAlterNext = true;
        isConditionCompare = true;
      }

      // ========== NÓ INTERATIVO (Botões/Lista nativos) ==========
      if (nodeSelected.type === "interactiveMenu") {
        logger.info(`[INTERACTIVE MENU] ========== PROCESSANDO NÓ INTERATIVO ==========`);
        logger.info(`[INTERACTIVE MENU] ID: ${nodeSelected.id}, Tipo: ${nodeSelected.data.interactiveType}`);

        if (pressKey) {
          // Usuário respondeu ao menu interativo
          const rawPressKey = pressKey;
          pressKey = pressKey.trim().replace(/[\r\n\u200e\u200f\u200b]/g, "");
          const groupQuoteMatch = pressKey.match(/^\*[^*]+:\*\s*/);
          if (groupQuoteMatch) {
            pressKey = pressKey.slice(groupQuoteMatch[0].length).trim();
          }

          logger.info(`[INTERACTIVE MENU] Resposta: "${rawPressKey}" → "${pressKey}"`);

          const sanitize = (s: string) =>
            (s || "")
              .toString()
              .trim()
              .replace(/[\r\u200e\u200f\u200b]/g, "")
              .toLowerCase();

          let matchedOption = null;

          // Alguns clientes enviam resposta com quote + texto do botão em outra linha.
          // Vamos testar múltiplos candidatos e priorizar a última linha não vazia.
          const candidates = Array.from(
            new Set([
              pressKey,
              ...pressKey
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              pressKey
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(-1)[0] || "",
            ].filter(Boolean))
          );

          // 1) match por número/ID
          for (const candidate of candidates) {
            const numericMatch = candidate.match(/(\d+)/);
            if (numericMatch) {
              matchedOption = nodeSelected.data.arrayOption?.find(
                o => String(o.number) === String(numericMatch[1])
              );
              if (matchedOption) break;
            }
          }

          // 2) match por texto (exato ou contido)
          if (!matchedOption) {
            for (const candidate of candidates) {
              const pk = sanitize(candidate);
              matchedOption = nodeSelected.data.arrayOption?.find(o => {
                const ov = sanitize(o.value);
                const on = sanitize(String(o.number));
                return pk === ov || pk === on || pk.endsWith(ov) || pk.includes(ov);
              });
              if (matchedOption) break;
            }
          }

          if (matchedOption) {
            // Alguns fluxos usam source = next, outros source = nodeSelected.id
            const filterOne = connectStatic.filter(
              c => c.source === next || c.source === nodeSelected.id
            );

            const normalizedValue = sanitize(matchedOption.value || "");
            const candidateHandles = new Set([
              `a${matchedOption.number}`,
              `${matchedOption.number}`,
              `option-${matchedOption.number}`,
              normalizedValue,
              `a${normalizedValue}`,
            ]);

            const filterTwo = filterOne.filter(c =>
              c.sourceHandle && candidateHandles.has(sanitize(c.sourceHandle))
            );

            logger.info(
              `[INTERACTIVE MENU] Handles disponíveis: ${JSON.stringify(
                filterOne.map(c => c.sourceHandle)
              )}`
            );
            logger.info(
              `[INTERACTIVE MENU] Handles candidatos para opção ${matchedOption.number}: ${JSON.stringify(
                Array.from(candidateHandles)
              )}`
            );

            if (filterTwo.length > 0) {
              execFn = filterTwo[0].target;
              next = execFn; // ✅ CRÍTICO: avançar para o nó final da opção

              global.flowVariables = global.flowVariables || {};
              global.flowVariables["menuOption"] = String(matchedOption.number);
              if (idTicket) {
                global.flowVariables[`${idTicket}_menuOption`] = String(matchedOption.number);
                global.flowVariables[`${idTicket}_returnMenuNodeId`] = nodeSelected.id;
                global.flowVariables[`${idTicket}_returnMenuEnabled`] = true;
                global.flowVariables[`${idTicket}_currentMenuNodeId`] = nodeSelected.id;
                if (!global.flowVariables[`${idTicket}_rootMenuNodeId`]) {
                  global.flowVariables[`${idTicket}_rootMenuNodeId`] = nodeSelected.id;
                }
              }

              logger.info(`[INTERACTIVE MENU] ✅ Opção ${matchedOption.number} → próximo: ${execFn}`);
            } else {
              logger.warn(
                `[INTERACTIVE MENU] ❌ Nenhuma conexão encontrada para opção ${matchedOption.number} (${matchedOption.value})`
              );
            }
          }

          if (!matchedOption || !execFn) {
            // Entrada comum que não corresponde a uma opção: aguardar sem reenviar o bloco.
            logger.warn(`[INTERACTIVE MENU] ❌ Opção inválida: "${pressKey}"`);
            await ticket.update({
              flowWebhook: true,
              flowStopped: idFlowDb.toString(),
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId || ticket.hashFlowId || randomString(32)
            });
            logger.info(
              `[INTERACTIVE MENU] Entrada ignorada; mantendo o nó ${nodeSelected.id} aguardando uma seleção válida`
            );
            return "waiting_input";

            if (!(await ensureTicket())) continue;
            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            const dataLocal = {
              nome: createFieldJsonName,
              numero: numberClient,
              email: createFieldJsonEmail
            };

            const preparedBody = await prepareFlowText({
              rawText: nodeSelected.data.message || "",
              ticketData: ticketDetails || ticket,
              ticketId: ticket?.id || idTicket,
              whatsappId,
              companyId,
              details,
              dataWebhook,
              dataLocal
            });

            const preparedFooter = await prepareFlowText({
              rawText: nodeSelected.data.footer || "",
              ticketData: preparedBody.ticketData || ticketDetails || ticket,
              ticketId: ticket?.id || idTicket,
              whatsappId,
              companyId,
              details,
              dataWebhook,
              dataLocal
            });

            const bodyMsg = preparedBody.text;
            const footerMsg = preparedFooter.text;
            let sentInteractiveMsg: any = null;
            if (whatsapp.channel === "whatsapp") {
              const wbot = getWbot(whatsapp.id);
              const contact = await Contact.findOne({ where: { id: ticket.contactId } });
              if (!contact) {
                logger.error(`[ActionsWebhook] Contato ${ticket.contactId} não encontrado para ticket ${ticket.id}`);
                break;
              }
              const jid = getJidOf(ticketDetails || ticket);

              if (nodeSelected.data.interactiveType === "button") {
                const { sendInteractiveButtons } = await import("../../helpers/SendInteractiveMsg");
                sentInteractiveMsg = await sendInteractiveButtons({
                  wbot,
                  jid,
                  bodyText: bodyMsg,
                  footerText: footerMsg || undefined,
                  buttons: nodeSelected.data.arrayOption.map((opt) => ({
                    displayText: opt.value,
                    id: `${opt.number}`,
                    type: opt.type || "quick_reply",
                    url: opt.url,
                    copyCode: opt.copyCode,
                    phoneNumber: opt.phoneNumber,
                  })),
                  headerImageFullPath: nodeSelected.data.headerImage ? path.join(publicFolder, nodeSelected.data.headerImage) : undefined,
                });
              } else {
                const { sendInteractiveList } = await import("../../helpers/SendInteractiveMsg");
                const listBodyText = bodyMsg || "Selecione uma opção:";
                logger.info(`[INTERACTIVE MENU] Reenviando LISTA para ${jid} (opção inválida)`);
                try {
                  sentInteractiveMsg = await sendInteractiveList({
                    wbot,
                    jid,
                    bodyText: listBodyText,
                    footerText: footerMsg || undefined,
                    buttonText: nodeSelected.data.listButtonText || "Selecionar",
                    sections: [{
                      title: "Opções",
                      rows: nodeSelected.data.arrayOption.slice(0, 10).map((opt) => ({
                        title: opt.value || `Opção ${opt.number}`,
                        description: opt.description || "",
                        id: `${opt.number}`
                      }))
                    }],
                    headerImageFullPath: nodeSelected.data.headerImage ? path.join(publicFolder, nodeSelected.data.headerImage) : undefined,
                  });
                } catch (btnErr: any) {
                  logger.error(`[INTERACTIVE MENU] ❌ Erro ao reenviar botões: ${btnErr?.message}`);
                  let fallbackText = listBodyText + "\n\n";
                  nodeSelected.data.arrayOption.forEach(opt => {
                    fallbackText += `[${opt.number}] ${opt.value}\n`;
                  });
                  await wbot.sendMessage(jid, { text: fallbackText });
                }
              }
            } else if (whatsapp.channel === "whatsapp_oficial") {
              if (nodeSelected.data.interactiveType === "button") {
                const interative = {
                  type: 'button' as const,
                  body: { text: bodyMsg },
                  footer: footerMsg ? { text: footerMsg } : undefined,
                  action: {
                    buttons: nodeSelected.data.arrayOption.map(opt => ({
                      type: 'reply' as const,
                      reply: { id: `${opt.number}`, title: opt.value }
                    }))
                  }
                };
                await SendWhatsAppOficialMessage({
                  body: bodyMsg, ticket: ticketDetails, type: 'interactive',
                  media: null, vCard: null, interative: interative as any
                });
              } else {
                const interative = {
                  type: 'list' as const,
                  body: { text: bodyMsg },
                  footer: footerMsg ? { text: footerMsg } : undefined,
                  action: {
                    button: nodeSelected.data.listButtonText || "Selecionar",
                    sections: [{
                      title: "Opções", rows: nodeSelected.data.arrayOption.map(opt => ({
                        id: `${opt.number}`, title: opt.value
                      }))
                    }]
                  }
                };
                await SendWhatsAppOficialMessage({
                  body: bodyMsg, ticket: ticketDetails, type: 'interactive',
                  media: null, vCard: null, interative: interative as any
                });
              }
            }

            await ticket.update({
              flowWebhook: true,
              flowStopped: idFlowDb.toString(),
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
            });
            return "waiting_input";
          }

          // ✅ CORRIGIDO: avançar fluxo imediatamente após seleção válida
          pressKey = undefined;

          // Verificar se o próximo nó também é menu/interactiveMenu
          const isNodeExist = nodes.filter(item => item.id === execFn);
          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" || isNodeExist[0].type === "interactiveMenu";
            logger.info(`[INTERACTIVE MENU] Próximo nó ${execFn} é do tipo ${isNodeExist[0].type}, isMenu=${isMenu}`);
          } else {
            isMenu = false;
            logger.warn(`[INTERACTIVE MENU] Próximo nó ${execFn} NÃO encontrado nos nodes!`);
          }

          noAlterNext = true;
          logger.info(`[INTERACTIVE MENU] ✅ Avançando para próximo nó: next=${next}, execFn=${execFn}, noAlterNext=${noAlterNext}, isMenu=${isMenu}`);
        } else {
          // Primeiro acesso — enviar mensagem interativa
          if (!(await ensureTicket())) continue;
          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const dataLocal = {
            nome: createFieldJsonName,
            numero: numberClient,
            email: createFieldJsonEmail
          };

          const preparedBody = await prepareFlowText({
            rawText: nodeSelected.data.message || "",
            ticketData: ticketDetails || ticket,
            ticketId: ticket?.id || idTicket,
            whatsappId,
            companyId,
            details,
            dataWebhook,
            dataLocal
          });

          const preparedFooter = await prepareFlowText({
            rawText: nodeSelected.data.footer || "",
            ticketData: preparedBody.ticketData || ticketDetails || ticket,
            ticketId: ticket?.id || idTicket,
            whatsappId,
            companyId,
            details,
            dataWebhook,
            dataLocal
          });

          const bodyMsg = preparedBody.text;
          const footerMsg = preparedFooter.text;
          let sentInteractiveMsg: any = null;

          if (whatsapp.channel === "whatsapp") {
            const wbot = getWbot(whatsapp.id);
            const contact = await Contact.findOne({ where: { id: ticket.contactId } });
            if (!contact) {
              logger.error(`[ActionsWebhook] Contato ${ticket.contactId} não encontrado para ticket ${ticket.id}`);
              break;
            }
            const jid = getJidOf(ticketDetails || ticket);

            if (nodeSelected.data.interactiveType === "button") {
              const { sendInteractiveButtons } = await import("../../helpers/SendInteractiveMsg");
              await sendInteractiveButtons({
                wbot,
                jid,
                bodyText: bodyMsg,
                footerText: footerMsg || undefined,
                buttons: nodeSelected.data.arrayOption.map((opt) => ({
                  displayText: opt.value,
                  id: `${opt.number}`,
                  type: opt.type || "quick_reply",
                  url: opt.url,
                  copyCode: opt.copyCode,
                  phoneNumber: opt.phoneNumber,
                })),
                headerImageFullPath: nodeSelected.data.headerImage ? path.join(publicFolder, nodeSelected.data.headerImage) : undefined,
              });
            } else {
              const { sendInteractiveList } = await import("../../helpers/SendInteractiveMsg");
              const listBodyText = bodyMsg || "Selecione uma opção:";
              logger.info(`[INTERACTIVE MENU] Enviando LISTA para ${jid} - Opções: ${nodeSelected.data.arrayOption?.length || 0}`);
              try {
                sentInteractiveMsg = await sendInteractiveList({
                  wbot,
                  jid,
                  bodyText: listBodyText,
                  footerText: footerMsg || undefined,
                  buttonText: nodeSelected.data.listButtonText || "Selecionar",
                  sections: [{
                    title: "Opções",
                    rows: nodeSelected.data.arrayOption.slice(0, 10).map((opt) => ({
                      title: opt.value || `Opção ${opt.number}`,
                      description: opt.description || "",
                      id: `${opt.number}`
                    }))
                  }],
                  headerImageFullPath: nodeSelected.data.headerImage ? path.join(publicFolder, nodeSelected.data.headerImage) : undefined,
                });
                logger.info(`[INTERACTIVE MENU] ✅ Lista enviada com sucesso para ${jid}`);
              } catch (btnErr: any) {
                logger.error(`[INTERACTIVE MENU] ❌ Erro ao enviar botões para ${jid}: ${btnErr?.message}`);
                let fallbackText = listBodyText + "\n\n";
                nodeSelected.data.arrayOption.forEach(opt => {
                  fallbackText += `[${opt.number}] ${opt.value}\n`;
                });
                await wbot.sendMessage(jid, { text: fallbackText });
                logger.info(`[INTERACTIVE MENU] ⚠️ Enviado como texto fallback para ${jid}`);
              }
            }
          } else if (whatsapp.channel === "whatsapp_oficial") {
            if (nodeSelected.data.interactiveType === "button") {
              const interative = {
                type: 'button' as const,
                body: { text: bodyMsg },
                footer: footerMsg ? { text: footerMsg } : undefined,
                action: {
                  buttons: nodeSelected.data.arrayOption.map(opt => ({
                    type: 'reply' as const,
                    reply: { id: `${opt.number}`, title: opt.value }
                  }))
                }
              };
              await SendWhatsAppOficialMessage({
                body: bodyMsg, ticket: ticketDetails, type: 'interactive',
                media: null, vCard: null, interative: interative as any
              });
            } else {
              const interative = {
                type: 'list' as const,
                body: { text: bodyMsg },
                footer: footerMsg ? { text: footerMsg } : undefined,
                action: {
                  button: nodeSelected.data.listButtonText || "Selecionar",
                  sections: [{
                    title: "Opções", rows: nodeSelected.data.arrayOption.map(opt => ({
                      id: `${opt.number}`, title: opt.value
                    }))
                  }]
                }
              };
              await SendWhatsAppOficialMessage({
                body: bodyMsg, ticket: ticketDetails, type: 'interactive',
                media: null, vCard: null, interative: interative as any
              });
            }
          }

          const interactiveHeaderImage =
            whatsapp.channel === "whatsapp" && nodeSelected.data.headerImage
              ? nodeSelected.data.headerImage
              : null;

          const messageData: MessageData = {
            wid: sentInteractiveMsg?.key?.id || randomString(50),
            ticketId: ticket.id,
            contactId: ticket.contactId,
            body: bodyMsg,
            fromMe: true,
            read: true,
            ack: 2,
            mediaType: interactiveHeaderImage ? "image" : "interactive",
            mediaUrl: interactiveHeaderImage,
            dataJson: JSON.stringify({
              type: "template",
              body: bodyMsg,
              templateButtons: (nodeSelected.data.arrayOption || []).map(opt => ({
                type:
                  opt.type === "cta_url"
                    ? "URL"
                    : opt.type === "cta_call"
                      ? "PHONE_NUMBER"
                      : opt.type === "cta_copy"
                        ? "COPY_CODE"
                        : "QUICK_REPLY",
                text: opt.value,
                title: opt.value,
                id: String(opt.number),
                payload: String(opt.number),
                url: opt.url || null,
                phone_number: opt.phoneNumber || null,
                example: opt.copyCode ? [opt.copyCode] : []
              }))
            }),
            remoteJid: sentInteractiveMsg?.key?.remoteJid || null
          };
          await CreateMessageService({ messageData, companyId });

          await ticket.update({
            flowWebhook: true,
            flowStopped: idFlowDb.toString(),
            lastFlowId: nodeSelected.id,
            hashFlowId: hashWebhookId,
          });

          if (idTicket) {
            global.flowVariables[`${idTicket}_currentMenuNodeId`] = nodeSelected.id;
            global.flowVariables[`${idTicket}_returnMenuNodeId`] = nodeSelected.id;
            global.flowVariables[`${idTicket}_returnMenuEnabled`] = true;
            if (!global.flowVariables[`${idTicket}_rootMenuNodeId`]) {
              global.flowVariables[`${idTicket}_rootMenuNodeId`] = nodeSelected.id;
            }
          }

          logger.info(`[INTERACTIVE MENU] ✅ Mensagem interativa enviada, aguardando resposta`);
          return "waiting_input";
        }
      }

      // isMenu declared at top of function scope
      if (nodeSelected.type === "menu") {
        logger.info(`[MENU NODE] ========== PROCESSANDO NÓ MENU ==========`);
        logger.info(`[MENU NODE] ID do nó: ${nodeSelected.id}`);
        logger.info(`[MENU NODE] PressKey recebido: ${pressKey || 'undefined'}`);
        logger.info(`[MENU NODE] Next atual: ${next}`);
        logger.info(`[MENU NODE] Ticket ID: ${ticket?.id || idTicket}`);

        // ✅ CORRIGIDO: Verificar se o ticket está "open" antes de processar Menu
        // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
        // Recarregar o ticket para obter o status mais atualizado
        if (idTicket) {
          const currentTicket = await Ticket.findByPk(idTicket);
          if (currentTicket && currentTicket.status === "open" && !isManualTrigger) {
            logger.info(`[MENU NODE] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não processando Menu`);
            // Limpar os dados do webhook relacionados ao fluxo
            await currentTicket.update({
              flowWebhook: false,
              lastFlowId: null,
              hashFlowId: null,
              flowStopped: null,
              dataWebhook: null
            });
            return "stopped_by_open_ticket";
          }
          // Atualizar a referência do ticket
          ticket = currentTicket;
        }

        if (pressKey) {
          // ✅ FIX: Normalizar pressKey — remover espaços, quebras de linha e caracteres invisíveis
          // O WhatsApp às vezes envia "1\n", " 1 ", "1." — todos devem ser tratados como "1"
          // Grupos/citações: WhatsApp envia "*Alan Lucena:*1" — remover prefixo "*Nome:*"
          const rawPressKey = pressKey;
          pressKey = pressKey.trim().replace(/[\r\n\u200e\u200f\u200b]/g, "");

          // Remover prefixo de citação de grupo no formato "*Nome:*resposta" ou "*Nome:* resposta"
          const groupQuoteMatch = pressKey.match(/^\*[^*]+:\*\s*/);
          if (groupQuoteMatch) {
            pressKey = pressKey.slice(groupQuoteMatch[0].length).trim();
            logger.info(`[MENU NODE] Prefixo de grupo removido: "${groupQuoteMatch[0]}" → pressKey agora: "${pressKey}"`);
          }

          // Tentar extrair só o número do início da mensagem (ex: "1 - Suporte" → "1", "2." → "2")
          const numericMatch = pressKey.match(/^(\d+)/);
          if (numericMatch) {
            pressKey = numericMatch[1];
          }

          logger.info(`[MENU NODE] ========== USUÁRIO RESPONDEU MENU ==========`);
          logger.info(`[MENU NODE] Resposta bruta: "${rawPressKey}" → Normalizada: "${pressKey}"`);
          logger.info(`[MENU NODE] Opções disponíveis: ${JSON.stringify(nodeSelected.data.arrayOption?.map(o => ({ number: o.number, value: o.value })))}`);

          if (pressKey.toLowerCase() === "sair") {
            logger.info(`[MENU NODE] Usuário solicitou sair do fluxo com a palavra-chave: "${pressKey}"`);

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            const exitMessage = "Atendimento pelo chatbot finalizado. Em breve um atendente entrará em contato.";

            if (whatsapp.channel === "whatsapp") {
              await SendWhatsAppMessage({
                body: exitMessage,
                ticket: ticketDetails,
                quotedMsg: null
              });
            } else if (whatsapp.channel === "whatsapp_oficial") {
              await SendWhatsAppOficialMessage({
                body: exitMessage,
                ticket: ticketDetails,
                quotedMsg: null,
                type: 'text',
                media: null,
                vCard: null
              });
            }

            const messageData: MessageData = {
              wid: randomString(50),
              ticketId: ticket.id,
              body: exitMessage,
              fromMe: true,
              read: true,
              ack: 2,
            };

            await CreateMessageService({ messageData, companyId });

            await ticketDetails.update({
              flowWebhook: false,
              flowStopped: null,
              lastFlowId: null,
              hashFlowId: null,
              dataWebhook: null,
              status: "pending"
            });

            // ✅ 6) Quando sair/finalizar, limpe tudo
            if (idTicket) {
              delete global.flowVariables[`${idTicket}_menuInvalidState`];
              delete global.flowVariables[`${idTicket}_currentMenuNodeId`];
              delete global.flowVariables[`${idTicket}_returnMenuNodeId`];
              delete global.flowVariables[`${idTicket}_returnMenuEnabled`];
              delete global.flowVariables[`${idTicket}_rootMenuNodeId`];
            }
            return "flow_exited";
          }

          logger.info(`[MENU NODE] Buscando conexão - Source: ${next}, SourceHandle: a${pressKey}`);
          logger.info(`[MENU NODE] Total de conexões disponíveis: ${connectStatic.length}`);
          logger.info(`[MENU NODE] Conexões do nó atual (${next}): ${JSON.stringify(connectStatic.filter(c => c.source === next).map(c => ({ source: c.source, target: c.target, handle: c.sourceHandle })))}`);

          const filterOne = connectStatic.filter(confil => confil.source === next)
          logger.info(`[MENU NODE] FilterOne (conexões do source ${next}): ${filterOne.length} encontradas`);

          const filterTwo = filterOne.filter(filt2 => filt2.sourceHandle === "a" + pressKey)
          logger.info(`[MENU NODE] FilterTwo (handle a${pressKey}): ${filterTwo.length} encontradas`);

          if (filterTwo.length > 0) {
            execFn = filterTwo[0].target;
            next = execFn;
            noAlterNext = true;

            logger.info(`[MENU NODE] ✅ Conexão encontrada! Próximo nó (execFn): ${execFn}`);
            logger.info(`[MENU NODE] ✅ Next fixado para: ${next} | noAlterNext=${noAlterNext}`);

            const menuVarKey = `menuOption_${pressKey}`;
            global.flowVariables[menuVarKey] = pressKey;
            global.flowVariables["menuOption"] = pressKey;

            if (idTicket) {
              global.flowVariables[`${idTicket}_${menuVarKey}`] = pressKey;
              global.flowVariables[`${idTicket}_menuOption`] = pressKey;

              // ✅ NOVO: salva o menu atual para permitir retorno automático
              global.flowVariables[`${idTicket}_returnMenuNodeId`] = nodeSelected.id;
              global.flowVariables[`${idTicket}_returnMenuEnabled`] = true;

              logger.info(
                `[MENU NODE] ✅ Retorno ao menu habilitado para ticket ${idTicket} usando menu ${nodeSelected.id}`
              );
            }

            logger.info(
              `[MENU NODE] ✅ Variável salva: ${menuVarKey} = "${pressKey}" (ticketId: ${idTicket})`
            );

            // ✅ 5) Quando a opção for válida, limpe o estado de inválido
            if (idTicket) {
              delete global.flowVariables[`${idTicket}_menuInvalidState`];
            }
          } else {
            execFn = undefined
            logger.warn(`[MENU NODE] ❌ NENHUMA CONEXÃO encontrada para handle a${pressKey}`);
          }

          if (execFn === undefined) {
            logger.error(`[MENU NODE] ========== OPÇÃO INVÁLIDA ==========`);
            logger.error(`[MENU NODE] PressKey: "${pressKey}" não tem conexão correspondente`);
            logger.error(`[MENU NODE] Handles disponíveis: ${filterOne.map(f => f.sourceHandle).join(', ')}`);

            // ✅ 4) Pare de repetir “Opção inválida...” toda hora
            const invalidStateKey = `${idTicket}_menuInvalidState`;
            const now = Date.now();

            const lastInvalidState = idTicket
              ? global.flowVariables[invalidStateKey]
              : null;

            const invalidCooldownMs = 60000; // 60 segundos

            if (
              idTicket &&
              lastInvalidState &&
              lastInvalidState.menuId === nodeSelected.id &&
              now - lastInvalidState.at < invalidCooldownMs
            ) {
              logger.warn(
                `[MENU NODE] 🔇 Resposta inválida suprimida para ticket ${idTicket} no menu ${nodeSelected.id} (cooldown ativo)`
              );

              return "invalid_suppressed";
            }

            if (idTicket) {
              global.flowVariables[invalidStateKey] = {
                menuId: nodeSelected.id,
                at: now,
                value: pressKey
              };
            }

            let optionsText = "";
            nodeSelected.data.arrayOption.forEach(item => {
              optionsText += `[${item.number}] ${item.value}\n`;
            });

            const fallbackMessage = `Opção inválida. Por favor, escolha uma das opções abaixo ou digite *menu* para retornar ao início:\n\n${optionsText}`;

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            if (whatsapp.channel === "whatsapp") {
              await SendWhatsAppMessage({
                body: fallbackMessage,
                ticket: ticketDetails,
                quotedMsg: null
              });
            } else if (whatsapp.channel === "whatsapp_oficial") {
              await SendWhatsAppOficialMessage({
                body: fallbackMessage,
                ticket: ticketDetails,
                quotedMsg: null,
                type: 'text',
                media: null,
                vCard: null
              });
            }

            const messageData: MessageData = {
              wid: randomString(50),
              ticketId: ticket.id,
              body: fallbackMessage,
              fromMe: true,
              read: true,
              ack: 2,
            };

            await CreateMessageService({ messageData, companyId });

            return "fallback_sent";
          }

          logger.info(`[MENU NODE] Definindo pressKey como "999" para continuar processamento`);
          pressKey = "999";

          const isNodeExist = nodes.filter(item => item.id === execFn);
          logger.info(`[MENU NODE] Verificando se nó ${execFn} existe: ${isNodeExist.length > 0 ? 'SIM' : 'NÃO'}`);

          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" ? true : false;
            logger.info(`[MENU NODE] Próximo nó é do tipo: ${isNodeExist[0].type}, isMenu: ${isMenu}`);
          } else {
            isMenu = false;
            logger.warn(`[MENU NODE] ⚠️ Nó ${execFn} NÃO ENCONTRADO na lista de nós!`);
          }

          logger.info(`[MENU NODE] ========== FIM PROCESSAMENTO RESPOSTA ==========`);
        } else {
          // ✅ CORRIGIDO: Verificar se o ticket está "open" antes de enviar Menu
          // EXCEÇÃO: Se o fluxo foi disparado manualmente (isManualTrigger=true), permitir execução mesmo com status "open"
          // Recarregar o ticket para obter o status mais atualizado
          if (idTicket) {
            const currentTicket = await Ticket.findByPk(idTicket);
            if (currentTicket && currentTicket.status === "open" && !isManualTrigger) {
              logger.info(`[MENU NODE] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não enviando Menu`);
              // Limpar os dados do webhook relacionados ao fluxo
              await currentTicket.update({
                flowWebhook: false,
                lastFlowId: null,
                hashFlowId: null,
                flowStopped: null,
                dataWebhook: null
              });
              return "stopped_by_open_ticket";
            }
            // Atualizar a referência do ticket
            ticket = currentTicket;
          }

          logger.info(`[MENU NODE] ========== CRIANDO E ENVIANDO MENU ==========`);

          let optionsMenu = "";
          nodeSelected.data.arrayOption.map(item => {
            optionsMenu += `[${item.number}] ${item.value}\n`;
          });
          logger.info(`[MENU NODE] Opções do menu: ${optionsMenu.trim()}`);

          const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;
          logger.info(`[MENU NODE] Menu completo criado com ${nodeSelected.data.arrayOption.length} opções`);

          let msg;

          const dataLocal = {
            nome: createFieldJsonName,
            numero: numberClient,
            email: createFieldJsonEmail
          };

          const preparedMenu = await prepareFlowText({
            rawText: menuCreate,
            ticketData: ticket,
            ticketId: ticket?.id || idTicket,
            whatsappId,
            companyId,
            details,
            dataWebhook,
            dataLocal
          });

          const preparedBodyOnly = await prepareFlowText({
            rawText: nodeSelected.data.message || "Selecione uma opção",
            ticketData: preparedMenu.ticketData || ticket,
            ticketId: ticket?.id || idTicket,
            whatsappId,
            companyId,
            details,
            dataWebhook,
            dataLocal
          });

          ticket = preparedMenu.ticketData || ticket;

          msg = {
            body: preparedMenu.text,
            number: numberClient,
            companyId: companyId
          };

          logger.info(`[MENU NODE] Mensagem pronta para envio (${msg.body.length} caracteres)`);

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const messageData: MessageData = {
            wid: randomString(50),
            ticketId: ticket.id,
            body: msg.body,
            fromMe: true,
            read: true,
            ack: 2,
          };

          logger.info(`[MENU NODE] Enviando menu via ${whatsapp.channel}...`);

          if (whatsapp.channel === "whatsapp") {
            await SendWhatsAppMessage({
              body: msg.body,
              ticket: ticketDetails,
              quotedMsg: null
            });
          }

          if (whatsapp.channel === "whatsapp_oficial") {
            const options = nodeSelected.data.arrayOption || [];
            const bodyText = preparedBodyOnly.text || "Selecione uma opção";

            if (options.length > 0 && options.length <= 3) {
              const interative = {
                type: "button" as const,
                body: { text: bodyText },
                action: {
                  buttons: options.map(opt => ({
                    type: "reply" as const,
                    reply: {
                      id: String(opt.number),
                      title: String(opt.value).slice(0, 20)
                    }
                  }))
                }
              };

              await SendWhatsAppOficialMessage({
                body: bodyText,
                bodyToSave: msg.body,
                ticket: ticketDetails,
                quotedMsg: null,
                type: "interactive",
                media: null,
                vCard: null,
                interative: interative as any
              });
            } else if (options.length > 3) {
              const interative = {
                type: "list" as const,
                body: { text: bodyText },
                action: {
                  button: "Selecionar",
                  sections: [
                    {
                      title: "Opções",
                      rows: options.map(opt => ({
                        id: String(opt.number),
                        title: String(opt.value).slice(0, 24),
                        description: ""
                      }))
                    }
                  ]
                }
              };

              await SendWhatsAppOficialMessage({
                body: bodyText,
                bodyToSave: msg.body,
                ticket: ticketDetails,
                quotedMsg: null,
                type: "interactive",
                media: null,
                vCard: null,
                interative: interative as any
              });
            } else {
              await SendWhatsAppOficialMessage({
                body: msg.body,
                ticket: ticketDetails,
                quotedMsg: null,
                type: "text",
                media: null,
                vCard: null
              });
            }
          }

          if (whatsapp.channel === "telegram") {
            await sendTelegramFlowMenu({
              whatsapp,
              ticket: ticketDetails,
              body: preparedBodyOnly.text || nodeSelected.data.message || "Selecione uma opção:",
              options: nodeSelected.data.arrayOption || []
            });
          }

          logger.info(`[MENU NODE] ✅ Menu enviado com sucesso!`);

          SetTicketMessagesAsRead(ticketDetails);

          logger.info(`[TICKET UPDATE] Atualizando lastMessage do ticket ${ticket.id} no menu`);

          await ticketDetails.update({
            lastMessage: msg.body
          });

          logger.info(`[TICKET UPDATE] LastMessage atualizada para ticket ${ticket.id} no menu`);

          await intervalWhats("1");

          const ticketIdToRefresh = ticket?.id || idTicket;
          ticket = await getTicketWithWhatsapp(ticketIdToRefresh, whatsappId, companyId);

          if (ticket) {
            logger.info(`[MENU NODE] ========== CONFIGURANDO TICKET PARA AGUARDAR RESPOSTA ==========`);
            logger.info(`[MENU NODE] Ticket ID: ${ticket.id}`);
            logger.info(`[MENU NODE] Status atual: ${ticket.status}`);
            logger.info(`[MENU NODE] LastFlowId será: ${nodeSelected.id}`);
            logger.info(`[MENU NODE] HashFlowId: ${hashWebhookId}`);
            logger.info(`[MENU NODE] FlowStopped: ${idFlowDb}`);

            const updateData = {
              status: "pending",
              queueId: ticket.queueId ? ticket.queueId : null,
              userId: null,
              companyId: companyId,
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              dataWebhook: dataWebhook,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString()
            };

            logger.info(`[MENU NODE] Dados que serão salvos: ${JSON.stringify(updateData)}`);

            try {
              const updateResult = await ticket.update(updateData);

              logger.info(`[MENU NODE] ✅ UPDATE EXECUTADO COM SUCESSO!`);
              logger.info(`[MENU NODE] Ticket após update - ID: ${updateResult.id}`);
              logger.info(`[MENU NODE] flowWebhook: ${updateResult.flowWebhook}`);
              logger.info(`[MENU NODE] lastFlowId: ${updateResult.lastFlowId}`);
              logger.info(`[MENU NODE] hashFlowId: ${updateResult.hashFlowId}`);
              logger.info(`[MENU NODE] flowStopped: ${updateResult.flowStopped}`);

              // ✅ 1) Salve o menu inicial e o menu atual
              if (idTicket) {
                if (!global.flowVariables[`${idTicket}_rootMenuNodeId`]) {
                  global.flowVariables[`${idTicket}_rootMenuNodeId`] = nodeSelected.id;
                  logger.info(
                    `[MENU NODE] ✅ Menu inicial salvo para ticket ${idTicket}: ${nodeSelected.id}`
                  );
                }

                global.flowVariables[`${idTicket}_currentMenuNodeId`] = nodeSelected.id;
                logger.info(
                  `[MENU NODE] ✅ Menu atual salvo para ticket ${idTicket}: ${nodeSelected.id}`
                );

                delete global.flowVariables[`${idTicket}_menuInvalidState`];
              }

              // Recarregar do banco para confirmar que foi salvo
              await ticket.reload();
              logger.info(`[MENU NODE] ========== VERIFICAÇÃO APÓS RELOAD ==========`);
              logger.info(`[MENU NODE] flowWebhook após reload: ${ticket.flowWebhook}`);
              logger.info(`[MENU NODE] lastFlowId após reload: ${ticket.lastFlowId}`);
              logger.info(`[MENU NODE] hashFlowId após reload: ${ticket.hashFlowId}`);
              logger.info(`[MENU NODE] flowStopped após reload: ${ticket.flowStopped}`);

            } catch (updateError) {
              logger.error(`[MENU NODE] ❌ ERRO AO FAZER UPDATE: ${updateError.message}`);
              logger.error(`[MENU NODE] Stack: ${updateError.stack}`);
            }
          }

          logger.info(`[MENU NODE] ========== FLUXO PAUSADO - AGUARDANDO RESPOSTA ==========`);
          break;
        }
      }

      let isSwitchFlow: boolean;
      if (nodeSelected.type === "switchFlow") {
        logger.info(`[SWITCH FLOW] ========== ACIONANDO OUTRO FLUXO ==========`);
        logger.info(`[SWITCH FLOW] Nó ID: ${nodeSelected.id}`);
        logger.info(`[SWITCH FLOW] Ticket ID: ${ticket?.id || idTicket}`);

        const data = nodeSelected.data?.flowSelected;

        logger.info(`[SWITCH FLOW] Dados do fluxo selecionado: ${JSON.stringify(data)}`);

        if (!data) {
          logger.error(`[SWITCH FLOW] ❌ Nenhum fluxo foi selecionado no nó!`);
          break;
        }

        const switchTicketId = ticket?.id || idTicket;
        ticket = await getTicketWithWhatsapp(switchTicketId);

        if (!ticket) {
          logger.error(`[SWITCH FLOW] ❌ Ticket não encontrado!`);
          break;
        }

        logger.info(`[SWITCH FLOW] Fluxo de destino: ${data?.name || 'N/A'} (ID: ${data?.id || 'N/A'})`);
        logger.info(`[SWITCH FLOW] Resetando estado do ticket antes de mudar de fluxo`);

        // ✅ IMPORTANTE: Resetar o fluxo atual antes de iniciar o novo
        await ticket.update({
          flowWebhook: false,
          lastFlowId: null,
          hashFlowId: null,
          flowStopped: null,
          dataWebhook: null
        });

        logger.info(`[SWITCH FLOW] Ticket resetado - iniciando novo fluxo`);

        isSwitchFlow = true;

        try {
          await switchFlow(data, companyId, ticket);
          logger.info(`[SWITCH FLOW] ✅ Novo fluxo iniciado com sucesso!`);
        } catch (error) {
          logger.error(`[SWITCH FLOW] ❌ Erro ao iniciar novo fluxo: ${error.message}`);
          logger.error(`[SWITCH FLOW] Stack: ${error.stack}`);
        }

        break;
      };

      if (nodeSelected.type === "attendant") {

        const data = nodeSelected.data?.user?.id;

        const attendantTicketId = ticket?.id || idTicket;
        ticket = await getTicketWithWhatsapp(attendantTicketId);

        if (!ticket) {
          logger.error(`[ATTENDANT NODE] Ticket ${attendantTicketId} não encontrado`);
          break;
        }

        logger.info(`[TICKET UPDATE] Atribuindo ticket ${ticket.id} ao atendente ${data}`);

        // ✅ CORRIGIDO: Desabilitar integração quando ticket é atribuído a atendente
        await ticket.update({
          userId: data,
          useIntegration: false,
          isBot: false,
          dataWebhook: null
        });

        logger.info(`[TICKET UPDATE] Ticket ${ticket.id} atribuído ao usuário ${data} com sucesso - integração desabilitada`);

        break;
      };

      let isContinue = false;

      logger.info(`[FLOW] ========== DETERMINANDO PRÓXIMO NÓ ==========`);
      logger.info(`[FLOW] PressKey: ${pressKey || 'undefined'}`);
      logger.info(`[FLOW] ExecCount: ${execCount}`);
      logger.info(`[FLOW] IsMenu: ${isMenu || false}`);
      logger.info(`[FLOW] ExecFn: ${execFn || 'undefined'}`);
      logger.info(`[FLOW] NoAlterNext: ${noAlterNext}`);

      // ✅ FIX IF/ELSE: Se noAlterNext=true, o nó atual (ex: conditionCompare) já processou
      // e definiu o next correto — NÃO sobrescrever com a lógica do pressKey=999
      if (pressKey === "999" && execCount > 0 && !noAlterNext) {
        logger.info(`[FLOW] ========== PROCESSANDO RESPOSTA DO MENU (pressKey=999) ==========`);
        logger.info(`[FLOW] Buscando conexão a partir de execFn: ${execFn}`);

        pressKey = undefined;
        let result = connects.filter(connect => connect.source === execFn)[0];

        logger.info(`[FLOW] Conexões disponíveis de ${execFn}: ${JSON.stringify(connects.filter(c => c.source === execFn).map(c => ({ target: c.target, handle: c.sourceHandle })))}`);

        if (typeof result === "undefined") {
          logger.error(`[FLOW] ❌ Nenhuma conexão encontrada para execFn: ${execFn}`);
          next = "";
        } else {
          next = result.target;
          logger.info(`[FLOW] ✅ Próximo nó definido: ${next} (de execFn: ${execFn})`);
        }
      } else if (pressKey === "999" && noAlterNext) {
        // Nó intermediário (ex: conditionCompare) já definiu o next corretamente — apenas limpar pressKey
        logger.info(`[FLOW] pressKey=999 mas noAlterNext=true — nó já processou e definiu next: ${next}. Limpando pressKey.`);
        pressKey = undefined;
      } else {
        logger.info(`[FLOW] Determinando próximo nó sem resposta de menu`);
        let result;

        if (isMenu) {
          logger.info(`[FLOW] ========== PRÓXIMO É OUTRO MENU ==========`);
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
          // ✅ CORRIGIDO: Quando isMenu=true, o menu já determinou o próximo nó (execFn)
          // Precisamos atualizar next diretamente, ignorando noAlterNext
          next = execFn;
          logger.info(`[FLOW] Continuando para menu: ${execFn}`);
        } else if (isSwitchFlow) {
          logger.info(`[SWITCH FLOW] ========== CÓDIGO LEGADO DE SWITCHFLOW DETECTADO ==========`);
          logger.info(`[SWITCH FLOW] Este código NÃO deveria ser executado - o switchFlow já foi processado acima`);
          logger.info(`[SWITCH FLOW] Pulando esta execução para evitar duplicação`);

          // ✅ CORRIGIDO: O switchFlow já foi executado acima, não precisa executar novamente
          // Este código legado será mantido comentado para referência
          /*
          const wbot = await getWbot(whatsapp.id);
          const contact = await Contact.findOne({
            where: {
              id: ticket?.contactId,
              companyId: companyId
            }
          })
          flowBuilderQueue(ticket, msg, wbot, whatsapp, companyId, contact, null);
          */
          break;
        } else if (isRandomizer) {
          isRandomizer = false;
          result = { target: next };
          logger.info(`[FLOW DEBUG] Randomizer - próximo nó: ${next}`);
        } else if (isConditionCompare) {
          isConditionCompare = false;
          result = { target: next };
          logger.info(`[FLOW DEBUG] ConditionCompare - próximo nó: ${next}`);
        } else {
          // ✅ CORRIGIDO: Verificar se noAlterNext está ativo antes de buscar nova conexão
          if (noAlterNext) {
            logger.info(`[FLOW DEBUG] noAlterNext ativo - mantendo next: ${next}`);
            result = { target: next };
          } else {
            result = connects.filter(connect => connect.source === nodeSelected.id)[0];
            logger.info(`[FLOW DEBUG] Buscando conexão para nó: ${nodeSelected.id}, resultado: ${result ? result.target : 'undefined'}`);
          }
        }

        if (typeof result === "undefined" || !result) {
          logger.warn(`[FLOW DEBUG] Nenhuma conexão encontrada para nó: ${nodeSelected?.id}`);
          next = "";
        } else {
          if (!noAlterNext) {
            next = result.target;
          }
          logger.info(`[FLOW DEBUG] Próximo nó definido: ${next}`);
        }
      }

      let finalStatus;
      if (nodeSelected?.data?.finalStatus) {
        console.log("[FINAL STATUS] O status final será:", nodeSelected.data.finalStatus);
        finalStatus = nodeSelected.data.finalStatus;
      }

      // ✅ CORRIGIDO: Verificar se é realmente o fim do fluxo antes de finalizar
      if (!pressKey && !isContinue) {
        const nextNode = connects.filter(connect => connect.source === nodeSelected.id).length;

        logger.info(`[FLOW DEBUG] Verificando fim de fluxo - Nó: ${nodeSelected.id}, Conexões: ${nextNode}, Next: ${next}`);

        // ✅ EVITA DUPLICAR ÚLTIMO BLOCO
        // Se o nó atual não tem nenhuma saída e o próximo nó ficou igual ao próprio nó,
        // o fluxo deve finalizar. Isso evita enviar duas vezes o último bloco de mensagem,
        // especialmente após o nó Asaas.
        // ✅ EVITA DUPLICAR ÚLTIMO BLOCO SEM PERDER GATILHOS DO MENU
        // Se o nó atual não tem saída e o next ficou igual ao próprio nó,
        // apenas encerramos o loop atual.
        // Não limpamos flowWebhook/lastFlowId aqui, para manter comandos como:
        // menu, voltar, início, retornar.
        if (nextNode === 0 && next === nodeSelected.id) {
          logger.info(
            `[FLOW DEBUG] Nó ${nodeSelected.id} (${nodeSelected.type}) não possui saída e next aponta para ele mesmo. Encerrando loop para evitar duplicidade, mantendo estado do fluxo.`
          );

          break;
        }

        // ✅ Só finalizar se não há conexões E não há próximo nó definido
        if (nextNode === 0 && (!next || next === "")) {
          if (ticket) {
            ticket = await Ticket.findOne({
              where: { id: ticket.id, whatsappId, companyId: companyId }
            });

            // ✅ RETORNO AUTOMÁTICO AO MENU quando um ramo vindo de menu termina sem próxima conexão
            const storedReturnMenuNodeId = idTicket
              ? global.flowVariables[`${idTicket}_returnMenuNodeId`]
              : null;

            const storedReturnMenuEnabled = idTicket
              ? global.flowVariables[`${idTicket}_returnMenuEnabled`]
              : null;

            if (
              (!next || next === "" || next === undefined) &&
              storedReturnMenuEnabled &&
              storedReturnMenuNodeId &&
              nodeSelected?.id !== storedReturnMenuNodeId &&
              ["singleBlock", "text", "image", "audio", "video", "document"].includes(
                String(nodeSelected?.type)
              )
            ) {
              logger.info(
                `[RETURN MENU] 🔁 Nó terminal ${nodeSelected?.id} (${nodeSelected?.type}) concluído. Retornando ao menu ${storedReturnMenuNodeId}`
              );

              const menuNodeToReturn = nodes.find(
                item => item.id === storedReturnMenuNodeId &&
                  (item.type === "menu" || item.type === "interactiveMenu")
              );

              if (menuNodeToReturn) {
                if (menuNodeToReturn.type === "interactiveMenu") {
                  await ticket.update({
                    status: "pending",
                    flowWebhook: true,
                    lastFlowId: menuNodeToReturn.id,
                    dataWebhook,
                    hashFlowId: hashWebhookId || ticket.hashFlowId || randomString(32),
                    flowStopped: idFlowDb.toString()
                  });
                  global.flowVariables[`${idTicket}_currentMenuNodeId`] = menuNodeToReturn.id;
                  logger.info(
                    `[RETURN MENU] ✅ Estado restaurado no menu interativo ${menuNodeToReturn.id}; a lista pode ser usada novamente`
                  );
                  return "waiting_input";
                }

                let optionsMenu = "";
                (menuNodeToReturn.data.arrayOption || []).forEach(item => {
                  optionsMenu += `[${item.number}] ${item.value}\n`;
                });

                const menuCreate = `${menuNodeToReturn.data.message}\n\n${optionsMenu}`;

                let msg;

                const dataLocal = {
                  nome: createFieldJsonName,
                  numero: numberClient,
                  email: createFieldJsonEmail
                };

                const preparedMenu = await prepareFlowText({
                  rawText: menuCreate,
                  ticketData: ticket,
                  ticketId: ticket?.id || idTicket,
                  whatsappId,
                  companyId,
                  details,
                  dataWebhook,
                  dataLocal
                });

                const preparedBodyOnly = await prepareFlowText({
                  rawText: menuNodeToReturn.data.message || "Selecione uma opção",
                  ticketData: preparedMenu.ticketData || ticket,
                  ticketId: ticket?.id || idTicket,
                  whatsappId,
                  companyId,
                  details,
                  dataWebhook,
                  dataLocal
                });

                msg = {
                  body: preparedMenu.text,
                  number: numberClient,
                  companyId: companyId
                };

                const ticketDetails = await ShowTicketService(ticket.id, companyId);

                logger.info(
                  `[RETURN MENU] Reenviando menu ${menuNodeToReturn.id} via canal ${whatsapp.channel}`
                );

                if (whatsapp.channel === "whatsapp") {
                  await SendWhatsAppMessage({
                    body: msg.body,
                    ticket: ticketDetails,
                    quotedMsg: null
                  });
                }

                if (whatsapp.channel === "whatsapp_oficial") {
                  const options = menuNodeToReturn.data.arrayOption || [];
                  const bodyText = preparedBodyOnly.text || "Selecione uma opção";

                  if (options.length > 0 && options.length <= 3) {
                    const interative = {
                      type: "button" as const,
                      body: { text: bodyText },
                      action: {
                        buttons: options.map(opt => ({
                          type: "reply" as const,
                          reply: {
                            id: String(opt.number),
                            title: String(opt.value).slice(0, 20)
                          }
                        }))
                      }
                    };

                    await SendWhatsAppOficialMessage({
                      body: bodyText,
                      bodyToSave: msg.body,
                      ticket: ticketDetails,
                      quotedMsg: null,
                      type: "interactive",
                      media: null,
                      vCard: null,
                      interative: interative as any
                    });
                  } else if (options.length > 3) {
                    const interative = {
                      type: "list" as const,
                      body: { text: bodyText },
                      action: {
                        button: "Selecionar",
                        sections: [
                          {
                            title: "Opções",
                            rows: options.map(opt => ({
                              id: String(opt.number),
                              title: String(opt.value).slice(0, 24),
                              description: ""
                            }))
                          }
                        ]
                      }
                    };

                    await SendWhatsAppOficialMessage({
                      body: bodyText,
                      bodyToSave: msg.body,
                      ticket: ticketDetails,
                      quotedMsg: null,
                      type: "interactive",
                      media: null,
                      vCard: null,
                      interative: interative as any
                    });
                  } else {
                    await SendWhatsAppOficialMessage({
                      body: msg.body,
                      ticket: ticketDetails,
                      quotedMsg: null,
                      type: "text",
                      media: null,
                      vCard: null
                    });
                  }
                }

                if (whatsapp.channel === "telegram") {
                  await sendTelegramFlowMenu({
                    whatsapp,
                    ticket: ticketDetails,
                    body: preparedBodyOnly.text || menuNodeToReturn.data.message || "Selecione uma opção:",
                    options: menuNodeToReturn.data.arrayOption || []
                  });
                }

                await ticketDetails.update({
                  status: "pending",
                  queueId: ticket.queueId ? ticket.queueId : null,
                  userId: null,
                  companyId: companyId,
                  flowWebhook: true,
                  lastFlowId: menuNodeToReturn.id,
                  dataWebhook: dataWebhook,
                  hashFlowId: hashWebhookId || randomString(32),
                  flowStopped: idFlowDb.toString(),
                  lastMessage: msg.body
                });

                logger.info(
                  `[RETURN MENU] ✅ Menu reenviado com sucesso para ticket ${ticket.id}. Fluxo aguardando nova resposta.`
                );

                return "returned_to_menu";
              }

              logger.warn(
                `[RETURN MENU] ⚠️ Menu salvo para retorno não encontrado: ${storedReturnMenuNodeId}`
              );
            }

            if (ticket) {
              logger.info(`[TICKET UPDATE] Finalizando fluxo - Ticket ${ticket.id} será resetado (LastFlowId: null, FlowWebhook: false)`);

              await ticket.update({
                lastFlowId: null,
                dataWebhook: null,
                hashFlowId: null,
                flowWebhook: false,
                flowStopped: null,
                useIntegration: null,
                integrationId: null
              });

              logger.info(`[TICKET UPDATE] NO IF - Fluxo finalizado - Ticket ${ticket.id} resetado com sucesso`);
            } else {
              logger.warn(`[TICKET UPDATE] Ticket não encontrado para resetar no IF`);
            }

          } else {
            ticket = await Ticket.findOne({
              where: { id: idTicket, whatsappId, companyId: companyId }
            });

            if (ticket) {
              await ticket.update({
                lastFlowId: null,
                dataWebhook: null,
                hashFlowId: null,
                flowWebhook: false,
                flowStopped: null,
                useIntegration: null,
                integrationId: null
              });

              logger.info(`[TICKET UPDATE] NO ELSE - Fluxo finalizado - Ticket ${idTicket} resetado com sucesso`);
            } else {
              logger.warn(`[TICKET UPDATE] Ticket ${idTicket} não encontrado para resetar no ELSE`);
            }
          }
          break;
        } else if (nextNode > 0 && (!next || next === "")) {
          // ✅ Se há conexões mas next não foi definido, buscar a conexão
          const nextConnection = connects.filter(connect => connect.source === nodeSelected.id)[0];
          if (nextConnection) {
            next = nextConnection.target;
            logger.info(`[FLOW DEBUG] Next não definido mas há conexões - usando: ${next}`);
          }
        }
      }

      isContinue = false;

      // ✅ CORRIGIDO: Verificar se realmente não há próximo nó antes de finalizar
      if (next === "" || !next) {
        logger.info(`[FLOW DEBUG] Next está vazio - verificando se deve finalizar fluxo`);

        // Tentar buscar conexão a partir do nó atual
        const possibleConnection = connects.filter(connect => connect.source === nodeSelected.id)[0];

        if (possibleConnection) {
          next = possibleConnection.target;
          logger.info(`[FLOW DEBUG] Conexão encontrada - continuando para: ${next}`);
        } else {
          // Realmente não há próximo nó - finalizar fluxo
          logger.info(`[FLOW DEBUG] Nenhuma conexão encontrada - finalizando fluxo`);

          if (ticket || idTicket) {
            ticket = await getTicketWithWhatsapp(ticket?.id || idTicket, whatsappId, companyId);
          }

          if (ticket) {
            logger.info(`[TICKET UPDATE] Finalizando fluxo disparado - Ticket ${ticket.id} com status final: ${finalStatus}`);
            await finalizeTriggeredFlow(ticket, nodeSelected, companyId, finalStatus);
          }

          break;
        }
      }

      console.log("UPDATE9...");
      if (idTicket) {
        console.log("UPDATE10...");
        ticket = await getTicketWithWhatsapp(idTicket, whatsappId, companyId);
      }

      console.log("UPDATE12...");

      if (!ticket) {
        logger.warn(`[FLOW LOOP] Ticket não encontrado após UPDATE10 - encerrando fluxo`);
        break;
      }

      logger.info(`[FLOW LOOP] Finalizando iteração - Próximo nó: ${next}, NoAlterNext: ${noAlterNext}`);
      logger.info(`[TICKET UPDATE] Continuando fluxo - Ticket ${ticket.id} - LastFlowId: ${nodeSelected.id}, HashFlowId: ${hashWebhookId}`);

      // ✅ CRÍTICO: Verificar se o próximo nó requer input do usuário
      // Se o próximo nó for do tipo 'menu' ou 'input', então flowStopped = idFlowDb (fluxo esperando input)
      // Caso contrário, flowStopped = null (fluxo executando, não esperando input)
      let flowStoppedValue: string | null = null;
      if (next) {
        const nextNode = nodes.find(node => node.id === next);
        if (nextNode && (nextNode.type === 'menu' || nextNode.type === 'input' || nextNode.type === 'interactiveMenu')) {
          // Próximo nó requer input do usuário - fluxo está esperando
          flowStoppedValue = idFlowDb.toString();
          logger.info(`[TICKET UPDATE] Próximo nó (${next}) é do tipo ${nextNode.type} - fluxo esperando input do usuário`);
        } else {
          // Próximo nó não requer input - fluxo continuando execução
          flowStoppedValue = null;
          logger.info(`[TICKET UPDATE] Próximo nó (${next}) é do tipo ${nextNode?.type || 'desconhecido'} - fluxo continuando execução`);
        }
      } else {
        // Não há próximo nó - fluxo finalizado ou continuando
        flowStoppedValue = null;
        logger.info(`[TICKET UPDATE] Não há próximo nó - fluxo pode estar finalizando`);
      }

      await ticket.update({
        whatsappId: whatsappId,
        queueId: ticket?.queueId,
        userId: ticket?.userId,
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: nodeSelected.id,
        dataWebhook: dataWebhook,
        hashFlowId: hashWebhookId,
        flowStopped: flowStoppedValue
      });

      logger.info(`[TICKET UPDATE] Ticket ${ticket.id} atualizado para continuar fluxo - FlowStopped: ${flowStoppedValue || 'null'}`);

      noAlterNext = false;
      isMenu = false;
      execFn = undefined;
      execCount++;

      logger.info(`[FLOW LOOP] ========== Fim da iteração ${i + 1}/${lengthLoop} ==========`);
    }

    return "ds";
  } catch (error) {
    const errorMessage = error?.message || "Erro desconhecido";
    const errorStack = error?.stack || "";
    const errorName = error?.name || "UnknownError";

    // Log detalhado para diagnóstico futuro
    logger.error(`[RDS-ERROR-DEBUG] Erro no ActionsWebhookService - Nome: ${errorName}`);
    logger.error(`[RDS-ERROR-DEBUG] Mensagem: ${errorMessage}`);

    // Registrar stack trace apenas em situações não previstas
    if (errorName !== "ValidationError" && errorName !== "NotFoundError") {
      logger.error(`[RDS-ERROR-DEBUG] Stack: ${errorStack.split("\n")[0]}`);
    }

    // Registrar contexto da execução para ajudar na depuração
    logger.error(`[RDS-ERROR-DEBUG] Contexto: Ticket=${idTicket}, nextStage=${nextStage}, nodeType=${nodes.find(n => n.id === nextStage)?.type || "unknown"}`);

    // Manter o log original para compatibilidade
    logger.error("[ActionsWebhookService] Erro geral no serviço:", error);

    if (idTicket) {
      const ticket = await Ticket.findByPk(idTicket);
      if (ticket) {
        await ticket.update({
          flowWebhook: false,
          lastFlowId: null,
          hashFlowId: null,
          flowStopped: null
        });

        logger.info(`[RDS-ERROR-DEBUG] Estado do ticket ${idTicket} resetado após erro`);
      }
    }

  }
};

const switchFlow = async (data: any, companyId: number, ticket: Ticket) => {
  logger.info(`[SWITCH FLOW FUNC] ========== FUNÇÃO switchFlow INICIADA ==========`);
  logger.info(`[SWITCH FLOW FUNC] Ticket ID: ${ticket?.id}`);
  logger.info(`[SWITCH FLOW FUNC] WhatsApp ID: ${ticket?.whatsappId}`);
  logger.info(`[SWITCH FLOW FUNC] Company ID: ${companyId}`);
  logger.info(`[SWITCH FLOW FUNC] Fluxo de destino: ${data?.name} (ID: ${data?.id})`);

  try {
    // Verificar se 'data' é o fluxo completo ou apenas o ID
    let flowData = data;

    // Se 'data' for um número ou string, buscar o fluxo
    if (typeof data === 'number' || typeof data === 'string') {
      logger.info(`[SWITCH FLOW FUNC] Buscando fluxo com ID: ${data}`);
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: data,
          company_id: companyId
        }
      });

      if (!flow) {
        logger.error(`[SWITCH FLOW FUNC] ❌ Fluxo ${data} não encontrado!`);
        return;
      }

      flowData = flow;
    } else if (!data?.flow || !data?.flow?.nodes) {
      logger.error(`[SWITCH FLOW FUNC] ❌ Dados do fluxo inválidos!`);
      return;
    }

    const wbot = await getWbot(ticket?.whatsappId);
    logger.info(`[SWITCH FLOW FUNC] ✅ WBot obtido com sucesso`);

    const whatsapp = await ShowWhatsAppService(wbot.id || ticket?.whatsappId, companyId);
    logger.info(`[SWITCH FLOW FUNC] ✅ WhatsApp service obtido - Nome: ${whatsapp.name}`);

    const contact = await Contact.findOne({
      where: {
        id: ticket?.contactId,
        companyId: companyId
      }
    });

    if (!contact) {
      logger.error(`[SWITCH FLOW FUNC] ❌ Contato não encontrado! ContactId: ${ticket?.contactId}`);
      return;
    }

    logger.info(`[SWITCH FLOW FUNC] ✅ Contato obtido - Nome: ${contact.name}, Número: ${contact.number}`);

    const nodes: INodes[] = flowData.flow["nodes"];
    const connections: IConnections[] = flowData.flow["connections"];

    if (!nodes || nodes.length === 0) {
      logger.error(`[SWITCH FLOW FUNC] ❌ Fluxo não possui nós válidos!`);
      return;
    }

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    logger.info(`[SWITCH FLOW FUNC] Chamando ActionsWebhookService para iniciar o novo fluxo...`);
    logger.info(`[SWITCH FLOW FUNC] Total de nós: ${nodes.length}, Primeiro nó: ${nodes[0].id}`);

    // ✅ CORRIGIDO: Chamar diretamente ActionsWebhookService para iniciar um NOVO fluxo
    // (flowBuilderQueue é apenas para CONTINUAR fluxos interrompidos)
    await ActionsWebhookService(
      whatsapp.id,
      flowData.id,
      companyId,
      nodes,
      connections,
      nodes[0].id, // Começar pelo primeiro nó
      null,
      "",
      "",
      null, // Sem pressKey pois não há mensagem do usuário
      ticket.id,
      mountDataContact,
      false // inputResponded = false
    );

    logger.info(`[SWITCH FLOW FUNC] ✅ Novo fluxo iniciado com sucesso!`);
  } catch (error) {
    logger.error(`[SWITCH FLOW FUNC] ❌ Erro na função switchFlow: ${error.message}`);
    logger.error(`[SWITCH FLOW FUNC] Stack: ${error.stack}`);
    throw error;
  }
};

const constructJsonLine = (line: string, json: any) => {
  let valor = json
  const chaves = line.split(".")

  if (chaves.length === 1) {
    return valor[chaves[0]]
  }

  for (const chave of chaves) {
    valor = valor[chave]
  }
  return valor
};

function removerNaoLetrasNumeros(texto: string) {
  // Substitui todos os caracteres que não são letras ou números por vazio
  return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const sendMessageWhats = async (
  whatsId: number,
  msg: any,
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
) => {
  sendMessageFlow(whatsId, msg, req);
  return Promise.resolve();
};

const makeHttpRequest = async (
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body: any = null,
  queryParams: Array<{ key: string; value: string }> = [],
  timeout: number = 10000
): Promise<any> => {
  try {
    // ✅ VALIDAÇÃO INICIAL MELHORADA DE URL
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      logger.error(`[httpRequestNode] URL vazia ou indefinida. method=${method}`);
      return { error: true, message: "Empty URL", status: 400, data: null };
    }

    let processedUrl = url.trim();

    // ✅ Processar variáveis na URL
    if (global.flowVariables && processedUrl.includes("${")) {
      const regex = /\${([^}]+)}/g;
      processedUrl = processedUrl.replace(regex, (match, varName) => {
        const value = global.flowVariables[varName];
        return value !== undefined ? String(value) : match;
      });
    }

    // ✅ VALIDAÇÃO PÓS-PROCESSAMENTO: Verificar se ainda há variáveis não resolvidas
    if (processedUrl.includes("${") && processedUrl.includes("}")) {
      const unresolvedVars = processedUrl.match(/\${([^}]+)}/g);
      logger.error(`[httpRequestNode] URL contém variáveis não resolvidas: ${unresolvedVars?.join(', ')} - URL: ${processedUrl}`);
      return { error: true, message: "Unresolved variables in URL", status: 400, data: null };
    }

    // ✅ VALIDAÇÃO: Verificar se URL ficou vazia após substituição
    if (!processedUrl || processedUrl.trim().length === 0) {
      logger.error(`[httpRequestNode] URL vazia após substituição de variáveis`);
      return { error: true, message: "Empty URL after variable substitution", status: 400, data: null };
    }

    // Log de diagnóstico do httpRequest
    logger.info(`[httpRequestNode] Preparando requisição: method=${(method || '').toUpperCase()} url=${processedUrl}`);

    if (queryParams) {
      try {
        const paramsArray = Array.isArray(queryParams) ? queryParams : [];

        if (paramsArray.length > 0) {
          // Processar variáveis nos parâmetros de query
          const processedParams = paramsArray.map(param => {
            if (!param || typeof param !== "object") {
              return { key: "", value: "" };
            }

            const key = param.key || "";
            let value = param.value || "";

            if (
              global.flowVariables &&
              typeof value === "string" &&
              value.includes("${")
            ) {
              const regex = /\${([^}]+)}/g;
              value = value.replace(regex, (match, varName) => {
                const replacement = global.flowVariables[varName];

                return replacement !== undefined ? String(replacement) : match;
              });
            }

            return { key, value };
          });

          const queryString = processedParams
            .filter(param => param.key && param.value)
            .map(
              param =>
                `${encodeURIComponent(param.key)}=${encodeURIComponent(
                  param.value
                )}`
            )
            .join("&");

          if (queryString) {
            console.log(
              `[httpRequestNode] Query string gerada: ${queryString}`
            );
            processedUrl = processedUrl.includes("?")
              ? `${processedUrl}&${queryString}`
              : `${processedUrl}?${queryString}`;
          }
        }
      } catch (error) {
        logger.error(error);
      }
    }

    const processedHeaders: Record<string, string> = { ...headers };
    if (global.flowVariables) {
      Object.keys(processedHeaders).forEach(key => {
        if (processedHeaders[key] && processedHeaders[key].includes("${")) {
          const regex = /\${([^}]+)}/g;
          processedHeaders[key] = processedHeaders[key].replace(
            regex,
            (match, varName) => {
              return global.flowVariables[varName] !== undefined
                ? global.flowVariables[varName]
                : match;
            }
          );
        }
      });
    }

    let processedBody = body;
    try {
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(
          method?.toUpperCase() || ""
        ) &&
        body
      ) {
        if (typeof body === "string") {
          if (global.flowVariables && body.includes("${")) {
            const regex = /\${([^}]+)}/g;
            processedBody = body.replace(regex, (match, varName) => {
              const value = global.flowVariables[varName];

              if (value !== undefined) {
                if (typeof value === "string") {
                  return value;
                } else {
                  return JSON.stringify(value);
                }
              }
              return match;
            });
          }

          if (
            processedBody &&
            typeof processedBody === "string" &&
            (processedBody.trim().startsWith("{") ||
              processedBody.trim().startsWith("["))
          ) {
            try {
              processedBody = JSON.parse(processedBody);
            } catch (e) { }
          }
        } else if (
          typeof body === "object" &&
          body !== null &&
          global.flowVariables
        ) {
          const processObject = (obj: any): any => {
            if (obj === null || typeof obj !== "object") {
              return obj;
            }

            if (Array.isArray(obj)) {
              return obj.map(item => processObject(item));
            }

            const result: any = {};
            Object.keys(obj).forEach(key => {
              if (typeof obj[key] === "string" && obj[key].includes("${")) {
                const regex = /\${([^}]+)}/g;
                result[key] = obj[key].replace(regex, (match, varName) => {
                  const value = global.flowVariables[varName];

                  return value !== undefined
                    ? typeof value === "object"
                      ? JSON.stringify(value)
                      : value
                    : match;
                });
              } else if (typeof obj[key] === "object") {
                result[key] = processObject(obj[key]);
              } else {
                result[key] = obj[key];
              }
            });
            return result;
          };

          processedBody = processObject(body);
        }
      }
    } catch (error) {
      logger.error(error);

      processedBody = body;
    }

    // Validação final da URL para evitar exception do axios/new URL
    try {
      // new URL lança se inválida
      // Aceitar apenas http/https
      const u = new URL(processedUrl);
      if (!/^https?:$/.test(u.protocol)) {
        logger.error(`[httpRequestNode] Protocolo não suportado em URL: ${processedUrl}`);
        return { error: true, message: "Unsupported protocol", status: 400 };
      }
    } catch (e) {
      logger.error(`[httpRequestNode] URL inválida: ${processedUrl}`);
      return { error: true, message: "Invalid URL", status: 400 };
    }

    const httpsAgent = new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === "production"
    });

    const limitedTimeout = Math.min(Math.max(1000, timeout), 45000);

    const config: any = {
      url: processedUrl,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...processedHeaders
      },
      httpsAgent,
      timeout: limitedTimeout
    };

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) &&
      processedBody
    ) {
      config.data =
        typeof processedBody === "string"
          ? processedBody
          : JSON.stringify(processedBody);
    }

    const response = await axios(config);

    return {
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  } catch (error) {
    logger.error(
      `Erro na requisição HTTP (${method} ${url}): ${error.message}`
    );

    if (error.response) {
      logger.error(`Resposta de erro com status ${error.response.status}`);
      return {
        data: error.response.data,
        status: error.response.status,
        headers: error.response.headers,
        error: true
      };
    }

    logger.error(`Erro sem resposta do servidor: ${error}`);
    return {
      error: true,
      message: error.message,
      status: 500
    };
  }
};

export const getFlowVariable = (name: string): any => {
  if (!global.flowVariables) {
    global.flowVariables = {};
    return undefined;
  }

  const value = global.flowVariables[name];

  return value;
};

export const setFlowVariable = (name: string, value: any): any => {
  if (!global.flowVariables) {
    global.flowVariables = {};
  }

  global.flowVariables[name] = value;

  const savedValue = global.flowVariables[name];
  if (savedValue !== value && typeof value !== "object") {
  }

  return value;
};

const intervalWhats = (time: string) => {
  const seconds = parseInt(time) * 1000;
  return new Promise(resolve => setTimeout(resolve, seconds));
};

const replaceMessages = (
  message: string,
  details: any,
  dataWebhook: any,
  dataNoWebhook?: DataNoWebhook,
  ticketId?: number
) => {
  if (!message) return "";

  try {
    global.flowVariables = global.flowVariables || {};

    const regexNewFormat = /\$\{([^}]+)\}/g;
    let processedMessage = message.replace(regexNewFormat, (match, varName) => {
      let varValue = global.flowVariables[varName];

      // Se temos um ticketId, verificar primeiro a variável específica do ticket
      if (ticketId) {
        const ticketSpecificVar = `${ticketId}_${varName}`;
        const ticketSpecificValue = global.flowVariables[ticketSpecificVar];
        if (ticketSpecificValue !== undefined && ticketSpecificValue !== null) {
          varValue = ticketSpecificValue;
        }
      }

      if (varValue !== undefined) {
        return typeof varValue === "object"
          ? JSON.stringify(varValue)
          : String(varValue);
      }

      return match;
    });

    const matches = processedMessage.match(/\{([^}]+)\}/g);

    if (dataWebhook && dataNoWebhook) {
      let newTxt = processedMessage;
      if (dataNoWebhook.nome) {
        newTxt = newTxt.replace(/{+nome}+/g, dataNoWebhook.nome);
      }
      if (dataNoWebhook.numero) {
        newTxt = newTxt.replace(/{+numero}+/g, dataNoWebhook.numero);
      }
      if (dataNoWebhook.email) {
        newTxt = newTxt.replace(/{+email}+/g, dataNoWebhook.email);
      }

      return newTxt;
    }

    if (matches && matches.includes("inputs")) {
      const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
      let newText = processedMessage;
      placeholders.map(item => {
        const value = details["inputs"].find(
          itemLocal => itemLocal.keyValue === item
        );
        if (value) {
          const lineToData = details["keysFull"].find(itemLocal =>
            itemLocal.endsWith(`.${value.data}`)
          );
          if (lineToData) {
            const createFieldJson = constructJsonLine(lineToData, dataWebhook);
            newText = newText.replace(`{${item}}`, createFieldJson);
          }
        }
      });
      return newText;
    } else {
      return processedMessage;
    }
  } catch (error) {
    logger.error(`Erro ao processar variáveis: ${error}`);
    return message;
  }
};

export { finalizeTriggeredFlow };
