import AppError from "../../errors/AppError";
import { SendMail } from "../../helpers/SendMail";

interface Request {
  email: string;
  name: string;
  code: string;
  companyId: number;
}

const SendVerificationCodeEmailService = async ({
  email,
  name,
  code,
  companyId
}: Request): Promise<void> => {
  try {
    await SendMail({
      to: email,
      subject: "Código de confirmação de cadastro",
      companyId,
      text: `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 10px;">
            <h2 style="margin-top: 0; color: #111;">Confirmação de cadastro</h2>
            <p>Olá, <strong>${name}</strong>.</p>
            <p>Use o código abaixo para confirmar seu cadastro no sistema:</p>

            <div style="margin: 24px 0; text-align: center;">
              <div style="display: inline-block; padding: 14px 24px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; background: #f5f5f5; color: #111;">
                ${code}
              </div>
            </div>

            <p>Esse código expira em <strong>10 minutos</strong>.</p>
            <p>Se você não solicitou esse cadastro, ignore este e-mail.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

            <p style="font-size: 12px; color: #666; margin-bottom: 0;">
              Esta é uma mensagem automática. Não responda este e-mail.
            </p>
          </div>
        </div>
      `
    });
  } catch (err) {
    throw new AppError("Não foi possível enviar o código de confirmação por e-mail.");
  }
};

export default SendVerificationCodeEmailService;