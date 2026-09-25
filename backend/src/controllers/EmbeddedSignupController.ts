import { Request, Response } from "express";
import AppError from "../errors/AppError";
import CompleteEmbeddedSignupService from "../services/WhatsAppOficial/EmbeddedSignupServices/CompleteEmbeddedSignupService";
import OfficialConnectionHealthcheckService from "../services/WhatsAppOficial/EmbeddedSignupServices/OfficialConnectionHealthcheckService";
import SendOfficialOnboardingTestService from "../services/WhatsAppOficial/EmbeddedSignupServices/SendOfficialOnboardingTestService";
import GetEmbeddedSignupConfigService from "../services/WhatsAppOficial/EmbeddedSignupServices/GetEmbeddedSignupConfigService";
import ListOfficialOnboardingLogsService from "../services/WhatsAppOficial/EmbeddedSignupServices/ListOfficialOnboardingLogsService";
import SubscribeWabaWebhookService from "../services/WhatsAppOficial/EmbeddedSignupServices/SubscribeWabaWebhookService";
import { UpdateConnectionWhatsAppOficial } from "../libs/whatsAppOficial/whatsAppOficial.service";
import Whatsapp from "../models/Whatsapp";

class EmbeddedSignupController {
  public async start(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const mode = String(req.body.mode || "manual");

    const config = await GetEmbeddedSignupConfigService({
      companyId
    });

    return res.status(200).json({
      success: true,
      companyId,
      mode,
      appId: config.appId,
      configId: config.configId,
      apiVersion: config.apiVersion,
      requireBusinessManagement: config.requireBusinessManagement
    });
  }

  public async complete(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const {
      code,
      wabaId,
      phoneNumberId,
      businessId,
      mode,
      name,
      number,
      testNumber
    } = req.body;

    if (!code) {
      throw new AppError("O code retornado pelo Embedded Signup é obrigatório.");
    }

    if (!wabaId) {
      throw new AppError("O wabaId retornado pelo Embedded Signup é obrigatório.");
    }

    if (!phoneNumberId) {
      throw new AppError("O phoneNumberId retornado pelo Embedded Signup é obrigatório.");
    }

    const result = await CompleteEmbeddedSignupService({
      companyId,
      code,
      wabaId,
      phoneNumberId,
      businessId,
      mode,
      name,
      number,
      testNumber
    });

    return res.status(200).json({
      success: true,
      message: "Onboarding da API Oficial concluído com sucesso.",
      data: result
    });
  }

  public async status(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);
    const { whatsappId } = req.params;

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const whatsapp = await Whatsapp.findOne({
      where: {
        id: Number(whatsappId),
        companyId
      }
    });

    if (!whatsapp) {
      throw new AppError("Conexão não encontrada.", 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: whatsapp.id,
        name: whatsapp.name,
        status: whatsapp.status,
        channel: whatsapp.channel,
        phone_number_id: whatsapp.phone_number_id,
        waba_id: whatsapp.waba_id,
        business_id: whatsapp.business_id,
        phone_number: whatsapp.phone_number,
        verified_name: (whatsapp as any).verified_name,
        officialOnboardingMode: (whatsapp as any).officialOnboardingMode,
        embeddedSignupStatus: (whatsapp as any).embeddedSignupStatus,
        embeddedSignupFinishedAt: (whatsapp as any).embeddedSignupFinishedAt,
        webhookSubscribed: (whatsapp as any).webhookSubscribed,
        webhookSubscribedAt: (whatsapp as any).webhookSubscribedAt,
        webhookLastCheckAt: (whatsapp as any).webhookLastCheckAt,
        officialHealthStatus: (whatsapp as any).officialHealthStatus,
        officialHealthDetails: (whatsapp as any).officialHealthDetails,
        officialLastError: (whatsapp as any).officialLastError
      }
    });
  }

  public async diagnostics(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);
    const { whatsappId } = req.params;

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const diagnostics = await OfficialConnectionHealthcheckService({
      whatsappId: Number(whatsappId),
      companyId,
      persist: true
    });

    return res.status(200).json({
      success: true,
      data: diagnostics
    });
  }

  public async logs(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);
    const { whatsappId } = req.params;
    const limit = Number(req.query.limit || 100);

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const logs = await ListOfficialOnboardingLogsService({
      companyId,
      whatsappId: Number(whatsappId),
      limit
    });

    return res.status(200).json({
      success: true,
      data: logs
    });
  }

  public async testSend(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);
    const { whatsappId } = req.params;
    const {
      number,
      body,
      templateName,
      templateLanguageCode,
      templateParameters
    } = req.body;

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    if (!number) {
      throw new AppError("Informe o número para teste.");
    }

    const result = await SendOfficialOnboardingTestService({
      whatsappId: Number(whatsappId),
      companyId,
      number,
      body,
      templateName,
      templateLanguageCode,
      templateParameters
    });

    return res.status(200).json({
      success: true,
      message: "Mensagem de teste enviada com sucesso.",
      data: result
    });
  }

  public async reconnect(req: Request, res: Response): Promise<Response> {
    const companyId = Number((req as any).user?.companyId);
    const { whatsappId } = req.params;

    if (!companyId) {
      throw new AppError("Empresa não identificada.", 401);
    }

    const whatsapp = await Whatsapp.findOne({
      where: {
        id: Number(whatsappId),
        companyId
      }
    });

    if (!whatsapp) {
      throw new AppError("Conexão não encontrada.", 404);
    }

    const config = await GetEmbeddedSignupConfigService({
      companyId
    });

    const accessToken =
      whatsapp.send_token ||
      whatsapp.tokenMeta ||
      "";
    const wabaId = whatsapp.waba_id || "";

    if (!accessToken) {
      throw new AppError(
        "Token da API Oficial não encontrado para reconectar.",
        400
      );
    }

    if (!wabaId) {
      throw new AppError(
        "WABA ID não encontrado para reconectar.",
        400
      );
    }

    if (!config.appId) {
      throw new AppError(
        "App ID da Meta não configurado no painel.",
        400
      );
    }

    whatsapp.meta_app_id = config.appId;
    (whatsapp as any).officialHealthStatus = "reconnecting";
    (whatsapp as any).officialHealthDetails =
      "Reconectando aplicativo e webhook da WABA.";
    await whatsapp.save();

    if (whatsapp.waba_webhook_id) {
      await UpdateConnectionWhatsAppOficial(
        whatsapp.waba_webhook_id,
        {
          meta_app_id: config.appId
        }
      );
    }

    const subscription = await SubscribeWabaWebhookService({
      whatsappId: whatsapp.id,
      companyId,
      accessToken,
      wabaId
    });

    const diagnostics = await OfficialConnectionHealthcheckService({
      whatsappId: whatsapp.id,
      companyId,
      persist: true
    });

    return res.status(200).json({
      success: diagnostics.status === "healthy",
      message:
        diagnostics.status === "healthy"
          ? "Reconexão concluída com sucesso."
          : "Reconexão concluída com avisos.",
      data: {
        id: whatsapp.id,
        subscription,
        diagnostics
      }
    });
  }
}

export default new EmbeddedSignupController();