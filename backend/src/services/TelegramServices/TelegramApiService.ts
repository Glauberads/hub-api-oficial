import path from "path";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";

import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import formatTelegramBotText from "./FormatTelegramBotTextService";

type TelegramApiResponse<T = any> = {
  ok: boolean;
  result: T;
  description?: string;
};

const normalizeToken = (token: string): string => String(token || "").trim();

const buildUrl = (token: string, method: string): string =>
  `https://api.telegram.org/bot${normalizeToken(token)}/${method}`;

const buildFileUrl = (token: string, filePath: string): string =>
  `https://api.telegram.org/file/bot${normalizeToken(token)}/${filePath}`;

const handleTelegramError = (error: any, fallback: string): never => {
  const message =
    error?.response?.data?.description ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  throw new AppError(message, 400);
};

export const getTelegramMe = async (token: string): Promise<any> => {
  try {
    const { data } = await axios.get<TelegramApiResponse>(
      buildUrl(token, "getMe"),
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Token Telegram inválido", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao validar token do Telegram");
  }
};

export const setTelegramWebhook = async ({
  token,
  url,
  secret
}: {
  token: string;
  url: string;
  secret: string;
}): Promise<any> => {
  try {
    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, "setWebhook"),
      {
        url,
        secret_token: secret,
        allowed_updates: ["message", "edited_message", "callback_query"]
      },
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao configurar webhook Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao configurar webhook Telegram");
  }
};

export const deleteTelegramWebhook = async (token: string): Promise<any> => {
  try {
    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, "deleteWebhook"),
      { drop_pending_updates: false },
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao remover webhook Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao remover webhook Telegram");
  }
};

export const sendTelegramTextMessage = async ({
  token,
  chatId,
  text
}: {
  token: string;
  chatId: string | number;
  text: string;
}): Promise<any> => {
  try {
    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, "sendMessage"),
      {
        chat_id: chatId,
        text: formatTelegramBotText(text),
        parse_mode: "HTML",
        disable_web_page_preview: false
      },
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao enviar mensagem Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao enviar mensagem Telegram");
  }
};

export const getTelegramFile = async ({
  token,
  fileId
}: {
  token: string;
  fileId: string;
}): Promise<any> => {
  try {
    const { data } = await axios.get<TelegramApiResponse>(
      buildUrl(token, "getFile"),
      {
        params: { file_id: fileId },
        timeout: 15000
      }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao buscar arquivo Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao buscar arquivo Telegram");
  }
};

export const downloadTelegramFileBuffer = async ({
  token,
  filePath
}: {
  token: string;
  filePath: string;
}): Promise<Buffer> => {
  try {
    const { data } = await axios.get(buildFileUrl(token, filePath), {
      responseType: "arraybuffer",
      timeout: 30000
    });

    return Buffer.from(data);
  } catch (error) {
    return handleTelegramError(error, "Erro ao baixar arquivo Telegram");
  }
};

export const sendTelegramMediaMessage = async ({
  token,
  chatId,
  filePath,
  fileName,
  caption,
  mediaType
}: {
  token: string;
  chatId: string | number;
  filePath: string;
  fileName: string;
  caption?: string;
  mediaType: "image" | "audio" | "video" | "document" | "voice";
}): Promise<any> => {
  try {
    const form = new FormData();

    form.append("chat_id", String(chatId));

    if (caption) {
      form.append("caption", formatTelegramBotText(caption));
      form.append("parse_mode", "HTML");
    }

    let method = "sendDocument";
    let fieldName = "document";

    if (mediaType === "image") {
      method = "sendPhoto";
      fieldName = "photo";
    } else if (mediaType === "video") {
      method = "sendVideo";
      fieldName = "video";
    } else if (mediaType === "audio") {
      method = "sendAudio";
      fieldName = "audio";
    } else if (mediaType === "voice") {
      method = "sendVoice";
      fieldName = "voice";
    }

    form.append(fieldName, fs.createReadStream(filePath), fileName);

    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, method),
      form,
      {
        headers: form.getHeaders(),
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao enviar mídia Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao enviar mídia Telegram");
  }
};


export const sendTelegramButtonMessage = async ({
  token,
  chatId,
  text,
  buttons
}: {
  token: string;
  chatId: string | number;
  text: string;
  buttons: Array<{ text: string; callback_data: string }>;
}): Promise<any> => {
  try {
    const inlineKeyboard = buttons.map(button => [
      {
        text: String(button.text || "").slice(0, 64),
        callback_data: String(button.callback_data || "").slice(0, 64)
      }
    ]);

    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, "sendMessage"),
      {
        chat_id: chatId,
        text: formatTelegramBotText(text),
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      },
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao enviar botões Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao enviar botões Telegram");
  }
};

export const answerTelegramCallbackQuery = async ({
  token,
  callbackQueryId,
  text
}: {
  token: string;
  callbackQueryId: string;
  text?: string;
}): Promise<any> => {
  try {
    const { data } = await axios.post<TelegramApiResponse>(
      buildUrl(token, "answerCallbackQuery"),
      {
        callback_query_id: callbackQueryId,
        text: formatTelegramBotText(text || undefined),
        parse_mode: "HTML",
        show_alert: false
      },
      { timeout: 15000 }
    );

    if (!data.ok) {
      throw new AppError(data.description || "Erro ao responder callback Telegram", 400);
    }

    return data.result;
  } catch (error) {
    return handleTelegramError(error, "Erro ao responder callback Telegram");
  }
};


export const getTelegramUserProfilePhotoBuffer = async ({
  token,
  userId
}: {
  token: string;
  userId: string | number;
}): Promise<{ buffer: Buffer; extension: string } | null> => {
  try {
    const photosResponse = await axios.get<any>(
      buildUrl(token, "getUserProfilePhotos"),
      {
        params: {
          user_id: userId,
          limit: 1
        },
        timeout: 15000
      }
    );

    if (!photosResponse.data?.ok) {
      return null;
    }

    const photos = photosResponse.data?.result?.photos || [];

    if (!photos.length || !photos[0]?.length) {
      return null;
    }

    const photoSizes = photos[0];
    const largestPhoto = photoSizes[photoSizes.length - 1];

    if (!largestPhoto?.file_id) {
      return null;
    }

    const file = await getTelegramFile({
      token,
      fileId: largestPhoto.file_id
    });

    if (!file?.file_path) {
      return null;
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const { data } = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 20000
    });

    const extension = path.extname(file.file_path) || ".jpg";

    return {
      buffer: Buffer.from(data),
      extension
    };
  } catch (error) {
    logger.warn(`[TELEGRAM PROFILE] Não foi possível baixar foto do usuário ${userId}:`, error);
    return null;
  }
};

