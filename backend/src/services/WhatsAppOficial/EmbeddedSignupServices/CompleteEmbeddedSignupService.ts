import { randomBytes } from "crypto";
import AppError from "../../../errors/AppError";
import Whatsapp from "../../../models/Whatsapp";
import Company from "../../../models/Company";
import {
  CreateCompanyConnectionOficial,
  UpdateConnectionWhatsAppOficial
} from "../../../libs/whatsAppOficial/whatsAppOficial.service";
import ExchangeEmbeddedSignupCodeService from "./ExchangeEmbeddedSignupCodeService";
import SyncOfficialConnectionDataService from "./SyncOfficialConnectionDataService";
import SubscribeWabaWebhookService from "./SubscribeWabaWebhookService";
import OfficialConnectionHealthcheckService from "./OfficialConnectionHealthcheckService";
import SendOfficialOnboardingTestService from "./SendOfficialOnboardingTestService";
import CreateOfficialOnboardingLogService from "./CreateOfficialOnboardingLogService";
import GetEmbeddedSignupConfigService from "./GetEmbeddedSignupConfigService";

interface Request {
  companyId: number;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
  mode?: string;
  name?: string;
  number?: string;
  testNumber?: string;
}

const CompleteEmbeddedSignupService = async ({
  companyId,
  code,
  wabaId,
  phoneNumberId,
  businessId,
  mode = "embedded_signup",
  name,
  number,
  testNumber
}: Request): Promise<any> => {
  let whatsapp: Whatsapp | null = null;

  await CreateOfficialOnboardingLogService({
    companyId,
    step: "start",
    status: "info",
    message: "Iniciando conclusão do Embedded Signup.",
    payload: {
      wabaId,
      phoneNumberId,
      mode,
      hasCode: Boolean(code)
    }
  });

  try {
    const tokenData = await ExchangeEmbeddedSignupCodeService({
      code,
      companyId
    });

    await CreateOfficialOnboardingLogService({
      companyId,
      step: "exchange_code",
      status: "success",
      message: "Code trocado por token com sucesso.",
      payload: {
        tokenType: tokenData.tokenType,
        expiresIn: tokenData.expiresIn,
        graphVersion: tokenData.graphVersion
      }
    });

    whatsapp = await Whatsapp.findOne({
      where: {
        companyId,
        phone_number_id: phoneNumberId
      }
    });

    if (!whatsapp) {
      whatsapp = await Whatsapp.create({
        companyId,
        name: name || `API Oficial ${number || phoneNumberId}`,
        status: "OPENING",
        channel: "whatsapp_oficial",
        provider: "cloudapi",
        token: randomBytes(24).toString("hex"),
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        business_id: businessId || "",
        send_token: tokenData.accessToken,
        tokenMeta: tokenData.accessToken,
        tokenOrigin: "embedded_signup",
        officialOnboardingMode: mode,
        embeddedSignupStatus: "processing",
        webhookSubscribed: false,
        officialHealthStatus: "processing",
        officialHealthDetails: "Onboarding iniciado pelo Embedded Signup.",
        officialLastError: "",
        number: number || null
      } as any);

      await CreateOfficialOnboardingLogService({
        companyId,
        whatsappId: whatsapp.id,
        step: "create_connection",
        status: "success",
        message: "Nova conexão oficial criada com sucesso.",
        payload: {
          whatsappId: whatsapp.id,
          phone_number_id: whatsapp.phone_number_id,
          waba_id: whatsapp.waba_id
        }
      });
    } else {
      whatsapp.channel = "whatsapp_oficial";
      whatsapp.provider = "cloudapi";
      whatsapp.waba_id = wabaId;
      whatsapp.phone_number_id = phoneNumberId;
      whatsapp.business_id = businessId || whatsapp.business_id || "";
      whatsapp.send_token = tokenData.accessToken;
      whatsapp.tokenMeta = tokenData.accessToken;
      whatsapp.tokenOrigin = "embedded_signup";
      whatsapp.officialOnboardingMode = mode;
      whatsapp.embeddedSignupStatus = "processing";
      whatsapp.officialHealthStatus = "processing";
      whatsapp.officialHealthDetails = "Atualizando conexão via Embedded Signup.";
      whatsapp.officialLastError = "";

      if (name) {
        whatsapp.name = name;
      }

      if (number) {
        whatsapp.number = number;
      }

      if (!whatsapp.token) {
        whatsapp.token = randomBytes(24).toString("hex");
      }

      await whatsapp.save();

      await CreateOfficialOnboardingLogService({
        companyId,
        whatsappId: whatsapp.id,
        step: "update_connection",
        status: "success",
        message: "Conexão oficial existente atualizada com sucesso.",
        payload: {
          whatsappId: whatsapp.id,
          phone_number_id: whatsapp.phone_number_id,
          waba_id: whatsapp.waba_id
        }
      });
    }

    const syncResult = await SyncOfficialConnectionDataService({
      whatsappId: whatsapp.id,
      companyId,
      accessToken: tokenData.accessToken,
      wabaId,
      phoneNumberId,
      businessId
    });

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp.id,
      step: "sync_connection_data",
      status: "success",
      message: "Dados da conexão oficial sincronizados com sucesso.",
      payload: syncResult
    });

    const company = await Company.findByPk(companyId);

    if (!company) {
      throw new AppError("Empresa não encontrada para criar a conexão oficial.");
    }

    if (!syncResult.business_id) {
      throw new AppError(
        "A Meta não retornou o Business ID necessário para criar a conexão oficial."
      );
    }

    const metaConfig = await GetEmbeddedSignupConfigService({ companyId });
    const officialConnectionPayload = {
      token_mult100: whatsapp.token,
      phone_number_id: syncResult.phone_number_id,
      waba_id: syncResult.waba_id,
      send_token: tokenData.accessToken,
      business_id: syncResult.business_id,
      phone_number: syncResult.phone_number,
      meta_app_id: metaConfig.appId,
      idEmpresaMult100: companyId
    };

    if (whatsapp.waba_webhook_id) {
      await UpdateConnectionWhatsAppOficial(
        whatsapp.waba_webhook_id,
        officialConnectionPayload
      );
    } else {
      const officialConnection = await CreateCompanyConnectionOficial({
        email: company.email,
        company: {
          companyId: String(companyId),
          companyName: company.name
        },
        whatsApp: officialConnectionPayload
      });

      whatsapp.waba_webhook = officialConnection.webhookLink;
      whatsapp.waba_webhook_id = officialConnection.connectionId;
      await whatsapp.save();
    }

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp.id,
      step: "sync_official_api",
      status: "success",
      message: "Conexão sincronizada com a API Oficial.",
      payload: {
        officialConnectionId: whatsapp.waba_webhook_id,
        phone_number_id: syncResult.phone_number_id
      }
    });

    const subscribeResult = await SubscribeWabaWebhookService({
      whatsappId: whatsapp.id,
      companyId,
      accessToken: tokenData.accessToken,
      wabaId
    });

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp.id,
      step: "subscribe_webhook",
      status: subscribeResult.success ? "success" : "warning",
      message: subscribeResult.success
        ? "Webhook da WABA assinado com sucesso."
        : "A tentativa de assinatura do webhook não retornou sucesso.",
      payload: subscribeResult
    });

    const diagnostics = await OfficialConnectionHealthcheckService({
      whatsappId: whatsapp.id,
      companyId,
      persist: true
    });

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp.id,
      step: "healthcheck",
      status:
        diagnostics.status === "healthy"
          ? "success"
          : diagnostics.status === "warning"
          ? "warning"
          : "error",
      message: diagnostics.details,
      error: diagnostics.lastError || "",
      payload: diagnostics
    });

    whatsapp = await Whatsapp.findOne({
      where: {
        id: whatsapp.id,
        companyId
      }
    });

    if (!whatsapp) {
      throw new AppError("Conexão não encontrada após a conclusão do onboarding.");
    }

    const isHealthy = diagnostics.status === "healthy";
    whatsapp.embeddedSignupStatus = isHealthy ? "completed" : "warning";
    if (isHealthy) {
      whatsapp.embeddedSignupFinishedAt = new Date();
    }
    whatsapp.status = isHealthy ? "CONNECTED" : "DISCONNECTED";
    await whatsapp.save();

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp.id,
      step: "finish",
      status: isHealthy ? "success" : "warning",
      message: isHealthy
        ? "Onboarding finalizado com sucesso."
        : "Onboarding finalizado com pendências de diagnóstico.",
      payload: {
        embeddedSignupStatus: whatsapp.embeddedSignupStatus,
        officialHealthStatus: whatsapp.officialHealthStatus
      }
    });

    let testResult: any = null;

    if (testNumber) {
      try {
        testResult = await SendOfficialOnboardingTestService({
          whatsappId: whatsapp.id,
          companyId,
          number: testNumber,
          body: "Teste de ativação da API Oficial realizado com sucesso."
        });

        await CreateOfficialOnboardingLogService({
          companyId,
          whatsappId: whatsapp.id,
          step: "test_send",
          status: "success",
          message: "Mensagem de teste enviada com sucesso.",
          payload: testResult
        });
      } catch (error: any) {
        whatsapp.officialLastError =
          error?.message || "Falha ao enviar mensagem de teste.";
        await whatsapp.save();

        await CreateOfficialOnboardingLogService({
          companyId,
          whatsappId: whatsapp.id,
          step: "test_send",
          status: "error",
          message: "Falha ao enviar mensagem de teste.",
          error: error?.message || "Erro desconhecido no envio de teste.",
          payload: {
            testNumber
          }
        });
      }
    }

    return {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId,
      embeddedSignupStatus: whatsapp.embeddedSignupStatus,
      officialOnboardingMode: whatsapp.officialOnboardingMode,
      phone_number_id: whatsapp.phone_number_id,
      waba_id: whatsapp.waba_id,
      business_id: whatsapp.business_id,
      phone_number: whatsapp.phone_number,
      verified_name: whatsapp.verified_name,
      webhookSubscribed: whatsapp.webhookSubscribed,
      diagnostics,
      testResult
    };
  } catch (error: any) {
    if (whatsapp) {
      whatsapp.embeddedSignupStatus = "failed";
      whatsapp.officialHealthStatus = "invalid";
      whatsapp.officialLastError =
        error?.message || "Erro ao concluir o onboarding oficial.";
      await whatsapp.save();
    }

    await CreateOfficialOnboardingLogService({
      companyId,
      whatsappId: whatsapp?.id || null,
      step: "error",
      status: "error",
      message: "Falha ao concluir o Embedded Signup.",
      error: error?.message || "Erro desconhecido.",
      payload: {
        wabaId,
        phoneNumberId,
        mode
      }
    });

    throw new AppError(
      error?.message || "Erro ao concluir o onboarding oficial.",
      error?.statusCode || 400
    );
  }
};

export default CompleteEmbeddedSignupService;
