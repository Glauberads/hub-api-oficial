import AppError from "../../errors/AppError";
import Plan from "../../models/Plan";

interface PlanData {
  name: string;
  id?: number | string;
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
  useOpenAi?: boolean;
  useIntegrations?: boolean;
  isPublic?: boolean;
  useWhatsappOfficial?: boolean;
  trial?: boolean;
  trialDays?: number;
  recurrence?: string;
  wavoip?: boolean;
  chipWarmup?: boolean;
}

const UpdatePlanService = async (planData: PlanData): Promise<Plan> => {
  const { id } = planData;
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

  let plan = await Plan.findByPk(id);

  if (!plan) {
    throw new AppError("ERR_NO_PLAN_FOUND", 404);
  }

  await plan.update({
    ...planData,
    currency,
    amount: String(amount),
    chipWarmup: planData.chipWarmup ?? plan.chipWarmup
  });

  return plan;
};

export default UpdatePlanService;
