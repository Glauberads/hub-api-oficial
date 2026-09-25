import path from "path";
import fs from "fs";
import os from "os";
import Message from "../../models/Message";

import axios from "axios";
import FormData from "form-data";
import OpenAI from "openai";
import { Transcription } from "openai/resources/audio/transcriptions";

type Response = Transcription | string;

const extractTranscriptionText = (payload: any): string => {
  if (!payload) return "";

  if (typeof payload === "string") {
    return payload.trim();
  }

  if (typeof payload?.text === "string") {
    return payload.text.trim();
  }

  if (typeof payload?.transcription === "string") {
    return payload.transcription.trim();
  }

  if (typeof payload?.message === "string") {
    return payload.message.trim();
  }

  return "";
};

const resolveLocalFilePath = (mediaUrl: string, companyId: string): string => {
  const projectRoot = path.resolve(__dirname, "..", "..", "..");
  const publicFolder = path.join(projectRoot, "public");

  const cleanMediaUrl = String(mediaUrl || "")
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/\\/g, "/");

  const fileName = path.basename(cleanMediaUrl);

  const candidates = [
    cleanMediaUrl,
    path.resolve(cleanMediaUrl),
    path.join(projectRoot, cleanMediaUrl.replace(/^\/+/, "")),
    path.join(publicFolder, cleanMediaUrl.replace(/^\/?(public\/)?/, "")),
    path.join(publicFolder, `company${companyId}`, fileName),
    path.join(publicFolder, fileName),
  ];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (fs.existsSync(normalized)) {
      return normalized;
    }
  }

  throw new Error(
    `Arquivo não encontrado para transcrição. mediaUrl=${mediaUrl}`
  );
};

const downloadRemoteFile = async (
  url: string
): Promise<{ filePath: string; cleanup: () => void }> => {
  const extension =
    path.extname(url.split("?")[0]).trim() || ".ogg";

  const filePath = path.join(
    os.tmpdir(),
    `audio-transcribe-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${extension}`
  );

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 120000,
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    writer.on("finish", () => resolve());
    writer.on("error", reject);
    response.data.on("error", reject);
  });

  return {
    filePath,
    cleanup: () => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn("Falha ao remover arquivo temporário:", error);
      }
    },
  };
};

const getAudioFile = async (
  mediaUrl: string,
  companyId: string
): Promise<{ filePath: string; cleanup: () => void }> => {
  if (/^https?:\/\//i.test(mediaUrl)) {
    return downloadRemoteFile(mediaUrl);
  }

  const filePath = resolveLocalFilePath(mediaUrl, companyId);

  return {
    filePath,
    cleanup: () => undefined,
  };
};

const transcribeWithExternalService = async (filePath: string): Promise<string> => {
  const baseUrl = String(process.env.TRANSCRIBE_URL || "").trim().replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("TRANSCRIBE_URL não configurada");
  }

  const endpoint = baseUrl.endsWith("/transcrever")
    ? baseUrl
    : `${baseUrl}/transcrever`;

  const data = new FormData();
  data.append("audio", fs.createReadStream(filePath));

  const res = await axios.request({
    method: "post",
    maxBodyLength: Infinity,
    url: endpoint,
    timeout: 120000,
    headers: {
      ...(process.env.TRANSCRIBE_API_KEY
        ? { Authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}` }
        : {}),
      ...data.getHeaders(),
    },
    data,
  });

  const text = extractTranscriptionText(res.data);

  if (!text) {
    throw new Error("Serviço externo retornou transcrição vazia");
  }

  return text;
};

const transcribeWithOpenAI = async (filePath: string): Promise<string> => {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_APIKEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const openai = new OpenAI({ apiKey });

  const result = await openai.audio.transcriptions.create({
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    file: fs.createReadStream(filePath) as any,
  });

  const text = extractTranscriptionText(result);

  if (!text) {
    throw new Error("OpenAI retornou transcrição vazia");
  }

  return text;
};

const TranscribeAudioMessageToText = async (
  wid: string,
  companyId: string
): Promise<Response> => {
  let cleanup: (() => void) | null = null;

  try {
    const msg = await Message.findOne({
      where: {
        wid,
        companyId,
      },
    });

    if (!msg) {
      throw new Error("Mensagem não encontrada");
    }

    if (msg.transcrito && msg.body) {
      return msg.body;
    }

    if (!msg.mediaUrl) {
      throw new Error("Mensagem sem mediaUrl para transcrição");
    }

    const audioFile = await getAudioFile(String(msg.mediaUrl), String(companyId));
    cleanup = audioFile.cleanup;

    let transcriptionText = "";

    if (process.env.TRANSCRIBE_URL) {
      try {
        transcriptionText = await transcribeWithExternalService(audioFile.filePath);
      } catch (externalError: any) {
        console.warn(
          "[TRANSCRIBE] Serviço externo indisponível, usando fallback OpenAI:",
          externalError?.message || externalError
        );
      }
    }

    if (!transcriptionText) {
      transcriptionText = await transcribeWithOpenAI(audioFile.filePath);
    }

    if (!transcriptionText) {
      throw new Error("Falha ao obter texto transcrito");
    }

    await msg.update({
      body: transcriptionText,
      transcrito: true,
    });

    return transcriptionText;
  } catch (error) {
    console.error("Erro durante a transcrição:", error);
    return "Conversão pra texto falhou";
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
};

export default TranscribeAudioMessageToText;