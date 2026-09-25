import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";

interface Request {
  id: string | number;
  status: boolean;
}

const ToggleCompanyStatusService = async ({ id, status }: Request): Promise<Company> => {
  const company = await Company.findByPk(id);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  await company.update({ status });

  // Se estiver bloqueando, desconectar WhatsApps imediatamente
  if (status === false) {
    logger.info(`ADMIN: Empresa ${id} foi BLOQUEADA manualmente.`);

    try {
      const whatsapps = await Whatsapp.findAll({
        where: { companyId: id },
        attributes: ["id", "status", "session"]
      });

      for (const whatsapp of whatsapps) {
        if (whatsapp.session) {
          await whatsapp.update({
            status: "DISCONNECTED",
            session: ""
          });

          try {
            const wbot = getWbot(whatsapp.id);
            await wbot.logout();
            logger.info(`ADMIN: WhatsApp ${whatsapp.id} da empresa ${id} desconectado.`);
          } catch (wbotError) {
            logger.warn(`Erro ao desconectar WhatsApp ${whatsapp.id}: ${wbotError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Erro ao desconectar WhatsApps da empresa ${id}: ${error.message}`);
    }
  } else {
    logger.info(`ADMIN: Empresa ${id} foi DESBLOQUEADA manualmente.`);
  }

  await company.reload();
  return company;
};

export default ToggleCompanyStatusService;
