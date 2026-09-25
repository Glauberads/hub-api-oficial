import { createHash } from "crypto";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import PasswordReset from "../../models/PasswordReset";
import User from "../../models/User";

interface Request {
  token: string;
  password: string;
}

const ResetPasswordService = async ({
  token,
  password
}: Request): Promise<void> => {
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) {
    throw new AppError("ERR_INVALID_TOKEN", 400);
  }

  if (!password || password.length < 6) {
    throw new AppError("ERR_PASSWORD_TOO_SHORT", 400);
  }

  const tokenHash = createHash("sha256").update(normalizedToken).digest("hex");

  const passwordReset = await PasswordReset.findOne({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!passwordReset) {
    throw new AppError("ERR_INVALID_OR_EXPIRED_TOKEN", 400);
  }

  const user = await User.findByPk(passwordReset.userId);

  if (!user) {
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  user.password = password;
  await user.save();

  passwordReset.usedAt = new Date();
  await passwordReset.save();

  await PasswordReset.update(
    { usedAt: new Date() },
    {
      where: {
        userId: user.id,
        id: {
          [Op.ne]: passwordReset.id
        },
        usedAt: null
      }
    }
  );

  // invalida tokens JWT antigos, caso seu sistema use tokenVersion
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
};

export default ResetPasswordService;