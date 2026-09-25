export const isIncomingAudioMessage = ({
  typeMessage,
  mediaType,
  msg
}: {
  typeMessage?: string;
  mediaType?: string;
  msg?: any;
}): boolean => {
  if (mediaType === "audio" || mediaType === "ptt") return true;

  if (
    typeMessage === "audioMessage" ||
    typeMessage === "ptt" ||
    typeMessage === "audio"
  ) {
    return true;
  }

  if (msg?.message?.audioMessage) return true;
  if (msg?.message?.ptt) return true;

  return false;
};

export const extractLinks = (text: string): string[] => {
  if (!text) return [];

  const links = text.match(/https?:\/\/[^\s)]+/gi);

  return links || [];
};

export const cleanTextForAudio = (text: string, maxChars = 700): string => {
  if (!text) return "";

  let clean = text;

  clean = clean.replace(/https?:\/\/[^\s)]+/gi, " ");
  clean = clean.replace(/[*_~`>#\[\]{}]/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();

  if (clean.length > maxChars) {
    clean = clean.substring(0, maxChars).trim();

    const lastDot = Math.max(
      clean.lastIndexOf("."),
      clean.lastIndexOf("!"),
      clean.lastIndexOf("?")
    );

    if (lastDot > 120) {
      clean = clean.substring(0, lastDot + 1).trim();
    }
  }

  return clean;
};