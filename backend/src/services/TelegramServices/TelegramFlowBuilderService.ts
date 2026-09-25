import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import logger from "../../utils/logger";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import ProcessTelegramAiFlowService from "./TelegramAiFlowService";

type Request = {
  whatsapp: Whatsapp;
  ticket: Ticket;
  contact: Contact;
  body: string;
};

const buildContactPayload = (contact: Contact) => ({
  number: contact.number,
  name: contact.name,
  email: contact.email || ""
});

const getFlowData = async ({
  flowId,
  companyId
}: {
  flowId: number;
  companyId: number;
}) => {
  if (!flowId) return null;

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: flowId,
      company_id: companyId,
      active: true
    }
  });

  if (!flow) return null;

  const nodes: INodes[] = (flow.flow as any)["nodes"] || [];
  const connections: IConnections[] = (flow.flow as any)["connections"] || [];

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  return {
    flow,
    nodes,
    connections
  };
};

const ProcessTelegramFlowBuilderService = async ({
  whatsapp,
  ticket,
  contact,
  body
}: Request): Promise<boolean> => {
  try {
    if (!whatsapp || whatsapp.channel !== "telegram") {
      return false;
    }

    if (!ticket || !contact) {
      return false;
    }

    // Se o atendimento já foi aceito por um usuário, não dispara automação automática.
    if (ticket.status === "open" && ticket.userId) {
      logger.info(
        `[TELEGRAM FLOW] Ticket ${ticket.id} já está aberto com usuário ${ticket.userId}. Não executando fluxo automático.`
      );
      return false;
    }

    const dataWebhook: any = ticket.dataWebhook || {};
    const isAiMode =
      ticket.useIntegration &&
      ["openai", "gemini"].includes(String(dataWebhook?.type || "")) &&
      ticket.status !== "open" &&
      ticket.isBot !== false;

    if (isAiMode) {
      logger.info(
        `[TELEGRAM FLOW] Ticket ${ticket.id} em modo IA ${dataWebhook?.type}. Encaminhando para TelegramAiFlowService.`
      );

      return ProcessTelegramAiFlowService({
        whatsapp,
        ticket,
        contact,
        body
      });
    }

    const mountDataContact = buildContactPayload(contact);

    // 1) Continuação de fluxo parado aguardando resposta
    if (ticket.flowStopped && ticket.lastFlowId) {
      const flowId = Number(ticket.flowStopped);

      const flowData = await getFlowData({
        flowId,
        companyId: ticket.companyId
      });

      if (!flowData) {
        logger.warn(
          `[TELEGRAM FLOW] Fluxo ${flowId} não encontrado/inativo para continuação do ticket ${ticket.id}`
        );

        await ticket.update({
          flowWebhook: false,
          flowStopped: null,
          lastFlowId: null,
          hashFlowId: null,
          dataWebhook: null,
          useIntegration: null,
          isBot: false
        });

        return false;
      }

      logger.info(
        `[TELEGRAM FLOW] Continuando fluxo ${flowId} no ticket ${ticket.id}, lastFlowId=${ticket.lastFlowId}, resposta="${body}"`
      );

      await ActionsWebhookService(
        whatsapp.id,
        flowId,
        ticket.companyId,
        flowData.nodes,
        flowData.connections,
        ticket.lastFlowId,
        null,
        "",
        ticket.hashFlowId || "",
        body,
        ticket.id,
        mountDataContact,
        true
      );

      return true;
    }

    // 2) Fluxo inicial: roda somente na primeira mensagem recebida dentro do ticket
    const incomingCount = await Message.count({
      where: {
        ticketId: ticket.id,
        fromMe: false
      }
    });

    if (incomingCount !== 1) {
      logger.info(
        `[TELEGRAM FLOW] Ticket ${ticket.id} não é primeira mensagem recebida (${incomingCount}). Não iniciando flowIdWelcome.`
      );
      return false;
    }

    const initialFlowId = Number(whatsapp.flowIdWelcome || whatsapp.flowIdNotPhrase || 0);

    if (!initialFlowId) {
      logger.info(
        `[TELEGRAM FLOW] Conexão Telegram ${whatsapp.id} sem flowIdWelcome/flowIdNotPhrase configurado.`
      );
      return false;
    }

    const flowData = await getFlowData({
      flowId: initialFlowId,
      companyId: ticket.companyId
    });

    if (!flowData) {
      logger.warn(
        `[TELEGRAM FLOW] Flow inicial ${initialFlowId} não encontrado/inativo para conexão ${whatsapp.id}`
      );
      return false;
    }

    const firstNodeId = flowData.nodes[0].id;

    logger.info(
      `[TELEGRAM FLOW] Iniciando flow inicial ${initialFlowId} no ticket ${ticket.id}, node=${firstNodeId}`
    );

    await ActionsWebhookService(
      whatsapp.id,
      initialFlowId,
      ticket.companyId,
      flowData.nodes,
      flowData.connections,
      firstNodeId,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );

    return true;
  } catch (error) {
    logger.error("[TELEGRAM FLOW] Erro ao processar FlowBuilder Telegram:", error);
    return false;
  }
};

export default ProcessTelegramFlowBuilderService;
