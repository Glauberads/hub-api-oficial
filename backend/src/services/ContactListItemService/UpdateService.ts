import AppError from "../../errors/AppError";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";

interface Data {
  id: number | string;
  name: string;
  number: string;
  username?: string;
  email?: string;
}

const UpdateService = async (data: Data): Promise<ContactListItem> => {
  const { id, name, number, username, email } = data;

  const record = await ContactListItem.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLISTITEM_FOUND", 404);
  }

  await record.update({
    name,
    number,
    username: username || "",
    email: email || ""
  });

  try {
    const response: any = await CheckContactNumber(record.number, record.companyId);
    record.isWhatsappValid = !!response;

    if (response?.jid) {
      const normalizedNumber = response.jid.split("@")[0];
      record.number = normalizedNumber;
    }

    await record.save();
  } catch (e) {
    logger.error(`Número de contato inválido: ${record.number}`);
  }

  return record;
};

export default UpdateService;