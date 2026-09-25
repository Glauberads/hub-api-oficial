const escapeTelegramHtml = (value: string): string => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const restorePlaceholders = (text: string, placeholders: string[]): string => {
  return placeholders.reduce((result, value, index) => {
    return result.replace(new RegExp(`@@TG_PLACEHOLDER_${index}@@`, "g"), value);
  }, text);
};

const formatTelegramBotText = (value: string | null | undefined): string => {
  const raw = String(value || "");

  if (!raw.trim()) {
    return raw;
  }

  const placeholders: string[] = [];

  let text = escapeTelegramHtml(raw);

  text = text.replace(/```([\s\S]*?)```/g, (_match, content) => {
    const index = placeholders.push(`<pre>${content}</pre>`) - 1;
    return `@@TG_PLACEHOLDER_${index}@@`;
  });

  text = text.replace(/`([^`\n]+)`/g, (_match, content) => {
    const index = placeholders.push(`<code>${content}</code>`) - 1;
    return `@@TG_PLACEHOLDER_${index}@@`;
  });

  text = text.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  text = text.replace(/_([^_\n]+)_/g, "<i>$1</i>");
  text = text.replace(/~([^~\n]+)~/g, "<s>$1</s>");

  return restorePlaceholders(text, placeholders);
};

export default formatTelegramBotText;
