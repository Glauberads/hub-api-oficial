import AppError from "../../errors/AppError";
import User from "../../models/User";

interface Request {
  email: string;
  code: string;
}

const VerifyEmailCodeService = async ({
  email,
  code
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
    return user;
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpiresAt) {
    throw new AppError("Código de verificação não encontrado.", 400);
  }

  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    throw new AppError("Código de verificação inválido.", 400);
  }

  if (user.emailVerificationCode !== normalizedCode) {
    throw new AppError("Código de verificação inválido.", 400);
  }

  if (new Date() > new Date(user.emailVerificationExpiresAt)) {
    throw new AppError("Código de verificação expirado.", 400);
  }

  user.emailVerified = true;
  user.emailVerificationCode = null;
  user.emailVerificationExpiresAt = null;
  user.emailVerificationSentAt = null;

  await user.save();

  return user;
};

export default VerifyEmailCodeService;