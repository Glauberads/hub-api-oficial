import AppError from "../../errors/AppError";
import { SendMail } from "../../helpers/SendMail";

interface Request {
  companyId: number;
  to: string;
  mailHost?: string;
  mailPort?: string | number;
  mailSecure?: string | boolean;
  mailUser?: string;
  mailPass?: string;
  mailFrom?: string;
}

const TestEmailService = async ({
  companyId,
  to,
  mailHost,
  mailPort,
  mailSecure,
  mailUser,
  mailPass,
  mailFrom
}: Request): Promise<void> => {
  if (!to || !String(to).trim()) {
    throw new AppError("Informe o e-mail de destino para teste.", 400);
  }

  await SendMail({
    to: String(to).trim(),
    companyId,
    subject: "Teste de integração SMTP",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222; line-height: 1.6;">
        <div style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 10px;">
          <h2 style="margin-top: 0; color: #111;">Teste de envio SMTP</h2>
          <p>Este e-mail foi enviado com sucesso pelo teste de integração SMTP do sistema.</p>
          <p>Se você recebeu esta mensagem, a configuração de envio está funcionando corretamente.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">
            Mensagem automática de teste.
          </p>
        </div>
      </div>
    `,
    smtpConfig: {
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      user: mailUser,
      pass: mailPass,
      from: mailFrom
    }
  });
};

export default TestEmailService;