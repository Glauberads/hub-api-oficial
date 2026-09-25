import { Op } from "sequelize";
import { sub } from "date-fns";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import { isNil } from "lodash";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import CreateLogTicketService from "./CreateLogTicketService";
import AppError from "../../errors/AppError";
import ContactWallet from "../../models/ContactWallet";
import ShowContactService from "../ContactServices/ShowContactService";
import logger from "../../utils/logger";
import { withLock } from "../../utils/redisLock";

const parseTicketDataWebhook = (rawValue: any): any => {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === "string") {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      logger.warn(`[AI PERMANENT] Não foi possível fazer parse do dataWebhook stringificado.`);
      return null;
    }
  }

  if (typeof rawValue === "object") {
    return rawValue;
  }

  return null;
};

const isPermanentAIMode = (ticket: Ticket): boolean => {
  const dataWebhook = parseTicketDataWebhook(ticket.dataWebhook);

  if (!dataWebhook) {
    return false;
  }

  const type = String(dataWebhook?.type || "").toLowerCase().trim();
  const mode = String(dataWebhook?.mode || "").toLowerCase().trim();

  return (type === "openai" || type === "gemini") && mode === "permanent";
};

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsapp: Whatsapp,
  unreadMessages: number,
  companyId: number,
  queueId: number = null,
  userId: number = null,
  groupContact?: Contact,
  channel?: string,
  isImported?: boolean,
  isForward?: boolean,
  settings?: any,
  isTransfered?: boolean,
  isCampaign: boolean = false
): Promise<Ticket> => {
  const lockKey = `ticket:lock:${companyId}:${groupContact ? groupContact.id : contact.id}`;

  return withLock(lockKey, async () => {
    let openAsLGPD = false;

    if (settings.enableLGPD) {
      openAsLGPD = !isCampaign &&
        !isTransfered &&
        settings.enableLGPD === "enabled" &&
        settings.lgpdMessage !== "" &&
        (
          settings.lgpdConsent === "enabled" ||
          (settings.lgpdConsent === "disabled" && isNil(contact?.lgpdAcceptedAt))
        );
    }

    const io = getIO();
    const DirectTicketsToWallets = settings.DirectTicketsToWallets;
    const contactId = groupContact ? groupContact.id : contact.id;

    logger.debug(`[RDS-TICKET] Buscando tickets existentes para contactId=${contactId}, companyId=${companyId}, whatsappId=${whatsapp.id}`);

    let ticket = await Ticket.findOne({
      where: {
        status: {
          [Op.or]: ["open", "pending", "group", "chatbot", "nps", "lgpd"]
        },
        contactId: contactId,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["updatedAt", "DESC"]]
    });

    // ✅ INDEPENDÊNCIA POR CONEXÃO: Cada conexão (whatsappId) mantém seus próprios tickets.
    // Se o contato escrever para dois números diferentes, terá tickets separados em cada um.

    if (ticket) {
      logger.debug(`[RDS-TICKET] Ticket existente encontrado: ID=${ticket.id}, status=${ticket.status}, updatedAt=${ticket.updatedAt}`);
    } else {
      logger.debug(`[RDS-TICKET] Nenhum ticket existente para contactId=${contactId}`);
    }

    if (ticket) {
      logger.debug(`[RDS-TICKET] Atualizando ticket existente ID=${ticket.id}, antigo status=${ticket.status}`);

      if (isCampaign) {
        await ticket.update({
          userId: userId !== ticket.userId ? ticket.userId : userId,
          queueId: queueId !== ticket.queueId ? ticket.queueId : queueId,
        });
      } else {
        const newUnreadCount = ticket.unreadMessages + unreadMessages;
        const aiPermanentMode = isPermanentAIMode(ticket);

        const updateData: any = {
          unreadMessages: newUnreadCount,
          isBot: aiPermanentMode
        };

        if (aiPermanentMode) {
          // ✅ Mantém IA permanente sem mover o ticket para status "chatbot",
          // evitando que ele suma da listagem principal após reload/navegação.
          if (!ticket.isGroup) {
            updateData.status = ticket.status === "open" ? "open" : "pending";
          }

          logger.info(
            `[AI PERMANENT] Preservando modo IA permanente para ticket ${ticket.id} sem mover para status chatbot`
          );
        } else {
          if (!["open", "pending", "chatbot", "nps"].includes(ticket.status)) {
            const isGroupTicket = ticket.status === "group" ||
              (ticket.isGroup === true) ||
              (groupContact !== undefined && groupContact !== null);

            if (isGroupTicket) {
              logger.debug(`[RDS-TICKET] Ticket ${ticket.id} identificado como grupo, verificando configuração groupAsTicket`);

              try {
                const ticketWhatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
                  attributes: ["id", "name", "groupAsTicket"]
                });

                if (ticketWhatsapp && ticketWhatsapp.groupAsTicket === "enabled") {
                  logger.debug(`[RDS-TICKET] Whatsapp ${ticketWhatsapp.id} tem groupAsTicket=enabled, reativando ticket ${ticket.id} para 'pending'`);
                  updateData.status = "pending";
                } else {
                  logger.debug(`[RDS-TICKET] Mantendo ticket ${ticket.id} como 'group' pois groupAsTicket não está habilitado`);

                  if (ticket.status !== "group") {
                    updateData.status = "group";
                  }
                }
              } catch (error) {
                logger.error(`[RDS-TICKET] Erro ao verificar configuração groupAsTicket: ${error.message}`);
                logger.debug(`[RDS-TICKET] Mantendo ticket ${ticket.id} como 'group' devido a erro na verificação`);
              }
            } else {
              logger.debug(`[RDS-TICKET] Reativando ticket ${ticket.id} de status '${ticket.status}' para 'pending'`);
              updateData.status = "pending";
            }
          }
        }

        await ticket.update(updateData);
      }

      ticket = await ShowTicketService(ticket.id, companyId);
      logger.debug(`[RDS-TICKET] Ticket atualizado ID=${ticket.id}, novo status=${ticket.status}`);

      if (!isCampaign && !isForward) {
        const hasValidUserId =
          !isNil(userId) &&
          Number(userId) > 0;

        const hasValidQueueId =
          !isNil(queueId) &&
          Number(queueId) > 0;

        if (
          (
            hasValidUserId &&
            Number(ticket?.userId) !== Number(userId) &&
            !ticket.isGroup
          ) ||
          (
            hasValidQueueId &&
            Number(ticket?.queueId) !== Number(queueId)
          )
        ) {
          throw new AppError(
            `Ticket em outro atendimento. ${"Atendente: " + ticket?.user?.name} - ${"Fila: " + ticket?.queue?.name}`
          );
        }
      }

      return ticket;
    }

    const timeCreateNewTicket = whatsapp.timeCreateNewTicket;

    if (!ticket && timeCreateNewTicket !== 0) {
      logger.debug(`[RDS-TICKET] Verificando tickets recentes nos últimos ${timeCreateNewTicket} minutos`);

      if (Number(timeCreateNewTicket) !== 0) {
        ticket = await Ticket.findOne({
          where: {
            updatedAt: {
              [Op.between]: [
                +sub(new Date(), {
                  minutes: Number(timeCreateNewTicket)
                }),
                +new Date()
              ]
            },
            contactId: contactId,
            companyId,
            whatsappId: whatsapp.id
          },
          order: [["updatedAt", "DESC"]]
        });

        // ✅ INDEPENDÊNCIA POR CONEXÃO: Não buscar tickets em outras conexões.
        // Cada whatsappId tem seu próprio ciclo de vida de tickets.

        if (ticket) {
          logger.debug(`[RDS-TICKET] Ticket recente encontrado: ID=${ticket.id}, status=${ticket.status}, updatedAt=${ticket.updatedAt}`);
        }
      }

      if (ticket && ticket.status !== "nps") {
        logger.debug(`[RDS-TICKET] Reativando ticket recente ID=${ticket.id} como 'pending'`);
        await ticket.update({
          status: "pending",
          unreadMessages,
          companyId,
        });
      }
    }

    if (!ticket) {
      logger.debug(`[RDS-TICKET] Criando novo ticket para contactId=${contactId}, companyId=${companyId}`);

      const ticketData: any = {
        contactId: contactId,
        status: (!isImported && !isNil(settings.enableLGPD) && openAsLGPD && !groupContact)
          ? "lgpd"
          : (whatsapp.groupAsTicket === "enabled" || !groupContact)
            ? "pending"
            : "group",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId: whatsapp.id,
        companyId,
        isBot: groupContact ? false : true,
        channel,
        imported: isImported ? new Date() : null,
        isActiveDemand: false
      };

      const contactWallet = await ShowContactService(contact.id, companyId);

      if (
        DirectTicketsToWallets &&
        ((contact.id && !groupContact) || (groupContact && groupContact)) &&
        contactWallet.contactWallets.length > 0
      ) {
        const wallets = await ContactWallet.findOne({
          where: {
            contactId: groupContact ? groupContact.id : contact.id,
            companyId: companyId
          }
        });

        try {
          if (wallets?.walletId && wallets?.queueId) {
            const userIdWallet = contactWallet.wallets[0].id;

            if (wallets && wallets?.id) {
              ticketData.status = (!isImported && !isNil(settings.enableLGPD) && openAsLGPD && !groupContact)
                ? "lgpd"
                : (whatsapp.groupAsTicket === "enabled" || !groupContact)
                  ? "pending"
                  : "group";

              ticketData.userId = userIdWallet;
              ticketData.queueId = wallets.queueId;
              ticketData.isBot = false;
              ticketData.startBot = false;
              ticketData.useIntegration = false;
              ticketData.integrationId = null;
              ticketData.isGroup = groupContact ? true : false;
            }
          }
        } catch (error) {
          logger.error("[RDS-TICKET] error wallet", error);
        }
      }

      ticket = await Ticket.create(ticketData);
    }

    if (queueId != 0 && !isNil(queueId)) {
      await ticket.update({ queueId: queueId });
    }

    if (userId != 0 && !isNil(userId)) {
      await ticket.update({ userId: userId });
    }

    ticket = await ShowTicketService(ticket.id, companyId);

    await CreateLogTicketService({
      ticketId: ticket.id,
      type: openAsLGPD ? "lgpd" : "create"
    });

    if (ticket.status === "pending" && ticket.queueId && !isImported) {
      logger.info(`[FindOrCreateTicket] Ticket pending com fila - ticketId=${ticket.id}, queueId=${ticket.queueId}`);
    } else {
      logger.info(`[NotifyUser] Notificação NÃO disparada - status=${ticket.status}, queueId=${ticket.queueId || "null"}, isImported=${isImported}`);
    }

    logger.debug(`[RDS-TICKET] Ticket final: ID=${ticket.id}, status=${ticket.status}, contactId=${ticket.contactId}`);
    return ticket;
  }, { ttlSeconds: 15, maxRetries: 8, retryDelayMs: 300 });
};

export default FindOrCreateTicketService;