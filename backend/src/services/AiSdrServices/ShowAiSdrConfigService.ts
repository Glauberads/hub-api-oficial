import AppError from "../../errors/AppError";
import AiSdrConfig from "../../models/AiSdrConfig";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  id: number;
  companyId: number;
}

const ShowAiSdrConfigService = async ({ id, companyId }: Request): Promise<AiSdrConfig> => {
  const config = await AiSdrConfig.findOne({
    where: { id, companyId },
    include: [
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "channel"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: User, as: "user", attributes: ["id", "name", "email"] }
    ]
  });

  if (!config) {
    throw new AppError("Configuração do Agente IA Comercial não encontrada.", 404);
  }

  return config;
};

export default ShowAiSdrConfigService;
