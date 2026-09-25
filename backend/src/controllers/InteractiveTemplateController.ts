import { Request, Response } from "express";
import InteractiveMessageTemplate from "../models/InteractiveMessageTemplate";
import AppError from "../errors/AppError";

const parseTemplateData = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeTemplate = (template: InteractiveMessageTemplate) => {
  const plain = template.get({ plain: true }) as any;
  return {
    ...plain,
    templateData: parseTemplateData(plain.templateData),
  };
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { type } = req.query as { type?: string };

  const where: any = { companyId };
  if (type) where.interactiveType = type;

  const templates = await InteractiveMessageTemplate.findAll({
    where,
    order: [["name", "ASC"]],
  });

  return res.json(templates.map(serializeTemplate));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { name, interactiveType, templateData } = req.body;

  if (!name || !interactiveType || !templateData) {
    throw new AppError("Nome, tipo e dados do template são obrigatórios");
  }

  const template = await InteractiveMessageTemplate.create({
    name,
    interactiveType,
    templateData: JSON.stringify(templateData),
    companyId,
    userId: req.user.id,
  });

  return res.status(201).json(serializeTemplate(template));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const { name, templateData } = req.body;

  const template = await InteractiveMessageTemplate.findOne({
    where: { id, companyId },
  });

  if (!template) throw new AppError("Template não encontrado", 404);

  await template.update({
    name: name || template.name,
    templateData: templateData ? JSON.stringify(templateData) : template.templateData,
  });

  return res.json(serializeTemplate(template));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const template = await InteractiveMessageTemplate.findOne({
    where: { id, companyId },
  });

  if (!template) throw new AppError("Template não encontrado", 404);

  await template.destroy();
  return res.json({ message: "Template removido" });
};
