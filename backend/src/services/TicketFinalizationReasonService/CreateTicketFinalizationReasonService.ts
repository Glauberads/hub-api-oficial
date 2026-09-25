import * as Yup from "yup";
import AppError from "../../errors/AppError";
import TicketFinalizationReason from "../../models/TicketFinalizationReason";
import { Op } from "sequelize";

interface Request {
  name: string;
  description?: string;
  companyId: number;
}

const CreateTicketFinalizationReasonService = async ({
  name,
  description,
  companyId
}: Request): Promise<TicketFinalizationReason> => {
  const normalizedName = String(name || "").trim();
  const normalizedDescription = description?.trim() || null;
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    description: Yup.string().optional(),
    companyId: Yup.number().required()
  });

  try {
    await schema.validate({ name: normalizedName, description: normalizedDescription, companyId });
  } catch (err) {
    throw new AppError(err.message);
  }

  const reasonExists = await TicketFinalizationReason.findOne({
    where: {
      companyId,
      name: { [Op.iLike]: normalizedName }
    }
  });

  if (reasonExists) {
    throw new AppError("ERR_DUPLICATED_FINALIZATION_REASON");
  }

  const reason = await TicketFinalizationReason.create({
    name: normalizedName,
    description: normalizedDescription,
    companyId
  });

  return reason;
};

export default CreateTicketFinalizationReasonService;
