import { Request, Response } from "express";
import AppError from "../../errors/AppError";
import { getAsaasSecondCopyByCpfCnpj } from "../../services/AsaasServices/AsaasApiService";
import FormatAsaasSecondCopyMessageService from "../../services/AsaasServices/FormatAsaasSecondCopyMessageService";

export const secondCopy = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { cpfCnpj } = req.body;

  if (!cpfCnpj) {
    throw new AppError("Informe o CPF ou CNPJ.", 400);
  }

  const result = await getAsaasSecondCopyByCpfCnpj({
    companyId,
    cpfCnpj
  });

  const replyMessage = FormatAsaasSecondCopyMessageService(result);

  return res.status(200).json({
    ...result,
    replyMessage
  });
};