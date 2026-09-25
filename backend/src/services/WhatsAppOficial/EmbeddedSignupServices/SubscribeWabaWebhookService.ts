import axios from "axios";
import AppError from "../../../errors/AppError";
import Whatsapp from "../../../models/Whatsapp";
import GetEmbeddedSignupConfigService from "./GetEmbeddedSignupConfigService";

interface Request {
  whatsappId: number;
  companyId: number;
  accessToken?: string;
  wabaId?: string;
}

interface Response {
  success: boolean;
  whatsappId: number;
  wabaId: string;
  webhookSubscribed: boolean;
  responseData: any;
}

const getGraphErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro ao assinar a WABA no webhook."
  );
};

const SubscribeWabaWebhookService = async ({
  whatsappId,
  companyId,
  accessToken,
  wabaId
}: Request): Promise<Response> => {
  const config = await GetEmbeddedSignupConfigService({ companyId });
  const graphVersion = config.apiVersion;

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada.", 404);
  }

  const resolvedAccessToken =
    accessToken || whatsapp.send_token || whatsapp.tokenMeta || "";
  const resolvedWabaId = wabaId || whatsapp.waba_id || "";

  if (!resolvedAccessToken) {
    throw new AppError("Token da API Oficial não encontrado.");
  }

  if (!resolvedWabaId) {
    throw new AppError("WABA ID não encontrado.");
  }

  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${resolvedWabaId}/subscribed_apps`,
      null,
      {
        params: {
          access_token: resolvedAccessToken
        },
        timeout: 30000
      }
    );

    whatsapp.webhookSubscribed = Boolean(
      data?.success === true || data?.success === "true"
    );
    whatsapp.webhookSubscribedAt = whatsapp.webhookSubscribed
      ? new Date()
      : whatsapp.webhookSubscribedAt;
    whatsapp.webhookLastCheckAt = new Date();
    whatsapp.officialLastError = whatsapp.webhookSubscribed
      ? ""
      : "A assinatura do webhook não retornou sucesso.";
    await whatsapp.save();

    return {
      success: whatsapp.webhookSubscribed,
      whatsappId: whatsapp.id,
      wabaId: resolvedWabaId,
      webhookSubscribed: whatsapp.webhookSubscribed,
      responseData: data
    };
  } catch (error: any) {
    whatsapp.webhookSubscribed = false;
    whatsapp.webhookLastCheckAt = new Date();
    whatsapp.officialLastError = getGraphErrorMessage(error);
    await whatsapp.save();

    throw new AppError(getGraphErrorMessage(error), 400);
  }
};

export default SubscribeWabaWebhookService;