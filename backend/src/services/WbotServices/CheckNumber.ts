// WASocket type disponível via Session
import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { Session } from "../../libs/wbot";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import Contact from "../../models/Contact";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
  lid: string;
}

const toJid = (num: string) =>
  num.includes("@") ? num : `${num}@s.whatsapp.net`;

const checker = async (number: string, wbot: Session, companyId?: number): Promise<IOnWhatsapp> => {
  // ✅ v7: Consultar WhatsappLidMap localmente antes de chamar onWhatsApp
  if (companyId) {
    const cleanNumber = number.includes("@") ? number.split("@")[0] : number;
    const contact = await Contact.findOne({ where: { number: cleanNumber, companyId } });
    if (contact) {
      const localMap = await WhatsappLidMap.findOne({
        where: { companyId, contactId: contact.id }
      });
      if (localMap) {
        logger.debug(`[CheckNumber] Contato ${cleanNumber} validado localmente via WhatsappLidMap`);
        return {
          jid: toJid(cleanNumber),
          exists: true,
          lid: localMap.lid
        };
      }
    }
  }

  // Fallback: consultar onWhatsApp
  const result = await wbot.onWhatsApp(toJid(number));

  if (!result) {
    logger.error({ number }, "Failed to check number on whatsapp");
    throw new AppError("ERR_INVALID_NUMBER", 400);
  }

  if (!result?.[0]?.exists) {
    throw new AppError("ERR_CHECK_NUMBER", 404);
  }

  const lid = (result[0] as any)?.lid ?? null;

  return {
    jid: result[0]?.jid,
    exists: true,
    lid
  };
};

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false,
  userId?: number,
  whatsapp?: Whatsapp | null
): Promise<IOnWhatsapp> => {
  const whatsappList =
    whatsapp || (await GetDefaultWhatsApp(companyId, userId));

  const wbot = getWbot(whatsappList.id);

  if (isGroup) {
    const meta = await wbot.groupMetadata(number);
    return { jid: meta.id, exists: true, lid: null };
  }

  if (whatsappList.channel === "whatsapp_oficial") {
    return { jid: toJid(number), exists: true, lid: null };
  }

  return checker(number, wbot, companyId);
};

export default CheckContactNumber;
