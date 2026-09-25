import AppError from "../../../errors/AppError";
import OfficialOnboardingLog from "../../../models/OfficialOnboardingLog";
import Whatsapp from "../../../models/Whatsapp";

interface Request {
  companyId: number;
  whatsappId: number;
  limit?: number;
}

const ListOfficialOnboardingLogsService = async ({
  companyId,
  whatsappId,
  limit = 100
}: Request): Promise<OfficialOnboardingLog[]> => {
  if (!companyId) {
    throw new AppError("Empresa não identificada.", 401);
  }

  if (!whatsappId) {
    throw new AppError("Conexão não identificada.", 400);
  }

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada.", 404);
  }

  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 200) : 100;

  const logs = await OfficialOnboardingLog.findAll({
    where: {
      companyId,
      whatsappId
    },
    order: [["createdAt", "DESC"]],
    limit: safeLimit
  });

  return logs;
};

export default ListOfficialOnboardingLogsService;