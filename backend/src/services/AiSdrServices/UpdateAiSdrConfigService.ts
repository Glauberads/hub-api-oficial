import ShowAiSdrConfigService from "./ShowAiSdrConfigService";
import AiSdrConfig from "../../models/AiSdrConfig";

interface Request {
  id: number;
  companyId: number;
  data: Partial<AiSdrConfig>;
}

const allowedFields = [
  "name",
  "enabled",
  "whatsappId",
  "queueId",
  "userId",
  "model",
  "temperature",
  "systemPrompt",
  "welcomeMessage",
  "qualificationQuestions",
  "handoffRules",
  "tags",
  "autoCreateOpportunity",
  "autoTransferQueue",
  "onlyPendingTickets",
  "maxInteractions",
  "isActive"
];

const UpdateAiSdrConfigService = async ({
  id,
  companyId,
  data
}: Request): Promise<AiSdrConfig> => {
  const config = await ShowAiSdrConfigService({ id, companyId });

  const payload: any = {};

  allowedFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = (data as any)[field];
    }
  });

  await config.update(payload);

  return ShowAiSdrConfigService({ id, companyId });
};

export default UpdateAiSdrConfigService;
