import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateTicketService from "../TicketServices/CreateTicketService";
import logger from "../../utils/logger";

/**
 * Aplica as ações configuradas na integração (transferência, fechar, abrir ticket)
 * baseado nos campos da QueueIntegrations.
 */

interface IntegrationActionParams {
  typebot: QueueIntegrations;
  ticket: Ticket;
  action: "transfer" | "close" | "open";
}

/**
 * Executa transferência de ticket usando os campos da integração
 */
export const handleIntegrationTransfer = async (
  typebot: QueueIntegrations,
  ticket: Ticket
): Promise<boolean> => {
  if (!typebot.enableTransfer) return false;

  const ticketData: any = {
    isBot: false,
    useIntegration: false,
    integrationId: null,
  };

  // ✅ CORRIGIDO: Determinar status baseado na presença de fila e/ou usuário
  const hasQueue = !!typebot.transferQueueId;
  const hasUser = !!typebot.transferUserId;

  if (hasQueue) {
    ticketData.queueId = typebot.transferQueueId;
  } else {
    // Sem fila configurada - limpar queueId para não herdar fila anterior
    ticketData.queueId = null;
    logger.info(
      `[INTEGRATION] Ticket ${ticket.id} - transferência sem fila configurada`
    );
  }

  if (hasUser) {
    ticketData.userId = typebot.transferUserId;
  }

  // ✅ CORRIGIDO: Definir status correto baseado na configuração
  // Com usuário → open; Sem usuário → pending
  if (hasUser) {
    ticketData.status = "open";
  } else {
    ticketData.status = "pending";
  }

  if (typebot.whatsappId) {
    ticketData.whatsappId = typebot.whatsappId;
  }

  await UpdateTicketService({
    ticketData,
    ticketId: ticket.id,
    companyId: ticket.companyId,
  });

  logger.info(
    `[INTEGRATION] Ticket ${ticket.id} transferido - queue: ${typebot.transferQueueId || 'nenhuma'}, user: ${typebot.transferUserId || 'nenhum'}, status: ${ticketData.status}`
  );

  return true;
};

/**
 * Fecha o ticket usando os campos da integração
 */
export const handleIntegrationCloseTicket = async (
  typebot: QueueIntegrations,
  ticket: Ticket
): Promise<boolean> => {
  if (!typebot.enableCloseTicket) return false;

  const ticketData: any = {
    status: "closed",
    useIntegration: false,
    integrationId: null,
  };

  if (typebot.closeTicketMessage) {
    ticketData.sendFarewellMessage = true;
    ticketData.farewellMessage = typebot.closeTicketMessage;
  }

  await UpdateTicketService({
    ticketData,
    ticketId: ticket.id,
    companyId: ticket.companyId,
  });

  logger.info(`[INTEGRATION] Ticket ${ticket.id} fechado via integração`);

  return true;
};

/**
 * Abre um novo ticket usando os campos da integração
 */
export const handleIntegrationOpenTicket = async (
  typebot: QueueIntegrations,
  ticket: Ticket
): Promise<Ticket | null> => {
  if (!typebot.enableOpenTicket) return null;

  try {
    const ticketData: any = {
      contactId: ticket.contactId,
      companyId: ticket.companyId,
      isBot: false,
      useIntegration: false,
    };

    // ✅ CORRIGIDO: Tratar abertura de ticket sem fila
    if (typebot.openTicketQueueId) {
      ticketData.queueId = typebot.openTicketQueueId;
    } else {
      ticketData.queueId = null;
    }

    if (typebot.openTicketUserId) {
      ticketData.userId = typebot.openTicketUserId;
      ticketData.status = "open";
    } else {
      ticketData.status = "pending";
    }

    if (typebot.whatsappId) {
      ticketData.whatsappId = typebot.whatsappId;
    } else {
      ticketData.whatsappId = ticket.whatsappId;
    }

    // Fecha o ticket atual primeiro
    await UpdateTicketService({
      ticketData: {
        status: "closed",
        useIntegration: false,
        integrationId: null,
      },
      ticketId: ticket.id,
      companyId: ticket.companyId,
    });

    // Cria novo ticket
    const newTicket = await CreateTicketService(ticketData);

    logger.info(
      `[INTEGRATION] Novo ticket ${newTicket.id} aberto a partir do ticket ${ticket.id} - queue: ${typebot.openTicketQueueId}, user: ${typebot.openTicketUserId}`
    );

    return newTicket;
  } catch (error) {
    logger.error(`[INTEGRATION] Erro ao abrir novo ticket: ${error}`);
    return null;
  }
};

/**
 * Processa gatilhos especiais vindos do typebot/n8n no formato:
 * #{"transfer": true} ou #{"closeTicket": true} ou #{"openTicket": true}
 * Usa os campos configurados na integração.
 */
export const handleIntegrationGatilho = async (
  gatilhoText: string,
  typebot: QueueIntegrations,
  ticket: Ticket
): Promise<boolean> => {
  try {
    const jsonGatilho = JSON.parse(gatilhoText);

    // Gatilho de transferência usando campos da integração
    if (jsonGatilho.transfer === true || jsonGatilho.transferir === true) {
      return await handleIntegrationTransfer(typebot, ticket);
    }

    // Gatilho de fechar ticket usando campos da integração
    if (jsonGatilho.closeTicket === true || jsonGatilho.fecharTicket === true) {
      return await handleIntegrationCloseTicket(typebot, ticket);
    }

    // Gatilho de abrir novo ticket usando campos da integração
    if (jsonGatilho.openTicket === true || jsonGatilho.abrirTicket === true) {
      const newTicket = await handleIntegrationOpenTicket(typebot, ticket);
      return newTicket !== null;
    }

    // Gatilho de atribuir a fila/usuário
    if (jsonGatilho.assignQueue === true || jsonGatilho.atribuirFila === true) {
      const ticketData: any = {
        isBot: false,
        useIntegration: false,
        integrationId: null,
      };

      if (typebot.queueIdAssign) {
        ticketData.queueId = typebot.queueIdAssign;
      } else {
        // ✅ CORRIGIDO: Sem fila configurada, manter null
        ticketData.queueId = null;
      }

      if (typebot.userIdAssign) {
        ticketData.userId = typebot.userIdAssign;
      }

      // ✅ CORRIGIDO: Definir status baseado na presença de usuário
      ticketData.status = typebot.userIdAssign ? "open" : "pending";

      await UpdateTicketService({
        ticketData,
        ticketId: ticket.id,
        companyId: ticket.companyId,
      });

      logger.info(
        `[INTEGRATION] Ticket ${ticket.id} atribuído - queue: ${typebot.queueIdAssign || 'nenhuma'}, user: ${typebot.userIdAssign || 'nenhum'}, status: ${ticketData.status}`
      );

      return true;
    }

    return false;
  } catch (err) {
    // Se não é JSON válido, não é um gatilho especial
    return false;
  }
};
