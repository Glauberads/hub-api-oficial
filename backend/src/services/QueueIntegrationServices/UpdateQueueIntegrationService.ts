import * as Yup from "yup";

import AppError from "../../errors/AppError";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowIntegrationService from "./ShowQueueIntegrationService";

interface IntegrationData {
  type?: string;
  name?: string;
  projectName?: string;
  jsonContent?: string;
  language?: string;
  urlN8N?: string;
  typebotSlug?: string;
  typebotExpires?: number;
  typebotKeywordFinish?: string;
  typebotUnknownMessage?: string;
  typebotDelayMessage?: number;
  typebotKeywordRestart?: string;
  typebotRestartMessage?: string;
  enableTransfer?: boolean;
  transferQueueId?: number;
  transferUserId?: number;
  queueIdAssign?: number;
  whatsappId?: number;
  userIdAssign?: number;
  enableCloseTicket?: boolean;
  closeTicketMessage?: string;
  enableOpenTicket?: boolean;
  openTicketQueueId?: number;
  openTicketUserId?: number;
  openTicketMessage?: string;
}

interface Request {
  integrationData: IntegrationData;
  integrationId: string;
  companyId: number;
}

const UpdateQueueIntegrationService = async ({
  integrationData,
  integrationId,
  companyId
}: Request): Promise<QueueIntegrations> => {
  const schema = Yup.object().shape({
    type: Yup.string().min(2),
    name: Yup.string().min(2)
  });

  const {
    type,
    name,
    projectName,
    jsonContent,
    language,
    urlN8N,
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage,
    enableTransfer,
    transferQueueId,
    transferUserId,
    queueIdAssign,
    whatsappId,
    userIdAssign,
    enableCloseTicket,
    closeTicketMessage,
    enableOpenTicket,
    openTicketQueueId,
    openTicketUserId,
    openTicketMessage
  } = integrationData;

  try {
    await schema.validate({ type, name, projectName, jsonContent, language, urlN8N });
  } catch (err) {
    throw new AppError(err.message);
  }

  const integration = await ShowIntegrationService(integrationId, companyId);

  await integration.update({
    type,
    name,
    projectName,
    jsonContent,
    language,
    urlN8N,
    companyId,
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage,
    enableTransfer,
    transferQueueId,
    transferUserId,
    queueIdAssign,
    whatsappId,
    userIdAssign,
    enableCloseTicket,
    closeTicketMessage,
    enableOpenTicket,
    openTicketQueueId,
    openTicketUserId,
    openTicketMessage
  });

  return integration;
};

export default UpdateQueueIntegrationService;