import axios from "axios";
import AppError from "../../../errors/AppError";
import Whatsapp from "../../../models/Whatsapp";
import GetEmbeddedSignupConfigService from "./GetEmbeddedSignupConfigService";

interface Request {
  whatsappId: number;
  companyId: number;
  persist?: boolean;
}

interface Response {
  whatsappId: number;
  companyId: number;
  status: string;
  checks: {
    hasToken: boolean;
    hasWabaId: boolean;
    hasPhoneNumberId: boolean;
    tokenValid: boolean;
    phoneReachable: boolean;
    webhookSubscribed: boolean;
    appSubscribed: boolean;
  };
  phoneData: any;
  subscribedApps: any[];
  details: string;
  lastError: string;
  checkedAt: Date;
}

const getGraphErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro ao validar a conexão oficial."
  );
};

const OfficialConnectionHealthcheckService = async ({
  whatsappId,
  companyId,
  persist = true
}: Request): Promise<Response> => {
  const config = await GetEmbeddedSignupConfigService({ companyId });
  const graphVersion = config.apiVersion;
  const metaAppId = config.appId;

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada.", 404);
  }

  const accessToken = whatsapp.send_token || whatsapp.tokenMeta || "";
  const wabaId = whatsapp.waba_id || "";
  const phoneNumberId = whatsapp.phone_number_id || "";

  const checks = {
    hasToken: Boolean(accessToken),
    hasWabaId: Boolean(wabaId),
    hasPhoneNumberId: Boolean(phoneNumberId),
    tokenValid: false,
    phoneReachable: false,
    webhookSubscribed: Boolean(whatsapp.webhookSubscribed),
    appSubscribed: false
  };

  let phoneData: any = {};
  let subscribedApps: any[] = [];
  let status = "invalid";
  let details = "";
  let lastError = "";

  if (!checks.hasToken || !checks.hasWabaId || !checks.hasPhoneNumberId) {
    details = "A conexão ainda não possui todos os dados mínimos da API Oficial.";

    if (persist) {
      whatsapp.officialHealthStatus = "invalid";
      whatsapp.officialHealthDetails = details;
      whatsapp.webhookLastCheckAt = new Date();
      whatsapp.officialLastError = "";
      await whatsapp.save();
    }

    return {
      whatsappId: whatsapp.id,
      companyId,
      status,
      checks,
      phoneData,
      subscribedApps,
      details,
      lastError,
      checkedAt: new Date()
    };
  }

  try {
    const phoneResponse = await axios.get(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}`,
      {
        params: {
          fields: "id,display_phone_number,verified_name",
          access_token: accessToken
        },
        timeout: 30000
      }
    );

    phoneData = phoneResponse.data || {};
    checks.tokenValid = true;
    checks.phoneReachable = Boolean(phoneData?.id);
  } catch (error: any) {
    lastError = getGraphErrorMessage(error);
  }

  try {
    const subscribedResponse = await axios.get(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`,
      {
        params: {
          access_token: accessToken
        },
        timeout: 30000
      }
    );

    subscribedApps = Array.isArray(subscribedResponse.data?.data)
      ? subscribedResponse.data.data
      : [];

    if (metaAppId) {
      checks.appSubscribed = subscribedApps.some(
        (item: any) =>
          String(
            item?.whatsapp_business_api_data?.id ||
              item?.id ||
              item?.app_id ||
              ""
          ) === String(metaAppId)
      );
    } else {
      checks.appSubscribed = subscribedApps.length > 0;
    }

    checks.webhookSubscribed =
      Boolean(whatsapp.webhookSubscribed) || checks.appSubscribed;
  } catch (error: any) {
    if (!lastError) {
      lastError = getGraphErrorMessage(error);
    }
  }

  if (
    checks.hasToken &&
    checks.hasWabaId &&
    checks.hasPhoneNumberId &&
    checks.tokenValid &&
    checks.phoneReachable &&
    checks.appSubscribed
  ) {
    status = "healthy";
    details = "Conexão oficial validada com sucesso.";
  } else if (checks.tokenValid && checks.phoneReachable) {
    status = "warning";
    details =
      "Conexão parcialmente válida. Verifique assinatura do webhook ou inscrição do app.";
  } else {
    status = "invalid";
    details = lastError || "A conexão oficial não passou na validação.";
  }

  if (persist) {
    whatsapp.webhookSubscribed = checks.webhookSubscribed;
    whatsapp.webhookLastCheckAt = new Date();
    whatsapp.officialHealthStatus = status;
    whatsapp.officialHealthDetails = details;
    whatsapp.officialLastError = lastError || "";
    await whatsapp.save();
  }

  return {
    whatsappId: whatsapp.id,
    companyId,
    status,
    checks,
    phoneData,
    subscribedApps,
    details,
    lastError,
    checkedAt: new Date()
  };
};

export default OfficialConnectionHealthcheckService;
