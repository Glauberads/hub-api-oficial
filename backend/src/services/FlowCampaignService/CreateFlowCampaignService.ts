import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel, PhraseCondition } from "../../models/FlowCampaign";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

interface Request {
  userId: number;
  name: string;
  companyId: number;
  flowId: number;
  phrases: PhraseCondition[];
  whatsappIds: number[];
  tagIds?: number[];
  status: boolean;
}

const CreateFlowCampaignService = async ({
  userId,
  name,
  companyId,
  phrases,
  whatsappIds,
  tagIds,
  flowId,
  status
}: Request): Promise<FlowCampaignModel> => {
  try {
    if (!name?.trim()) {
      throw new AppError("Nome da campanha é obrigatório", 400);
    }

    if (!flowId || isNaN(Number(flowId))) {
      throw new AppError("Fluxo é obrigatório e deve ser um ID válido", 400);
    }

    if (!phrases || !Array.isArray(phrases) || phrases.length === 0) {
      throw new AppError("Pelo menos uma frase é obrigatória", 400);
    }

    if (!whatsappIds || !Array.isArray(whatsappIds) || whatsappIds.length === 0) {
      throw new AppError("Pelo menos uma conexão WhatsApp deve ser selecionada", 400);
    }

    const normalizedWhatsappIds = [
      ...new Set(
        whatsappIds
          .map(id => Number(id))
          .filter(id => Number.isInteger(id) && id > 0)
      )
    ];

    if (normalizedWhatsappIds.length === 0) {
      throw new AppError("Pelo menos uma conexão WhatsApp válida deve ser selecionada", 400);
    }

    const validPhrases = phrases.filter(phrase => phrase?.text?.trim());

    if (validPhrases.length === 0) {
      throw new AppError("Pelo menos uma frase deve ter conteúdo", 400);
    }

    const flowExists = await FlowBuilderModel.findOne({
      where: {
        id: Number(flowId),
        company_id: companyId
      }
    });

    if (!flowExists) {
      throw new AppError("Fluxo não encontrado", 404);
    }

    const whatsappConnections = await Whatsapp.findAll({
      where: {
        id: normalizedWhatsappIds,
        companyId
      }
    });

    if (whatsappConnections.length !== normalizedWhatsappIds.length) {
      const foundIds = whatsappConnections.map(w => w.id);
      const missingIds = normalizedWhatsappIds.filter(id => !foundIds.includes(id));
      throw new AppError(
        `Conexões não encontradas ou não pertencem à empresa: ${missingIds.join(", ")}`,
        400
      );
    }

    const existingCampaign = await FlowCampaignModel.findOne({
      where: {
        name: name.trim(),
        companyId
      }
    });

    if (existingCampaign) {
      throw new AppError("Já existe uma campanha com este nome", 400);
    }

    const normalizedPhrases: PhraseCondition[] = validPhrases.map(phrase => ({
      text: phrase.text.trim(),
      type: phrase.type || "exact"
    }));

    const normalizedTagIds = Array.isArray(tagIds)
      ? [...new Set(tagIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))]
      : [];

    const flow = await FlowCampaignModel.create({
      userId,
      companyId,
      name: name.trim(),
      phrase: normalizedPhrases,
      flowId: Number(flowId),
      whatsappId: normalizedWhatsappIds[0],
      whatsappIds: normalizedWhatsappIds,
      tagIds: normalizedTagIds,
      status: Boolean(status)
    });

    await flow.reload({
      include: [
        {
          model: FlowBuilderModel,
          as: "flow",
          attributes: ["id", "name"]
        }
      ]
    });

    console.log(
      `✅ Campanha criada: ${flow.name} com ${normalizedWhatsappIds.length} conexões: ${normalizedWhatsappIds.join(", ")}`
    );

    return flow;
  } catch (error) {
    console.error("Erro ao criar campanha de fluxo:", error);

    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map(err => err.message).join(", ");
      throw new AppError(`Erro de validação: ${messages}`, 400);
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      throw new AppError("Já existe uma campanha com estes dados", 400);
    }

    throw new AppError("Erro interno ao criar campanha", 500);
  }
};

export default CreateFlowCampaignService;