import AppError from "../../errors/AppError";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";

interface Request {
  id: number | string;
  companyId: number;
  name?: string;
  whatsappId?: number | null;
  queueId?: number | null;
  userId?: number | null;
  flowId?: number | null;
  tags?: any[];
  welcomeMessage?: string | null;
  autoSendMessage?: boolean;
  autoStartFlow?: boolean;
  isActive?: boolean;
}

const UpdateLandingWebhookConfigService = async ({
  id,
  companyId,
  name,
  whatsappId,
  queueId,
  userId,
  flowId,
  tags,
  welcomeMessage,
  autoSendMessage,
  autoStartFlow,
  isActive
}: Request): Promise<LandingWebhookConfig> => {
  const landingWebhookConfig = await LandingWebhookConfig.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!landingWebhookConfig) {
    throw new AppError("Integração de Landing Page não encontrada.", 404);
  }

  if (name !== undefined && !name.trim()) {
    throw new AppError("Nome da integração é obrigatório.", 400);
  }

  await landingWebhookConfig.update({
    name: name !== undefined ? name.trim() : landingWebhookConfig.name,
    whatsappId:
      whatsappId !== undefined ? whatsappId : landingWebhookConfig.whatsappId,
    queueId: queueId !== undefined ? queueId : landingWebhookConfig.queueId,
    userId: userId !== undefined ? userId : landingWebhookConfig.userId,
    flowId: flowId !== undefined ? flowId : landingWebhookConfig.flowId,
    tags: tags !== undefined ? tags : landingWebhookConfig.tags,
    welcomeMessage:
      welcomeMessage !== undefined
        ? welcomeMessage
        : landingWebhookConfig.welcomeMessage,
    autoSendMessage:
      autoSendMessage !== undefined
        ? autoSendMessage
        : landingWebhookConfig.autoSendMessage,
    autoStartFlow:
      autoStartFlow !== undefined
        ? autoStartFlow
        : landingWebhookConfig.autoStartFlow,
    isActive:
      isActive !== undefined ? isActive : landingWebhookConfig.isActive
  });

  await landingWebhookConfig.reload();

  return landingWebhookConfig;
};

export default UpdateLandingWebhookConfigService;