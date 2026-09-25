import * as Yup from "yup";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { getIO } from "../libs/socket";

import ListService from "../services/QuickMessageService/ListService";
import CreateService from "../services/QuickMessageService/CreateService";
import ShowService from "../services/QuickMessageService/ShowService";
import UpdateService from "../services/QuickMessageService/UpdateService";
import DeleteService from "../services/QuickMessageService/DeleteService";
import FindService from "../services/QuickMessageService/FindService";

import QuickMessage from "../models/QuickMessage";
import QuickMessageComponent from "../models/QuickMessageComponent";
import { head } from "lodash";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import AdmZip from "adm-zip";

import AppError from "../errors/AppError";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import logger from "../utils/logger";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  userId: string | number;
};

type StoreData = {
  shortcode: string;
  message: string;
  userId: number | number;
  mediaPath?: string;
  mediaName?: string;
  mediaType?: string;
  geral: boolean;
  isMedia: boolean;
  visao: boolean;
  isOficial: boolean;
  language?: string;
  status?: string;
  category?: string;
  metaID?: string;
  interactiveButtons?: Array<{
    type?: string;
    text?: string;
    id?: string;
    url?: string;
    copyCode?: string;
    phoneNumber?: string;
  }>;
};

const normalizeInteractiveButtons = (value: StoreData["interactiveButtons"]) => {
  if (!Array.isArray(value)) return [];

  const allowedTypes = new Set(["quick_reply", "cta_url", "cta_copy", "cta_call"]);
  const buttons = value
    .map((button, index) => ({
      type: String(button?.type || "quick_reply").trim().toLowerCase(),
      text: String(button?.text || "").trim(),
      id: String(button?.id || `quick_message_button_${index + 1}`).trim(),
      url: String(button?.url || "").trim(),
      copyCode: String(button?.copyCode || "").trim(),
      phoneNumber: String(button?.phoneNumber || "").trim()
    }))
    .filter(button => button.text)
    .slice(0, 3);

  for (const button of buttons) {
    if (!allowedTypes.has(button.type)) {
      throw new AppError(`Tipo de botão inválido: ${button.type}`, 400);
    }
    if (button.text.length > 25) {
      throw new AppError("O texto de cada botão deve ter no máximo 25 caracteres.", 400);
    }
    if (button.type === "cta_url") {
      try {
        const parsedUrl = new URL(button.url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        throw new AppError(`Informe uma URL válida para o botão "${button.text}".`, 400);
      }
    }
    if (button.type === "cta_copy" && !button.copyCode) {
      throw new AppError(`Informe o código do botão "${button.text}".`, 400);
    }
    if (button.type === "cta_call" && !/^\+?[0-9]{8,15}$/.test(button.phoneNumber)) {
      throw new AppError(`Informe um telefone válido para o botão "${button.text}".`, 400);
    }
  }

  return buttons.map(button => ({
    type: button.type,
    text: button.text,
    ...(button.type === "quick_reply" ? { id: button.id.slice(0, 200) } : {}),
    ...(button.type === "cta_url" ? { url: button.url } : {}),
    ...(button.type === "cta_copy" ? { copyCode: button.copyCode.slice(0, 500) } : {}),
    ...(button.type === "cta_call" ? { phoneNumber: button.phoneNumber } : {})
  }));
};

const saveInteractiveButtons = async (
  quickMessageId: number,
  value: StoreData["interactiveButtons"]
): Promise<void> => {
  const buttons = normalizeInteractiveButtons(value);

  await QuickMessageComponent.destroy({
    where: { quickMessageId, type: "BUTTONS" }
  });

  if (buttons.length > 0) {
    await QuickMessageComponent.create({
      quickMessageId,
      type: "BUTTONS",
      text: "Botões interativos",
      buttons: JSON.stringify(buttons)
    } as any);
  }
};

type FindParams = {
  companyId: string;
  userId: string;
  isOficial: string;
  status: string;
  whatsappId?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId, id: userId } = req.user;

  // Respostas rápidas nunca mostram templates oficiais (gerenciados em /template-manager)
  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    userId,
    isOficial: false
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;
  const { interactiveButtons, ...quickMessageData } = data;

  const schema = Yup.object().shape({
    shortcode: Yup.string().required(),
    message: data.isMedia ? Yup.string().notRequired() : Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await CreateService({
    ...quickMessageData,
    companyId,
    userId: req.user.id
  });

  await saveInteractiveButtons(record.id, interactiveButtons);
  const recordWithComponents = await ShowService(record.id, companyId);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-quickmessage`, {
      action: "create",
      record: recordWithComponents
    });

  return res.status(200).json(recordWithComponents);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  
  const record = await ShowService(id, companyId);

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as StoreData;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    shortcode: Yup.string().required(),
    message: data.isMedia ? Yup.string().notRequired() : Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;
  await ShowService(id, companyId);
  const { interactiveButtons, ...quickMessageData } = data;

  const record = await UpdateService({
    ...quickMessageData,
    userId: req.user.id,
    id,
  });

  await saveInteractiveButtons(record.id, interactiveButtons);
  const recordWithComponents = await ShowService(record.id, companyId);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-quickmessage`, {
      action: "update",
      record: recordWithComponents
    });

  return res.status(200).json(recordWithComponents);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-quickmessage`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Contact deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id: userId, companyId } = req.user;
  const params = {
    ...req.query as FindParams,
    userId: String(userId),
    companyId: String(companyId)
  };
  const records = await FindService(params);

  return res.status(200).json(records);
};


const safeExportFileName = (value: unknown): string => {
  const normalized = path.basename(String(value || "arquivo"))
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  return normalized || "arquivo";
};

const uniqueImportedShortcode = async (
  baseValue: unknown,
  companyId: number
): Promise<string> => {
  const original = String(baseValue || "resposta").trim().slice(0, 200)
    || "resposta";

  let candidate = original;
  let sequence = 1;

  while (
    await QuickMessage.findOne({
      where: {
        companyId,
        shortcode: candidate,
        isOficial: false
      }
    })
  ) {
    sequence += 1;
    const suffix = `_importado_${sequence}`;
    candidate = `${original.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
  }

  return candidate;
};


export const bulkRemove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const receivedIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

  const ids: number[] = Array.from(
    new Set<number>(
      receivedIds
        .map((value: any): number => Number(value))
        .filter((value: number): boolean =>
          Number.isInteger(value) && value > 0
        )
    )
  ).slice(0, 1000);

  if (ids.length === 0) {
    throw new AppError(
      "Selecione pelo menos uma resposta rápida para excluir.",
      400
    );
  }

  const records = await QuickMessage.findAll({
    where: {
      id: { [Op.in]: ids },
      companyId,
      isOficial: false
    }
  });

  if (records.length === 0) {
    throw new AppError(
      "Nenhuma resposta rápida válida foi encontrada.",
      404
    );
  }

  const baseDir = path.resolve(
    __dirname,
    "..",
    "..",
    "public",
    `company${companyId}`,
    "quickMessage"
  );

  const recordIds = records.map(record => record.id);

  await QuickMessageComponent.destroy({
    where: {
      quickMessageId: { [Op.in]: recordIds }
    }
  });

  await QuickMessage.destroy({
    where: {
      id: { [Op.in]: recordIds },
      companyId
    }
  });

  for (const record of records) {
    const storedMediaPath = record.getDataValue("mediaPath") as string | null;

    if (storedMediaPath) {
      const mediaFile = path.resolve(
        baseDir,
        path.basename(storedMediaPath)
      );

      if (
        mediaFile.startsWith(`${baseDir}${path.sep}`) &&
        fs.existsSync(mediaFile)
      ) {
        try {
          fs.unlinkSync(mediaFile);
        } catch (error: any) {
          logger.warn(
            `[QUICKMSG] Não foi possível remover a mídia ${mediaFile}: ${error.message}`
          );
        }
      }
    }

    getIO()
      .of(String(companyId))
      .emit(`company-${companyId}-quickmessage`, {
        action: "delete",
        id: record.id
      });
  }

  return res.status(200).json({
    success: true,
    deleted: recordIds.length
  });
};

export const exportQuickMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { companyId } = req.user;

  const records = await QuickMessage.findAll({
    where: {
      companyId,
      isOficial: false
    },
    include: [
      {
        model: QuickMessageComponent,
        as: "components",
        attributes: ["type", "text", "buttons", "format", "example"]
      }
    ],
    order: [["shortcode", "ASC"]]
  });

  const archive = archiver("zip", {
    zlib: { level: 9 }
  });

  const exportedAt = new Date().toISOString();
  const usedMediaNames = new Set<string>();

  const items = records.map(record => {
    const rawRecord = record.get({ plain: true }) as any;
    const storedMediaPath = record.getDataValue("mediaPath") as string | null;

    let zipMediaName: string | null = null;

    if (storedMediaPath) {
      const baseName = safeExportFileName(storedMediaPath);
      zipMediaName = `${record.id}_${baseName}`;
      usedMediaNames.add(zipMediaName);
    }

    return {
      shortcode: rawRecord.shortcode,
      message: rawRecord.message || "",
      geral: Boolean(rawRecord.geral),
      visao: Boolean(rawRecord.visao),
      mediaName: rawRecord.mediaName || null,
      mediaType: rawRecord.mediaType || null,
      zipMediaName,
      components: Array.isArray(rawRecord.components)
        ? rawRecord.components.map((component: any) => ({
            type: component.type || null,
            text: component.text || null,
            buttons: component.buttons || null,
            format: component.format || null,
            example: component.example || null
          }))
        : []
    };
  });

  const payload = {
    type: "quick-messages-backup",
    version: 1,
    exportedAt,
    count: items.length,
    items
  };

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="respostas_rapidas_${new Date()
      .toISOString()
      .slice(0, 10)}.zip"`
  );

  archive.on("error", error => {
    logger.error(`[QUICKMSG] Erro ao criar ZIP: ${error.message}`);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Erro ao exportar respostas rápidas"
      });
    } else {
      res.end();
    }
  });

  archive.pipe(res);
  archive.append(JSON.stringify(payload, null, 2), {
    name: "quick-messages.json"
  });

  const baseDir = path.resolve(
    __dirname,
    "..",
    "..",
    "public",
    `company${companyId}`,
    "quickMessage"
  );

  for (const record of records) {
    const storedMediaPath = record.getDataValue("mediaPath") as string | null;

    if (!storedMediaPath) continue;

    const zipMediaName = `${record.id}_${safeExportFileName(storedMediaPath)}`;

    if (!usedMediaNames.has(zipMediaName)) continue;

    const sourcePath = path.resolve(baseDir, path.basename(storedMediaPath));

    if (
      sourcePath.startsWith(`${baseDir}${path.sep}`) &&
      fs.existsSync(sourcePath)
    ) {
      archive.file(sourcePath, {
        name: `midias/${zipMediaName}`
      });
    }
  }

  await archive.finalize();
};

export const importQuickMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const file = req.file as Express.Multer.File;

  if (!file) {
    return res.status(400).json({
      error: "Nenhum arquivo ZIP foi enviado"
    });
  }

  if (!file.originalname.toLowerCase().endsWith(".zip")) {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.status(400).json({
      error: "O arquivo deve estar no formato ZIP"
    });
  }

  const createdIds: number[] = [];
  const createdFiles: string[] = [];

  try {
    const zip = new AdmZip(file.path);
    const entries = zip.getEntries();

    if (entries.length > 2002) {
      throw new AppError("O arquivo contém itens demais para importação", 400);
    }

    const jsonEntry = entries.find(
      entry =>
        !entry.isDirectory &&
        entry.entryName === "quick-messages.json"
    );

    if (!jsonEntry) {
      throw new AppError(
        "quick-messages.json não foi encontrado no arquivo ZIP",
        400
      );
    }

    const jsonBuffer = jsonEntry.getData();

    if (jsonBuffer.length > 20 * 1024 * 1024) {
      throw new AppError("O arquivo de dados é muito grande", 400);
    }

    const importData = JSON.parse(jsonBuffer.toString("utf8"));

    if (
      !importData ||
      importData.type !== "quick-messages-backup" ||
      importData.version !== 1 ||
      !Array.isArray(importData.items)
    ) {
      throw new AppError(
        "O arquivo não é uma exportação válida de respostas rápidas",
        400
      );
    }

    if (importData.items.length > 1000) {
      throw new AppError(
        "O arquivo possui mais de 1000 respostas rápidas",
        400
      );
    }

    const baseDir = path.resolve(
      __dirname,
      "..",
      "..",
      "public",
      `company${companyId}`,
      "quickMessage"
    );

    fs.mkdirSync(baseDir, { recursive: true });

    let imported = 0;
    let importedMedia = 0;
    let renamed = 0;

    for (const item of importData.items) {
      if (!item || typeof item !== "object") continue;

      const requestedShortcode = String(item.shortcode || "").trim();

      if (!requestedShortcode) continue;

      const shortcode = await uniqueImportedShortcode(
        requestedShortcode,
        Number(companyId)
      );

      if (shortcode !== requestedShortcode) {
        renamed += 1;
      }

      let storedMediaPath: string | null = null;
      let originalMediaName: string | null = null;
      let mediaType: string | null = null;

      if (item.zipMediaName) {
        const safeZipMediaName = safeExportFileName(item.zipMediaName);
        const mediaEntry = entries.find(
          entry =>
            !entry.isDirectory &&
            entry.entryName === `midias/${safeZipMediaName}`
        );

        if (mediaEntry) {
          const mediaBuffer = mediaEntry.getData();

          if (mediaBuffer.length > 100 * 1024 * 1024) {
            throw new AppError(
              `A mídia de "${requestedShortcode}" ultrapassa 100 MB`,
              400
            );
          }

          const originalExtension =
            path.extname(String(item.mediaName || safeZipMediaName))
              .toLowerCase()
              .replace(/[^a-z0-9.]/g, "") ||
            path.extname(safeZipMediaName).toLowerCase();

          storedMediaPath =
            `imported_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 10)}${originalExtension}`;

          const destination = path.resolve(baseDir, storedMediaPath);

          if (!destination.startsWith(`${baseDir}${path.sep}`)) {
            throw new AppError("Nome de mídia inválido", 400);
          }

          fs.writeFileSync(destination, mediaBuffer);
          createdFiles.push(destination);

          originalMediaName = safeExportFileName(
            item.mediaName || safeZipMediaName
          );
          mediaType = ["image", "audio", "video", "document"].includes(
            String(item.mediaType || "").toLowerCase()
          )
            ? String(item.mediaType).toLowerCase()
            : "document";

          importedMedia += 1;
        }
      }

      const record = await CreateService({
        shortcode,
        message: String(item.message || ""),
        companyId,
        userId,
        geral: Boolean(item.geral),
        visao: Boolean(item.visao),
        isMedia: Boolean(storedMediaPath),
        mediaPath: storedMediaPath,
        mediaName: originalMediaName,
        mediaType
      });

      createdIds.push(record.id);

      const components = Array.isArray(item.components)
        ? item.components.slice(0, 20)
        : [];

      for (const component of components) {
        if (!component || !component.type) continue;

        if (String(component.type).toUpperCase() === "BUTTONS") {
          let buttons: any[] = [];

          try {
            buttons =
              typeof component.buttons === "string"
                ? JSON.parse(component.buttons)
                : component.buttons;
          } catch {
            buttons = [];
          }

          await saveInteractiveButtons(record.id, buttons);
          continue;
        }

        await QuickMessageComponent.create({
          quickMessageId: record.id,
          type: String(component.type).slice(0, 255),
          text:
            component.text === null || component.text === undefined
              ? null
              : String(component.text),
          buttons:
            component.buttons === null || component.buttons === undefined
              ? null
              : String(component.buttons),
          format:
            component.format === null || component.format === undefined
              ? null
              : String(component.format),
          example:
            component.example === null || component.example === undefined
              ? null
              : String(component.example)
        } as any);
      }

      const completeRecord = await ShowService(record.id, Number(companyId));

      getIO()
        .of(String(companyId))
        .emit(`company-${companyId}-quickmessage`, {
          action: "create",
          record: completeRecord
        });

      imported += 1;
    }

    return res.status(200).json({
      success: true,
      imported,
      importedMedia,
      renamed
    });
  } catch (error: any) {
    for (const id of createdIds.reverse()) {
      await QuickMessageComponent.destroy({
        where: { quickMessageId: id }
      }).catch(() => undefined);

      await QuickMessage.destroy({
        where: {
          id,
          companyId
        }
      }).catch(() => undefined);
    }

    for (const createdFile of createdFiles) {
      if (fs.existsSync(createdFile)) {
        fs.unlinkSync(createdFile);
      }
    }

    logger.error(
      `[QUICKMSG] Erro ao importar respostas rápidas: ${error.message}`
    );

    const statusCode =
      error instanceof AppError && (error as any).statusCode
        ? (error as any).statusCode
        : 500;

    return res.status(statusCode).json({
      error: error.message || "Erro ao importar respostas rápidas"
    });
  } finally {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

export const audioUpload = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    if (!file) throw new AppError("Nenhum arquivo recebido");
    
    logger.info(`[QUICKMSG] Processando áudio: ${file.originalname} (mime: ${file.mimetype}, size: ${file.size})`);

    const quickmessage = await QuickMessage.findByPk(id);
    if (!quickmessage) {
      throw new AppError("Quick message não encontrada");
    }
    
    // ✅ CORREÇÃO: Garantir que seja sempre salvo como tipo 'audio'
    // independente do mimetype original (webm, ogg, etc)
    await quickmessage.update({
      mediaPath: file.filename, // Nome que o multer gerou (sempre .ogg)
      mediaName: file.originalname || `Áudio gravado - ${new Date().toLocaleString()}`,
      mediaType: 'audio' // ✅ SEMPRE 'audio' para compatibilidade
    });

    logger.info(`[QUICKMSG] Quick message atualizada: id=${quickmessage.id}, mediaPath=${quickmessage.mediaPath}`);

    return res.send({ 
      mensagem: "Áudio gravado anexado com sucesso",
      mediaPath: file.filename,
      mediaName: file.originalname,
      mediaType: 'audio'
    });
  } catch (err: any) {
    logger.error(`[QUICKMSG] Erro no audioUpload: ${err}`);
    throw new AppError(err.message);
  }
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const quickmessage = await QuickMessage.findByPk(id);
    
    // ✅ CORREÇÃO: Melhor detecção do tipo de mídia
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let mediaType = 'document'; // padrão
    
    // ✅ CORREÇÃO: Detectar áudio por extensão E mimetype
    if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'].includes(fileExtension) || 
        file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension)) {
      mediaType = 'image';
    } else if (['.mp4', '.avi', '.mov'].includes(fileExtension)) {
      mediaType = 'video';
    }

    logger.debug(`[QUICKMSG] Tipo de mídia detectado: ${file.originalname} → ${mediaType}`);

    await quickmessage.update({
      mediaPath: file.filename,
      mediaName: file.originalname,
      mediaType: mediaType
    });

    return res.send({ 
      mensagem: "Arquivo Anexado",
      mediaType: mediaType
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user

  try {
    const quickmessage = await QuickMessage.findByPk(id);
    const filePath = path.resolve("public", `company${companyId}`, "quickMessage", quickmessage.mediaName);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }
    await quickmessage.update({
      mediaPath: null,
      mediaName: null,
      mediaType: null
    });

    return res.send({ mensagem: "Arquivo Excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
