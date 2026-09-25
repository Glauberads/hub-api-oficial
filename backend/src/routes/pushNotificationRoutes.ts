import express from "express";
import isAuth from "../middleware/isAuth";
import * as PushNotificationController from "../controllers/PushNotificationController";

const pushNotificationRoutes = express.Router();

// Rota pública - retorna VAPID public key
pushNotificationRoutes.get("/push/vapid-public-key", PushNotificationController.getPublicKey);

// Rotas autenticadas
pushNotificationRoutes.post("/push/subscribe", isAuth, PushNotificationController.subscribe);
pushNotificationRoutes.post("/push/unsubscribe", isAuth, PushNotificationController.unsubscribe);

export default pushNotificationRoutes;
