import express from "express";
import isAuth from "../middleware/isAuth";
import * as TelegramController from "../controllers/TelegramController";

const telegramRoutes = express.Router();

telegramRoutes.post(
  "/telegram/webhook/:whatsappId/:secret",
  TelegramController.webhook
);

telegramRoutes.post(
  "/telegram/:whatsappId/reconnect",
  isAuth,
  TelegramController.reconnect
);

telegramRoutes.post(
  "/telegram/:whatsappId/disconnect",
  isAuth,
  TelegramController.disconnect
);

export default telegramRoutes;
