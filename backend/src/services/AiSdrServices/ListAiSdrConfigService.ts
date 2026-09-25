import AiSdrConfig from "../../models/AiSdrConfig";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  companyId: number;
}

const ListAiSdrConfigService = async ({ companyId }: Request): Promise<AiSdrConfig[]> => {
  const configs = await AiSdrConfig.findAll({
    where: { companyId },
    include: [
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "channel"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: User, as: "user", attributes: ["id", "name", "email"] }
    ],
    order: [["id", "DESC"]]
  });

  return configs;
};

export default ListAiSdrConfigService;
