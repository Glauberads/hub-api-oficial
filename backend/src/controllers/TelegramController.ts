import { Request, Response } from "express";

import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import HandleTelegramWebhookService from "../services/TelegramServices/HandleTelegramWebhookService";
import RegisterTelegramWebhookService from "../services/TelegramServices/RegisterTelegramWebhookService";
import { deleteTelegramWebhook } from "../services/TelegramServices/TelegramApiService";

export const webhook = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, secret } = req.params;

  await HandleTelegramWebhookService({
    whatsappId,
    secret,
    headerSecret: req.headers["x-telegram-bot-api-secret-token"],
    update: req.body
  });

  return res.sendStatus(200);
};

export const reconnect = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId,
      channel: "telegram"
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  await RegisterTelegramWebhookService({ whatsapp });

  return res.status(200).json(whatsapp);
};

export const disconnect = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: {
      id: whatsappId,
      companyId,
      channel: "telegram"
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão Telegram não encontrada", 404);
  }

  if (whatsapp.token) {
    await deleteTelegramWebhook(whatsapp.token);
  }

  await whatsapp.update({
    status: "DISCONNECTED"
  });

  return res.status(200).json(whatsapp);
};
