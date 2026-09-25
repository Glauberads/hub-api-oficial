import AppError from "../../errors/AppError";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";

interface Request {
  id: number | string;
  companyId: number;
}

const DeleteLandingWebhookConfigService = async ({
  id,
  companyId
}: Request): Promise<void> => {
  const landingWebhookConfig = await LandingWebhookConfig.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!landingWebhookConfig) {
    throw new AppError("Integração de Landing Page não encontrada.", 404);
  }

  await landingWebhookConfig.destroy();
};

export default DeleteLandingWebhookConfigService;