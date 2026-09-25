import * as Yup from "yup";
import AppError from "../../errors/AppError";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";

interface Data {
  name: string;
  number: string;
  username?: string;
  contactListId: number;
  companyId: number;
  email?: string;
}

const CreateService = async (data: Data): Promise<ContactListItem> => {
  const { name } = data;

  const contactListItemSchema = Yup.object().shape({
    name: Yup.string()
      .min(3, "ERR_CONTACTLISTITEM_INVALID_NAME")
      .required("ERR_CONTACTLISTITEM_REQUIRED")
  });

  try {
    await contactListItemSchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const [record, created] = await ContactListItem.findOrCreate({
    where: {
      number: data.number,
      companyId: data.companyId,
      contactListId: data.contactListId
    },
    defaults: {
      ...data,
      username: data.username || "",
      email: data.email || ""
    }
  });

  if (!created) {
    let changed = false;

    if (data.name && record.name !== data.name) {
      record.name = data.name;
      changed = true;
    }

    if ((data.username || "") !== (record.username || "")) {
      record.username = data.username || "";
      changed = true;
    }

    if ((data.email || "") !== (record.email || "")) {
      record.email = data.email || "";
      changed = true;
    }

    if (changed) {
      await record.save();
    }
  }

  try {
    const response: any = await CheckContactNumber(record.number, record.companyId);
    record.isWhatsappValid = !!response;
    if (response?.jid) {
      const number = response.jid.split("@")[0];
      record.number = number;
    }
    await record.save();
  } catch (e) {
    logger.error(`Número de contato inválido: ${record.number}`);
  }

  return record;
};

export default CreateService;