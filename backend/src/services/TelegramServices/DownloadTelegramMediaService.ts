import fs from "fs";
import path from "path";

import { downloadTelegramFileBuffer, getTelegramFile } from "./TelegramApiService";

type TelegramMediaResult = {
  mediaType: "image" | "audio" | "video" | "document" | "sticker";
  fileName: string;
  body: string;
  mimeType?: string;
};

const sanitizeFileName = (value: string): string => {
  return String(value || "arquivo")
    .replace(/[\/\\]/g, "-")
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "");
};

const extensionFromMime = (mime?: string): string => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/zip": "zip"
  };

  return mime && map[mime] ? map[mime] : "bin";
};

const extractTelegramMedia = (message: any): any | null => {
  if (!message) return null;

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const photo = [...message.photo].sort(
      (a, b) => Number(b.file_size || 0) - Number(a.file_size || 0)
    )[0];

    return {
      fileId: photo.file_id,
      mediaType: "image",
      fileName: `telegram_photo_${message.chat?.id}_${message.message_id}.jpg`,
      mimeType: "image/jpeg",
      body: message.caption || "Imagem Telegram"
    };
  }

  if (message.document?.file_id) {
    return {
      fileId: message.document.file_id,
      mediaType: "document",
      fileName: message.document.file_name || `telegram_document_${message.message_id}.${extensionFromMime(message.document.mime_type)}`,
      mimeType: message.document.mime_type,
      body: message.caption || message.document.file_name || "Documento Telegram"
    };
  }

  if (message.voice?.file_id) {
    return {
      fileId: message.voice.file_id,
      mediaType: "audio",
      fileName: `telegram_voice_${message.chat?.id}_${message.message_id}.ogg`,
      mimeType: message.voice.mime_type || "audio/ogg",
      body: message.caption || "Áudio Telegram"
    };
  }

  if (message.audio?.file_id) {
    return {
      fileId: message.audio.file_id,
      mediaType: "audio",
      fileName: message.audio.file_name || `telegram_audio_${message.message_id}.${extensionFromMime(message.audio.mime_type)}`,
      mimeType: message.audio.mime_type,
      body: message.caption || message.audio.file_name || "Áudio Telegram"
    };
  }

  if (message.video?.file_id) {
    return {
      fileId: message.video.file_id,
      mediaType: "video",
      fileName: message.video.file_name || `telegram_video_${message.message_id}.${extensionFromMime(message.video.mime_type || "video/mp4")}`,
      mimeType: message.video.mime_type || "video/mp4",
      body: message.caption || "Vídeo Telegram"
    };
  }

  if (message.animation?.file_id) {
    return {
      fileId: message.animation.file_id,
      mediaType: "video",
      fileName: message.animation.file_name || `telegram_animation_${message.message_id}.mp4`,
      mimeType: message.animation.mime_type || "video/mp4",
      body: message.caption || "Animação Telegram"
    };
  }

  if (message.sticker?.file_id) {
    const ext = message.sticker.is_video ? "webm" : message.sticker.is_animated ? "tgs" : "webp";

    return {
      fileId: message.sticker.file_id,
      mediaType: "sticker",
      fileName: `telegram_sticker_${message.chat?.id}_${message.message_id}.${ext}`,
      mimeType: message.sticker.is_video ? "video/webm" : "image/webp",
      body: message.sticker.emoji ? `Sticker ${message.sticker.emoji}` : "Sticker Telegram"
    };
  }

  return null;
};

const DownloadTelegramMediaService = async ({
  token,
  companyId,
  message
}: {
  token: string;
  companyId: number;
  message: any;
}): Promise<TelegramMediaResult | null> => {
  const media = extractTelegramMedia(message);

  if (!media?.fileId) {
    return null;
  }

  const telegramFile = await getTelegramFile({
    token,
    fileId: media.fileId
  });

  const buffer = await downloadTelegramFileBuffer({
    token,
    filePath: telegramFile.file_path
  });

  const folder = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public",
    `company${companyId}`
  );

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  const filePathExt = path.extname(telegramFile.file_path || "");
  const originalExt = path.extname(media.fileName || "");
  const ext = filePathExt || originalExt || `.${extensionFromMime(media.mimeType)}`;

  const baseName = path.basename(media.fileName || `telegram_${message.message_id}${ext}`, originalExt || ext);
  const fileName = `${Date.now()}_${sanitizeFileName(baseName)}${ext}`;
  const fullPath = path.join(folder, fileName);

  fs.writeFileSync(fullPath, buffer);
  fs.chmodSync(fullPath, 0o666);

  return {
    mediaType: media.mediaType,
    fileName,
    body: media.body,
    mimeType: media.mimeType
  };
};

export default DownloadTelegramMediaService;
