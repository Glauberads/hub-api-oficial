import { Transaction } from "sequelize";
import Setting from "../../models/Setting";

interface Request {
  companyId: number;
  transaction?: Transaction;
}

const defaultSettings = [
  {
    key: "currency",
    value: "BRL"
  },
  {
    key: "aiAudioReplyEnabled",
    value: "false"
  },
  {
    key: "aiAudioReplyOnlyWhenInputAudio",
    value: "true"
  },
  {
    key: "aiAudioReplyProvider",
    value: "openai"
  },
  {
    key: "aiAudioReplyModel",
    value: "gpt-4o-mini-tts"
  },
  {
    key: "aiAudioReplyVoice",
    value: "coral"
  },
  {
    key: "aiAudioReplySpeed",
    value: "1"
  },
  {
    key: "aiAudioReplyMaxChars",
    value: "700"
  },
  {
    key: "aiAudioReplySendTextWithLinks",
    value: "true"
  },
  {
    key: "aiAudioReplyFallbackToText",
    value: "true"
  },
  {
    key: "aiAudioReplyInstructions",
    value:
      "Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo."
  }
];

const EnsureDefaultCompanySettingsService = async ({
  companyId,
  transaction
}: Request): Promise<void> => {
  for (const setting of defaultSettings) {
    await Setting.findOrCreate({
      where: {
        key: setting.key,
        companyId
      },
      defaults: {
        key: setting.key,
        value: setting.value,
        companyId
      },
      transaction
    });
  }
};

export default EnsureDefaultCompanySettingsService;
