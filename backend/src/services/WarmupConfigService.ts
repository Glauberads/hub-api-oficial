import WarmupConfig from "../models/WarmupConfig";
import Company from "../models/Company";
import Plan from "../models/Plan";
import AppError from "../errors/AppError";

const checkCompanyWarmupPlan = async (companyId: number): Promise<void> => {
  const company = await Company.findByPk(companyId, {
    include: [
      {
        model: Plan
      }
    ]
  });

  if (!company) {
    throw new AppError("ERR_COMPANY_NOT_FOUND", 404);
  }

  const plan = (company as any).plan || (company as any).Plan;

  if (!plan || !plan.chipWarmup) {
    throw new AppError("ERR_CHIP_WARMUP_NOT_AVAILABLE_IN_PLAN", 403);
  }
};

export const getWarmupConfig = async (companyId: number) => {
  await checkCompanyWarmupPlan(companyId);

  let config = await WarmupConfig.findOne({
    where: { companyId }
  });

  if (!config) {
    config = await WarmupConfig.create({
      companyId,
      minDelay: 30000,
      maxDelay: 120000,
      messagesPerCycle: 1,
      prompt: "",
      isActive: false
    });
  }

  return config;
};

export const updateWarmupConfig = async (companyId: number, data: any) => {
  await checkCompanyWarmupPlan(companyId);

  const config = await getWarmupConfig(companyId);

  await config.update({
    minDelay: Number(data.minDelay),
    maxDelay: Number(data.maxDelay),
    messagesPerCycle: Number(data.messagesPerCycle) || 1,
    prompt: data.prompt || ""
  });

  return config;
};