import { Request, Response } from "express";
import * as Yup from "yup";

import EmailSetting from "../models/EmailSetting";
import AppError from "../errors/AppError";
import EmailMarketingService from "../services/EmailMarketing/EmailMarketingService";

const getProvider = (value: any): string => {
  const provider = String(value || "sendgrid").trim().toLowerCase();

  if (!["sendgrid", "smtp"].includes(provider)) {
    throw new AppError("Provedor de email inválido");
  }

  return provider;
};

const findEmailSetting = async (companyId: number, provider: string) => {
  const setting = await EmailSetting.findOne({
    where: {
      companyId,
      provider
    }
  });

  if (!setting) {
    throw new AppError(
      `Configuração de email não encontrada para o provedor ${provider}`,
      404
    );
  }

  if (!setting.isActive) {
    throw new AppError(
      `Envio de email está desativado para o provedor ${provider}`,
      403
    );
  }

  return setting;
};

/**
 * POST /email-marketing/test
 * Envia email de teste usando o provider selecionado.
 */
export const testEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    to: Yup.string().email("Email de destino inválido").required(),
    provider: Yup.string().oneOf(["sendgrid", "smtp"]).nullable()
  });

  await schema.validate(req.body).catch(err => {
    throw new AppError(err.message);
  });

  const provider = getProvider(req.body.provider);

  const setting = await findEmailSetting(companyId, provider);

  try {
    await EmailMarketingService.send(setting, {
      to: req.body.to,
      subject: "✅ Teste de Email",
      html: `
        <h1>Email de teste</h1>
        <p>Parabéns, isso mostra que sua configuração está <strong>funcionando corretamente</strong>.</p>
        <p>Provider utilizado: <strong>${setting.provider.toUpperCase()}</strong></p>
        <p>Se você recebeu esta mensagem, sua configuração de envio está ativa.</p>
      `
    });

    return res.status(200).json({
      success: true,
      provider: setting.provider,
      message: "Email de teste enviado com sucesso"
    });
  } catch (err: any) {
    console.error("[EmailMarketing] Erro no teste:", err);

    return res.status(400).json({
      success: false,
      provider: setting.provider,
      error: err.message
    });
  }
};

/**
 * POST /email-marketing/send
 * Envia email marketing usando o provider informado.
 */
export const sendMarketingEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    to: Yup.string().email("Email de destino inválido").required(),
    subject: Yup.string().required(),
    html: Yup.string().required(),
    provider: Yup.string().oneOf(["sendgrid", "smtp"]).nullable(),
    emailProvider: Yup.string().oneOf(["sendgrid", "smtp"]).nullable()
  });

  await schema.validate(req.body).catch(err => {
    throw new AppError(err.message);
  });

  const provider = getProvider(req.body.emailProvider || req.body.provider);

  const setting = await findEmailSetting(companyId, provider);

  try {
    await EmailMarketingService.send(setting, {
      to: req.body.to,
      subject: req.body.subject,
      html: req.body.html
    });

    return res.status(200).json({
      success: true,
      provider: setting.provider,
      message: "Email enviado com sucesso"
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }

    console.error("[EmailMarketing] Erro no envio:", err);

    return res.status(400).json({
      success: false,
      provider: setting.provider,
      error: err.message
    });
  }
};