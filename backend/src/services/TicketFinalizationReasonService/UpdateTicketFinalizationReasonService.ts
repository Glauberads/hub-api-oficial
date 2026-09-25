import * as Yup from "yup";
import AppError from "../../errors/AppError";
import TicketFinalizationReason from "../../models/TicketFinalizationReason";
import { Op } from "sequelize";

interface Request {
  id: number;
  name?: string;
  description?: string;
  companyId: number;
}

const UpdateTicketFinalizationReasonService = async ({
  id,
  name,
  description,
  companyId
}: Request): Promise<TicketFinalizationReason> => {
  const normalizedName = name === undefined ? undefined : String(name).trim();
  const normalizedDescription = description === undefined
    ? undefined
    : description.trim() || null;
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    description: Yup.string().optional(),
    companyId: Yup.number().required()
  });

  try {
    await schema.validate({ name: normalizedName, description: normalizedDescription, companyId });
  } catch (err) {
    throw new AppError(err.message);
  }

  const reason = await TicketFinalizationReason.findOne({
    where: { id, companyId }
  });

  if (!reason) {
    throw new AppError("ERR_FINALIZATION_REASON_NOT_FOUND", 404);
  }

  if (normalizedName && normalizedName.toLowerCase() !== reason.name.toLowerCase()) {
    const reasonExists = await TicketFinalizationReason.findOne({
      where: {
        companyId,
        name: { [Op.iLike]: normalizedName },
        id: { [Op.ne]: id }
      }
    });

    if (reasonExists) {
      throw new AppError("ERR_DUPLICATED_FINALIZATION_REASON");
    }
  }

  await reason.update({
    name: normalizedName || reason.name,
    description: normalizedDescription !== undefined ? normalizedDescription : reason.description
  });

  return reason;
};

export default UpdateTicketFinalizationReasonService;
