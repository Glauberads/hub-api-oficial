import { Request, Response } from "express";
import * as Yup from "yup";

import EmailSetting from "../models/EmailSetting";
import AppError from "../errors/AppError";

const maskSensitiveFields = (setting: EmailSetting) => {
  const safeSetting: any = setting.toJSON();

  if (safeSetting.sendgridApiKey) {
    safeSetting.sendgridApiKey = "********";
  }

  if (safeSetting.smtpPass) {
    safeSetting.smtpPass = "********";
  }

  if (safeSetting.sesSecretKey) {
    safeSetting.sesSecretKey = "********";
  }

  return safeSetting;
};

const getProvider = (value: any): string => {
  const provider = String(value || "sendgrid").trim().toLowerCase();

  if (!["sendgrid", "smtp"].includes(provider)) {
    throw new AppError("Provedor de email inválido");
  }

  return provider;
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const provider = getProvider(req.query.provider);

  let setting = await EmailSetting.findOne({
    where: {
      companyId,
      provider
    }
  });

  if (!setting) {
    setting = await EmailSetting.create({
      companyId,
      provider,
      dailyLimit: 200,
      ratePerMinute: 5,
      continueHour: "08:00",
      isActive: false,
      smtpPort: provider === "smtp" ? 587 : null,
      smtpSecure: false
    } as any);
  }

  return res.status(200).json(maskSensitiveFields(setting));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    provider: Yup.string().oneOf(["sendgrid", "smtp"]).required(),

    sendgridApiKey: Yup.string().nullable(),

    smtpHost: Yup.string().nullable(),
    smtpPort: Yup.number().nullable(),
    smtpUser: Yup.string().nullable(),
    smtpPass: Yup.string().nullable(),
    smtpSecure: Yup.boolean().nullable(),

    fromAddress: Yup.string().email("Email do remetente inválido").nullable(),
    fromName: Yup.string().nullable(),

    dailyLimit: Yup.number().min(1).required(),
    ratePerMinute: Yup.number().min(1).required(),
    continueHour: Yup.string()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horário de continuação inválido")
      .nullable(),
    isActive: Yup.boolean().required()
  });

  await schema.validate(req.body).catch(err => {
    throw new AppError(err.message);
  });

  const provider = getProvider(req.body.provider);

  const data: any = {
    ...req.body,
    provider
  };

  if (data.sendgridApiKey === "********") {
    delete data.sendgridApiKey;
  }

  if (data.smtpPass === "********") {
    delete data.smtpPass;
  }

  if (data.sesSecretKey === "********") {
    delete data.sesSecretKey;
  }

  data.smtpSecure = Boolean(data.smtpSecure);
  data.continueHour = data.continueHour || "08:00";

  const [setting] = await EmailSetting.findOrCreate({
    where: {
      companyId,
      provider
    },
    defaults: {
      companyId,
      provider,
      dailyLimit: 200,
      ratePerMinute: 5,
      continueHour: "08:00",
      isActive: false,
      smtpPort: provider === "smtp" ? 587 : null,
      smtpSecure: false
    } as any
  });

  await setting.update(data);

  return res.status(200).json(maskSensitiveFields(setting));
};