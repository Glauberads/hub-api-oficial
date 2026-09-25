import nodemailer from "nodemailer";
import EmailSetting from "../../../models/EmailSetting";

interface SendData {
  to: string;
  subject: string;
  html: string;
}

class SmtpProvider {
  async send(setting: EmailSetting, data: SendData): Promise<void> {
    if (!setting.smtpHost || !setting.smtpPort) {
      throw new Error("Configurações SMTP incompletas: host e porta são obrigatórios.");
    }

    if (!setting.smtpUser || !setting.smtpPass) {
      throw new Error("Credenciais SMTP não configuradas.");
    }

    if (!setting.fromAddress) {
      throw new Error("Email do remetente não configurado.");
    }

    const smtpPort = Number(setting.smtpPort);
    const isSSLPure = smtpPort === 465;
    const useSecure = isSSLPure || Boolean(setting.smtpSecure);

    const transporter = nodemailer.createTransport({
      host: setting.smtpHost,
      port: smtpPort,
      secure: useSecure,
      requireTLS: !isSSLPure,
      auth: {
        user: setting.smtpUser,
        pass: setting.smtpPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: {
        name: setting.fromName || "Multizap",
        address: setting.fromAddress
      },
      to: data.to,
      subject: data.subject,
      html: data.html
    });
  }
}

export default SmtpProvider;