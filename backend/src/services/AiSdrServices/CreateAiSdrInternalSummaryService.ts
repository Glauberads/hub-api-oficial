import CreateMessageService from "../MessageServices/CreateMessageService";
import Ticket from "../../models/Ticket";
import AiSdrConfig from "../../models/AiSdrConfig";
import AiSdrSession from "../../models/AiSdrSession";
import { AiSdrEvaluation } from "./EvaluateAiSdrLeadService";

interface Request {
  ticket: Ticket;
  session: AiSdrSession;
  config: AiSdrConfig;
  evaluation: AiSdrEvaluation;
}

const formatValue = (value?: string | number | null): string => {
  const normalized = String(value || "").trim();
  return normalized || "Não informado";
};

const CreateAiSdrInternalSummaryService = async ({
  ticket,
  session,
  config,
  evaluation
}: Request): Promise<void> => {
  const shouldCreate =
    evaluation.shouldHandoff ||
    ["waiting_human", "qualified", "unqualified", "finished"].includes(
      evaluation.status
    );

  if (!shouldCreate) {
    return;
  }

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

  const sessionLeadData =
    session.leadData && typeof session.leadData === "object"
      ? session.leadData
      : {};

  const qualificationAnswers = {
    ...(sessionLeadData.qualificationAnswers || {}),
    ...(evaluation.qualificationAnswers || {})
  };

  const qualificationLines: string[] = [];

  qualificationQuestions.forEach(question => {
    qualificationLines.push(question);
    qualificationLines.push(
      formatValue(qualificationAnswers[question])
    );
    qualificationLines.push("");
  });

  const bodyParts = [
    "🤖 Resumo do Agente IA Comercial",
    "",
    `Temperatura: ${formatValue(evaluation.leadTemperature)}`,
    `Score: ${Number(evaluation.leadScore || 0)}/100`,
    ""
  ];

  if (qualificationLines.length) {
    bodyParts.push("📋 Dados de qualificação");
    bodyParts.push("");
    bodyParts.push(...qualificationLines);
  }

  bodyParts.push(
    `Resumo: ${formatValue(evaluation.summary)}`,
    `Próxima ação: ${formatValue(evaluation.nextAction)}`,
    "",
    evaluation.tags?.length
      ? `Tags sugeridas: ${evaluation.tags.join(", ")}`
      : "Tags sugeridas: Nenhuma"
  );

  const body = bodyParts.join("\n").trim();

  await CreateMessageService({
    companyId: ticket.companyId,
    messageData: {
      wid: `ai-sdr-summary-${session.id}-${Number(session.interactions || 0) + 1}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      mediaType: "chat",
      ack: 2,
      queueId: ticket.queueId,
      companyId: ticket.companyId,
      remoteJid: `ai-sdr:${ticket.id}`,
      participant: null,
      dataJson: JSON.stringify({
        source: "ai-sdr",
        sessionId: session.id,
        status: evaluation.status,
        leadScore: evaluation.leadScore,
        leadTemperature: evaluation.leadTemperature,
        qualificationAnswers
      }),
      isPrivate: true
    }
  });
};

export default CreateAiSdrInternalSummaryService;
