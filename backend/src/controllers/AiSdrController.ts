import { Request, Response } from "express";

import ListAiSdrConfigService from "../services/AiSdrServices/ListAiSdrConfigService";
import ShowAiSdrConfigService from "../services/AiSdrServices/ShowAiSdrConfigService";
import CreateAiSdrConfigService from "../services/AiSdrServices/CreateAiSdrConfigService";
import UpdateAiSdrConfigService from "../services/AiSdrServices/UpdateAiSdrConfigService";
import DeleteAiSdrConfigService from "../services/AiSdrServices/DeleteAiSdrConfigService";
import HandleAiSdrMessageService from "../services/AiSdrServices/HandleAiSdrMessageService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const configs = await ListAiSdrConfigService({ companyId });

  return res.status(200).json(configs);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const config = await ShowAiSdrConfigService({
    id: Number(id),
    companyId
  });

  return res.status(200).json(config);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const config = await CreateAiSdrConfigService({
    ...req.body,
    companyId
  });

  return res.status(201).json(config);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const config = await UpdateAiSdrConfigService({
    id: Number(id),
    companyId,
    data: req.body
  });

  return res.status(200).json(config);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteAiSdrConfigService({
    id: Number(id),
    companyId
  });

  return res.status(200).json({ message: "Configuração removida com sucesso." });
};


export const processTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId } = req.params;
  const { currentMessage, sendResponse } = req.body;

  const result = await HandleAiSdrMessageService({
    ticketId: Number(ticketId),
    companyId,
    currentMessage,
    sendResponse: Boolean(sendResponse)
  });

  return res.status(200).json(result);
};
