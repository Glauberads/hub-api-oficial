import axios from "axios";
import AppError from "../../../errors/AppError";
import GetEmbeddedSignupConfigService from "./GetEmbeddedSignupConfigService";

interface Request {
  code: string;
  companyId: number;
}

interface Response {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
  graphVersion: string;
  companyId: number;
}

const getGraphErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro ao trocar o code do Embedded Signup por token."
  );
};

const ExchangeEmbeddedSignupCodeService = async ({
  code,
  companyId
}: Request): Promise<Response> => {
  if (!code) {
    throw new AppError("O code do Embedded Signup não foi informado.");
  }

  if (!companyId) {
    throw new AppError("Empresa não identificada.", 401);
  }

  const config = await GetEmbeddedSignupConfigService({
    companyId
  });

  if (!config.appId) {
    throw new AppError("metaAppId não configurado.");
  }

  if (!config.appSecret) {
    throw new AppError("metaAppSecret não configurado.");
  }

  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/${config.apiVersion}/oauth/access_token`,
      {
        params: {
          client_id: config.appId,
          client_secret: config.appSecret,
          code
        },
        timeout: 30000
      }
    );

    const accessToken = data?.access_token || "";
    const tokenType = data?.token_type || "bearer";
    const expiresIn =
      typeof data?.expires_in === "number" ? data.expires_in : null;

    if (!accessToken) {
      throw new AppError(
        "A Meta não retornou um access_token na troca do code."
      );
    }

    return {
      accessToken,
      tokenType,
      expiresIn,
      graphVersion: config.apiVersion,
      companyId
    };
  } catch (error: any) {
    throw new AppError(getGraphErrorMessage(error), 400);
  }
};

export default ExchangeEmbeddedSignupCodeService;