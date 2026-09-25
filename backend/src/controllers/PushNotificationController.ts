import { Request, Response } from "express";
import {
  getVapidPublicKey,
  subscribeUser,
  unsubscribeUser
} from "../services/PushNotificationService";

export const getPublicKey = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const publicKey = getVapidPublicKey();
  return res.json({ publicKey });
};

export const subscribe = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { endpoint, keys } = req.body;
  const userId = Number(req.user.id);
  const companyId = Number(req.user.companyId);

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Dados de subscription inválidos" });
  }

  const subscription = await subscribeUser({
    userId,
    companyId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: req.headers["user-agent"]
  });

  return res.status(201).json({
    id: subscription.id,
    message: "Subscription criada com sucesso"
  });
};

export const unsubscribe = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { endpoint } = req.body;
  const userId = Number(req.user.id);
  const companyId = Number(req.user.companyId);

  if (!endpoint) {
    return res.status(400).json({ error: "Endpoint é obrigatório" });
  }

  await unsubscribeUser({
    userId,
    companyId,
    endpoint
  });

  return res.json({ message: "Subscription removida com sucesso" });
};