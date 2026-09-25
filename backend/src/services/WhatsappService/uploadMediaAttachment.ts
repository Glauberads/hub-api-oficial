import { Request, Response } from "express";
import { head } from "lodash";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import path from "path";
import fs from "fs";

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    if (!file?.filename) {
      throw new AppError("Arquivo não informado", 400);
    }

    whatsapp.greetingMediaAttachment = file.filename;

    await whatsapp.save();

    return res.status(200).json({
      mensagem: "Arquivo adicionado!"
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    const greetingMediaAttachment = String(
      whatsapp.greetingMediaAttachment || ""
    ).trim();

    if (greetingMediaAttachment) {
      const filePath = path.resolve(
        "public",
        greetingMediaAttachment
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (whatsapp.greetingMediaAttachment !== null) {
      whatsapp.greetingMediaAttachment = null;
      await whatsapp.save();
    }

    return res.status(200).json({
      message: "Arquivo excluído"
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(err.message);
  }
};
