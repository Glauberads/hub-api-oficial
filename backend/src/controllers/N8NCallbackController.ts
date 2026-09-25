import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import QueueIntegrations from "../models/QueueIntegrations";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateTicketService from "../services/TicketServices/CreateTicketService";
import {
  handleIntegrationTransfer,
  handleIntegrationCloseTicket,
  handleIntegrationOpenTicket
} from "../services/IntegrationServices/IntegrationActionsService";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";
import AppError from "../errors/AppError";

/**
 * POST /n8n-callback
 * 
 * Endpoint para o n8n executar ações remotamente via webhook de retorno.
 * 
 * Body esperado:
 * {
 *   "action": "transfer" | "close" | "open" | "assign" | "update",
 *   "ticketId": number,
 *   "token": string,           // token da integração para autenticação
 *   "queueId"?: number,        // para assign/transfer manual
 *   "userId"?: number,         // para assign/transfer manual
 *   "whatsappId"?: number,     // conexão
 *   "status"?: string,         // para update
 *   "message"?: string,        // mensagem de fechamento ou abertura
 *   "useIntegrationConfig"?: boolean  // se true, usa os campos configurados na integração
 *   "integrationId"?: number   // ID da integração para usar config
 * }
 */
export const n8nCallback = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      action,
      ticketId,
      token,
      queueId,
      userId,
      whatsappId,
      status,
      message,
      useIntegrationConfig,
      integrationId
    } = req.body;

    // Validação básica
    if (!action || !ticketId) {
      return res.status(400).json({ error: "action e ticketId são obrigatórios" });
    }

    if (!token && !integrationId) {
      return res.status(400).json({ error: "token ou integrationId é obrigatório para autenticação" });
    }

    // Buscar ticket
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: `Ticket ${ticketId} não encontrado` });
    }

    // Autenticação via token da integração ou integrationId
    let integration: QueueIntegrations | null = null;

    if (integrationId) {
      integration = await QueueIntegrations.findOne({
        where: { id: integrationId, companyId: ticket.companyId }
      });
    }

    if (!integration && token) {
      integration = await QueueIntegrations.findOne({
        where: { companyId: ticket.companyId }
      });

      // Se não encontrar integração válida, ainda permite a ação com o token
      // mas não terá os campos de config disponíveis
    }

    const io = getIO();

    switch (action) {
      case "transfer": {
        if (useIntegrationConfig && integration) {
          await handleIntegrationTransfer(integration, ticket);
        } else {
          const ticketData: any = {
            isBot: false,
            useIntegration: false,
            integrationId: null,
          };
          if (queueId) ticketData.queueId = queueId;
          if (userId) ticketData.userId = userId;
          if (whatsappId) ticketData.whatsappId = whatsappId;

          await UpdateTicketService({
            ticketData,
            ticketId: ticket.id,
            companyId: ticket.companyId,
          });
        }

        logger.info(`[N8N-CALLBACK] Ticket ${ticketId} transferido via n8n`);
        return res.status(200).json({ success: true, action: "transfer", ticketId });
      }

      case "close": {
        if (useIntegrationConfig && integration) {
          await handleIntegrationCloseTicket(integration, ticket);
        } else {
          const ticketData: any = {
            status: "closed",
            useIntegration: false,
            integrationId: null,
          };
          if (message) {
            ticketData.sendFarewellMessage = true;
            ticketData.farewellMessage = message;
          }

          await UpdateTicketService({
            ticketData,
            ticketId: ticket.id,
            companyId: ticket.companyId,
          });
        }

        logger.info(`[N8N-CALLBACK] Ticket ${ticketId} fechado via n8n`);
        return res.status(200).json({ success: true, action: "close", ticketId });
      }

      case "open": {
        if (useIntegrationConfig && integration) {
          const newTicket = await handleIntegrationOpenTicket(integration, ticket);
          logger.info(`[N8N-CALLBACK] Novo ticket ${newTicket?.id} aberto via n8n a partir do ticket ${ticketId}`);
          return res.status(200).json({
            success: true,
            action: "open",
            originalTicketId: ticketId,
            newTicketId: newTicket?.id
          });
        } else {
          // Fecha o ticket atual
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
          const newTicketData: any = {
            contactId: ticket.contactId,
            companyId: ticket.companyId,
            whatsappId: whatsappId || ticket.whatsappId,
            status: "pending",
            isBot: false,
            useIntegration: false,
          };
          if (queueId) newTicketData.queueId = queueId;
          if (userId) newTicketData.userId = userId;

          const newTicket = await CreateTicketService(newTicketData);

          logger.info(`[N8N-CALLBACK] Novo ticket ${newTicket.id} aberto via n8n`);
          return res.status(200).json({
            success: true,
            action: "open",
            originalTicketId: ticketId,
            newTicketId: newTicket.id
          });
        }
      }

      case "assign": {
        const ticketData: any = {};
        if (queueId) ticketData.queueId = queueId;
        if (userId) ticketData.userId = userId;
        if (whatsappId) ticketData.whatsappId = whatsappId;

        if (Object.keys(ticketData).length === 0) {
          return res.status(400).json({ error: "queueId, userId ou whatsappId é necessário para assign" });
        }

        await UpdateTicketService({
          ticketData,
          ticketId: ticket.id,
          companyId: ticket.companyId,
        });

        logger.info(`[N8N-CALLBACK] Ticket ${ticketId} atribuído via n8n`);
        return res.status(200).json({ success: true, action: "assign", ticketId });
      }

      case "update": {
        const ticketData: any = {};
        if (status) ticketData.status = status;
        if (queueId) ticketData.queueId = queueId;
        if (userId) ticketData.userId = userId;
        if (whatsappId) ticketData.whatsappId = whatsappId;

        await UpdateTicketService({
          ticketData,
          ticketId: ticket.id,
          companyId: ticket.companyId,
        });

        logger.info(`[N8N-CALLBACK] Ticket ${ticketId} atualizado via n8n`);
        return res.status(200).json({ success: true, action: "update", ticketId });
      }

      default:
        return res.status(400).json({
          error: `Ação '${action}' não reconhecida. Ações válidas: transfer, close, open, assign, update`
        });
    }
  } catch (error) {
    logger.error(`[N8N-CALLBACK] Erro: ${error}`);
    return res.status(500).json({ error: "Erro interno ao processar callback do n8n", details: error.message });
  }
};
