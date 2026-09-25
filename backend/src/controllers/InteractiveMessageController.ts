import { Request, Response } from "express";
import InteractiveMessageService from "../services/WbotServices/InteractiveMessageService";
import AppError from "../errors/AppError";

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId, jid, type, data } = req.body;

  if (!jid) {
    throw new AppError("O campo 'jid' é obrigatório", 400);
  }

  if (!type) {
    throw new AppError("O campo 'type' é obrigatório", 400);
  }

  if (!data || typeof data !== "object") {
    throw new AppError("O campo 'data' é obrigatório e deve ser um objeto", 400);
  }

  const result = await InteractiveMessageService({
    companyId,
    whatsappId: whatsappId ? Number(whatsappId) : undefined,
    jid,
    type,
    data,
  });

  return res.status(200).json({
    message: "Mensagem interativa enviada com sucesso",
    messageId: result?.key?.id || null,
  });
};
