import {
  WAMessage,
  AnyMessageContent,
  delay,
  WAPresence
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import mime from "mime-types";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import logger from "../../utils/logger";
import { getJidOf } from "./getJidOf";
import { ENABLE_LID_DEBUG } from "../../config/debug";
interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

interface RequestFlow {
  media: string;
  ticket: Ticket;
  whatsappId: number;
  body?: string;
  isFlow?: boolean;
  isRecord?: boolean;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        //fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        //fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const nameFileDiscovery = (pathMedia: string) => {
  // ✅ CORRIGIDO: Extrair apenas o nome do arquivo (com extensão) do caminho completo
  // Suporta tanto / (Unix/Linux) quanto \ (Windows) como separadores
  let filename = pathMedia;
  
  // Se contém separadores de caminho, extrair apenas o nome do arquivo
  if (filename.includes("/") || filename.includes("\\")) {
    // Primeiro tenta com /, depois com \
    const parts = filename.split("/");
    filename = parts[parts.length - 1];
    
    // Se ainda tiver \, extrair novamente
    if (filename.includes("\\")) {
      const backslashParts = filename.split("\\");
      filename = backslashParts[backslashParts.length - 1];
    }
  }
  
  // Retorna o nome completo do arquivo (com extensão)
  return filename;
};

export const typeSimulation = async (ticket: Ticket, presence: WAPresence) => {
  const wbot = await GetTicketWbot(ticket);

  let contact = await Contact.findOne({
    where: {
      id: ticket.contactId
    }
  });

  await wbot.sendPresenceUpdate(
    presence,
    getJidOf(contact)
  );
  await delay(5000);
  await wbot.sendPresenceUpdate(
    "paused",
    getJidOf(contact)
  );
};

const SendWhatsAppMediaFlow = async ({
  media,
  ticket,
  whatsappId,
  body,
  isFlow = false,
  isRecord = false
}: RequestFlow): Promise<WAMessage> => {
  try {
    const wbot = getWbot(whatsappId);

    const mimetype = mime.lookup(media);
    const pathMedia = media;

    const typeMessage = mimetype.split("/")[0];
    const mediaName = nameFileDiscovery(media);

    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      console.log("record", isRecord);
      if (isRecord) {
        const convert = await processAudio(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeMessage ? "audio/mp4" : mimetype,
          ptt: true
        };
      } else {
        const convert = await processAudioFile(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeMessage ? "audio/mp4" : mimetype,
          ptt: false
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName,
        mimetype: mimetype
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body,
        fileName: mediaName,
        mimetype: mimetype
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body
      };
    }

    let contact = await Contact.findOne({
      where: {
        id: ticket.contactId
      }
    });

    // ✅ CORREÇÃO: Sempre envie para o JID tradicional
    const jid = getJidOf(ticket);

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] SendWhatsAppMediaFlow - Enviando para JID tradicional: ${jid}`
      );
      logger.info(
        `[RDS-LID] SendWhatsAppMediaFlow - Contact lid: ${contact.lid}`
      );
      logger.info(
        `[RDS-LID] SendWhatsAppMediaFlow - Contact remoteJid: ${contact.remoteJid}`
      );
      logger.info(
        `[RDS-LID] SendWhatsAppMediaFlow - Media type: ${typeMessage}`
      );
    }

    const sentMessage = await wbot.sendMessage(jid, {
      ...options
    });

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] SendWhatsAppMediaFlow - Mídia enviada com sucesso para ${jid}`
      );
    }

    wbot.store(sentMessage);

    await ticket.update({ lastMessage: mediaName });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMediaFlow;
