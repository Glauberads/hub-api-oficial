import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import { sendAttachment, sendAttachmentFromUrl } from "./graphAPI";

const execFileAsync = promisify(execFile);

interface Request {
  ticket: Ticket;
  media?: Express.Multer.File;
  body?: string;
  url?: string;
}

export const typeAttachment = (media: Express.Multer.File) => {
  if (media.mimetype.includes("image")) {
    return "image";
  }
  if (media.mimetype.includes("video")) {
    return "video";
  }
  if (media.mimetype.includes("audio")) {
    return "audio";
  }

  return "file";
};

const removeFileIfExists = (filePath?: string): void => {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      `[FACEBOOK] Não foi possível remover arquivo temporário ${filePath}:`,
      error
    );
  }
};

const convertAudioToM4a = async (
  media: Express.Multer.File
): Promise<Express.Multer.File> => {
  const outputPath = path.join(
    path.dirname(media.path),
    `${path.parse(media.filename).name}_meta.m4a`
  );

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    media.path,
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "1",
    "-movflags",
    "+faststart",
    outputPath
  ]);

  const stats = fs.statSync(outputPath);

  console.log("[FACEBOOK] Áudio convertido para Instagram:", {
    original: media.path,
    convertido: outputPath,
    tamanho: stats.size,
    mimetype: "audio/mp4"
  });

  return {
    ...media,
    path: outputPath,
    filename: path.basename(outputPath),
    originalname: path.basename(outputPath),
    mimetype: "audio/mp4",
    size: stats.size
  };
};

const convertVideoForMeta = async (
  media: Express.Multer.File
): Promise<Express.Multer.File> => {
  const outputPath = path.join(
    path.dirname(media.path),
    `${path.parse(media.filename).name}_meta.mp4`
  );

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    media.path,

    // Usa a primeira faixa de vídeo e áudio, quando existir.
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",

    // Padronização para Messenger mobile.
    "-vf",
    "scale=min(720\\,iw):-2:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-profile:v",
    "baseline",
    "-level:v",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "25",
    "-maxrate",
    "2500k",
    "-bufsize",
    "5000k",

    // Gera quadros-chave frequentes para thumbnail e busca mobile.
    "-g",
    "30",
    "-keyint_min",
    "30",
    "-sc_threshold",
    "0",

    // Áudio compatível.
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",

    // Remove metadados desnecessários e coloca o moov no início.
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    outputPath
  ]);

  const stats = fs.statSync(outputPath);

  console.log("[FACEBOOK] Vídeo convertido para Messenger mobile:", {
    original: media.path,
    convertido: outputPath,
    tamanho: stats.size,
    mimetype: "video/mp4"
  });

  return {
    ...media,
    path: outputPath,
    filename: path.basename(outputPath),
    originalname: path.basename(outputPath),
    mimetype: "video/mp4",
    size: stats.size
  };
};

export const sendFacebookMessageMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<any> => {
  if (!media) {
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }

  let mediaToSend = media;
  let convertedAudioPath: string | undefined;
  let convertedVideoPath: string | undefined;

  try {
    const type = typeAttachment(media);
    const channel = String(ticket.channel || "").toLowerCase();
    const isInstagram = channel === "instagram";
    if (type === "audio") {
      mediaToSend = await convertAudioToM4a(media);
      convertedAudioPath = mediaToSend.path;
    }

    // Padroniza todos os vídeos antes do envio. O Facebook utiliza o
    // arquivo convertido no Media Template e o mantém para reprodução
    // local no sistema.
    if (type === "video") {
      mediaToSend = await convertVideoForMeta(media);
      convertedVideoPath = mediaToSend.path;
    }

    const domain =
      `${process.env.BACKEND_URL}/public/company${ticket.companyId}/` +
      encodeURIComponent(mediaToSend.filename);

    let sendMessage;


    // O endpoint message_attachments funciona para Facebook, mas a
    // conexão do Instagram rejeita esse POST. No Instagram, áudio e
    // vídeo precisam ser enviados utilizando uma URL pública.
    // Áudio do Facebook utiliza upload por attachment_id.
    // Vídeos são enviados pela URL pública para o Messenger processar
    // a mídia e gerar corretamente a miniatura no aplicativo móvel.
    // Áudio do Facebook utiliza attachment_id. Vídeos seguem por URL
    // pública para que a Meta baixe e processe o arquivo, incluindo a
    // geração da miniatura no Messenger.
    const shouldUseAttachmentId =
      !isInstagram && type === "audio";

    if (shouldUseAttachmentId) {
      console.log("[FACEBOOK] Enviando mídia via attachment_id:", {
        channel,
        type,
        filename: mediaToSend.filename,
        mimetype: mediaToSend.mimetype,
        size: mediaToSend.size
      });

      sendMessage = await sendAttachment(
        ticket.contact.number,
        mediaToSend,
        type,
        ticket.whatsapp.facebookUserToken
      );
    } else {
      console.log("[META] Enviando attachment por URL:", {
        channel,
        type,
        url: domain,
        mimetype: mediaToSend.mimetype,
        filename: mediaToSend.filename
      });

      sendMessage = await sendAttachmentFromUrl(
        ticket.contact.number,
        domain,
        type,
        ticket.whatsapp.facebookUserToken
      );
    }

    await ticket.update({
      lastMessage: mediaToSend.filename
    });

    // Vídeos enviados ao Facebook via Media Template não retornam no
    // webhook is_echo como um anexo comum. Preserva o arquivo convertido
    // para que ele seja registrado e reproduzido localmente no sistema.
    const preserveLocalFacebookVideo =
      channel === "facebook" && type === "video";

    // Remove o upload original. O MP4 convertido permanece salvo para
    // reprodução da mensagem dentro do sistema.
    removeFileIfExists(media.path);

    if (convertedAudioPath && convertedAudioPath !== media.path) {
      removeFileIfExists(convertedAudioPath);
    }

    if (
      convertedVideoPath &&
      convertedVideoPath !== media.path &&
      !preserveLocalFacebookVideo
    ) {
      removeFileIfExists(convertedVideoPath);
    }

    return {
      ...sendMessage,
      localMedia: preserveLocalFacebookVideo
        ? {
            filename: mediaToSend.filename,
            mimetype: mediaToSend.mimetype,
            mediaType: "video"
          }
        : undefined
    };
  } catch (err: any) {
    console.error(
      "[FACEBOOK] Falha ao converter/enviar mídia:",
      err?.response?.data || err?.message || err
    );

    // Em caso de falha, preserva os arquivos para diagnóstico.
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }
};

export const sendFacebookMessageMediaExternal = async ({
  url,
  ticket,
  body
}: Request): Promise<any> => {
  try {
    const type = "image";

    const sendMessage = await sendAttachmentFromUrl(
      ticket.contact.number,
      url,
      type,
      ticket.whatsapp.facebookUserToken
    );

    const randomName = Math.random().toString(36).substring(7);

    await ticket.update({
      lastMessage: body || `${randomName}.jpg`
    });

    return sendMessage;
  } catch (err) {
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }
};

export const sendFacebookMessageFileExternal = async ({
  url,
  ticket,
  body
}: Request): Promise<any> => {
  try {
    const type = "file";

    const sendMessage = await sendAttachmentFromUrl(
      ticket.contact.number,
      url,
      type,
      ticket.whatsapp.facebookUserToken
    );

    const randomName = Math.random().toString(36).substring(7);

    await ticket.update({
      lastMessage: body || `${randomName}.pdf`
    });

    return sendMessage;
  } catch (err) {
    throw new AppError("ERR_SENDING_FACEBOOK_MSG");
  }
};