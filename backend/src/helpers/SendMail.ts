import nodemailer from "nodemailer";
import Setting from "../models/Setting";

export interface MailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  companyId?: number;
  smtpConfig?: {
    host?: string;
    port?: number | string;
    secure?: boolean | string;
    user?: string;
    pass?: string;
    from?: string;
  };
}

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  source: "settings" | "env" | "override";
}

const normalizeBoolean = (value: any): boolean => {
  return (
    String(value || "").toLowerCase() === "true" ||
    String(value || "").toLowerCase() === "1" ||
    String(value || "").toLowerCase() === "enabled"
  );
};

const getSettingsMap = async (companyId: number): Promise<Record<string, string>> => {
  const settings = await Setting.findAll({
    where: {
      companyId
    }
  });

  return settings.reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
};

const loadMailConfigFromOverride = (
  smtpConfig?: MailData["smtpConfig"]
): MailConfig | null => {
  if (!smtpConfig) return null;

  const host = String(smtpConfig.host || "").trim();
  const port = Number(smtpConfig.port || 587);
  const secure = normalizeBoolean(smtpConfig.secure);
  const user = String(smtpConfig.user || "").trim();
  const pass = String(smtpConfig.pass || "").trim();
  const from = String(smtpConfig.from || "").trim();

  if (host && user && pass && from) {
    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      source: "override"
    };
  }

  return null;
};

const loadMailConfigFromSettings = async (
  companyId?: number
): Promise<MailConfig | null> => {
  const companyIdsToTry = [];

  if (companyId) {
    companyIdsToTry.push(companyId);
  }

  if (!companyIdsToTry.includes(1)) {
    companyIdsToTry.push(1);
  }

  for (const currentCompanyId of companyIdsToTry) {
    const settingsMap = await getSettingsMap(currentCompanyId);

    const host = settingsMap.MAIL_HOST || "";
    const port = Number(settingsMap.MAIL_PORT || 587);
    const secure = normalizeBoolean(settingsMap.MAIL_SECURE);
    const user = settingsMap.MAIL_USER || "";
    const pass = settingsMap.MAIL_PASS || "";
    const from = settingsMap.MAIL_FROM || "";

    if (host && user && pass && from) {
      return {
        host,
        port,
        secure,
        user,
        pass,
        from,
        source: "settings"
      };
    }
  }

  return null;
};

const loadMailConfigFromEnv = (): MailConfig | null => {
  const host = process.env.MAIL_HOST || "";
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = normalizeBoolean(process.env.MAIL_SECURE || "false");
  const user = process.env.MAIL_USER || "";
  const pass = process.env.MAIL_PASS || "";
  const from = process.env.MAIL_FROM || "";

  if (host && user && pass && from) {
    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      source: "env"
    };
  }

  return null;
};

export async function SendMail(mailData: MailData) {
  const overrideConfig = loadMailConfigFromOverride(mailData.smtpConfig);
  const settingsConfig = await loadMailConfigFromSettings(mailData.companyId);
  const envConfig = loadMailConfigFromEnv();
  const config = overrideConfig || settingsConfig || envConfig;

  if (!config) {
    throw new Error(
      "Configuração de e-mail não encontrada nem no painel nem no .env"
    );
  }

  console.log("[MAIL-DEBUG]", {
    source: config.source,
    companyId: mailData.companyId || 1,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    hasPass: !!config.pass
  });

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const info = await transporter.sendMail({
    from: config.from,
    to: mailData.to,
    subject: mailData.subject,
    text: mailData.text,
    html: mailData.html || mailData.text
  });

  console.log("Message sent: %s", info.messageId);
}