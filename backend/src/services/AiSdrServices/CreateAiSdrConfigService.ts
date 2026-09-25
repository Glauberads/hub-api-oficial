import AiSdrConfig from "../../models/AiSdrConfig";

interface Request {
  companyId: number;
  name?: string;
  enabled?: boolean;
  whatsappId?: number | null;
  queueId?: number | null;
  userId?: number | null;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  welcomeMessage?: string;
  qualificationQuestions?: any[];
  handoffRules?: any;
  tags?: any[];
  autoCreateOpportunity?: boolean;
  autoTransferQueue?: boolean;
  onlyPendingTickets?: boolean;
  maxInteractions?: number;
  isActive?: boolean;
}

const defaultQuestions = [
  {
    key: "interest",
    label: "Qual produto ou serviço você procura?",
    required: true
  },
  {
    key: "city",
    label: "Qual sua cidade?",
    required: false
  },
  {
    key: "budget",
    label: "Você tem um orçamento aproximado?",
    required: false
  }
];

const CreateAiSdrConfigService = async ({
  companyId,
  name = "Agente IA Comercial",
  enabled = false,
  whatsappId = null,
  queueId = null,
  userId = null,
  model = "gpt-4o-mini",
  temperature = 0.3,
  systemPrompt,
  welcomeMessage,
  qualificationQuestions = defaultQuestions,
  handoffRules = {},
  tags = [],
  autoCreateOpportunity = true,
  autoTransferQueue = true,
  onlyPendingTickets = true,
  maxInteractions = 8,
  isActive = true
}: Request): Promise<AiSdrConfig> => {
  const config = await AiSdrConfig.create({
    companyId,
    name,
    enabled,
    whatsappId,
    queueId,
    userId,
    model,
    temperature,
    systemPrompt,
    welcomeMessage,
    qualificationQuestions,
    handoffRules,
    tags,
    autoCreateOpportunity,
    autoTransferQueue,
    onlyPendingTickets,
    maxInteractions,
    isActive
  });

  return config;
};

export default CreateAiSdrConfigService;
