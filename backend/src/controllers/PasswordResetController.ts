import { Request, Response } from "express";
import RequestPasswordResetService from "../services/UserServices/RequestPasswordResetService";
import ResetPasswordService from "../services/UserServices/ResetPasswordService";

export const request = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;

  await RequestPasswordResetService({ email });

  return res.status(200).json({
    message: "Se o e-mail existir, você receberá um link para redefinir sua senha."
  });
};

export const reset = async (req: Request, res: Response): Promise<Response> => {
  const { token, password } = req.body;

  await ResetPasswordService({ token, password });

  return res.status(200).json({
    message: "Senha redefinida com sucesso."
  });
};