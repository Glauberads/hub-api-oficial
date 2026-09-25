import { Op } from "sequelize";
import fs from "fs";
import path from "path";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

type Request = {
  contact: Contact;
  companyId: number;
  buffer: Buffer | Uint8Array;
  extension?: string;
  source?: string;
};

const normalizeExtension = (extension?: string): string => {
  const ext = String(extension || ".jpg").trim().toLowerCase();

  if (!ext) return ".jpg";
  if (ext.startsWith(".")) return ext;

  return `.${ext}`;
};

const getPublicUrl = ({
  companyId,
  fileName
}: {
  companyId: number;
  fileName: string;
}): string => {
  const backendUrl = String(process.env.BACKEND_URL || "").replace(/\/+$/, "");
  const relativePath = `company${companyId}/telegram-profiles/${fileName}`;

  if (backendUrl) {
    return `${backendUrl}/public/${relativePath}`;
  }

  return `/public/${relativePath}`;
};


const emitTelegramProfilePhotoUpdate = async ({
  contact,
  companyId
}: {
  contact: Contact;
  companyId: number;
}): Promise<void> => {
  try {
    const io = getIO();

    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

    io.emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

    const tickets = await Ticket.findAll({
      where: {
        companyId,
        contactId: contact.id,
        status: {
          [Op.in]: ["open", "pending"]
        }
      },
      include: [
        {
          model: Contact,
          as: "contact"
        }
      ]
    });

    for (const ticket of tickets) {
      io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

      io.to(`company-${companyId}-${ticket.status}`).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

      io.emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
    }

    logger.info(`[TELEGRAM PROFILE] Socket atualizado para contato ${contact.id}`);
  } catch (error) {
    logger.warn(`[TELEGRAM PROFILE] Falha ao emitir atualização socket contato ${contact.id}:`, error);
  }
};


const SaveTelegramContactProfilePhotoService = async ({
  contact,
  companyId,
  buffer,
  extension = ".jpg",
  source = "telegram"
}: Request): Promise<string | null> => {
  try {
    if (!buffer) return null;

    const normalizedExtension = normalizeExtension(extension);

    const folder = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      `company${companyId}`,
      "telegram-profiles"
    );

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      fs.chmodSync(folder, 0o777);
    }

    const fileName = `${source}_profile_${contact.id}_${Date.now()}${normalizedExtension}`;
    const fullPath = path.join(folder, fileName);

    const finalBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    fs.writeFileSync(fullPath, finalBuffer);
    fs.chmodSync(fullPath, 0o666);

    const publicUrl = getPublicUrl({
      companyId,
      fileName
    });

    await contact.update({
      profilePicUrl: publicUrl
    } as any);

    await contact.reload();

    await emitTelegramProfilePhotoUpdate({
      contact,
      companyId
    });

    logger.info(`[TELEGRAM PROFILE] Foto salva para contato ${contact.id}: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    logger.warn(`[TELEGRAM PROFILE] Falha ao salvar foto do contato ${contact.id}:`, error);
    return null;
  }
};

export default SaveTelegramContactProfilePhotoService;
