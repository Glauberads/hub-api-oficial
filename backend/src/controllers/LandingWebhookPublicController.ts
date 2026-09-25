import { Request, Response } from "express";

import ProcessLandingWebhookLeadService from "../services/LandingWebhookServices/ProcessLandingWebhookLeadService";

export const receiveLead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { token } = req.params;

  const result = await ProcessLandingWebhookLeadService({
    token,
    payload: req.body
  });

  return res.status(200).json({
    success: true,
    message: "Lead recebido com sucesso.",
    data: result
  });
};