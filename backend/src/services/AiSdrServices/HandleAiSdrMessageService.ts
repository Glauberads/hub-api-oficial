import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import AiSdrConfig from "../../models/AiSdrConfig";
import AiSdrSession from "../../models/AiSdrSession";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendTelegramMessageService from "../TelegramServices/SendTelegramMessageService";
import TranscribeAudioMessageToText from "../MessageServices/TranscribeAudioMessageService";
import CreateAiSdrInternalSummaryService from "./CreateAiSdrInternalSummaryService";
import ApplyAiSdrTagsService from "./ApplyAiSdrTagsService";
import EvaluateAiSdrLeadService, {
  AiSdrEvaluation
} from "./EvaluateAiSdrLeadService";

interface Request {
  ticketId: number;
  companyId: number;
  currentMessage?: string;
  messageWid?: string;
  isAudioInput?: boolean;
  sendResponse?: boolean;
}

interface Response {
  processed: boolean;
  sent: boolean;
  reason?: string;
  ticketId: number;
  session?: AiSdrSession;
  evaluation?: AiSdrEvaluation;
  sendError?: string;
}

const findConfigForTicket = async (ticket: Ticket): Promise<AiSdrConfig | null> => {
  const configs = await AiSdrConfig.findAll({
    where: {
      companyId: ticket.companyId,
      enabled: true,
      isActive: true,
      [Op.or]: [
        { whatsappId: null },
        { whatsappId: ticket.whatsappId || null }
      ]
    },
    order: [["id", "ASC"]]
  });

  if (!configs.length) {
    return null;
  }

  // Importante:
  // queueId é fila de transferência/destino.
  // Não deve filtrar a entrada do agente, porque ticket novo geralmente nasce sem fila.
  return configs.sort((a, b) => {
    const aScore = a.whatsappId && a.whatsappId === ticket.whatsappId ? 10 : 0;
    const bScore = b.whatsappId && b.whatsappId === ticket.whatsappId ? 10 : 0;

    return bScore - aScore;
  })[0];
};

const findOrCreateSession = async ({
  ticket,
  config
}: {
  ticket: Ticket;
  config: AiSdrConfig;
}): Promise<AiSdrSession> => {
  const session = await AiSdrSession.findOne({
    where: {
      companyId: ticket.companyId,
      ticketId: ticket.id,
      configId: config.id,
      status: {
        [Op.in]: ["active", "waiting_human"]
      }
    },
    order: [["id", "DESC"]]
  });

  if (session) return session;

  return AiSdrSession.create({
    companyId: ticket.companyId,
    configId: config.id,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    whatsappId: ticket.whatsappId,
    status: "active",
    currentStep: 0,
    interactions: 0,
    leadScore: 0,
    leadData: {}
  });
};

const sendAiSdrReply = async ({
  ticket,
  body
}: {
  ticket: Ticket;
  body: string;
}): Promise<{ sent: boolean; error?: string; reason?: string }> => {
  const channel = String(
    (ticket as any).channel ||
      (ticket as any).whatsapp?.channel ||
      "whatsapp"
  ).toLowerCase();

  try {
    if (channel === "telegram") {
      await SendTelegramMessageService({
        ticket,
        body
      });

      return { sent: true };
    }

    if (channel === "whatsapp" || channel === "baileys") {
      await SendWhatsAppMessage({
        ticket,
        body
      });

      return { sent: true };
    }

    return {
      sent: false,
      reason: `Canal ${channel} ainda não habilitado para envio automático pelo Agente IA Comercial.`
    };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro ao enviar resposta."
    };
  }
};

const DEFAULT_HANDOFF_MESSAGE = `Perfeito! 😊 Já coletei as informações necessárias.

Vou encaminhar seu atendimento agora para nossa equipe comercial, que continuará a conversa com você por aqui.

Só um momento, por favor.`;

const getHandoffConfig = (
  config: AiSdrConfig
): { enabled: boolean; message: string } => {
  const handoffRules = (config.handoffRules || {}) as any;

  return {
    enabled: handoffRules.notifyCustomer !== false,
    message: String(
      handoffRules.handoffMessage || DEFAULT_HANDOFF_MESSAGE
    ).trim()
  };
};

const HandleAiSdrMessageService = async ({
  ticketId,
  companyId,
  currentMessage,
  messageWid,
  isAudioInput = false,
  sendResponse = false
}: Request): Promise<Response> => {
  const ticket = await Ticket.findOne({
    where: {
      id: ticketId,
      companyId
    },
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" },
      { model: Queue, as: "queue" }
    ]
  });

  if (!ticket) {
    throw new AppError("Ticket não encontrado.", 404);
  }

  if (ticket.isGroup) {
    return {
      processed: false,
      sent: false,
      reason: "Atendimento de grupo ignorado.",
      ticketId: ticket.id
    };
  }

  const config = await findConfigForTicket(ticket);

  if (!config) {
    return {
      processed: false,
      sent: false,
      reason: "Nenhuma configuração ativa do Agente IA Comercial encontrada para este ticket.",
      ticketId: ticket.id
    };
  }

  if (config.onlyPendingTickets && ticket.status !== "pending") {
    return {
      processed: false,
      sent: false,
      reason: "Configuração permite somente tickets pendentes.",
      ticketId: ticket.id
    };
  }

  let resolvedCurrentMessage = String(
    currentMessage || ""
  ).trim();

  if (isAudioInput) {
    if (!messageWid) {
      return {
        processed: false,
        sent: false,
        reason: "Mensagem de áudio sem identificador para transcrição.",
        ticketId: ticket.id
      };
    }

    const transcriptionResult =
      await TranscribeAudioMessageToText(
        messageWid,
        String(companyId)
      );

    const transcription = String(
      transcriptionResult || ""
    ).trim();

    const transcriptionFailed =
      !transcription ||
      transcription.toLowerCase() ===
        "conversão pra texto falhou";

    if (transcriptionFailed) {
      return {
        processed: false,
        sent: false,
        reason: "Não foi possível transcrever o áudio recebido.",
        ticketId: ticket.id
      };
    }

    resolvedCurrentMessage = transcription;
  }

  if (!resolvedCurrentMessage) {
    return {
      processed: false,
      sent: false,
      reason: "Mensagem sem conteúdo para o Agente IA Comercial.",
      ticketId: ticket.id
    };
  }

  const session = await findOrCreateSession({ ticket, config });

  if (session.status !== "active") {
    return {
      processed: false,
      sent: false,
      reason: `Sessão não está ativa. Status atual: ${session.status}`,
      ticketId: ticket.id,
      session
    };
  }

  if (session.interactions >= config.maxInteractions) {
    await session.update({
      status: "waiting_human",
      finishedAt: new Date(),
      nextAction: "Limite de interações do Agente IA Comercial atingido. Transferir para atendimento humano."
    });

    return {
      processed: false,
      sent: false,
      reason: "Limite de interações atingido.",
      ticketId: ticket.id,
      session
    };
  }

  const evaluation = await EvaluateAiSdrLeadService({
    ticket,
    config,
    session,
    companyId,
    currentMessage: resolvedCurrentMessage
  });

  const leadData = {
    ...(session.leadData || {}),
    ...(evaluation.extractedData || {}),
    qualificationAnswers:
      evaluation.qualificationAnswers ||
      (session.leadData || {}).qualificationAnswers ||
      {},
    tags: evaluation.tags || []
  };

  await session.update({
    status: evaluation.status,
    currentStep: Number(session.currentStep || 0) + 1,
    interactions: Number(session.interactions || 0) + 1,
    leadName: evaluation.leadName || session.leadName,
    leadInterest: evaluation.leadInterest || session.leadInterest,
    leadCity: evaluation.leadCity || session.leadCity,
    leadBudget: evaluation.leadBudget || session.leadBudget,
    leadTemperature: evaluation.leadTemperature,
    leadScore: evaluation.leadScore,
    leadData,
    summary: evaluation.summary,
    nextAction: evaluation.nextAction,
    lastQuestion: evaluation.lastQuestion,
    lastAiResponse: evaluation.reply,
    finishedAt:
      evaluation.status === "qualified" ||
      evaluation.status === "unqualified" ||
      evaluation.status === "finished" ||
      evaluation.status === "waiting_human"
        ? new Date()
        : null
  });

  let sent = false;
  let sendError: string | undefined;
  let reason: string | undefined;

  const shouldTransfer =
    evaluation.shouldHandoff && config.autoTransferQueue;

  if (shouldTransfer) {
    const {
      enabled: notifyCustomer,
      message: handoffMessage
    } = getHandoffConfig(config);

    const currentLeadData = (session.leadData || {}) as any;
    const alreadyNotified = Boolean(
      currentLeadData.handoffNotifiedAt
    );

    if (
      sendResponse &&
      notifyCustomer &&
      handoffMessage &&
      !alreadyNotified
    ) {
      const sendResult = await sendAiSdrReply({
        ticket,
        body: handoffMessage
      });

      sent = sendResult.sent;
      sendError = sendResult.error;
      reason = sendResult.reason;

      if (sendResult.sent) {
        await session.update({
          leadData: {
            ...(session.leadData || {}),
            handoffNotifiedAt: new Date().toISOString()
          },
          lastAiResponse: handoffMessage
        });
      }
    }

    const transferData: any = {
      isBot: false,
      useIntegration: false
    };

    if (config.queueId) {
      transferData.queueId = config.queueId;
    }

    if (config.userId) {
      transferData.userId = config.userId;
      transferData.status = "open";
    } else if (config.queueId) {
      transferData.status = "pending";
    }

    await ticket.update(transferData);
  }

  await CreateAiSdrInternalSummaryService({
    ticket,
    session,
    config,
    evaluation
  });

  await ApplyAiSdrTagsService({
    ticket,
    config,
    evaluation
  });

  if (!shouldTransfer && sendResponse && evaluation.reply) {
    const sendResult = await sendAiSdrReply({
      ticket,
      body: evaluation.reply
    });

    sent = sendResult.sent;
    sendError = sendResult.error;
    reason = sendResult.reason;
  }

  const refreshedSession = await AiSdrSession.findByPk(session.id);

  return {
    processed: true,
    sent,
    reason,
    sendError,
    ticketId: ticket.id,
    session: refreshedSession || session,
    evaluation
  };
};

export default HandleAiSdrMessageService;
