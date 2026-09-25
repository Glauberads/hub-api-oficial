import AppError from "../../errors/AppError";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  id: number | string;
  companyId: number;
}

const ShowLandingWebhookConfigService = async ({
  id,
  companyId
}: Request): Promise<LandingWebhookConfig> => {
  const landingWebhookConfig = await LandingWebhookConfig.findOne({
    where: {
      id,
      companyId
    },
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "status"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "email"]
      }
    ]
  });

  if (!landingWebhookConfig) {
    throw new AppError("Integração de Landing Page não encontrada.", 404);
  }

  return landingWebhookConfig;
};

export default ShowLandingWebhookConfigService;