import * as Yup from "yup";

import AppError from "../../errors/AppError";
import QueueIntegrations from "../../models/QueueIntegrations";


interface Request {
  type: string;
  name: string;
  projectName: string;
  jsonContent: string;
  language: string;
  urlN8N?: string;
  companyId: number;
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

const CreateQueueIntegrationService = async ({
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
}: Request): Promise<QueueIntegrations> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "This integration name is already used.",
        async value => {
          if (!value) return false;
          const nameExists = await QueueIntegrations.findOne({
            where: { name: value, companyId }
          });
          return !nameExists;
        }
      )
  });

  try {
    await schema.validate({ type, name, projectName, jsonContent, language, urlN8N, companyId });
  } catch (err) {
    throw new AppError(err.message);
  }


  const queueIntegration = await QueueIntegrations.create(
    {
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
    }
  );

  return queueIntegration;
};

export default CreateQueueIntegrationService;