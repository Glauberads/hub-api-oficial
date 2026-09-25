import EmailSetting from "../../../models/EmailSetting";
import SendGridProvider from "./SendGridProvider";
import SmtpProvider from "./SmtpProvider";

interface SendData {
  to: string;
  subject: string;
  html: string;
}

/**
 * Factory: escolhe o provider de email baseado na configuração selecionada.
 */
export async function sendEmail(
  setting: EmailSetting,
  data: SendData
): Promise<void> {
  switch (setting.provider) {
    case "sendgrid":
      return new SendGridProvider().send(setting, data);

    case "smtp":
      return new SmtpProvider().send(setting, data);

    default:
      throw new Error(`Provedor de email desconhecido: ${setting.provider}`);
  }
}

export { SendGridProvider, SmtpProvider };