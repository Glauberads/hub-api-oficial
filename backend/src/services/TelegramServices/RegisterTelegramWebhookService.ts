import { randomBytes } from "crypto";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import { getTelegramMe, setTelegramWebhook } from "./TelegramApiService";

type Request = {
  whatsapp: Whatsapp;
};

const buildBackendUrl = (): string => {
  const raw = String(process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");

  if (!raw) {
    throw new AppError("BACKEND_URL não configurado. Não é possível registrar webhook Telegram.", 400);
  }

  return raw;
};

const RegisterTelegramWebhookService = async ({
  whatsapp
}: Request): Promise<Whatsapp> => {
  if (whatsapp.channel !== "telegram") {
    throw new AppError("A conexão informada não é Telegram", 400);
  }

  const token = String(whatsapp.token || "").trim();

  if (!token) {
    throw new AppError("Informe o token do Bot Telegram", 400);
  }

  const bot = await getTelegramMe(token);

  if (!bot?.id) {
    throw new AppError("Token Telegram inválido", 400);
  }

  const secret =
    whatsapp.telegramWebhookSecret ||
    randomBytes(24).toString("hex");

  const backendUrl = buildBackendUrl();
  const webhookUrl = `${backendUrl}/telegram/webhook/${whatsapp.id}/${secret}`;

  await setTelegramWebhook({
    token,
    url: webhookUrl,
    secret
  });

  await whatsapp.update({
    status: "CONNECTED",
    number: bot.username ? `@${bot.username}` : String(bot.id),
    phone_number: bot.username ? `@${bot.username}` : String(bot.id),
    telegramBotId: String(bot.id),
    telegramBotUsername: bot.username || "",
    telegramBotFirstName: bot.first_name || "",
    telegramWebhookSecret: secret,
    telegramWebhookUrl: webhookUrl,
    telegramLastError: null
  });

  return whatsapp;
};

export default RegisterTelegramWebhookService;
