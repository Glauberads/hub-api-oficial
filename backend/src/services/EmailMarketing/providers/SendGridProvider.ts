import sgMail from "@sendgrid/mail";
import EmailSetting from "../../../models/EmailSetting";

interface SendData {
  to: string;
  subject: string;
  html: string;
}

class SendGridProvider {
  async send(setting: EmailSetting, data: SendData): Promise<void> {
    sgMail.setApiKey(setting.sendgridApiKey);

    await sgMail.send({
      to: data.to,
      from: {
        email: setting.fromAddress,
        name: setting.fromName
      },
      subject: data.subject,
      html: data.html
    });
  }
}

export default SendGridProvider;