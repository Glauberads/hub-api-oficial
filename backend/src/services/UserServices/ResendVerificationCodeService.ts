import AppError from "../../errors/AppError";
import User from "../../models/User";
import SendVerificationCodeEmailService from "./SendVerificationCodeEmailService";

interface Request {
  email: string;
}

const generateEmailVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const ResendVerificationCodeService = async ({
  email
}: Request): Promise<User> => {
  const user = await User.findOne({
    where: {
      email
    }
  });

  if (!user) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (user.emailVerified) {
    throw new AppError("Este e-mail já foi confirmado.", 400);
  }

  if (!user.companyId) {
    throw new AppError("Empresa do usuário não encontrada.", 400);
  }

  const now = new Date();

  if (user.emailVerificationSentAt) {
    const lastSentAt = new Date(user.emailVerificationSentAt);
    const diffInMs = now.getTime() - lastSentAt.getTime();

    if (diffInMs < 60000) {
      throw new AppError("Aguarde 1 minuto para solicitar um novo código.", 429);
    }
  }

  const emailVerificationCode = generateEmailVerificationCode();
  const emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.emailVerificationCode = emailVerificationCode;
  user.emailVerificationExpiresAt = emailVerificationExpiresAt;
  user.emailVerificationSentAt = now;

  await user.save();

  await SendVerificationCodeEmailService({
    email: user.email,
    name: user.name,
    code: emailVerificationCode,
    companyId: user.companyId
  });

  return user;
};

export default ResendVerificationCodeService;