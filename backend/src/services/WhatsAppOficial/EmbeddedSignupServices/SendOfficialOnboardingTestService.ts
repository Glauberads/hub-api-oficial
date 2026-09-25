import axios from "axios";
import AppError from "../../../errors/AppError";
import Whatsapp from "../../../models/Whatsapp";

interface Request {
  whatsappId: number;
  companyId: number;
  number: string;
  body?: string;
  templateName?: string;
  templateLanguageCode?: string;
  templateParameters?: string[];
}

interface Response {
  whatsappId: number;
  phoneNumberId: string;
  to: string;
  messageType: "text" | "template";
  responseData: any;
}

const getGraphErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro ao enviar mensagem de teste da API Oficial."
  );
};

const getGraphErrorCode = (error: any): number | null => {
  const code = error?.response?.data?.error?.code;
  return typeof code === "number" ? code : null;
};

const normalizeNumber = (value: string): string => {
  return String(value || "").replace(/\D/g, "");
};

const buildTemplateComponents = (params?: string[]) => {
  const safeParams = Array.isArray(params)
    ? params.filter(item => String(item || "").trim() !== "")
    : [];

  if (!safeParams.length) {
    return undefined;
  }

  return [
    {
      type: "body",
      parameters: safeParams.map(text => ({
        type: "text",
        text: String(text)
      }))
    }
  ];
};

const SendOfficialOnboardingTestService = async ({
  whatsappId,
  companyId,
  number,
  body = "Teste de ativação da API Oficial realizado com sucesso.",
  templateName,
  templateLanguageCode = "pt_BR",
  templateParameters = []
}: Request): Promise<Response> => {
  const graphVersion = process.env.META_SDK_VERSION || "v25.0";

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
  const phoneNumberId = whatsapp.phone_number_id || "";
  const to = normalizeNumber(number);

  if (!accessToken) {
    throw new AppError("Token da API Oficial não encontrado.");
  }

  if (!phoneNumberId) {
    throw new AppError("Phone Number ID não encontrado.");
  }

  if (!to) {
    throw new AppError("Número de teste inválido.");
  }

  const usingTemplate = String(templateName || "").trim() !== "";

  try {
    const payload = usingTemplate
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: String(templateName).trim(),
            language: {
              code: templateLanguageCode || "pt_BR"
            },
            ...(buildTemplateComponents(templateParameters)
              ? { components: buildTemplateComponents(templateParameters) }
              : {})
          }
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: false,
            body
          }
        };

    const { data } = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    whatsapp.officialLastError = "";
    await whatsapp.save();

    return {
      whatsappId: whatsapp.id,
      phoneNumberId,
      to,
      messageType: usingTemplate ? "template" : "text",
      responseData: data
    };
  } catch (error: any) {
    const graphMessage = getGraphErrorMessage(error);
    const graphCode = getGraphErrorCode(error);

    whatsapp.officialLastError = graphMessage;
    await whatsapp.save();

    if (!usingTemplate) {
      throw new AppError(
        `Falha no teste em texto livre. A Cloud API só envia mensagem sem template com a janela de 24 horas aberta. Use um template aprovado para o teste ou responda a um contato com conversa ativa. Detalhe: ${graphMessage}`,
        400
      );
    }

    throw new AppError(
      `Falha no teste com template. Verifique se o template está aprovado, ativo e compatível com os parâmetros enviados. Detalhe: ${graphMessage}${graphCode ? ` (code ${graphCode})` : ""}`,
      400
    );
  }
};

export default SendOfficialOnboardingTestService;