import OfficialOnboardingLog from "../../../models/OfficialOnboardingLog";

interface Request {
  companyId: number;
  whatsappId?: number | null;
  step: string;
  status?: string;
  message?: string;
  error?: string;
  payload?: any;
}

const CreateOfficialOnboardingLogService = async ({
  companyId,
  whatsappId = null,
  step,
  status = "info",
  message = "",
  error = "",
  payload = null
}: Request): Promise<OfficialOnboardingLog> => {
  const log = await OfficialOnboardingLog.create({
    companyId,
    whatsappId,
    step,
    status,
    message,
    error,
    payload
  });

  return log;
};

export default CreateOfficialOnboardingLogService;