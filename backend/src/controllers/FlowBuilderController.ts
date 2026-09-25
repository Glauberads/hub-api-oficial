import { Request, Response } from "express";
import CreateWebHookService from "../services/WebhookService/CreateWebHookService";
import DeleteWebHookService from "../services/WebhookService/DeleteWebHookService";
import UpdateWebHookService from "../services/WebhookService/UpdateWebHookService";
import GetWebHookService from "../services/WebhookService/GetWebHookService";
import DispatchWebHookService from "../services/WebhookService/DispatchWebHookService";
import ListFlowBuilderService from "../services/FlowBuilderService/ListFlowBuilderService";
import CreateFlowBuilderService from "../services/FlowBuilderService/CreateFlowBuilderService";
import UpdateFlowBuilderService from "../services/FlowBuilderService/UpdateFlowBuilderService";
import DeleteFlowBuilderService from "../services/FlowBuilderService/DeleteFlowBuilderService";
import GetFlowBuilderService from "../services/FlowBuilderService/GetFlowBuilderService";
import FlowUpdateDataService from "../services/FlowBuilderService/FlowUpdateDataService";
import FlowsGetDataService from "../services/FlowBuilderService/FlowsGetDataService";
import UploadImgFlowBuilderService from "../services/FlowBuilderService/UploadImgFlowBuilderService";
import UploadAudioFlowBuilderService from "../services/FlowBuilderService/UploadAudioFlowBuilderService";
import DuplicateFlowBuilderService from "../services/FlowBuilderService/DuplicateFlowBuilderService";
import UploadAllFlowBuilderService from "../services/FlowBuilderService/UploadAllFlowBuilderService";
import UpdateFlowActiveService from "../services/FlowBuilderService/UpdateFlowActiveService";
import FlowBuilderModel from "../models/FlowBuilder";
import { FlowImgModel } from "../models/FlowImg";
import { FlowAudioModel } from "../models/FlowAudio";
import { FlowDocModel } from "../models/FlowDoc";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import AdmZip from "adm-zip";

export const createFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name } = req.body;
  const userId = parseInt(req.user.id);
  const { companyId } = req.user;

  const flow = await CreateFlowBuilderService({
    userId,
    name,
    companyId
  });

  if(flow === 'exist'){
    return res.status(402).json('exist')
  }

  return res.status(200).json(flow);
};

export const updateFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { flowId, name } = req.body;

  const flow = await UpdateFlowBuilderService({ companyId, name, flowId });

  if(flow === 'exist'){
    return res.status(402).json('exist')
  }

  return res.status(200).json(flow);
};

export const deleteFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const flowIdInt = parseInt(idFlow);

  const flow = await DeleteFlowBuilderService(flowIdInt);

  return res.status(200).json(flow);
};

export const myFlows = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const flows = await ListFlowBuilderService({
    companyId
  });

  return res.status(200).json(flows);
};

export const flowOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const { companyId } = req.user;

  const idFlowInt = parseInt(idFlow);

  const webhook = await GetFlowBuilderService({
    companyId,
    idFlow: idFlowInt
  });

  return res.status(200).json(webhook);
};

export const FlowDataUpdate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = parseInt(req.user.id);

  const bodyData = req.body;

  const { companyId } = req.user;

  const keys = Object.keys(bodyData);

  console.log(keys);

  const webhook = await FlowUpdateDataService({
    companyId,
    bodyData
  });

  return res.status(200).json(webhook);
};

export const FlowDataGetOne = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { idFlow } = req.params;

  const { companyId } = req.user;

  const idFlowInt = parseInt(idFlow);

  const webhook = await FlowsGetDataService({
    companyId,
    idFlow: idFlowInt
  });

  return res.status(200).json(webhook);
};

export const FlowUploadImg = async (req: Request, res: Response) => {
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (medias.length === 0) {
    return res.status(400).json("No File");
  }

  let nameFile = medias[0].filename;

  if (medias[0].filename.split(".").length === 1) {
    nameFile = medias[0].filename + "." + medias[0].mimetype.split("/")[1];
  }

  // Incluir caminho relativo com diretório da empresa para o arquivo ser encontrado corretamente
  const nameWithCompanyPath = `company${companyId}/${nameFile}`;

  const img = await UploadImgFlowBuilderService({
    userId,
    name: nameWithCompanyPath,
    companyId
  });
  return res.status(200).json(img);
};

export const FlowUploadAudio = async (req: Request, res: Response) => {
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (medias.length === 0) {
    return res.status(400).json("No File");
  }

  let nameFile = medias[0].filename;

  if (medias[0].filename.split(".").length === 1) {
    nameFile = medias[0].filename + "." + medias[0].mimetype.split("/")[1];
  }

  // Incluir caminho relativo com diretório da empresa
  const nameWithCompanyPath = `company${companyId}/${nameFile}`;

  const img = await UploadAudioFlowBuilderService({
    userId,
    name: nameWithCompanyPath,
    companyId
  });
  return res.status(200).json(img);
};

export const FlowDuplicate = async (req: Request, res: Response) => {
  const { flowId } = req.body;
  const { companyId } = req.user;

  const newFlow = await DuplicateFlowBuilderService({ id: flowId, companyId });

  return res.status(200).json(newFlow);
};

export const FlowUploadAll = async (req: Request, res: Response) => {
  const medias = req.files as Express.Multer.File[];

  const { companyId } = req.user;
  const userId = parseInt(req.user.id);

  if (medias.length === 0) {
    return res.status(400).json("No File");
  }

  const items = await UploadAllFlowBuilderService({
    userId,
    medias: medias,
    companyId
  });
  return res.status(200).json(items);
};

export const toggleFlowActive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { idFlow } = req.params;
  const { active } = req.body;

  try {
    const flowIdInt = parseInt(idFlow);

    if (active === undefined || typeof active !== "boolean") {
      return res.status(400).json({
        error: "O campo 'active' é obrigatório e deve ser um booleano"
      });
    }

    const flow = await UpdateFlowActiveService({
      companyId,
      flowId: flowIdInt,
      active
    });

    return res.status(200).json({
      success: true,
      data: flow,
      message: `Fluxo ${active ? "ativado" : "desativado"} com sucesso`
    });
  } catch (error) {
    console.error("Erro ao alterar status do fluxo:", error);
    return res.status(500).json({
      error: error.message || "Erro interno do servidor"
    });
  }
};

export const exportFlow = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { idFlow } = req.params;
  const { companyId } = req.user;

  const flowIdInt = parseInt(idFlow);
  const flow = await FlowBuilderModel.findOne({
    where: { id: flowIdInt, company_id: companyId }
  });

  if (!flow) {
    res.status(404).json({ error: "Flow not found" });
    return;
  }

  // Coletar nomes de mídias por regex simples e cruzar com tabelas
  const flowString = JSON.stringify(flow.flow || {});
  const mediaNameRegex = /([\w\-()\[\]\s]+\.(?:png|jpg|jpeg|gif|svg|mp3|ogg|mp4|m4a|aac|wav|pdf|docx|xlsx))/gi;
  const matched = flowString.match(mediaNameRegex) || [];
  const uniqueNames = Array.from(new Set(matched));

  // Cruzar com DB (mesma company) para validar nomes existentes
  const [imgs, audios, docs] = await Promise.all([
    FlowImgModel.findAll({ where: { companyId } }),
    FlowAudioModel.findAll({ where: { companyId } }),
    FlowDocModel.findAll({ where: { companyId } })
  ]);
  const dbNames = new Set([
    ...imgs.map(i => i.name),
    ...audios.map(a => a.name),
    ...docs.map(d => d.name)
  ]);
  const mediaFiles = uniqueNames.filter(n => dbNames.has(n));

  // Criar ZIP
  const archive = archiver("zip", { zlib: { level: 9 } });
  
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${flow.name.replace(/[^a-z0-9-_]/gi, "_")}.zip"`
  );

  archive.pipe(res);

  // Tratar erros do archiver
  archive.on("error", (err) => {
    console.error("Erro ao criar ZIP:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error creating ZIP file" });
    }
  });

  // Adicionar flow.json na raiz
  const payload = {
    version: 1,
    name: flow.name,
    flow: flow.flow || {},
    mediaFiles
  };
  archive.append(JSON.stringify(payload, null, 2), { name: "flow.json" });

  // Adicionar arquivos de mídia na pasta midias/
  const baseDir = path.resolve(__dirname, "..", "..", "public", `company${companyId}`, "flow");
  
  for (const fileName of mediaFiles) {
    const filePath = path.resolve(baseDir, fileName);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: `midias/${fileName}` });
    }
  }

  await archive.finalize();
};

export const importFlow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const file = req.file as Express.Multer.File;

  if (!file) {
    return res.status(400).json({ error: "No ZIP file uploaded" });
  }

  if (!file.originalname.toLowerCase().endsWith(".zip")) {
    return res.status(400).json({ error: "File must be a ZIP archive" });
  }

  try {
    // Extrair ZIP
    const zip = new AdmZip(file.path);
    const zipEntries = zip.getEntries();

    // Procurar flow.json
    const flowJsonEntry = zipEntries.find(entry => entry.entryName === "flow.json");
    if (!flowJsonEntry) {
      return res.status(400).json({ error: "flow.json not found in ZIP" });
    }

    const flowData = JSON.parse(flowJsonEntry.getData().toString("utf8"));
    
    if (!flowData || !flowData.name || typeof flowData.flow === "undefined") {
      return res.status(400).json({ error: "Invalid flow.json structure" });
    }

    let name = String(flowData.name);
    // Evitar conflito de nome
    const exists = await FlowBuilderModel.findOne({ where: { name, company_id: companyId } });
    if (exists) {
      name = `${name} (importado)`;
    }

    // Preparar diretórios
    const baseDir = path.resolve(__dirname, "..", "..", "public", `company${companyId}`, "flow");
    const midiasDir = path.resolve(baseDir, "midias");
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(midiasDir)) {
      fs.mkdirSync(midiasDir, { recursive: true });
    }

    // Extrair mídias da pasta midias/ do ZIP
    const mediaFiles: string[] = Array.isArray(flowData.mediaFiles) ? flowData.mediaFiles : [];
    
    for (const fileName of mediaFiles) {
      const zipEntry = zipEntries.find(entry => entry.entryName === `midias/${fileName}`);
      if (!zipEntry) continue;

      const ext = path.extname(fileName).toLowerCase();
      const dest = path.resolve(baseDir, fileName);
      const midiasDest = path.resolve(midiasDir, fileName);

      // Extrair arquivo para pasta flow (raiz)
      fs.writeFileSync(dest, zipEntry.getData());
      
      // Também copiar para pasta midias (manter compatibilidade)
      fs.writeFileSync(midiasDest, zipEntry.getData());

      // Registrar no banco se não existir
      const existingImg = await FlowImgModel.findOne({ where: { companyId, name: fileName } });
      const existingAudio = await FlowAudioModel.findOne({ where: { companyId, name: fileName } });
      const existingDoc = await FlowDocModel.findOne({ where: { companyId, name: fileName } });

      if (!existingImg && !existingAudio && !existingDoc) {
        if ([".png", ".jpg", ".jpeg", ".gif", ".svg"].includes(ext)) {
          await FlowImgModel.create({ companyId, userId: Number(userId), name: fileName });
        } else if ([".mp3", ".ogg", ".mp4", ".m4a", ".aac", ".wav"].includes(ext)) {
          await FlowAudioModel.create({ companyId, userId: Number(userId), name: fileName });
        } else {
          await FlowDocModel.create({ companyId, userId: Number(userId), name: fileName });
        }
      }
    }

    // Criar o flow
    const created = await FlowBuilderModel.create({
      user_id: Number(userId),
      company_id: companyId,
      name,
      flow: flowData.flow,
      active: true
    });

    // Limpar arquivo temporário
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.status(200).json({ success: true, flow: created });
  } catch (error: any) {
    // Limpar arquivo temporário em caso de erro
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    console.error("Erro ao importar fluxo:", error);
    return res.status(500).json({ error: error.message || "Error importing flow" });
  }
};