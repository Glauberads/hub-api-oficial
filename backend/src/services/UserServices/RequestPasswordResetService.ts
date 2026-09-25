import { createHash, randomBytes } from "crypto";
import User from "../../models/User";
import PasswordReset from "../../models/PasswordReset";
import SendEmailService from "../EmailServices/SendEmailService";

interface Request {
  email: string;
}

const RequestPasswordResetService = async ({
  email
}: Request): Promise<void> => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return;
  }

  const user = await User.findOne({
    where: { email: normalizedEmail }
  });

  // resposta silenciosa para não expor se o e-mail existe
  if (!user) {
    return;
  }

  await PasswordReset.update(
    { usedAt: new Date() },
    {
      where: {
        userId: user.id,
        usedAt: null
      }
    }
  );

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await PasswordReset.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    usedAt: null
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const appName = process.env.APP_NAME || "Sistema";
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  await SendEmailService({
    to: user.email,
    subject: `${appName} - Redefinição de senha`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222;">
        <p>Olá${user.name ? `, ${user.name}` : ""}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <p style="margin: 24px 0;">
          <a
            href="${resetLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;padding:12px 18px;background:#1976d2;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;"
          >
            Redefinir senha
          </a>
        </p>
        <p>Se preferir, copie e cole este link no navegador:</p>
        <p>${resetLink}</p>
        <p>Esse link expira em 1 hora.</p>
        <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
      </div>
    `
  });
};

export default RequestPasswordResetService;