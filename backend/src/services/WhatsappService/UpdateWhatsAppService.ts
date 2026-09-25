import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import ShowWhatsAppService, { invalidateWhatsAppCache } from "./ShowWhatsAppService";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  queueIds?: number[];
  token?: string;
  maxUseBotQueues?: number;
  timeUseBotQueues?: string;
  expiresTicket?: string;
  allowGroup?: boolean;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
  ratingMessage?: string;
  maxUseBotQueuesNPS?: number;
  expiresTicketNPS?: number;
  whenExpiresTicket?: string;
  expiresInactiveMessage?: string;
  groupAsTicket?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  timeCreateNewTicket?: number;
  integrationId?: number;
  integrationTypeId?: number;
  schedules?: any[];
  promptId?: number;
  requestQR?: boolean;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
  phone_number_id?: string;
  waba_id?: string;
  send_token?: string;
  business_id?: string;
  phone_number?: string;
  flowIdNotPhrase?: number;
  flowIdWelcome?: number;
  flowIdInactiveTime?: number;
  flowInactiveTime?: number;
  maxUseInactiveTime?: number;
  color?: string;
  timeToReturnQueue?: number;
  timeAwaitActiveFlowId?: number;
  timeAwaitActiveFlow?: number;
  triggerIntegrationOnClose?: boolean;
  importHistory?: boolean;
  importDays?: number;
  wavoip?: string;
  receiveComments?: boolean;
}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
  companyId: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const normalizeNullableInteger = (
  value: unknown,
  fieldName: string
): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized)) {
    throw new AppError(`Valor inválido para ${fieldName}`);
  }

  return normalized;
};

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean()
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds = [],
    token,
    maxUseBotQueues = 0,
    timeUseBotQueues = 0,
    expiresTicket = 0,
    allowGroup,
    timeSendQueue = 0,
    sendIdQueue = null,
    timeInactiveMessage = 0,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS = 0,
    whenExpiresTicket,
    expiresInactiveMessage,
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket = null,
    integrationId,
    integrationTypeId,
    schedules,
    promptId,
    requestQR = false,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    flowIdNotPhrase,
    flowIdWelcome,
    flowIdInactiveTime,
    flowInactiveTime,
    maxUseInactiveTime,
    color,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    timeToReturnQueue = 0,
    timeAwaitActiveFlowId,
    timeAwaitActiveFlow = 0,
    triggerIntegrationOnClose,
    importHistory,
    importDays,
    wavoip,
    receiveComments
  } = whatsappData;

  try {
    await schema.validate({ name, status, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: {
        isDefault: true,
        id: { [Op.not]: whatsappId },
        companyId
      }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }
  // console.log("GETTING WHATSAPP SHOW WHATSAPP 1", whatsappId, companyId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  const normalizedSendIdQueue = normalizeNullableInteger(sendIdQueue, "sendIdQueue");
  const normalizedMaxUseBotQueuesNPS = normalizeNullableInteger(maxUseBotQueuesNPS, "maxUseBotQueuesNPS");
  const normalizedExpiresTicketNPS = normalizeNullableInteger(expiresTicketNPS, "expiresTicketNPS");
  const normalizedTimeCreateNewTicket = normalizeNullableInteger(timeCreateNewTicket, "timeCreateNewTicket");
  const normalizedIntegrationId = normalizeNullableInteger(integrationId, "integrationId");
  const normalizedIntegrationTypeId = normalizeNullableInteger(integrationTypeId, "integrationTypeId");
  const normalizedPromptId = normalizeNullableInteger(promptId, "promptId");
  const normalizedQueueIdImportMessages = normalizeNullableInteger(queueIdImportMessages, "queueIdImportMessages");
  const normalizedFlowIdNotPhrase = normalizeNullableInteger(flowIdNotPhrase, "flowIdNotPhrase");
  const normalizedFlowIdWelcome = normalizeNullableInteger(flowIdWelcome, "flowIdWelcome");
  const normalizedFlowIdInactiveTime = normalizeNullableInteger(flowIdInactiveTime, "flowIdInactiveTime");
  const normalizedFlowInactiveTime = normalizeNullableInteger(flowInactiveTime, "flowInactiveTime");
  const normalizedMaxUseInactiveTime = normalizeNullableInteger(maxUseInactiveTime, "maxUseInactiveTime");
  const normalizedTimeAwaitActiveFlowId = normalizeNullableInteger(timeAwaitActiveFlowId, "timeAwaitActiveFlowId");
  const normalizedImportDays = normalizeNullableInteger(importDays, "importDays");

  // DEBUG - Log dos dados antes da atualização
  console.log(`[WHATSAPP-SERVICE] Atualizando conexão ${whatsappId} com:`, {
    flowIdNotPhrase: normalizedFlowIdNotPhrase,
    flowIdWelcome: normalizedFlowIdWelcome,
    flowIdInactiveTime: normalizedFlowIdInactiveTime,
    integrationId: normalizedIntegrationId
  });

  await whatsapp.update({
    name,
    status,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    isDefault,
    companyId,
    token,
    maxUseBotQueues: maxUseBotQueues || 0,
    timeUseBotQueues: timeUseBotQueues || 0,
    expiresTicket: expiresTicket || 0,
    allowGroup,
    timeSendQueue,
    sendIdQueue: normalizedSendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS: normalizedMaxUseBotQueuesNPS,
    expiresTicketNPS: normalizedExpiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    groupAsTicket,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    timeCreateNewTicket: normalizedTimeCreateNewTicket,
    integrationId: normalizedIntegrationId,
    integrationTypeId: normalizedIntegrationTypeId,
    schedules,
    promptId: normalizedPromptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages: normalizedQueueIdImportMessages,
    flowIdNotPhrase: normalizedFlowIdNotPhrase,
    flowIdWelcome: normalizedFlowIdWelcome,
    flowIdInactiveTime: normalizedFlowIdInactiveTime,
    flowInactiveTime: normalizedFlowInactiveTime,
    maxUseInactiveTime: normalizedMaxUseInactiveTime,
    color,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    timeToReturnQueue,
    timeAwaitActiveFlowId: normalizedTimeAwaitActiveFlowId,
    timeAwaitActiveFlow,
    triggerIntegrationOnClose,
    importHistory,
    importDays: normalizedImportDays,
    wavoip,
    receiveComments
  });

  if (!requestQR) {
    await AssociateWhatsappQueue(whatsapp, queueIds);
  }

  // ✅ Invalidar cache após atualização
  invalidateWhatsAppCache(whatsappId, companyId);

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;