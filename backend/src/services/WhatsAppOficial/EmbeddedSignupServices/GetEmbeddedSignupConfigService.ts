import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import Setting from "../../../models/Setting";

interface Request {
  companyId: number;
}

interface Response {
  appId: string;
  appSecret: string;
  configId: string;
  apiVersion: string;
  requireBusinessManagement: boolean;
}

const normalizeMetaVersion = (value: string): string => {
  const raw = String(value || "").trim();

  if (!raw) {
    return "v25.0";
  }

  const cleaned = raw.replace(/^v/i, "");

  if (!/^\d+\.\d+$/.test(cleaned)) {
    return "v25.0";
  }

  const majorVersion = parseInt(cleaned.split(".")[0], 10);

  if (majorVersion >= 20 && majorVersion <= 25) {
    return `v${cleaned}`;
  }

  return "v25.0";
};

const toBoolean = (value: any, fallback = true): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
};

const GetEmbeddedSignupConfigService = async ({
  companyId
}: Request): Promise<Response> => {
  if (!companyId) {
    throw new AppError("Empresa não identificada.", 401);
  }

  const keys = [
    "metaAppId",
    "metaAppSecret",
    "metaSdkVersion",
    "metaRequireBusinessManagement",
    "metaEmbeddedSignupConfigId"
  ];

  const settings = await Setting.findAll({
    where: {
      key: {
        [Op.in]: keys
      },
      [Op.or]: [
        { companyId },
        { companyId: null }
      ]
    },
    order: [["companyId", "DESC"]]
  });

  const getSettingValue = (key: string, fallback = ""): string => {
    const found = settings.find(item => item.key === key);
    return found?.value ?? fallback;
  };

  const appId =
    getSettingValue("metaAppId") ||
    process.env.META_APP_ID ||
    process.env.REACT_APP_FACEBOOK_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    "";

  const appSecret =
    getSettingValue("metaAppSecret") ||
    process.env.META_APP_SECRET ||
    process.env.FACEBOOK_APP_SECRET ||
    "";

  const configId =
    getSettingValue("metaEmbeddedSignupConfigId") ||
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
    "";

  const apiVersion = normalizeMetaVersion(
    getSettingValue("metaSdkVersion") ||
      process.env.META_SDK_VERSION ||
      "25.0"
  );

  const requireBusinessManagement = toBoolean(
    getSettingValue("metaRequireBusinessManagement", "true"),
    true
  );

  return {
    appId,
    appSecret,
    configId,
    apiVersion,
    requireBusinessManagement
  };
};

export default GetEmbeddedSignupConfigService;
