import LandingWebhookConfig from "../../models/LandingWebhookConfig";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number;
  searchParam?: string;
}

const ListLandingWebhookConfigService = async ({
  companyId,
  searchParam = ""
}: Request): Promise<LandingWebhookConfig[]> => {
  const whereCondition: any = {
    companyId
  };

  if (searchParam) {
    whereCondition.name = {
      $iLike: `%${searchParam}%`
    };
  }

  const landingWebhookConfigs = await LandingWebhookConfig.findAll({
    where: whereCondition,
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
    ],
    order: [["createdAt", "DESC"]]
  });

  return landingWebhookConfigs;
};

export default ListLandingWebhookConfigService;