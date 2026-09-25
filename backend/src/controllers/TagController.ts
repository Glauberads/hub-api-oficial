import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import multer from "multer";
import path from "path";
import fs from "fs";

import AppError from "../errors/AppError";

import CreateService from "../services/TagServices/CreateService";
import ListService from "../services/TagServices/ListService";
import UpdateService from "../services/TagServices/UpdateService";
import ShowService from "../services/TagServices/ShowService";
import DeleteService from "../services/TagServices/DeleteService";
import SimpleListService from "../services/TagServices/SimpleListService";
import SyncTagService from "../services/TagServices/SyncTagsService";
import KanbanListService from "../services/TagServices/KanbanListService";
import ContactTag from "../models/ContactTag";
import { importWhatsAppLabels, removeTagFromWhatsApp } from "../services/TagServices/WhatsAppLabelSyncService";

// Configuração do multer para upload de mídia
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return cb(new Error('Company ID não encontrado'), '');
    }
    
    const uploadPath = path.join(__dirname, `../../public/company${companyId}/lanes`);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `lane-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov', 'video/webm',
      'application/x-ret'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export const uploadMiddleware = upload.array('mediaFiles', 5); // Máximo 5 arquivos

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
  kanban?: number;
  tagId?: number;
  limit?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam, kanban, tagId, limit } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { tags, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    kanban,
    tagId,
    limit
  });

  return res.json({ tags, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, kanban,
    timeLane,
    nextLaneId,
    greetingMessageLane,
    rollbackLaneId } = req.body;
  const { companyId } = req.user;

  // Processar arquivos de mídia
  let mediaFilesData = null;
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const files = req.files as any[];
    mediaFilesData = JSON.stringify(files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/company${companyId}/lanes/${file.filename}`
    })));
  }

  const tag = await CreateService({
    name,
    color,
    kanban,
    companyId,
    timeLane,
    nextLaneId,
    greetingMessageLane,
    rollbackLaneId,
    mediaFiles: mediaFilesData
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company${companyId}-tag`, {
      action: "create",
      tag
    });

  return res.status(200).json(tag);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;

  const tag = await ShowService(tagId);

  return res.status(200).json(tag);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { kanban } = req.body;

  //console.log(kanban)
  if (req.user.profile !== "admin" && kanban === 1) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { tagId } = req.params;
  const { companyId } = req.user;

  // Buscar tag existente para preservar mediaFiles se não houver novos uploads
  const existingTag = await ShowService(tagId);
  
  // Parsear arquivos existentes atuais do banco de dados
  let existingFilesInDb: any[] = [];
  if (existingTag.mediaFiles) {
    try {
      existingFilesInDb = typeof existingTag.mediaFiles === 'string' 
        ? JSON.parse(existingTag.mediaFiles) 
        : existingTag.mediaFiles;
      if (!Array.isArray(existingFilesInDb)) {
        existingFilesInDb = [];
      }
    } catch (e) {
      console.error('Erro ao parsear mediaFiles existentes:', e);
      existingFilesInDb = [];
    }
  }
  
  // Processar arquivos de mídia
  let mediaFilesData: string | null = null;
  
  // Parsear arquivos existentes que devem ser mantidos (enviados pelo frontend)
  let existingFilesToKeep: any[] = [];
  if (req.body.existingMediaFiles) {
    try {
      const existingFilesStr = typeof req.body.existingMediaFiles === 'string' 
        ? req.body.existingMediaFiles 
        : JSON.stringify(req.body.existingMediaFiles);
      existingFilesToKeep = JSON.parse(existingFilesStr);
      if (!Array.isArray(existingFilesToKeep)) {
        existingFilesToKeep = [];
      }
    } catch (e) {
      console.error('Erro ao parsear existingMediaFiles:', e);
      existingFilesToKeep = [];
    }
  }
  
  // Identificar arquivos que foram removidos (estavam no DB mas não estão na lista de mantidos)
  const filesToDelete: any[] = [];
  existingFilesInDb.forEach((fileInDb: any) => {
    // Verificar se o arquivo ainda está na lista de mantidos
    const stillExists = existingFilesToKeep.some((fileToKeep: any) => {
      // Comparar por filename (identificador único)
      return fileToKeep.filename === fileInDb.filename;
    });
    
    if (!stillExists) {
      filesToDelete.push(fileInDb);
    }
  });
  
  // Deletar arquivos físicos do servidor
  if (filesToDelete.length > 0) {
    const publicFolder = path.resolve(__dirname, '..', '..', 'public');
    filesToDelete.forEach((fileToDelete: any) => {
      try {
        // Construir o caminho completo do arquivo
        // fileToDelete.path pode ser algo como "/company1/lanes/filename.ext"
        // ou apenas "company1/lanes/filename.ext"
        let filePath = fileToDelete.path || '';
        
        // Se não tiver path, tentar construir a partir do filename
        if (!filePath && fileToDelete.filename) {
          filePath = `company${companyId}/lanes/${fileToDelete.filename}`;
        }
        
        // Remover barra inicial se houver
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        // Construir caminho completo
        const fullPath = path.join(publicFolder, filePath);
        
        // Verificar se o arquivo existe antes de tentar deletar
        if (fs.existsSync(fullPath)) {
          // Verificar se o arquivo pertence à empresa correta (segurança)
          if (fullPath.includes(`company${companyId}`)) {
            fs.unlinkSync(fullPath);
            console.log(`[TAG] Arquivo deletado do servidor: ${fullPath}`);
          } else {
            console.warn(`[TAG] Tentativa de deletar arquivo de outra empresa: ${fullPath}`);
          }
        } else {
          console.warn(`[TAG] Arquivo não encontrado para deletar: ${fullPath} (path original: ${fileToDelete.path})`);
        }
      } catch (err: any) {
        console.error(`[TAG] Erro ao deletar arquivo ${fileToDelete.filename}:`, err.message);
        // Continuar mesmo se houver erro ao deletar um arquivo
      }
    });
  }
  
  // Processar novos arquivos enviados
  const newFiles: any[] = [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const files = req.files as any[];
    const companyId = req.user?.companyId;
    newFiles.push(...files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/company${companyId}/lanes/${file.filename}`
    })));
  }
  
  // Mesclar arquivos existentes mantidos com novos arquivos
  const allMediaFiles = [...existingFilesToKeep, ...newFiles];
  
  if (allMediaFiles.length > 0) {
    mediaFilesData = JSON.stringify(allMediaFiles);
  } else {
    // Se não há arquivos mantidos nem novos, limpar mediaFiles
    mediaFilesData = null;
  }

  const tagData = {
    ...req.body,
    mediaFiles: mediaFilesData
  };

  const tag = await UpdateService({ tagData, id: tagId });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company${companyId}-tag`, {
      action: "update",
      tag
    });

  return res.status(200).json(tag);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;
  const { companyId } = req.user;

  await DeleteService(tagId);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company${companyId}-tag`, {
      action: "delete",
      tagId
    });

  return res.status(200).json({ message: "Tag deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, kanban } = req.query as IndexQuery;
  const { companyId } = req.user;

  const tags = await SimpleListService({ searchParam, kanban, companyId });

  return res.json(tags);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const tags = await KanbanListService({ companyId });

  return res.json({ lista: tags });
};

export const syncTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body;
  const { companyId } = req.user;

  const tags = await SyncTagService({ ...data, companyId });

  return res.json(tags);
};

export const removeContactTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId, contactId } = req.params;
  const { companyId } = req.user;

  console.log(tagId, contactId)

  await ContactTag.destroy({
    where: {
      tagId: parseInt(tagId),
      contactId: parseInt(contactId)
    }
  });

  // Sincronizar remoção com WhatsApp Labels
  removeTagFromWhatsApp(companyId, parseInt(contactId), parseInt(tagId)).catch(err => {
    console.error(`[LABEL SYNC] Erro ao remover label do WhatsApp:`, err.message);
  });

  const tag = await ShowService(tagId);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company${companyId}-tag`, {
      action: "update",
      tag
    });

  return res.status(200).json({ message: "Tag deleted" });
};

export const importWhatsAppLabelsController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;

  if (!whatsappId) {
    return res.status(400).json({ error: "whatsappId é obrigatório" });
  }

  try {
    const result = await importWhatsAppLabels(companyId, parseInt(whatsappId));
    return res.status(200).json({
      success: true,
      message: `Labels sincronizadas: ${result.imported} importadas, ${result.updated} atualizadas`,
      ...result
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro ao importar labels" });
  }
};