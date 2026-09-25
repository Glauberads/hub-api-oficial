import axios from "axios";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import User from "../../models/User";

interface Request {
  ticketId: string | number;
  companyId: number;
  userId: number;
  currentMessage?: string;
  mode?: string;
}

interface OpportunityAnalysis {
  score: number;
  status: string;
  intent: string;
  summary: string;
  nextAction: string;
  suggestedReply: string;
  risk: string;
  tags: string[];
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

  if (!parsed || Number.isNaN(parsed)) return 15;
  if (parsed < 5) return 5;
  if (parsed > 50) return 50;

  return parsed;
};

const safeParseOpportunityAnalysis = (content: string): OpportunityAnalysis => {
  try {
    const cleanContent = String(content || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanContent);

    return {
      score: Number(parsed.score) || 0,
      status: parsed.status || "no_opportunity",
      intent: parsed.intent || "unknown",
      summary: parsed.summary || "Sem resumo retornado pela IA.",
      nextAction: parsed.nextAction || "Revisar a conversa manualmente.",
      suggestedReply: parsed.suggestedReply || "",
      risk: parsed.risk || "Nenhum risco identificado.",
      tags: Array.isArray(parsed.tags) ? parsed.tags : ["radar"]
    };
  } catch (error) {
    return {
      score: 0,
      status: "no_opportunity",
      intent: "unknown",
      summary: "Não foi possível interpretar a análise retornada pela IA.",
      nextAction: "Revisar a conversa manualmente.",
      suggestedReply: "",
      risk: "A IA retornou um formato inválido.",
      tags: ["erro_analise"]
    };
  }
};

const GenerateAiSuggestionService = async ({
  ticketId,
  companyId,
  userId,
  currentMessage,
  mode
}: Request): Promise<string | OpportunityAnalysis> => {
  const isOpportunityRadar = mode === "opportunityRadar";

  const user = await User.findOne({
    where: {
      id: userId,
      companyId
    }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  if (user.allowAiSuggestions !== "enabled") {
    throw new AppError("Usuário sem permissão para usar sugestões de IA.", 403);
  }

  const enableAiSuggestions = await getSettingValue(
    "enableAiSuggestions",
    companyId
  );

  if (
    enableAiSuggestions !== "enabled" &&
    enableAiSuggestions !== "true"
  ) {
    throw new AppError("As sugestões de IA estão desativadas.", 403);
  }

  const aiApiKey = await getSettingValue("aiApiKey", companyId);

  if (!aiApiKey) {
    throw new AppError("Chave da IA não configurada.", 400);
  }

  const ticketIdString = String(ticketId);

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      ticketIdString
    );

  const ticketWhere = isUuid
    ? {
        uuid: ticketIdString,
        companyId
      }
    : {
        id: Number(ticketIdString),
        companyId
      };

  const ticket = await Ticket.findOne({
    where: ticketWhere
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const model =
    (await getSettingValue("aiSuggestionModel", companyId)) ||
    "gpt-4o-mini";

  const normalPrompt =
    (await getSettingValue("aiSuggestionPrompt", companyId)) ||
    `Você é um atendente profissional de WhatsApp.

Sua função é sugerir respostas curtas, naturais, educadas e úteis com base no histórico da conversa.

REGRAS IMPORTANTES:
- Nunca invente informações.
- Nunca prometa algo que não esteja confirmado.
- Nunca diga que é uma IA.
- Use linguagem humana e natural.
- Responda no mesmo idioma do cliente.
- Evite respostas muito longas.
- Se o cliente estiver irritado, responda com empatia.
- Se faltar informação, peça mais detalhes.
- Não utilize markdown.
- Não use emojis excessivos.
- Retorne apenas a mensagem sugerida.`;

  const opportunityRadarPrompt = `Você é um especialista em vendas, atendimento e qualificação de oportunidades.

Analise o histórico da conversa e retorne SOMENTE um JSON válido, sem markdown, sem comentários e sem texto fora do JSON.

Formato obrigatório:
{
  "score": 0,
  "status": "cold|warm|hot|urgent|risk|support|no_opportunity",
  "intent": "price_request|purchase_intent|objection|complaint|support|scheduling|payment|cancellation|follow_up|no_opportunity|unknown",
  "summary": "resumo curto da situação",
  "nextAction": "próxima melhor ação para o atendente",
  "suggestedReply": "resposta pronta, natural e objetiva para enviar ao cliente",
  "risk": "risco ou atenção importante",
  "tags": ["tag1", "tag2"]
}

Critérios:
- score deve ir de 0 a 100.
- hot: cliente com forte chance de compra.
- warm: cliente interessado, mas ainda precisa ser conduzido.
- cold: conversa fria ou pouco qualificada.
- urgent: cliente demonstra urgência.
- risk: risco de perda, cancelamento ou insatisfação.
- support: atendimento técnico/suporte, não venda direta.
- no_opportunity: sem oportunidade comercial clara.
- suggestedReply deve ser uma resposta pronta para o atendente enviar ao cliente.
- Use sempre português do Brasil, salvo se o cliente estiver conversando em outro idioma.`;

  const limit = sanitizeLimit(
    await getSettingValue("aiSuggestionMessagesLimit", companyId)
  );

  const messages = await Message.findAll({
    where: {
      ticketId: ticket.id,
      companyId,
      isDeleted: false,
      isPrivate: false
    },
    order: [["createdAt", "DESC"]],
    limit
  });

  if (!messages.length) {
    throw new AppError("Não há mensagens suficientes para sugerir resposta.", 400);
  }

  const conversation = messages
    .reverse()
    .map(message => {
      const author = message.fromMe ? "ATENDENTE" : "CLIENTE";
      const body = String(message.body || "").trim();

      if (body) {
        return `${author}: ${body}`;
      }

      if (message.mediaType) {
        return `${author}: [mensagem de ${message.mediaType}]`;
      }

      return `${author}: [mensagem sem texto]`;
    })
    .join("\n");

  const userContent = isOpportunityRadar
    ? `Histórico da conversa:
${conversation}

Mensagem atual digitada pelo atendente:
${currentMessage || ""}

Analise a oportunidade comercial deste atendimento.`
    : `Histórico da conversa:
${conversation}

Mensagem atual digitada pelo atendente:
${currentMessage || ""}

Sugira a próxima resposta do atendente.`;

  try {
    const payload: any = {
      model,
      temperature: isOpportunityRadar ? 0.2 : 0.4,
      max_tokens: isOpportunityRadar ? 700 : 220,
      messages: [
        {
          role: "system",
          content: isOpportunityRadar ? opportunityRadarPrompt : normalPrompt
        },
        {
          role: "user",
          content: userContent
        }
      ]
    };

    if (isOpportunityRadar) {
      payload.response_format = { type: "json_object" };
    }

    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AppError("A IA não retornou conteúdo.", 500);
    }

    if (isOpportunityRadar) {
      return safeParseOpportunityAnalysis(content);
    }

    return content;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError("Erro ao gerar sugestão com IA.", 500);
  }
};

export default GenerateAiSuggestionService;