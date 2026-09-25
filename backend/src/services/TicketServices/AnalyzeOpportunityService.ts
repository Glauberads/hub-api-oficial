import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Contact from "../../models/Contact";

interface Request {
  ticketId: number;
  companyId: number;
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

const normalizeText = (text: string): string => {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const clampScore = (score: number): number => {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
};

const analyzeByRules = (transcript: string, contactName = "cliente"): OpportunityAnalysis => {
  const text = normalizeText(transcript);

  let score = 20;
  let status = "cold";
  let intent = "unknown";
  const tags: string[] = [];

  const hotWords = [
    "valor",
    "preco",
    "quanto custa",
    "comprar",
    "fechar",
    "contratar",
    "pix",
    "pagamento",
    "instalacao",
    "quero",
    "me passa",
    "tenho interesse"
  ];

  const objectionWords = [
    "caro",
    "desconto",
    "duvida",
    "garantia",
    "funciona",
    "medo",
    "problema",
    "nao gostei",
    "nao entendi"
  ];

  const urgentWords = [
    "urgente",
    "agora",
    "hoje",
    "preciso",
    "rapido",
    "imediato"
  ];

  const supportWords = [
    "erro",
    "bug",
    "nao aparece",
    "nao envia",
    "travou",
    "suporte",
    "ajuda"
  ];

  const cancellationWords = [
    "cancelar",
    "desistir",
    "reembolso",
    "devolver"
  ];

  const hasAny = (words: string[]) => words.some(word => text.includes(word));

  if (hasAny(hotWords)) {
    score += 45;
    intent = "purchase_intent";
    tags.push("lead quente");
  }

  if (text.includes("preco") || text.includes("valor") || text.includes("quanto custa")) {
    intent = "price_request";
    tags.push("pedido de preço");
    score += 15;
  }

  if (hasAny(objectionWords)) {
    intent = intent === "unknown" ? "objection" : intent;
    tags.push("objeção");
    score += 10;
  }

  if (hasAny(urgentWords)) {
    status = "urgent";
    tags.push("urgente");
    score += 15;
  }

  if (hasAny(supportWords)) {
    intent = "support";
    status = "support";
    tags.push("suporte");
    score = Math.max(score, 45);
  }

  if (hasAny(cancellationWords)) {
    intent = "cancellation";
    status = "risk";
    tags.push("risco de perda");
    score = Math.max(score, 70);
  }

  score = clampScore(score);

  if (status !== "urgent" && status !== "support" && status !== "risk") {
    if (score >= 75) status = "hot";
    else if (score >= 45) status = "warm";
    else status = "cold";
  }

  const displayName = contactName || "cliente";

  let nextAction = "Continuar a conversa e identificar melhor a necessidade do cliente.";
  let suggestedReply = `Olá ${displayName}, me fala um pouco melhor o que você precisa para eu te orientar da forma certa.`;

  if (intent === "price_request" || intent === "purchase_intent") {
    nextAction = "Responder rápido com proposta clara, benefício principal e chamada para fechamento.";
    suggestedReply = `Perfeito, ${displayName}! Pelo que você me falou, acredito que temos uma solução ideal para você. Posso te passar os detalhes, valor e como funciona a instalação agora.`;
  }

  if (intent === "objection") {
    nextAction = "Quebrar a objeção com segurança, prova de valor e garantia.";
    suggestedReply = `Entendi sua dúvida, ${displayName}. É normal querer ter segurança antes de fechar. Vou te explicar de forma simples como funciona e por que essa solução pode valer a pena para você.`;
  }

  if (intent === "support") {
    nextAction = "Tratar como atendimento/suporte antes de tentar vender.";
    suggestedReply = `Entendi, ${displayName}. Vou te ajudar com isso agora. Me confirma só mais um detalhe para eu identificar exatamente onde está o problema.`;
  }

  if (intent === "cancellation") {
    nextAction = "Priorizar retenção, entender motivo e oferecer solução antes de perder o cliente.";
    suggestedReply = `Entendi, ${displayName}. Antes de qualquer decisão, me conta o que aconteceu para eu tentar resolver da melhor forma possível para você.`;
  }

  return {
    score,
    status,
    intent,
    summary: transcript.length > 700
      ? `${transcript.slice(0, 700)}...`
      : transcript || "Sem mensagens suficientes para análise.",
    nextAction,
    suggestedReply,
    risk: status === "risk"
      ? "Cliente demonstrou possível desistência ou insatisfação. Priorize atendimento humano."
      : status === "cold"
        ? "Ainda não há sinais fortes de compra. Precisa qualificar melhor."
        : "Sem risco crítico identificado.",
    tags: Array.from(new Set(tags.length ? tags : ["radar"]))
  };
};

const AnalyzeOpportunityService = async ({
  ticketId,
  companyId
}: Request): Promise<{ analysis: OpportunityAnalysis }> => {
  const ticket = await Ticket.findOne({
    where: {
      id: ticketId,
      companyId
    },
    include: [
      {
        model: Contact,
        as: "contact"
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const messages = await Message.findAll({
    where: {
      ticketId
    },
    order: [["createdAt", "DESC"]],
    limit: 30
  });

  const transcript = messages
    .reverse()
    .filter(message => String(message.body || "").trim() !== "")
    .map(message => {
      const author = message.fromMe ? "Atendente" : "Cliente";
      return `${author}: ${String(message.body || "").replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");

  const contactName = (ticket as any)?.contact?.name || "cliente";

  return {
    analysis: analyzeByRules(transcript, contactName)
  };
};

export default AnalyzeOpportunityService;
