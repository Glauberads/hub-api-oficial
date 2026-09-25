import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs, { unlinkSync } from "fs";

import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import mime from "mime-types";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import { getJidOf } from "./getJidOf";

ffmpeg.setFfmpegPath(ffmpegStatic!);

(() => {
  try {
    const resolvedPath: string | undefined =
      typeof ffmpegStatic === "string"
        ? (ffmpegStatic as unknown as string)
        : undefined;
    if (resolvedPath) {
      ffmpeg.setFfmpegPath(resolvedPath);
    } else {
      logger.warn(
        "ffmpeg não encontrado via ffmpeg-static; usando PATH do sistema."
      );
    }
  } catch (e) {
    logger.warn({ e }, "Falha ao configurar ffmpeg; tentando PATH do SO");
  }
})();

const convertToOggOpus = async (inputFile: string): Promise<string> => {
  const parsed = path.parse(inputFile);
  const outputFile = path.join(parsed.dir, `${parsed.name}-${Date.now()}.ogg`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputFile)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec("libopus")
      .audioBitrate("18k")
      .addOption(["-vbr", "off"])
      .addOption(["-avoid_negative_ts", "make_zero"])
      .format("ogg")
      .on("end", () => resolve())
      .on("error", err => reject(err))
      .save(outputFile);
  });

  return outputFile;
};

// ✅ Função para converter vídeo para formato compatível com WhatsApp
const convertVideoToWhatsAppMp4 = async (inputFile: string): Promise<string> => {
  const parsed = path.parse(inputFile);
  const outputFile = path.join(
    parsed.dir,
    `${parsed.name}-wa-${Date.now()}.mp4`
  );

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputFile)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-profile:v baseline",
        "-level 3.1",
        "-pix_fmt yuv420p",
        "-r 30",
        "-b:a 128k",
        "-movflags +faststart"
      ])
      .format("mp4")
      .on("end", () => resolve())
      .on("error", err => reject(err))
      .save(outputFile);
  });

  return outputFile;
};

const getMediaTypeFromMimeType = (mimetype: string): string => {
  const documentMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.graphics",
    "application/rtf",
    "text/plain",
    "text/csv",
    "text/html",
    "text/xml",
    "application/xml",
    "application/json",
    "application/ofx",
    "application/vnd.ms-outlook",
    "application/vnd.apple.keynote",
    "application/vnd.apple.numbers",
    "application/vnd.apple.pages",
    "application/x-msdownload",
    "application/x-executable",
    "application/x-msdownload",
    "application/acad",
    "application/x-pkcs12",
    "application/x-ret"
  ];

  const archiveMimeTypes = [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/gzip",
    "application/x-bzip2"
  ];

  if (mimetype === "audio/webm") {
    return "audio";
  }

  if (documentMimeTypes.includes(mimetype)) {
    return "document";
  }

  if (archiveMimeTypes.includes(mimetype)) {
    return "document";
  }

  return mimetype.split("/")[0];
};

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  isPrivate?: boolean;
  isForwarded?: boolean;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

// ✅ Função para resolver caminho da mídia
const resolveMediaPath = (rawPath: string): string => {
  let cleanPath = String(rawPath || "").trim().replace(/\\/g, "/");

  if (!cleanPath) {
    throw new Error("Caminho da mídia vazio");
  }

  if (/^https?:\/\//i.test(cleanPath)) {
    const parsedUrl = new URL(cleanPath);
    cleanPath = parsedUrl.pathname;
  }

  cleanPath = cleanPath.replace(/^\/+/, "");

  if (cleanPath.startsWith("public/")) {
    cleanPath = cleanPath.replace(/^public\//, "");
  }

  if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) {
    return rawPath;
  }

  return path.join(publicFolder, cleanPath);
};

// ✅ CORREÇÃO: Função de conversão de áudio otimizada

export const convertAudioToOgg = async (
  inputPath: string,
  companyId: number
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const newMediaFileName = `${new Date().getTime()}.ogg`;
      const outputFile = path.join(
        publicFolder,
        `company${companyId}`,
        newMediaFileName
      );

      console.log("🔄 Convertendo áudio:", {
        input: inputPath,
        output: outputFile
      });

      const converter = ffmpeg(inputPath);

      converter
        .outputFormat("ogg")
        .noVideo()
        .audioCodec("libopus")
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate("64k")
        .addOutputOptions("-avoid_negative_ts make_zero")
        .on("end", () => {
          console.log("✅ Conversão de áudio concluída:", outputFile);
          resolve(outputFile);
        })
        .on("error", (err: Error) => {
          console.error("❌ Erro na conversão de áudio:", err);
          reject(err);
        })
        .save(outputFile);
    } catch (error) {
      console.error("❌ Erro ao configurar conversão:", error);
      reject(error);
    }
  });
};

// ✅ Função para converter PNG/WebP para JPG usando ffmpeg
export const convertPngToJpg = async (
  inputPath: string,
  companyId: number
): Promise<Buffer> => {
  try {
    console.log("🔄 Convertendo imagem para JPG:", inputPath);

    const outputPath = path.join(
      publicFolder,
      `company${companyId}`,
      `temp_${new Date().getTime()}.jpg`
    );

    // Usar ffmpeg para converter qualquer formato de imagem para JPG
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputFormat('mjpeg')
        .outputOptions('-q:v', '2') // Qualidade alta
        .on('end', () => {
          console.log("✅ Conversão para JPG concluída");
          resolve();
        })
        .on('error', (err) => {
          console.error("❌ Erro na conversão para JPG:", err);
          reject(err);
        })
        .save(outputPath);
    });

    // Ler o arquivo JPG convertido
    const imageBuffer = fs.readFileSync(outputPath);

    // Limpar arquivo temporário
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log("✅ Conversão concluída e buffer retornado");
    return imageBuffer;
  } catch (error) {
    console.error("❌ Erro na conversão para JPG:", error);
    throw error;
  }
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId: string,
  body: string = " "
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType ? mimeType.split("/")[0] : "application";

  console.log("🔍 Processando mídia:", {
    fileName,
    pathMedia,
    mimeType,
    typeMessage
  });

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }

    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: { url: pathMedia },
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "audio") {
      // ✅ CORREÇÃO: Verificar se o arquivo já está em formato adequado
      const isAlreadyOgg = pathMedia.toLowerCase().endsWith(".ogg");
      let audioPath = pathMedia;

      if (!isAlreadyOgg) {
        console.log("🔄 Arquivo não é OGG, convertendo...");
        audioPath = await convertAudioToOgg(pathMedia, +companyId);
      } else {
        console.log("✅ Arquivo já é OGG, usando diretamente");
      }

      options = {
        audio: fs.readFileSync(audioPath),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      };

      // Limpar arquivo temporário se foi convertido
      if (audioPath !== pathMedia && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } else if (typeMessage === "document" || typeMessage === "application") {
      options = {
        document: { url: pathMedia },
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: { url: pathMedia },
        caption: body ? body : null
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.error("❌ Erro ao processar mídia:", e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body = "",
  isPrivate = false,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  // ✅ Variável para armazenar caminho do vídeo temporário convertido
  let temporaryVideoPath: string | null = null;

  try {
    const wbot = getWbot(ticket.whatsappId);
    const companyId = ticket.companyId.toString();

    // ✅ Usar a função resolveMediaPath para obter o caminho correto
    const pathMedia = resolveMediaPath(media.path || media.filename);

    // Debug: verificar se o arquivo existe
    console.log("🔍 Verificando arquivo de mídia:", {
      originalPath: media.path,
      publicFolder,
      fullPath: pathMedia,
      exists: fs.existsSync(pathMedia)
    });

    if (!fs.existsSync(pathMedia)) {
      throw new Error(`Arquivo de mídia não encontrado: ${pathMedia}`);
    }

    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    let bodyTicket = "";
    const bodyMedia = ticket ? formatBody(body, ticket) : body;

    console.log("📤 Enviando mídia:", {
      originalname: media.originalname,
      mimetype: media.mimetype,
      typeMessage,
      pathMedia
    });

    if (typeMessage === "video") {
      // ✅ Tentar converter vídeo para formato compatível com WhatsApp
      try {
        temporaryVideoPath = await convertVideoToWhatsAppMp4(pathMedia);
        
        options = {
          video: { url: temporaryVideoPath },
          mimetype: "video/mp4",
          caption: bodyMedia,
          fileName: media.originalname.replace("/", "-"),
          contextInfo: {
            forwardingScore: isForwarded ? 2 : 0,
            isForwarded: isForwarded
          }
        };
        
        bodyTicket = "🎥 Arquivo de vídeo";
        console.log("✅ Vídeo convertido com sucesso para formato WhatsApp:", temporaryVideoPath);
      } catch (videoError) {
        logger.error(
          `[RDS-BAILEYS-MEDIA] Erro ao converter vídeo, enviando original: ${videoError?.message}`
        );
        
        options = {
          video: { url: pathMedia },
          mimetype: media.mimetype,
          caption: bodyMedia,
          fileName: media.originalname.replace("/", "-"),
          contextInfo: {
            forwardingScore: isForwarded ? 2 : 0,
            isForwarded: isForwarded
          }
        };
        
        bodyTicket = "🎥 Arquivo de vídeo";
      }
    } else if (typeMessage === "audio" || media.mimetype.includes("audio")) {
      // ✅ CORREÇÃO: Tratamento específico para arquivos de áudio
      let audioPath = pathMedia;

      console.log("🔄 Convertendo áudio para OGG...");
      audioPath = await convertToOggOpus(pathMedia);

      options = {
        audio: fs.readFileSync(audioPath),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded: isForwarded
        }
      };

      // Limpar arquivo convertido se necessário
      if (audioPath !== pathMedia && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      bodyTicket = bodyMedia || "🎵 Mensagem de voz";
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: { url: pathMedia },
        caption: bodyMedia,
        fileName: media.originalname.replace("/", "-"),
        mimetype: media.mimetype,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded: isForwarded
        }
      };
      bodyTicket = "📂 Documento";
    } else if (typeMessage === "application") {
      options = {
        document: { url: pathMedia },
        caption: bodyMedia,
        fileName: media.originalname.replace("/", "-"),
        mimetype: media.mimetype,
        contextInfo: {
          forwardingScore: isForwarded ? 2 : 0,
          isForwarded: isForwarded
        }
      };
      bodyTicket = "📎 Outros anexos";
    } else {
      if (media.mimetype.includes("gif")) {
        options = {
          image: { url: pathMedia },
          caption: bodyMedia,
          mimetype: "image/gif",
          contextInfo: {
            forwardingScore: isForwarded ? 2 : 0,
            isForwarded: isForwarded
          },
          gifPlayback: true
        };
      } else {
        if (media.mimetype.includes("png") || media.mimetype.includes("webp")) {
          // ✅ Converter PNG/WebP para JPG antes de enviar
          console.log("🔄 Detectado arquivo PNG/WebP, convertendo para JPG...");
          const imageBuffer = await convertPngToJpg(pathMedia, ticket.companyId);
          options = {
            image: imageBuffer,
            caption: bodyMedia,
            contextInfo: {
              forwardingScore: isForwarded ? 2 : 0,
              isForwarded: isForwarded
            }
          };
        } else {
          options = {
            image: { url: pathMedia },
            caption: bodyMedia,
            contextInfo: {
              forwardingScore: isForwarded ? 2 : 0,
              isForwarded: isForwarded
            }
          };
        }
      }
      bodyTicket = "🖼️ Imagem";
    }

    if (isPrivate === true) {
      const messageData = {
        wid: `PVT${companyId}${ticket.id}${body.substring(0, 6)}`,
        ticketId: ticket.id,
        contactId: undefined,
        body: bodyMedia,
        fromMe: true,
        mediaUrl: media.filename,
        mediaType: getMediaTypeFromMimeType(media.mimetype),
        read: true,
        quotedMsgId: null,
        ack: 2,
        remoteJid: null,
        participant: null,
        dataJson: null,
        ticketTrakingId: null,
        isPrivate
      };

      await CreateMessageService({ messageData, companyId: ticket.companyId });
      return;
    }

    const contactNumber = await Contact.findByPk(ticket.contactId);

    const sentMessage = await wbot.sendMessage(getJidOf(ticket), options);

    wbot.store(sentMessage);

    // ✅ Descrição amigável para mídias enviadas
    const mediaDescriptions: Record<string, string> = {
      video: "🎥 Vídeo", audio: "🎵 Áudio", image: "📷 Imagem",
      application: "📄 Documento", document: "📄 Documento",
    };
    let lastMsg = body !== media.filename ? body : bodyMedia;
    if (!lastMsg || lastMsg === media.filename) {
      lastMsg = mediaDescriptions[typeMessage] || bodyMedia || media.filename;
    }
    await ticket.update({
      lastMessage: lastMsg,
      imported: null
    });

    return sentMessage;
  } catch (err) {
    console.error(
      `❌ ERRO AO ENVIAR MÍDIA ${ticket.id} media ${media.originalname}:`,
      err
    );
    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  } finally {
    // ✅ Limpeza garantida do vídeo temporário convertido
    if (temporaryVideoPath && fs.existsSync(temporaryVideoPath)) {
      try {
        fs.unlinkSync(temporaryVideoPath);
        console.log("🗑️ Arquivo de vídeo temporário removido:", temporaryVideoPath);
      } catch (cleanupError) {
        logger.warn(`Erro ao limpar vídeo temporário: ${cleanupError.message}`);
      }
    }
  }
};

export default SendWhatsAppMedia;