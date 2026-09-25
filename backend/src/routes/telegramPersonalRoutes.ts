import express from "express";
import isAuth from "../middleware/isAuth";
import * as TelegramPersonalController from "../controllers/TelegramPersonalController";

const telegramPersonalRoutes = express.Router();

telegramPersonalRoutes.post("/telegram/personal/send-code", isAuth, TelegramPersonalController.sendCode);
telegramPersonalRoutes.post("/telegram/personal/:whatsappId/send-code", isAuth, TelegramPersonalController.sendCode);
telegramPersonalRoutes.post("/telegram/personal/:whatsappId/confirm", isAuth, TelegramPersonalController.confirmCode);
telegramPersonalRoutes.post("/telegram/personal/:whatsappId/start", isAuth, TelegramPersonalController.startSession);
telegramPersonalRoutes.post("/telegram/personal/:whatsappId/disconnect", isAuth, TelegramPersonalController.disconnect);

export default telegramPersonalRoutes;
