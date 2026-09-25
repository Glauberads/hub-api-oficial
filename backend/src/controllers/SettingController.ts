import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import path from "path";
import fs from "fs";
import sharp from "sharp";
import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import ListSettingsServiceOne from "../services/SettingServices/ListSettingsServiceOne";
import GetSettingService from "../services/SettingServices/GetSettingService";
import UpdateOneSettingService from "../services/SettingServices/UpdateOneSettingService";
import GetPublicSettingService from "../services/SettingServices/GetPublicSettingService";
import TestEmailService from "../services/SettingServices/TestEmailService";

type LogoRequest = {
  mode: string;
};

type PrivateFileRequest = {
  settingKey: string;
};

type PublicFileRequest = {
  settingKey: string;
};

const MAIN_COMPANY_ID = 1;

const MAIN_COMPANY_ONLY_KEYS = new Set([
  "MAIL_HOST",
  "MAIL_PORT",
  "MAIL_SECURE",
  "MAIL_USER",
  "MAIL_PASS",
  "MAIL_FROM",
  "loginWhatsappNumber",
  "loginShowWhatsappButton",
  "loginBannerMode",
  "loginBannerImageUrl",
  "loginBannerTitle",
  "loginBannerSubtitle",
  "loginBannerBadge1",
  "loginBannerBadge2",
  "loginBannerBadge3",
  "loginLogoUrl",
  "loginLogo",
  "loginBannerImage",
  "pwaIconUrl",
  "pwaIcon",
  "pwaIconUrl",
  "pwaIcon",
  "pwaIcon192",
  "pwaIcon512"
]);

const PRIVATE_SETTING_KEYS = new Set([
  "aiApiKey"
]);

const AI_SETTING_KEYS = new Set([
  "enableAiSuggestions",
  "aiApiKey",
  "aiSuggestionModel",
  "aiSuggestionPrompt",
  "aiSuggestionMessagesLimit"
]);

const maskPrivateSetting = (setting: any, profile: string): any => {
  if (PRIVATE_SETTING_KEYS.has(setting.key) && profile !== "admin") {
    return {
      ...setting.toJSON?.() || setting,
      value: ""
    };
  }

  return setting;
};

const isMainCompany = (companyId: number | string): boolean => {
  return Number(companyId) === MAIN_COMPANY_ID;
};

const ensureMainCompanyOnlySettingAccess = (
  companyId: number | string,
  key: string
): void => {
  if (MAIN_COMPANY_ONLY_KEYS.has(key) && !isMainCompany(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const ensureMainCompanyOnlyBrandingAccess = (
  companyId: number | string
): void => {
  if (!isMainCompany(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile } = req.user;

  let settings = await ListSettingsService({ companyId });

  if (!isMainCompany(companyId)) {
    settings = settings.filter(
      setting => !MAIN_COMPANY_ONLY_KEYS.has(setting.key)
    );
  }

  const safeSettings = settings.map(setting =>
    maskPrivateSetting(setting, profile)
  );

  return res.status(200).json(safeSettings);
};

export const showOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;
  const { settingKey: key } = req.params;

  ensureMainCompanyOnlySettingAccess(companyId, key);

  const setting = await ListSettingsServiceOne({
    companyId,
    key
  });

  if (setting && PRIVATE_SETTING_KEYS.has(key) && profile !== "admin") {
    return res.status(200).json({
      ...setting.toJSON?.() || setting,
      value: ""
    });
  }

  return res.status(200).json(setting);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { settingKey: key } = req.params;
  const { value } = req.body;
  const { companyId } = req.user;

  ensureMainCompanyOnlySettingAccess(companyId, key);

  if (AI_SETTING_KEYS.has(key) && typeof value !== "string") {
    throw new AppError("INVALID_SETTING_VALUE", 400);
  }

  const setting = await UpdateSettingService({
    key,
    value,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-settings`, {
    action: "update",
    setting: PRIVATE_SETTING_KEYS.has(setting.key)
      ? {
        ...setting.toJSON?.() || setting,
        value: ""
      }
      : setting
  });

  return res.status(200).json(
    PRIVATE_SETTING_KEYS.has(setting.key)
      ? {
        ...setting.toJSON?.() || setting,
        value: ""
      }
      : setting
  );
};

export const getSetting = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { settingKey: key } = req.params;

  const setting = await GetSettingService({ key });

  return res.status(200).json(setting);
};

export const updateOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { settingKey: key } = req.params;
  const { value } = req.body;
  const { companyId } = req.user;

  ensureMainCompanyOnlySettingAccess(companyId, key);

  const setting = await UpdateOneSettingService({
    key,
    value
  });

  return res.status(200).json(setting);
};

export const publicShow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { settingKey: key } = req.params;
  const { companyId } = req.query;

  const targetCompanyId = companyId ? parseInt(companyId as string) : undefined;

  const settingValue = await GetPublicSettingService({
    key,
    companyId: targetCompanyId
  });

  return res.status(200).json(settingValue);
};

export const testEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;

  ensureMainCompanyOnlyBrandingAccess(companyId);

  const {
    to,
    mailHost,
    mailPort,
    mailSecure,
    mailUser,
    mailPass,
    mailFrom
  } = req.body;

  await TestEmailService({
    companyId,
    to,
    mailHost,
    mailPort,
    mailSecure,
    mailUser,
    mailPass,
    mailFrom
  });

  return res.status(200).json({
    message: "E-mail de teste enviado com sucesso."
  });
};

export const storeLogo = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const file = req.file as Express.Multer.File;
  const { mode }: LogoRequest = req.body;
  const { companyId } = req.user;
  const validModes = [
    "Light",
    "Dark",
    "Favicon",
    "BackgroundLight",
    "BackgroundDark"
  ];

  ensureMainCompanyOnlyBrandingAccess(companyId);

  if (validModes.indexOf(mode) === -1) {
    return res.sendStatus(406);
  }

  if (file && file.mimetype.startsWith("image/")) {
    const setting = await UpdateSettingService({
      key: `appLogo${mode}`,
      value: file.filename,
      companyId
    });

    return res.status(200).json(setting.value);
  }

  return res.sendStatus(406);
};

export const storePrivateFile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = req.file as Express.Multer.File;
  const { settingKey }: PrivateFileRequest = req.body;
  const { companyId } = req.user;

  if (!file) {
    throw new AppError("ERR_NO_FILE_UPLOADED", 400);
  }

  const setting = await UpdateSettingService({
    key: settingKey,
    value: file.filename,
    companyId
  });

  return res.status(200).json(setting.value);
};

const generatePwaIconFiles = async (
  file: Express.Multer.File,
  companyId: number | string
): Promise<{
  icon192Value: string;
  icon512Value: string;
}> => {
  const uploadDir = path.dirname(file.path);
  const timestamp = Date.now();
  const baseName = `pwa-icon-${companyId}-${timestamp}`;

  const icon192Filename = `${baseName}-192x192.png`;
  const icon512Filename = `${baseName}-512x512.png`;

  const icon192Path = path.join(uploadDir, icon192Filename);
  const icon512Path = path.join(uploadDir, icon512Filename);

  await sharp(file.path)
    .rotate()
    .resize(192, 192, {
      fit: "cover",
      position: "center"
    })
    .png({
      quality: 100,
      compressionLevel: 9
    })
    .toFile(icon192Path);

  await sharp(file.path)
    .rotate()
    .resize(512, 512, {
      fit: "cover",
      position: "center"
    })
    .png({
      quality: 100,
      compressionLevel: 9
    })
    .toFile(icon512Path);

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn("Não foi possível remover imagem original do PWA:", error);
  }

  return {
    icon192Value: icon192Filename,
    icon512Value: icon512Filename
  };
};

export const storePublicFile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const file = req.file as Express.Multer.File;
  const { settingKey }: PublicFileRequest = req.body;
  const { companyId } = req.user;

  const allowedKeys = [
    "loginLogo",
    "loginBannerImage",
    "eficertificado",
    "pwaIcon"
  ];

  if (!allowedKeys.includes(settingKey)) {
    throw new AppError("INVALID_SETTING_KEY", 400);
  }

  ensureMainCompanyOnlySettingAccess(companyId, settingKey);

  if (!file) {
    throw new AppError("ERR_NO_FILE_UPLOADED", 400);
  }

  if (settingKey === "eficertificado") {
    if (!file.originalname.toLowerCase().endsWith(".p12")) {
      throw new AppError("INVALID_FILE", 400);
    }
  } else if (!file.mimetype.startsWith("image/")) {
    throw new AppError("INVALID_FILE", 400);
  }

  if (settingKey === "pwaIcon") {
    const { icon192Value, icon512Value } = await generatePwaIconFiles(
      file,
      companyId
    );

    await UpdateSettingService({
      key: "pwaIcon192",
      value: icon192Value,
      companyId
    });

    await UpdateSettingService({
      key: "pwaIcon512",
      value: icon512Value,
      companyId
    });

    const setting = await UpdateSettingService({
      key: "pwaIcon",
      value: icon512Value,
      companyId
    });

    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-settings`, {
      action: "update",
      setting
    });

    return res.status(200).json(setting.value);
  }

  const value =
    settingKey === "eficertificado"
      ? `company${companyId}/efi/${file.filename}`
      : file.filename;

  const setting = await UpdateSettingService({
    key: settingKey,
    value,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-settings`, {
    action: "update",
    setting
  });

  return res.status(200).json(setting.value);
};