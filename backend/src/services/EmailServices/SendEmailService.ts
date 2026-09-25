import nodemailer from "nodemailer";
import Setting from "../../models/Setting";

interface Request {
  to: string;
  subject: string;
  html: string;
  companyId?: number | string;
}

const getSettingValue = async (
  key: string,
  companyId?: number | string,
  fallback = ""
): Promise<string> => {
  try {
    const where: any = { key };

    if (companyId !== undefined && companyId !== null && companyId !== "") {
      where.companyId = companyId;
    }

    const setting = await Setting.findOne({ where });

    if (
      setting &&
      setting.value !== null &&
      setting.value !== undefined &&
      String(setting.value).trim() !== ""
    ) {
      return String(setting.value);
    }
  } catch (error) {
    // mantém fallback do .env em caso de erro
  }

  return fallback;
};

const SendEmailService = async ({
  to,
  subject,
  html,
  companyId
}: Request): Promise<void> => {
  const mailHost = await getSettingValue(
    "MAIL_HOST",
    companyId,
    process.env.MAIL_HOST || ""
  );

  const mailPort = await getSettingValue(
    "MAIL_PORT",
    companyId,
    process.env.MAIL_PORT || "587"
  );

  const mailSecure = await getSettingValue(
    "MAIL_SECURE",
    companyId,
    process.env.MAIL_SECURE || "false"
  );

  const mailUser = await getSettingValue(
    "MAIL_USER",
    companyId,
    process.env.MAIL_USER || ""
  );

  const mailPass = await getSettingValue(
    "MAIL_PASS",
    companyId,
    process.env.MAIL_PASS || ""
  );

  const mailFrom = await getSettingValue(
    "MAIL_FROM",
    companyId,
    process.env.MAIL_FROM || process.env.MAIL_USER || ""
  );

  const transporter = nodemailer.createTransport({
    host: mailHost,
    port: Number(mailPort || 587),
    secure: String(mailSecure || "false") === "true",
    auth: {
      user: mailUser,
      pass: mailPass
    }
  });

  await transporter.sendMail({
    from: mailFrom || mailUser,
    to,
    subject,
    html
  });
};

export default SendEmailService;