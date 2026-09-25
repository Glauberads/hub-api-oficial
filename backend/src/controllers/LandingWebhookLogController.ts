import { Request, Response } from "express";

import ListLandingWebhookLogService from "../services/LandingWebhookServices/ListLandingWebhookLogService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const {
    configId,
    status,
    searchParam,
    pageNumber
  } = req.query;

  const { logs, count, hasMore } = await ListLandingWebhookLogService({
    companyId,
    configId: configId ? String(configId) : undefined,
    status: status ? String(status) : undefined,
    searchParam: searchParam ? String(searchParam) : "",
    pageNumber: pageNumber ? String(pageNumber) : "1"
  });

  return res.status(200).json({
    logs,
    count,
    hasMore
  });
};