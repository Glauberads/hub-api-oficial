import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

const isAuthApi = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  // Limpar token (remover aspas, espaços extras)
  const cleanToken = token.replace(/^["']|["']$/g, '').trim();

  if (!cleanToken) {
    throw new AppError("Token vazio ou inválido", 401);
  }

  let whatsapp: Whatsapp | null;
  try {
    whatsapp = await Whatsapp.findOne({ where: { token: cleanToken } });
  } catch (err) {
    console.error("[tokenAuth] Erro ao buscar token no banco:", err);
    throw new AppError(
      "Erro interno ao validar token da API. Verifique os logs.",
      500
    );
  }

  if (!whatsapp || whatsapp.token !== cleanToken) {
    console.warn(`[tokenAuth] Token não encontrado ou não corresponde. Token recebido: "${cleanToken.substring(0, 8)}..."`);
    throw new AppError("Token da API não encontrado. Verifique o token configurado na conexão.", 401);
  }

  return next();
};

export default isAuthApi;
