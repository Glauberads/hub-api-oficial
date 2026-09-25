import path, { join } from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import * as Sentry from "@sentry/node";
import {
  downloadMediaMessage,
  proto,
} from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import logger from "../../utils/logger";
import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import ffmpeg from "fluent-ffmpeg";
import os from "os";
import { Session } from "../../libs/wbot";
import {
  getBodyMessage,
  getTypeMessage,
  getQuotedMessageId,
  getTimestampMessage,
  getMediaTypeFromMimeType,
  allowedMimeTypes
} from "./messageUtils";

let ffmpegPath: string;
if (os.platform() === "win32") {
  ffmpegPath = "C:\\ffmpeg\\ffmpeg.exe";
} else if (os.platform() === "darwin") {
  ffmpegPath = "/opt/homebrew/bin/ffmpeg";
} else {
  ffmpegPath = "/usr/bin/ffmpeg";
}
ffmpeg.setFfmpegPath(ffmpegPath);

const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);
  if (!quoted) return null;
  const quotedMsg = await Message.findOne({ where: { wid: quoted } });
  if (!quotedMsg) return null;
  return quotedMsg;
};

const downloadMedia = async (
  msg: proto.IWebMessageInfo,
  isImported: Date = null,
  wbot: Session
) => {
  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.ephemeralMessage?.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.imageMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage?.message?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedTemplate?.videoMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.hydratedFourRowTemplate?.videoMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.imageMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.documentMessage ||
    msg.message?.templateMessage?.fourRowTemplate?.videoMessage ||
    msg.message?.interactiveMessage?.header?.imageMessage ||
    msg.message?.interactiveMessage?.header?.documentMessage ||
    msg.message?.interactiveMessage?.header?.videoMessage;

  let filename =
    msg.message?.documentMessage?.fileName ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
    msg.message?.extendedTextMessage?.text || "";

  if (!filename && msg.message?.documentMessage?.title) {
    filename = msg.message.documentMessage.title;
  }

  // Validação de tipo de arquivo para documentos
  if (msg.message?.documentMessage && filename) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!ext && msg.message.documentMessage.mimetype) {
      const mimeType = msg.message.documentMessage.mimetype;
      const isValidMimeType = allowedMimeTypes.includes(mimeType);
      if (!isValidMimeType && !msg.key.fromMe) {
        throw new Error("Invalid file type");
      }
    } else if (ext) {
      const isAllowedExt = [
        "mtx", "aud", "rul", "exp", "zip", "plt", "mdl", "pdf", "psd", "cdr",
        "ai", "xls", "xlsx", "xlsm", "doc", "docx", "docm", "txt",
        "odt", "ods", "odp", "odg", "xml", "ofx", "rtf", "csv", "html", "json",
        "rar", "7z", "tar", "gz", "bz2", "msg", "key", "numbers", "pages",
        "ppt", "pptx", "exe", "png", "jpg", "jpeg", "gif", "bmp", "webp",
        "dwg", "pfx", "p12", "ret"
      ].includes(ext);
      if (!isAllowedExt) {
        if (msg.key.fromMe && msg.message.documentMessage.mimetype) {
          const isValidMimeType = allowedMimeTypes.includes(msg.message.documentMessage.mimetype);
          if (!isValidMimeType) throw new Error("Invalid file type");
        } else {
          throw new Error("Invalid file type");
        }
      }
    }
  }

  if (!filename) {
    const mimeToExt: any = {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-excel": "xls", "application/msword": "doc",
      "application/pdf": "pdf", "text/plain": "txt",
      "image/vnd.adobe.photoshop": "psd", "application/x-photoshop": "psd",
      "application/vnd.oasis.opendocument.text": "odt",
      "application/vnd.oasis.opendocument.spreadsheet": "ods",
      "application/vnd.oasis.opendocument.presentation": "odp",
      "application/vnd.oasis.opendocument.graphics": "odg",
      "application/xml": "xml", "text/xml": "xml", "application/ofx": "ofx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/rtf": "rtf", "text/csv": "csv", "text/html": "html",
      "application/json": "json", "application/zip": "zip",
      "application/x-rar-compressed": "rar", "application/x-7z-compressed": "7z",
      "application/x-tar": "tar", "application/gzip": "gz",
      "application/x-bzip2": "bz2", "application/vnd.ms-outlook": "msg",
      "application/vnd.apple.keynote": "key", "application/vnd.apple.numbers": "numbers",
      "application/vnd.apple.pages": "pages", "application/x-msdownload": "exe",
      "application/x-executable": "exe", "application/acad": "dwg",
      "image/vnd.dwg": "dwg", "application/dwg": "dwg",
      "application/x-dwg": "dwg", "image/x-dwg": "dwg",
      "application/x-pkcs12": "pfx", "application/pkcs-12": "pfx",
      "application/pkcs12": "pfx", "application/x-pkcs-12": "pfx",
      "application/pfx": "pfx"
    };
    const ext = mimeToExt[mineType.mimetype] || mineType.mimetype.split("/")[1].split(";")[0];
    const shortId = String(new Date().getTime()).slice(-4);
    filename = `file_${shortId}.${ext}`;
  } else {
    const ext = filename.split(".").pop();
    const name = filename.split(".").slice(0, -1).join(".")
      .replace(/\s/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const sanitizedName = `${name.trim()}.${ext}`;
    const folder = path.resolve(__dirname, "..", "..", "..", "public",
      `company${msg.key.remoteJid?.split("@")[0]}`);
    if (fs.existsSync(path.join(folder, sanitizedName))) {
      let counter = 1;
      let newName = `${name.trim()}_${counter}.${ext}`;
      while (fs.existsSync(path.join(folder, newName)) && counter < 100) {
        counter++;
        newName = `${name.trim()}_${counter}.${ext}`;
      }
      filename = newName;
    } else {
      filename = sanitizedName;
    }
  }

  if (msg.message?.stickerMessage) {
    const urlAnt = "https://web.whatsapp.net";
    const directPath = msg.message?.stickerMessage?.directPath;
    const newUrl = "https://mmg.whatsapp.net";
    const final = newUrl + directPath;
    if (msg.message?.stickerMessage?.url?.includes(urlAnt)) {
      msg.message.stickerMessage.url = msg.message?.stickerMessage.url.replace(urlAnt, final);
    }
  }

  let buffer;
  try {
    buffer = await downloadMediaMessage(msg as any, "buffer", {}, {
      logger, reuploadRequest: wbot.updateMediaMessage
    });
  } catch (err) {
    if (isImported) {
      console.log("Falha ao fazer o download de uma mensagem importada");
    } else {
      console.error("Erro ao baixar mídia:", err);
    }
  }

  return { data: buffer, mimetype: mineType.mimetype, filename };
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const companyId = ticket.companyId;

  try {
    let media;
    try {
      media = await downloadMedia(msg, ticket?.imported, wbot);
    } catch (downloadError: any) {
      if (msg.key.fromMe && downloadError.message === "Invalid file type") {
        logger.warn(`[VERIFY MEDIA] Erro ao baixar mídia do bot (tipo inválido)`);
        media = null;
      } else {
        throw downloadError;
      }
    }

    if (!media && ticket.imported) {
      const body = "*System:* \nFalha no download da mídia verifique no dispositivo";
      const messageData = {
        wid: msg.key.id, ticketId: ticket.id,
        contactId: msg.key.fromMe ? undefined : ticket.contactId,
        body, reactionMessage: msg.message?.reactionMessage,
        fromMe: msg.key.fromMe, mediaType: getTypeMessage(msg),
        read: msg.key.fromMe,
        quotedMsgId: quotedMsg?.id || msg.message?.reactionMessage?.key?.id,
        ack: msg.status, companyId, remoteJid: msg.key.remoteJid,
        participant: msg.key.participant,
        timestamp: getTimestampMessage(msg.messageTimestamp),
        createdAt: new Date(Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)).toISOString(),
        dataJson: JSON.stringify(msg), ticketImported: ticket.imported,
        isForwarded, isPrivate
      };
      await ticket.update({ lastMessage: body });
      logger.error(Error("ERR_WAPP_DOWNLOAD_MEDIA"));
      return CreateMessageService({ messageData, companyId });
    }

    if (!media) {
      if (msg.key.fromMe && msg.message?.documentMessage) {
        const docMessage = msg.message.documentMessage;
        let filename = docMessage.fileName || docMessage.title || "documento";
        if (filename.includes("/") || filename.includes("\\")) {
          const pathParts = filename.split("/").pop()?.split("\\").pop();
          filename = pathParts || filename;
        }
        const mimetype = docMessage.mimetype || "application/octet-stream";
        const body = getBodyMessage(msg) || filename;
        const messageData = {
          wid: msg.key.id, ticketId: ticket.id, contactId: undefined,
          body, fromMe: true, read: true, mediaUrl: filename,
          mediaType: getMediaTypeFromMimeType(mimetype),
          quotedMsgId: quotedMsg?.id,
          ack: Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) || 2,
          remoteJid: msg.key.remoteJid, participant: msg.key.participant,
          dataJson: JSON.stringify(msg), ticketTrakingId: ticketTraking?.id,
          createdAt: new Date(Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)).toISOString(),
          ticketImported: ticket.imported, isForwarded, isPrivate
        };
        await ticket.update({ lastMessage: body });
        return CreateMessageService({ messageData, companyId });
      }
      throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
    }

    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${new Date().getTime()}.${ext}`;
    } else {
      const ext = media.filename.split(".").pop();
      const name = media.filename.split(".").slice(0, -1).join(".")
        .replace(/\s/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);
      const sanitizedName = `${name.trim()}.${ext}`;
      if (fs.existsSync(path.join(folder, sanitizedName))) {
        media.filename = `${name.trim()}_${new Date().getTime()}.${ext}`;
      } else {
        media.filename = sanitizedName;
      }
    }

    try {
      const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }
      await fsp.writeFile(join(folder, media.filename), media.data.toString("base64"), "base64")
        .then(() => {
          if (media.mimetype.includes("audio")) {
            const inputFile = path.join(folder, media.filename);
            let outputFile: string;
            if (inputFile.endsWith(".mpeg")) {
              outputFile = inputFile.replace(".mpeg", ".mp3");
            } else if (inputFile.endsWith(".ogg")) {
              outputFile = inputFile.replace(".ogg", ".mp3");
            } else { return; }
            return new Promise<void>((resolve, reject) => {
              ffmpeg(inputFile).toFormat("mp3").save(outputFile)
                .on("end", () => resolve())
                .on("error", (err: any) => reject(err));
            });
          }
        });
    } catch (err) {
      Sentry.setExtra("Erro media", { companyId, ticket, contact, media, quotedMsg });
      Sentry.captureException(err);
      logger.error(err);
    }

    const body = getBodyMessage(msg);
    let mediaFilename = media.filename;
    if (mediaFilename && (mediaFilename.includes("/") || mediaFilename.includes("\\"))) {
      const pathParts = mediaFilename.split("/").pop()?.split("\\").pop();
      mediaFilename = pathParts || mediaFilename;
    }

    const messageData = {
      wid: msg.key.id, ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: body || mediaFilename, fromMe: msg.key.fromMe,
      read: msg.key.fromMe, mediaUrl: mediaFilename,
      mediaType: getMediaTypeFromMimeType(media.mimetype),
      quotedMsgId: quotedMsg?.id,
      ack: Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) || 2,
      remoteJid: msg.key.remoteJid, participant: msg.key.participant,
      dataJson: JSON.stringify(msg), ticketTrakingId: ticketTraking?.id,
      createdAt: new Date(Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)).toISOString(),
      ticketImported: ticket.imported, isForwarded, isPrivate
    };

    await ticket.update({ lastMessage: body || mediaFilename });
    const newMessage = await CreateMessageService({ messageData, companyId });

    if (!msg.key.fromMe && ticket.status === "closed") {
      await ticket.update({ status: "pending" });
      await ticket.reload({
        attributes: [
          "id", "uuid", "queueId", "isGroup", "channel", "status",
          "contactId", "useIntegration", "lastMessage", "updatedAt",
          "unreadMessages", "companyId", "whatsappId", "imported",
          "lgpdAcceptedAt", "amountUsedBotQueues", "integrationId",
          "userId", "amountUsedBotQueuesNPS", "lgpdSendMessageAt", "isBot"
        ],
        include: [
          { model: Queue, as: "queue" }, { model: User, as: "user" },
          { model: Contact, as: "contact" }, { model: Whatsapp, as: "whatsapp" }
        ]
      });
      io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
        action: "delete", ticket, ticketId: ticket.id
      });
      io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
        action: "update", ticket, ticketId: ticket.id
      });
    }
    return newMessage;
  } catch (error) {
    console.log(error);
    logger.warn("Erro ao baixar media: ", JSON.stringify(msg));
  }
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking?: TicketTraking,
  isPrivate?: boolean,
  isForwarded: boolean = false
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);
  const companyId = ticket.companyId;

  const messageData = {
    wid: msg.key.id, ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body, fromMe: msg.key.fromMe, mediaType: getTypeMessage(msg),
    read: msg.key.fromMe, quotedMsgId: quotedMsg?.id,
    ack: Number(String(msg.status).replace("PENDING", "2").replace("NaN", "1")) || 2,
    remoteJid: msg.key.remoteJid, participant: msg.key.participant,
    dataJson: JSON.stringify(msg), ticketTrakingId: ticketTraking?.id,
    isPrivate,
    createdAt: new Date(Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)).toISOString(),
    ticketImported: ticket.imported, isForwarded
  };

  await ticket.update({ lastMessage: body });
  await CreateMessageService({ messageData, companyId });

  // Verificar e cancelar Floups
  if (!msg.key.fromMe && contact?.id) {
    try {
      const FloupService = (await import('../../plugins/floup/service')).default;
      await FloupService.verificarECancelarFloupsAoReceberMensagem(
        ticket.id, contact.id, companyId, body
      );
    } catch (floupError) {
      logger.warn(`[FLOUP] Erro ao verificar condições de parada:`, floupError);
    }
  }

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" }, { model: User, as: "user" },
        { model: Contact, as: "contact" }, { model: Whatsapp, as: "whatsapp" }
      ]
    });
    if (!ticket.imported) {
      io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
        action: "update", ticket, ticketId: ticket.id
      });
    }
  }
};
