import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import logger from "../../utils/logger";
import {
  getCompanySetting,
  getCompanySettingNumber
} from "../SettingServices/GetCompanySettingService";

interface Request {
  companyId: number;
  text: string;
  openAiApiKey?: string;
  model?: string;
  voice?: string;
  speed?: number | string;
  instructions?: string;
}

interface Response {
  filePath: string;
  fileName: string;
  mimetype: string;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const sanitizeVoice = (voice: string): string => {
  const allowed = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "onyx",
    "nova",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar"
  ];

  return allowed.includes(voice) ? voice : "coral";
};

const GenerateAiSpeechService = async ({
  companyId,
  text,
  openAiApiKey,
  model: requestModel,
  voice: requestVoice,
  speed: requestSpeed,
  instructions: requestInstructions
}: Request): Promise<Response | null> => {
  try {
    const apiKey =
      openAiApiKey ||
      (await getCompanySetting(companyId, "openAiApiKey", "")) ||
      (await getCompanySetting(companyId, "openaiApiKey", "")) ||
      (await getCompanySetting(companyId, "chatGPTApiKey", ""));

    if (!apiKey) {
      logger.warn(`[AI-AUDIO] Empresa ${companyId} sem chave OpenAI configurada.`);
      return null;
    }

    const model =
      requestModel ||
      (await getCompanySetting(
        companyId,
        "aiAudioReplyModel",
        "gpt-4o-mini-tts"
      ));

    const voice = sanitizeVoice(
      requestVoice ||
      (await getCompanySetting(companyId, "aiAudioReplyVoice", "coral"))
    );

    const speedValue =
      requestSpeed !== undefined && requestSpeed !== null
        ? Number(requestSpeed)
        : await getCompanySettingNumber(
          companyId,
          "aiAudioReplySpeed",
          1,
          0.25,
          4
        );

    const speed = Number.isNaN(speedValue) ? 1 : speedValue;

    const instructions =
      requestInstructions ||
      (await getCompanySetting(
        companyId,
        "aiAudioReplyInstructions",
        "Fale em português do Brasil, com tom natural, simpático e objetivo."
      ));

    const folder = path.join(publicFolder, "ai-audio-replies", String(companyId));

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const fileName = `${uuidv4()}.ogg`;
    const filePath = path.join(folder, fileName);

    const payload: any = {
      model,
      input: text,
      voice,
      response_format: "opus",
      speed
    };

    logger.info(
      `[AI-AUDIO-DEBUG] Gerando TTS | companyId=${companyId} model=${model} voice=${voice} speed=${speed}`
    );

    if (instructions && !["tts-1", "tts-1-hd"].includes(model)) {
      payload.instructions = instructions;
    }

    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      payload,
      {
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    fs.writeFileSync(filePath, Buffer.from(response.data));

    return {
      filePath,
      fileName: `ai-audio-replies/${companyId}/${fileName}`,
      mimetype: "audio/ogg; codecs=opus"
    };
  } catch (error: any) {
    logger.error(
      `[AI-AUDIO] Erro ao gerar áudio da IA: ${error?.response?.data ? JSON.stringify(error.response.data) : error.message
      }`
    );

    return null;
  }
};

export default GenerateAiSpeechService;