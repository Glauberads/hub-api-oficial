import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Plan from "../../models/Plan";

interface PlanData {
  name: string;
  users?: number;
  connections?: number;
  queues?: number;
  amount?: string;
  currency?: string;
  useWhatsapp?: boolean;
  useFacebook?: boolean;
  useInstagram?: boolean;
  useCampaigns?: boolean;
  useEmailMarketing?: boolean;
  useSchedules?: boolean;
  useInternalChat?: boolean;
  useExternalApi?: boolean;
  useKanban?: boolean;
  trial?: boolean;
  trialDays?: number;
  recurrence?: string;
  useOpenAi?: boolean;
  useIntegrations?: boolean;
  isPublic?: boolean;
  useWhatsappOfficial?: boolean;
  wavoip?: boolean;
  chipWarmup?: boolean;
}

const CreatePlanService = async (planData: PlanData): Promise<Plan> => {
  const { name } = planData;
  const currency = String(planData.currency || "BRL").toUpperCase();
  const rawAmount = String(planData.amount ?? "0").trim();
  const normalizedAmount = rawAmount.includes(",")
    ? rawAmount.replace(/\./g, "").replace(",", ".")
    : rawAmount;
  const amount = Number(normalizedAmount);

  if (!["BRL", "COP", "USD"].includes(currency)) {
    throw new AppError("ERR_PLAN_INVALID_CURRENCY", 400);
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("ERR_PLAN_INVALID_AMOUNT", 400);
  }

  const planSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_PLAN_INVALID_NAME")
      .required("ERR_PLAN_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_PLAN_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const planWithSameName = await Plan.findOne({
              where: { name: value }
            });

            return !planWithSameName;
          }
          return false;
        }
      )
  });

  try {
    await planSchema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const plan = await Plan.create({
    ...planData,
    currency,
    amount: String(amount),
    chipWarmup: planData.chipWarmup ?? false
  });

  return plan;
};

export default CreatePlanService;
