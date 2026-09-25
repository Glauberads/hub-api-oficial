import AppError from "../../errors/AppError";
import EmailSetting from "../../models/EmailSetting";
import { sendEmail } from "./providers";

interface SendData {
  to: string;
  subject: string;
  html: string;
}

class EmailMarketingService {
  async send(
    setting: EmailSetting,
    data: SendData
  ): Promise<void> {
    if (!setting.isActive) {
      throw new AppError(
        "Envio de email está desativado nas configurações da empresa.",
        403
      );
    }

    return sendEmail(setting, data);
  }
}

export default new EmailMarketingService();