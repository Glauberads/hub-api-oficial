import { WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";

const CheckIsValidContact = async (number: string, companyId: number): Promise<void> => {
  // ✅ v7: Verificar localmente via WhatsappLidMap antes de chamar onWhatsApp
  const contact = await Contact.findOne({ where: { number, companyId } });
  if (contact) {
    const localMap = await WhatsappLidMap.findOne({
      where: { companyId, contactId: contact.id }
    });
    if (localMap) {
      logger.debug(`[CheckIsValid] Contato ${number} validado localmente via WhatsappLidMap`);
      return;
    }
  }

  // Fallback: consultar onWhatsApp
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);
  const wbot = getWbot(defaultWhatsapp.id);
  try {
    const [result] = await (wbot as WASocket).onWhatsApp(
      `${number}@s.whatsapp.net`
    );
    
    if (!result || !result?.exists) {
      throw new AppError("invalidNumber");
    }
  } catch (err) {
    logger.error(`[CheckIsValid] Erro ao verificar contato ${number}: ${err.message}`);
    if (err.message === "invalidNumber") {
      throw new AppError("ERR_WAPP_INVALID_CONTACT");
    }
    throw new AppError("ERR_WAPP_CHECK_CONTACT");
  }
};

export default CheckIsValidContact;
