import { Request, Response } from "express";

import CreateLandingWebhookConfigService from "../services/LandingWebhookServices/CreateLandingWebhookConfigService";
import ListLandingWebhookConfigService from "../services/LandingWebhookServices/ListLandingWebhookConfigService";
import ShowLandingWebhookConfigService from "../services/LandingWebhookServices/ShowLandingWebhookConfigService";
import UpdateLandingWebhookConfigService from "../services/LandingWebhookServices/UpdateLandingWebhookConfigService";
import DeleteLandingWebhookConfigService from "../services/LandingWebhookServices/DeleteLandingWebhookConfigService";

const getWebhookBaseUrl = (req: Request): string => {
  const envBackendUrl = process.env.BACKEND_URL;

  if (envBackendUrl) {
    return envBackendUrl.replace(/\/$/, "");
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");

  return `${protocol}://${host}`;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam } = req.query;

  const landingWebhookConfigs = await ListLandingWebhookConfigService({
    companyId,
    searchParam: searchParam ? String(searchParam) : ""
  });

  const baseUrl = getWebhookBaseUrl(req);

  const data = landingWebhookConfigs.map(config => ({
    ...config.toJSON(),
    webhookUrl: `${baseUrl}/webhook/landing/${config.token}`
  }));

  return res.status(200).json(data);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const {
    name,
    whatsappId,
    queueId,
    userId,
    flowId,
    tags,
    welcomeMessage,
    autoSendMessage,
    autoStartFlow,
    isActive
  } = req.body;

  const landingWebhookConfig = await CreateLandingWebhookConfigService({
    companyId,
    name,
    whatsappId,
    queueId,
    userId,
    flowId,
    tags,
    welcomeMessage,
    autoSendMessage,
    autoStartFlow,
    isActive
  });

  const baseUrl = getWebhookBaseUrl(req);

  return res.status(200).json({
    ...landingWebhookConfig.toJSON(),
    webhookUrl: `${baseUrl}/webhook/landing/${landingWebhookConfig.token}`
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const landingWebhookConfig = await ShowLandingWebhookConfigService({
    id,
    companyId
  });

  const baseUrl = getWebhookBaseUrl(req);

  return res.status(200).json({
    ...landingWebhookConfig.toJSON(),
    webhookUrl: `${baseUrl}/webhook/landing/${landingWebhookConfig.token}`
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const {
    name,
    whatsappId,
    queueId,
    userId,
    flowId,
    tags,
    welcomeMessage,
    autoSendMessage,
    autoStartFlow,
    isActive
  } = req.body;

  const landingWebhookConfig = await UpdateLandingWebhookConfigService({
    id,
    companyId,
    name,
    whatsappId,
    queueId,
    userId,
    flowId,
    tags,
    welcomeMessage,
    autoSendMessage,
    autoStartFlow,
    isActive
  });

  const baseUrl = getWebhookBaseUrl(req);

  return res.status(200).json({
    ...landingWebhookConfig.toJSON(),
    webhookUrl: `${baseUrl}/webhook/landing/${landingWebhookConfig.token}`
  });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteLandingWebhookConfigService({
    id,
    companyId
  });

  return res.status(200).json({
  message: "Integração de Landing Page excluída com sucesso."
});
};