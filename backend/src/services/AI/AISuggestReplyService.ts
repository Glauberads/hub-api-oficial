import axios from "axios";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

interface Request {
  ticketId: number;
  companyId: number;
}

interface Response {
  suggestion: string;
}

const getSettingValue = async (
  key: string,
  companyId: number
): Promise<string> => {
  const setting = await Setting.findOne({
    where: {
      key,
      companyId
    }
  });

  return setting?.value || "";
};

const sanitizeLimit = (value: string): number => {
  const parsed = Number(value);

  if (!parsed || Number.isNaN(parsed)) {
    return 15;
  }

  if (parsed < 5) {
    return 5;
  }

  if (parsed > 50) {
    return 50;
  }

  return parsed;
};

const AISuggestReplyService = async ({
  ticketId,
  companyId
}: Request): Promise<Response> => {
  const enableAiSuggestions = await getSettingValue(
    "enableAiSuggestions",
    companyId
  );

  if (enableAiSuggestions !== "true") {
    throw new AppError("As sugestões de IA estão desativadas.", 403);
  }

  const aiApiKey = await getSettingValue("aiApiKey", companyId);

  if (!aiApiKey) {
    throw new AppError("Chave da IA não configurada.", 400);
  }

  const ticket = await Ticket.findOne({
    where: {
      id: ticketId,
      companyId
    }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const aiSuggestionModel =
    (await getSettingValue("aiSuggestionModel", companyId)) || "gpt-4o-mini";

  const aiSuggestionPrompt =
    (await getSettingValue("aiSuggestionPrompt", companyId)) ||
    "Você é um atendente profissional. Sugira uma resposta curta, educada e útil com base no histórico da conversa. Não invente informações. Use o mesmo idioma do cliente. Retorne apenas a mensagem sugerida.";

  const messagesLimit = sanitizeLimit(
    await getSettingValue("aiSuggestionMessagesLimit", companyId)
  );

  const messages = await Message.findAll({
    where: {
      ticketId,
      companyId,
      isDeleted: false,
      isPrivate: false,
      [Op.or]: [
        {
          body: {
            [Op.ne]: null
          }
        },
        {
          mediaType: {
            [Op.ne]: null
          }
        }
      ]
    },
    order: [["createdAt", "DESC"]],
    limit: messagesLimit
  });

  if (!messages.length) {
    throw new AppError("Não há mensagens suficientes para sugerir resposta.", 400);
  }

  const history = messages
    .reverse()
    .map(message => {
      const sender = message.fromMe ? "Atendente" : "Cliente";

      if (message.body && String(message.body).trim()) {
        return `${sender}: ${String(message.body).trim()}`;
      }

      if (message.mediaType) {
        return `${sender}: [mensagem de ${message.mediaType}]`;
      }

      return `${sender}: [mensagem sem texto]`;
    })
    .join("\n");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: aiSuggestionModel,
      temperature: 0.4,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: aiSuggestionPrompt
        },
        {
          role: "user",
          content: `Histórico da conversa:\n${history}\n\nSugira a próxima resposta do atendente.`
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  const suggestion =
    response.data?.choices?.[0]?.message?.content?.trim() || "";

  if (!suggestion) {
    throw new AppError("A IA não retornou nenhuma sugestão.", 500);
  }

  return {
    suggestion
  };
};

export default AISuggestReplyService;