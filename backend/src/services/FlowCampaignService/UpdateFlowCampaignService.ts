import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel, PhraseCondition } from "../../models/FlowCampaign";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";

interface Request {
  companyId: number;
  name: string;
  flowId: number;
  phrases: PhraseCondition[];
  id: number;
  status: boolean;
  whatsappIds: number[];
  tagIds?: number[];
}

const UpdateFlowCampaignService = async ({
  companyId,
  name,
  flowId,
  phrases,
  id,
  status,
  whatsappIds,
  tagIds
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
          .map(item => Number(item))
          .filter(item => Number.isInteger(item) && item > 0)
      )
    ];

    if (normalizedWhatsappIds.length === 0) {
      throw new AppError("Pelo menos uma conexão WhatsApp válida deve ser selecionada", 400);
    }

    const validPhrases = phrases.filter(phrase => phrase?.text?.trim());

    if (validPhrases.length === 0) {
      throw new AppError("Pelo menos uma frase deve ter conteúdo", 400);
    }

    const existingCampaign = await FlowCampaignModel.findOne({
      where: {
        id,
        companyId
      }
    });

    if (!existingCampaign) {
      throw new AppError("Campanha não encontrada", 404);
    }

    const duplicateCampaign = await FlowCampaignModel.findOne({
      where: {
        name: name.trim(),
        companyId,
        id: { [Op.ne]: id }
      }
    });

    if (duplicateCampaign) {
      throw new AppError("Já existe uma campanha com este nome", 400);
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
      const missingIds = normalizedWhatsappIds.filter(item => !foundIds.includes(item));
      throw new AppError(
        `Conexões não encontradas ou não pertencem à empresa: ${missingIds.join(", ")}`,
        400
      );
    }

    const normalizedPhrases: PhraseCondition[] = validPhrases.map(phrase => ({
      text: phrase.text.trim(),
      type: phrase.type || "exact"
    }));

    const normalizedTagIds = Array.isArray(tagIds)
      ? [...new Set(tagIds.map(item => Number(item)).filter(item => Number.isInteger(item) && item > 0))]
      : [];

    await existingCampaign.update({
      name: name.trim(),
      phrase: normalizedPhrases,
      flowId: Number(flowId),
      status: status !== undefined ? Boolean(status) : true,
      whatsappId: normalizedWhatsappIds[0],
      whatsappIds: normalizedWhatsappIds,
      tagIds: normalizedTagIds
    });

    await existingCampaign.reload({
      include: [
        {
          model: FlowBuilderModel,
          as: "flow",
          attributes: ["id", "name"]
        }
      ]
    });

    console.log(
      `✅ Campanha atualizada: ${existingCampaign.name} com ${normalizedWhatsappIds.length} conexões: ${normalizedWhatsappIds.join(", ")}`
    );

    return existingCampaign;
  } catch (error) {
    console.error("Erro ao atualizar campanha de fluxo:", error);

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

    throw new AppError("Erro interno ao atualizar campanha", 500);
  }
};

export default UpdateFlowCampaignService;