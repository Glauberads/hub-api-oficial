export interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  provider?: "openai" | "gemini";

  // Campos para controle de fluxo
  flowMode?: "permanent" | "temporary";
  maxInteractions?: number;
  continueKeywords?: string[];
  completionTimeout?: number;
  objective?: string;
  autoCompleteOnObjective?: boolean;

  // Resposta automática em áudio com OpenAI TTS
  aiAudioReplyEnabled?: boolean;
  aiAudioReplyOnlyWhenInputAudio?: boolean;
  aiAudioReplyModel?: string;
  aiAudioReplyVoice?: string;
  aiAudioReplySpeed?: number | string;
  aiAudioReplyMaxChars?: number | string;
  aiAudioReplySendTextWithLinks?: boolean;
  aiAudioReplyFallbackToText?: boolean;
  aiAudioReplyInstructions?: string;
}