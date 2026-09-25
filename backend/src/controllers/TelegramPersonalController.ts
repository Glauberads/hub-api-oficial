import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import {
  confirmTelegramPersonalCodeService,
  startTelegramPersonalCodeService,
  startTelegramPersonalSession,
  stopTelegramPersonalSession
} from "../services/TelegramServices/TelegramPersonalService";

const findConnection = async (id: number, companyId: number): Promise<Whatsapp> => {
  const whatsapp = await Whatsapp.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!whatsapp) {
    throw new AppError("Conexão não encontrada", 404);
  }

  return whatsapp;
};

export const sendCode = async (req: Request, res: Response): Promise<Response> => {
  const user: any = (req as any).user;
  const companyId = Number(user.companyId);
  const whatsappId = req.params.whatsappId ? Number(req.params.whatsappId) : Number(req.body.whatsappId || 0);

  const {
    name,
    apiId,
    apiHash,
    phone
  } = req.body;

  let whatsapp: Whatsapp | null = null;

  if (whatsappId) {
    whatsapp = await findConnection(whatsappId, companyId);
    await whatsapp.update({
      name: name || whatsapp.name,
      channel: "telegram",
      telegramConnectionType: "personal",
      telegramApiId: Number(apiId || (whatsapp as any).telegramApiId),
      telegramApiHash: apiHash || (whatsapp as any).telegramApiHash,
      telegramPhone: phone || (whatsapp as any).telegramPhone,
      status: "PAIRING"
    } as any);
  } else {
    whatsapp = await Whatsapp.create({
      name: name || "Telegram Pessoal",
      channel: "telegram",
      telegramConnectionType: "personal",
      telegramApiId: Number(apiId),
      telegramApiHash: apiHash,
      telegramPhone: phone,
      status: "PAIRING",
      companyId,
      token: "",
      number: phone || "",
      qrcode: null,
      battery: "",
      plugged: false,
      retries: 0
    } as any);
  }

  const result = await startTelegramPersonalCodeService({
    whatsapp
  });

  return res.status(200).json(result);
};

export const confirmCode = async (req: Request, res: Response): Promise<Response> => {
  const user: any = (req as any).user;
  const companyId = Number(user.companyId);
  const whatsappId = Number(req.params.whatsappId);

  const whatsapp = await findConnection(whatsappId, companyId);

  const result = await confirmTelegramPersonalCodeService({
    whatsapp,
    code: req.body.code,
    password: req.body.password
  });

  return res.status(200).json(result);
};

export const startSession = async (req: Request, res: Response): Promise<Response> => {
  const user: any = (req as any).user;
  const companyId = Number(user.companyId);
  const whatsappId = Number(req.params.whatsappId);

  await findConnection(whatsappId, companyId);
  await startTelegramPersonalSession(whatsappId);

  return res.status(200).json({
    whatsappId,
    status: "CONNECTED"
  });
};

export const disconnect = async (req: Request, res: Response): Promise<Response> => {
  const user: any = (req as any).user;
  const companyId = Number(user.companyId);
  const whatsappId = Number(req.params.whatsappId);

  await findConnection(whatsappId, companyId);
  await stopTelegramPersonalSession(whatsappId);

  return res.status(200).json({
    whatsappId,
    status: "DISCONNECTED"
  });
};
