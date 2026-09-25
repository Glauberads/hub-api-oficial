import { randomBytes } from "crypto";

import AppError from "../../errors/AppError";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";

interface Request {
  companyId: number;
  name: string;
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

const generateToken = (): string => {
  return randomBytes(24).toString("hex");
};

const generateUniqueToken = async (): Promise<string> => {
  let token = generateToken();
  let exists = await LandingWebhookConfig.findOne({
    where: { token }
  });

  while (exists) {
    token = generateToken();
    exists = await LandingWebhookConfig.findOne({
      where: { token }
    });
  }

  return token;
};

const CreateLandingWebhookConfigService = async ({
  companyId,
  name,
  whatsappId = null,
  queueId = null,
  userId = null,
  flowId = null,
  tags = [],
  welcomeMessage = null,
  autoSendMessage = false,
  autoStartFlow = false,
  isActive = true
}: Request): Promise<LandingWebhookConfig> => {
  if (!companyId) {
    throw new AppError("Empresa não informada.", 400);
  }

  if (!name || !name.trim()) {
    throw new AppError("Nome da integração é obrigatório.", 400);
  }

  const token = await generateUniqueToken();

  const landingWebhookConfig = await LandingWebhookConfig.create({
    companyId,
    name: name.trim(),
    token,
    whatsappId,
    queueId,
    userId,
    flowId,
    tags,
    welcomeMessage,
    autoSendMessage,
    autoStartFlow,
    isActive
  });

  return landingWebhookConfig;
};

export default CreateLandingWebhookConfigService;