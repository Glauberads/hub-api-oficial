import { Request, Response } from "express";
import CreateFlowCampaignService from "../services/FlowCampaignService/CreateFlowCampaignService";
import FlowsCampaignGetDataService from "../services/FlowCampaignService/FlowsCampaignGetDataService";
import GetFlowsCampaignDataService from "../services/FlowCampaignService/GetFlowsCampaignDataService";
import DeleteFlowCampaignService from "../services/FlowCampaignService/DeleteFlowCampaignService";
import UpdateFlowCampaignService from "../services/FlowCampaignService/UpdateFlowCampaignService";
import AppError from "../errors/AppError";
import logger from "../utils/logger";

export const createFlowCampaign = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, flowId, phrases, whatsappIds, tagIds, status } = req.body;
    const userId = parseInt(req.user.id);
    const { companyId } = req.user;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Nome da campanha é obrigatório" });
    }

    if (!flowId) {
      return res.status(400).json({ error: "Fluxo é obrigatório" });
    }

    if (!phrases || !Array.isArray(phrases) || phrases.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma frase é obrigatória" });
    }

    const normalizedWhatsappIds = Array.isArray(whatsappIds)
      ? [...new Set(
          whatsappIds
            .map(item => Number(item))
            .filter(item => Number.isInteger(item) && item > 0)
        )]
      : (whatsappIds !== undefined && whatsappIds !== null && whatsappIds !== "")
        ? [Number(whatsappIds)].filter(item => Number.isInteger(item) && item > 0)
        : [];

    if (normalizedWhatsappIds.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma conexão WhatsApp deve ser selecionada" });
    }

    const validPhrases = phrases.filter(p => p && p.text && p.text.trim());
    if (validPhrases.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma frase válida é obrigatória" });
    }

    logger.info(
      `[CAMPAIGN][CREATE] body.whatsappIds=${JSON.stringify(whatsappIds)} | normalized=${JSON.stringify(normalizedWhatsappIds)} | name=${name?.trim()} | flowId=${flowId}`
    );

    const flow = await CreateFlowCampaignService({
      userId,
      name: name.trim(),
      companyId,
      phrases: validPhrases,
      whatsappIds: normalizedWhatsappIds,
      tagIds: Array.isArray(tagIds) ? tagIds.map(Number) : [],
      flowId,
      status: status !== undefined ? status : true
    });

    return res.status(201).json({
      success: true,
      data: flow,
      message: `Campanha criada com sucesso para ${normalizedWhatsappIds.length} conexão(ões)`
    });

  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao criar campanha: ${error}`);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const flowCampaigns = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { page, limit, searchTerm } = req.query;

    const result = await FlowsCampaignGetDataService({
      companyId,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      searchTerm: searchTerm as string
    });

    const flow = Array.isArray(result?.flow) ? result.flow : 
                 Array.isArray(result) ? result : [];

    return res.status(200).json({
      success: true,
      flow,
      count: result?.count || flow.length,
      hasMore: result?.hasMore || false,
      message: "Campanhas listadas com sucesso"
    });

  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao listar campanhas: ${error}`);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const flowCampaign = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { idFlow } = req.params;
    const { companyId } = req.user;

    if (!idFlow) {
      return res.status(400).json({ error: "ID da campanha é obrigatório" });
    }

    const id = parseInt(idFlow);

    if (isNaN(id)) {
      return res.status(400).json({ error: "ID da campanha deve ser um número válido" });
    }

    const result = await GetFlowsCampaignDataService({
      companyId,
      idFlow: id
    });

    return res.status(200).json({
      success: true,
      ...result.details,
      message: "Campanha encontrada com sucesso"
    });

  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao buscar campanha: ${error}`);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const updateFlowCampaign = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { flowId, name, phrases, id, status, whatsappIds, tagIds } = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID da campanha é obrigatório" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ error: "Nome da campanha é obrigatório" });
    }

    if (!flowId) {
      return res.status(400).json({ error: "Fluxo é obrigatório" });
    }

    if (!phrases || !Array.isArray(phrases) || phrases.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma frase é obrigatória" });
    }

    const normalizedWhatsappIds = Array.isArray(whatsappIds)
      ? [...new Set(
          whatsappIds
            .map(item => Number(item))
            .filter(item => Number.isInteger(item) && item > 0)
        )]
      : (whatsappIds !== undefined && whatsappIds !== null && whatsappIds !== "")
        ? [Number(whatsappIds)].filter(item => Number.isInteger(item) && item > 0)
        : [];

    if (normalizedWhatsappIds.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma conexão WhatsApp deve ser selecionada" });
    }

    const validPhrases = phrases.filter(p => p && p.text && p.text.trim());
    if (validPhrases.length === 0) {
      return res.status(400).json({ error: "Pelo menos uma frase válida é obrigatória" });
    }

    logger.info(
      `[CAMPAIGN][UPDATE] id=${id} | body.whatsappIds=${JSON.stringify(whatsappIds)} | normalized=${JSON.stringify(normalizedWhatsappIds)} | name=${name?.trim()} | flowId=${flowId}`
    );

    const flow = await UpdateFlowCampaignService({
      companyId,
      name: name.trim(),
      flowId,
      phrases: validPhrases,
      id,
      status: status !== undefined ? status : true,
      whatsappIds: normalizedWhatsappIds,
      tagIds: Array.isArray(tagIds) ? tagIds.map(Number) : []
    });

    return res.status(200).json({
      success: true,
      data: flow,
      message: `Campanha atualizada com sucesso para ${normalizedWhatsappIds.length} conexão(ões)`
    });

  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao atualizar campanha: ${error}`);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const deleteFlowCampaign = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { idFlow } = req.params;

    if (!idFlow) {
      return res.status(400).json({ error: "ID da campanha é obrigatório" });
    }

    const flowIdInt = parseInt(idFlow);

    if (isNaN(flowIdInt)) {
      return res.status(400).json({ error: "ID da campanha deve ser um número válido" });
    }

    logger.info(`[CAMPAIGN] Deletando campanha ID: ${flowIdInt}`);

    const flow = await DeleteFlowCampaignService(flowIdInt);

    return res.status(200).json({
      success: true,
      data: flow,
      message: "Campanha removida com sucesso"
    });

  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao remover campanha: ${error}`);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};