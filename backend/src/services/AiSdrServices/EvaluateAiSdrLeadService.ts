import axios from "axios";

import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import AiSdrConfig from "../../models/AiSdrConfig";
import AiSdrSession from "../../models/AiSdrSession";

interface Request {
  ticket: Ticket;
  config: AiSdrConfig;
  session: AiSdrSession;
  companyId: number;
  currentMessage?: string;
}

export interface AiSdrEvaluation {
  reply: string;
  shouldHandoff: boolean;
  status: string;
  leadScore: number;
  leadTemperature: string;
  leadName?: string;
  leadInterest?: string;
  leadCity?: string;
  leadBudget?: string;
  summary: string;
  nextAction: string;
  lastQuestion: string;
  extractedData: any;
  qualificationAnswers: Record<string, string>;
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

const safeJsonParse = (content: string): AiSdrEvaluation => {
  try {
    const clean = String(content || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(clean);

    return {
      reply: String(parsed.reply || "").trim(),
      shouldHandoff: Boolean(parsed.shouldHandoff),
      status: String(parsed.status || "active"),
      leadScore: Number(parsed.leadScore) || 0,
      leadTemperature: String(parsed.leadTemperature || "cold"),
      leadName: parsed.leadName ? String(parsed.leadName) : undefined,
      leadInterest: parsed.leadInterest ? String(parsed.leadInterest) : undefined,
      leadCity: parsed.leadCity ? String(parsed.leadCity) : undefined,
      leadBudget: parsed.leadBudget ? String(parsed.leadBudget) : undefined,
      summary: String(parsed.summary || "Lead ainda em qualificação.").trim(),
      nextAction: String(parsed.nextAction || "Continuar qualificação.").trim(),
      lastQuestion: String(parsed.lastQuestion || "").trim(),
      extractedData: parsed.extractedData || {},
      qualificationAnswers:
        parsed.qualificationAnswers &&
        typeof parsed.qualificationAnswers === "object"
          ? parsed.qualificationAnswers
          : {},
      tags: Array.isArray(parsed.tags) ? parsed.tags : []
    };
  } catch (error) {
    return {
      reply: "Certo, obrigado pelas informações. Vou seguir com seu atendimento.",
      shouldHandoff: true,
      status: "waiting_human",
      leadScore: 0,
      leadTemperature: "cold",
      summary: "A IA retornou um formato inválido e o atendimento deve ser revisado manualmente.",
      nextAction: "Revisar conversa manualmente.",
      lastQuestion: "",
      extractedData: {},
      qualificationAnswers: {},
      tags: ["ai_sdr_parse_error"]
    };
  }
};

const sanitizeStatus = (status: string, shouldHandoff: boolean): string => {
  if (shouldHandoff) return "waiting_human";

  const allowed = ["active", "qualified", "unqualified", "finished", "waiting_human"];

  if (allowed.includes(status)) return status;

  return "active";
};

const buildDefaultPrompt = (): string => {
  return `Você é um Agente IA Comercial de um sistema de atendimento.

Sua função é qualificar leads de forma natural, curta e objetiva.

OBJETIVOS:
1. Entender o interesse do cliente.
2. Fazer perguntas comerciais úteis, uma por vez.
3. Identificar se o lead é quente, morno ou frio.
4. Gerar resumo e próxima ação.
5. Transferir para humano quando o lead estiver pronto, irritado, confuso ou pedir atendimento humano.

REGRAS:
- Responda sempre em português do Brasil, salvo se o cliente conversar em outro idioma.
- Não diga que é uma IA.
- Não use markdown.
- Não invente preço, prazo, garantia, recurso ou condição comercial.
- Faça no máximo uma pergunta por resposta.
- Seja direto, educado e com linguagem humana.
- As perguntas de qualificação configuradas formam um checklist obrigatório.
- Faça somente uma pergunta de qualificação por vez.
- Registre em qualificationAnswers as respostas identificadas.
- Use exatamente o texto original da pergunta configurada como chave de qualificationAnswers.
- Não marque shouldHandoff como true apenas por score alto ou lead hot enquanto existirem perguntas configuradas sem resposta.
- Não invente respostas. Só registre informações realmente fornecidas pelo cliente.
- Se o cliente pedir atendente, humano, vendedor, ligação ou contato comercial, marcar shouldHandoff como true.
- Se o cliente demonstrar compra imediata, orçamento, urgência, intenção forte, disser que quer comprar hoje ou fechar agora, marcar leadTemperature como hot e shouldHandoff como true.
- Quando shouldHandoff for true, use status waiting_human.
- Retorne somente JSON válido.`;
};

const EvaluateAiSdrLeadService = async ({
  ticket,
  config,
  session,
  companyId,
  currentMessage
}: Request): Promise<AiSdrEvaluation> => {
  const aiApiKey = await getSettingValue("aiApiKey", companyId);

  if (!aiApiKey) {
    throw new AppError("Chave da IA não configurada.", 400);
  }

  const messagesLimit = 20;

  const messages = await Message.findAll({
    where: {
      ticketId: ticket.id,
      companyId,
      isDeleted: false,
      isPrivate: false
    },
    order: [["createdAt", "DESC"]],
    limit: messagesLimit
  });

  const conversation = messages
    .reverse()
    .map(message => {
      const author = message.fromMe ? "ATENDENTE" : "CLIENTE";
      const body = String(message.body || "").trim();

      if (body) {
        return `${author}: ${body}`;
      }

      if ((message as any).mediaType) {
        return `${author}: [mensagem de ${(message as any).mediaType}]`;
      }

      return `${author}: [mensagem sem texto]`;
    })
    .join("\n");

  const qualificationQuestions = Array.isArray(config.qualificationQuestions)
    ? config.qualificationQuestions
        .map((question: any) => {
          if (typeof question === "string") {
            return question.trim();
          }

          return String(
            question?.label ||
            question?.key ||
            ""
          ).trim();
        })
        .filter(Boolean)
    : [];

  const previousQualificationAnswers =
    session.leadData &&
    typeof session.leadData === "object" &&
    session.leadData.qualificationAnswers &&
    typeof session.leadData.qualificationAnswers === "object"
      ? session.leadData.qualificationAnswers
      : {};

  const baseSystemPrompt =
    String(config.systemPrompt || "").trim() ||
    buildDefaultPrompt();

  const qualificationPolicy = `REGRAS OPERACIONAIS DE QUALIFICAÇÃO:

- As perguntas de qualificação configuradas são objetivos de coleta de dados, e não um roteiro robótico.
- Continue seguindo integralmente o comportamento, contexto comercial, personalidade e instruções do prompt principal.
- Primeiro compreenda e responda naturalmente à mensagem atual do cliente.
- Reaja ao que o cliente falou. Explique, acolha, esclareça ou conduza a conversa quando isso for necessário.
- Aproveite informações espontâneas do cliente para preencher qualificationAnswers, mesmo que ele responda uma pergunta antes dela ser feita.
- Não faça novamente uma pergunta cuja resposta já foi identificada.
- Enquanto existirem perguntas de qualificação pendentes, faça no máximo UMA pergunta pendente por resposta.
- A pergunta de qualificação deve entrar naturalmente na conversa. Não transforme o atendimento em interrogatório ou formulário.
- Não responda apenas com o texto seco da próxima pergunta, salvo quando isso for realmente natural no contexto.
- Você pode formular a pergunta de forma mais humana na mensagem reply.
- No campo lastQuestion, informe exatamente o texto original da pergunta configurada que está sendo coletada.
- Em qualificationAnswers, use exatamente o texto original da pergunta configurada como chave.
- Não invente respostas.
- Enquanto existirem perguntas configuradas sem resposta, não transfira apenas porque o score está alto ou o lead está hot.
- Se o cliente pedir explicitamente atendimento humano, vendedor, atendente ou transferência, a transferência pode ocorrer imediatamente.
- Retorne somente JSON válido.`;

  const systemPrompt =
    `${baseSystemPrompt}\n\n${qualificationPolicy}`;

  const userContent = `Histórico da conversa:
${conversation || "[sem histórico]"}

Mensagem atual do cliente:
${currentMessage || ""}

Sessão atual:
status: ${session.status}
etapa atual: ${session.currentStep}
interações: ${session.interactions}
leadName: ${session.leadName || ""}
leadInterest: ${session.leadInterest || ""}
leadCity: ${session.leadCity || ""}
leadBudget: ${session.leadBudget || ""}
leadTemperature: ${session.leadTemperature || ""}
leadScore: ${session.leadScore || 0}
leadData: ${JSON.stringify(session.leadData || {})}

Perguntas de qualificação configuradas:
${JSON.stringify(qualificationQuestions)}

Respostas de qualificação já coletadas:
${JSON.stringify(previousQualificationAnswers)}

Regras de transferência configuradas:
${JSON.stringify(config.handoffRules || {})}

Retorne SOMENTE um JSON válido neste formato:
{
  "reply": "mensagem curta e natural para enviar ao cliente",
  "shouldHandoff": false,
  "status": "active|qualified|unqualified|finished|waiting_human",
  "leadScore": 0,
  "leadTemperature": "cold|warm|hot",
  "leadName": "",
  "leadInterest": "",
  "leadCity": "",
  "leadBudget": "",
  "summary": "resumo objetivo do lead",
  "nextAction": "próxima ação recomendada",
  "lastQuestion": "última pergunta feita ao cliente",
  "extractedData": {},
  "qualificationAnswers": {
    "texto exato da pergunta configurada": "resposta identificada do cliente"
  },
  "tags": ["tag1"]
}`;

  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: config.model || "gpt-4o-mini",
        temperature: Number(config.temperature) || 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userContent
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

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AppError("A IA não retornou conteúdo.", 500);
    }

    const parsed = safeJsonParse(content);

    const normalizedCurrentMessage = String(currentMessage || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const explicitHandoff =
      normalizedCurrentMessage.includes("atendente") ||
      normalizedCurrentMessage.includes("humano") ||
      normalizedCurrentMessage.includes("comprar hoje") ||
      normalizedCurrentMessage.includes("fechar") ||
      normalizedCurrentMessage.includes("quero comprar") ||
      normalizedCurrentMessage.includes("vou comprar");

    if (
      explicitHandoff ||
      parsed.leadTemperature === "hot" ||
      Number(parsed.leadScore || 0) >= 70
    ) {
      parsed.shouldHandoff = true;
      parsed.status = "waiting_human";

      if (!parsed.nextAction || parsed.nextAction === "Continuar qualificação.") {
        parsed.nextAction = "Transferir para atendimento humano para conduzir o fechamento.";
      }
    }

    parsed.status = sanitizeStatus(parsed.status, parsed.shouldHandoff);

    let calculatedScore = Number(parsed.leadScore || 0);

    if (parsed.leadInterest) calculatedScore += 25;
    if (parsed.leadCity) calculatedScore += 15;
    if (parsed.leadBudget) calculatedScore += 25;

    if (explicitHandoff) {
      calculatedScore += 35;
    }

    if (normalizedCurrentMessage.includes("urgente")) {
      calculatedScore += 20;
    }

    if (normalizedCurrentMessage.includes("hoje")) {
      calculatedScore += 20;
    }

    if (calculatedScore > Number(parsed.leadScore || 0)) {
      parsed.leadScore = calculatedScore;
    }

    if (parsed.leadScore < 0) parsed.leadScore = 0;
    if (parsed.leadScore > 100) parsed.leadScore = 100;

    if (parsed.leadScore >= 70) {
      parsed.leadTemperature = "hot";
      parsed.shouldHandoff = true;
      parsed.status = "waiting_human";

      if (!parsed.nextAction || parsed.nextAction === "Continuar qualificação.") {
        parsed.nextAction = "Transferir para atendimento humano para conduzir o fechamento.";
      }
    } else if (parsed.leadScore >= 40) {
      parsed.leadTemperature = "warm";
    } else if (!["cold", "warm", "hot"].includes(parsed.leadTemperature)) {
      parsed.leadTemperature = "cold";
    }

    parsed.status = sanitizeStatus(parsed.status, parsed.shouldHandoff);

    const normalizeQuestion = (value: string): string =>
      String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[?!.:,;]+$/g, "")
        .replace(/\s+/g, " ");

    const hasQualificationAnswer = (value: any): boolean => {
      const normalized = normalizeQuestion(String(value || ""));

      return Boolean(
        normalized &&
        normalized !== "nao informado" &&
        normalized !== "null" &&
        normalized !== "undefined"
      );
    };

    const mergedQualificationAnswers: Record<string, string> = {};

    qualificationQuestions.forEach(question => {
      const previousAnswer = previousQualificationAnswers[question];

      if (hasQualificationAnswer(previousAnswer)) {
        mergedQualificationAnswers[question] = String(previousAnswer).trim();
      }
    });

    const aiQualificationAnswers =
      parsed.qualificationAnswers &&
      typeof parsed.qualificationAnswers === "object"
        ? parsed.qualificationAnswers
        : {};

    qualificationQuestions.forEach(question => {
      const normalizedQuestion = normalizeQuestion(question);

      const matchingEntry = Object.entries(aiQualificationAnswers).find(
        ([key]) => normalizeQuestion(key) === normalizedQuestion
      );

      const answer = matchingEntry?.[1];

      if (hasQualificationAnswer(answer)) {
        mergedQualificationAnswers[question] = String(answer).trim();
      }
    });

    const currentMessageText = String(currentMessage || "").trim();

    const previousQuestion = qualificationQuestions.find(
      question =>
        normalizeQuestion(question) ===
        normalizeQuestion(session.lastQuestion || "")
    );

    if (
      previousQuestion &&
      currentMessageText &&
      hasQualificationAnswer(currentMessageText)
    ) {
      mergedQualificationAnswers[previousQuestion] = currentMessageText;
    }

    parsed.qualificationAnswers = mergedQualificationAnswers;

    const pendingQualificationQuestions = qualificationQuestions.filter(
      question =>
        !hasQualificationAnswer(
          mergedQualificationAnswers[question]
        )
    );

    if (
      pendingQualificationQuestions.length > 0 &&
      !explicitHandoff
    ) {
      const nextQualificationQuestion =
        pendingQualificationQuestions[0];

      parsed.shouldHandoff = false;
      parsed.status = "active";

      const aiReply = String(parsed.reply || "").trim();

      if (!aiReply) {
        parsed.reply = nextQualificationQuestion;
      } else if (!/[?？]/.test(aiReply)) {
        parsed.reply =
          `${aiReply}\n\n${nextQualificationQuestion}`;
      } else {
        parsed.reply = aiReply;
      }

      parsed.lastQuestion = nextQualificationQuestion;
      parsed.nextAction =
        `Continuar a conversa naturalmente e coletar a resposta para: ${nextQualificationQuestion}`;
    }

    parsed.status = sanitizeStatus(
      parsed.status,
      parsed.shouldHandoff
    );

    return parsed;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Erro ao avaliar lead com IA.", 500);
  }
};

export default EvaluateAiSdrLeadService;
