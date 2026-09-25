import moment from "moment";
import * as Sentry from "@sentry/node";
import { Op } from "sequelize";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import { isNil } from "lodash";
import { sendFacebookMessage } from "../FacebookServices/sendFacebookMessage";
import { verifyMessageFace } from "../FacebookServices/facebookMessageListener";
import ShowUserService from "../UserServices/ShowUserService";
import User from "../../models/User";
import CompaniesSettings from "../../models/CompaniesSettings";
import CreateLogTicketService from "./CreateLogTicketService";
import TicketTag from "../../models/TicketTag";
import Tag from "../../models/Tag";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "./FindOrCreateTicketService";
import formatBody from "../../helpers/Mustache";
import { Mutex } from "async-mutex";
import { getJidOf } from "../WbotServices/getJidOf";
import logger from "../../utils/logger";
import ListUserQueueImmediateService from "../UserQueueServices/ListUserQueueImmediateService";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import TicketFinalizationReason from "../../models/TicketFinalizationReason";
import AppError from "../../errors/AppError";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  isBot?: boolean;
  queueOptionId?: number;
  sendFarewellMessage?: boolean;
  amountUsedBotQueues?: number;
  lastMessage?: string;
  integrationId?: number;
  useIntegration?: boolean;
  unreadMessages?: number;
  msgTransfer?: string;
  isTransfered?: boolean;
  valorVenda?: number;
  motivoNaoVenda?: string;
  motivoFinalizacao?: string;
  finalizadoComVenda?: boolean;
  flowWebhook?: boolean;
  flowStopped?: boolean;
  dataWebhook?: any;
  lastFlowId?: string;
  hashFlowId?: string;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const buildTransferMessageSafely = ({
  template,
  queueName,
  userName,
  ticket
}: {
  template?: string | null;
  queueName?: string | null;
  userName?: string | null;
  ticket: Ticket;
}): string => {
  const safeQueueName = String(queueName || "");
  const safeUserName = String(userName || "");

  const normalizedTemplate = String(template || "")
    .replace(/\$\{queue\.name\}/g, safeQueueName)
    .replace(/\$\{queue\}/g, safeQueueName)
    .replace(/\{\{\s*queue\.name\s*\}\}/g, safeQueueName)
    .replace(/\{\{\s*queue\s*\}\}/g, safeQueueName)
    .replace(/\{queue\.name\}/g, safeQueueName)
    .replace(/\{queue\}/g, safeQueueName)
    .replace(/\$\{userName\}/g, safeUserName)
    .replace(/\{\{\s*userName\s*\}\}/g, safeUserName)
    .replace(/\{userName\}/g, safeUserName);

  if (!normalizedTemplate.trim()) {
    return "";
  }

  try {
    return formatBody(`\u200e ${normalizedTemplate}`, ticket);
  } catch (error: any) {
    logger.error(
      `[TICKET TRANSFER] Erro ao processar transferMessage com Mustache. Aplicando fallback. Erro: ${error?.message || error}`
    );

    return `\u200e ${normalizedTemplate}`
      .replace(/\{\{/g, "")
      .replace(/\}\}/g, "")
      .trim();
  }
};

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId
}: Request): Promise<Response> => {
  try {

    let {
      queueId,
      userId,
      sendFarewellMessage = true,
      amountUsedBotQueues,
      lastMessage,
      integrationId,
      useIntegration,
      unreadMessages,
      msgTransfer,
      isTransfered = false,
      status,
      valorVenda,
      motivoNaoVenda,
      motivoFinalizacao,
      finalizadoComVenda
    } = ticketData;
    let isBot: boolean | null = ticketData.isBot || false;
    let queueOptionId: number | null = ticketData.queueOptionId || null;

    const io = getIO();

    const settings = await CompaniesSettings.findOne({
      where: {
        companyId: companyId
      }
    });

    if (status === "closed" && userId) {
      const closingUser = await User.findOne({
        where: { id: userId, companyId },
        attributes: ["id", "finalizacaoComValorVendaAtiva"]
      });

      if (closingUser?.finalizacaoComValorVendaAtiva) {
        const selectedReason = settings?.informarValorVenda
          ? (finalizadoComVenda ? null : motivoNaoVenda)
          : motivoFinalizacao;

        if (settings?.informarValorVenda && finalizadoComVenda) {
          const parsedValue = Number(valorVenda);
          if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            throw new AppError("ERR_INVALID_SALE_VALUE", 400);
          }
          valorVenda = parsedValue;
        } else {
          const normalizedReason = String(selectedReason || "").trim();
          if (!normalizedReason) {
            throw new AppError("ERR_FINALIZATION_REASON_REQUIRED", 400);
          }

          const reasonExists = await TicketFinalizationReason.findOne({
            where: { companyId, name: { [Op.iLike]: normalizedReason } },
            attributes: ["id", "name"]
          });

          if (!reasonExists) {
            throw new AppError("ERR_INVALID_FINALIZATION_REASON", 400);
          }

          if (settings?.informarValorVenda) {
            motivoNaoVenda = reasonExists.name;
          } else {
            motivoFinalizacao = reasonExists.name;
          }
        }
      }
    }

    let ticket = await ShowTicketService(ticketId, companyId);

    if (ticket.channel === "whatsapp" && ticket.whatsappId) {
      SetTicketMessagesAsRead(ticket);
    }

    const oldStatus = ticket?.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket?.queueId;

    if (isNil(ticket.whatsappId) && status === "closed") {
      await CreateLogTicketService({
        userId,
        queueId: ticket.queueId,
        ticketId,
        type: "closed"
      });

      await ticket.update({
        status: "closed"
      });

      io.of(String(companyId))
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "delete",
          ticketId: ticket.id
        });
      return { ticket, oldStatus, oldUserId };
    }

    if (oldStatus === "closed") {
      let otherTicket = await Ticket.findOne({
        where: {
          contactId: ticket.contactId,
          status: { [Op.or]: ["open", "pending", "group"] },
          whatsappId: ticket.whatsappId
        }
      });
      if (otherTicket) {
        if (otherTicket.id !== ticket.id) {
          otherTicket = await ShowTicketService(otherTicket.id, companyId);
          return { ticket: otherTicket, oldStatus, oldUserId };
        }
      }

      isBot = false;
    }

    if (userId && userId !== oldUserId && status === "open") {
      logger.info(`[TICKET ACCEPTED] Ticket ${ticketId} aceito por usuário ${userId} - desabilitando integração`);
      isBot = false;
      useIntegration = false;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket?.whatsappId,
      userId: ticket.userId
    });

    const { complationMessage, ratingMessage, groupAsTicket } = await ShowWhatsAppService(ticket?.whatsappId,companyId);

    if (status !== undefined && ["closed"].indexOf(status) > -1) {
      const _userId = ticket.userId || userId;
      let user;
      if (_userId) {
        user = await User.findByPk(_userId);
      }

      if (
        settings.userRating === "enabled" &&
        (sendFarewellMessage || sendFarewellMessage === undefined) &&
        !isNil(ratingMessage) &&
        ratingMessage !== "" &&
        !ticket.isGroup
      ) {
        if (ticketTraking.ratingAt == null) {
          const ratingTxt = ratingMessage || "";
          let bodyRatingMessage = `\u200e${ratingTxt}\n`;

          if (
            ticket.channel === "whatsapp" &&
            ticket.whatsapp.status === "CONNECTED"
          ) {
            const msg = await SendWhatsAppMessage({
              body: bodyRatingMessage,
              ticket,
              isForwarded: false
            });
            await verifyMessage(msg, ticket, ticket.contact);
          } else if (["facebook", "instagram"].includes(ticket.channel)) {
            const msg = await sendFacebookMessage({
              body: bodyRatingMessage,
              ticket
            });
            await verifyMessageFace(
              msg,
              bodyRatingMessage,
              ticket,
              ticket.contact
            );
          } else if (ticket.channel === "whatsapp_oficial") {
            await SendWhatsAppOficialMessage({
              body: bodyRatingMessage,
              ticket: ticket,
              quotedMsg: null,
              type: "text",
              media: null,
              vCard: null
            });
          }

          await ticketTraking.update({
            userId: ticket.userId,
            closedAt: moment().toDate()
          });

          await CreateLogTicketService({
            userId: ticket.userId,
            queueId: ticket.queueId,
            ticketId,
            type: "nps"
          });

          await ticket.update({
            status: "nps",
            amountUsedBotQueuesNPS: 1
          });

          io.of(String(companyId))
            .emit(`company-${ticket.companyId}-ticket`, {
              action: "delete",
              ticketId: ticket.id
            });

          return { ticket, oldStatus, oldUserId };
        }
      }

      if (
        ((!isNil(user?.farewellMessage) && user?.farewellMessage !== "") ||
          (!isNil(complationMessage) && complationMessage !== "")) &&
        (sendFarewellMessage || sendFarewellMessage === undefined)
      ) {
        let body: any;

        if (
          ticket.status !== "pending" ||
          (ticket.status === "pending" &&
            settings.sendFarewellWaitingTicket === "enabled")
        ) {
          if (
            !isNil(user) &&
            !isNil(user?.farewellMessage) &&
            user?.farewellMessage !== ""
          ) {
            body = `\u200e${user.farewellMessage}`;
          } else {
            body = `\u200e${complationMessage}`;
          }
          if (
            ticket.channel === "whatsapp" &&
            (!ticket.isGroup || groupAsTicket === "enabled") &&
            ticket.whatsapp.status === "CONNECTED"
          ) {
            const sentMessage = await SendWhatsAppMessage({
              body,
              ticket,
              isForwarded: false
            });

            await verifyMessage(sentMessage, ticket, ticket.contact);
          }

          if (
            ["facebook", "instagram"].includes(ticket.channel) &&
            (!ticket.isGroup || groupAsTicket === "enabled")
          ) {
            const sentMessage = await sendFacebookMessage({ body, ticket });

            // await verifyMessageFace(sentMessage, body, ticket, ticket.contact );
          }

          if (ticket.channel === "whatsapp_oficial") {
            await SendWhatsAppOficialMessage({
              body: body,
              ticket: ticket,
              quotedMsg: null,
              type: "text",
              media: null,
              vCard: null
            });
          }

        }
      }

      ticketTraking.finishedAt = moment().toDate();
      ticketTraking.closedAt = moment().toDate();
      ticketTraking.whatsappId = ticket?.whatsappId;
      ticketTraking.userId = ticket.userId;

      await CreateLogTicketService({
        userId,
        queueId: ticket.queueId,
        ticketId,
        type: "closed"
      });

      await ticketTraking.save();

      await ticket.update({
        status: "closed",
        lastFlowId: null,
        dataWebhook: null,
        hashFlowId: null,
        valorVenda,
        motivoNaoVenda,
        motivoFinalizacao,
        finalizadoComVenda:
          finalizadoComVenda === undefined || finalizadoComVenda === null
            ? false
            : finalizadoComVenda
      });

      io.of(String(companyId))
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "delete",
          ticketId: ticket.id
        });
      return { ticket, oldStatus, oldUserId };
    }

    let queue;
    if (!isNil(queueId)) {
      queue = await Queue.findByPk(queueId);
      if (queue) {
        ticketTraking.queuedAt = moment().toDate();
      } else {
        logger.warn(`[TICKET UPDATE] Fila ${queueId} não encontrada no banco. Tratando como transferência sem fila.`);
        queueId = null;
      }
    }

    if (!isTransfered && !isNil(queueId) && queue) {
      if (isNil(userId) && queue.randomizeImmediate && queue.ativarRoteador) {
        logger.info(
          `[AUTO ASSIGN] Aplicando randomização imediata da fila ${queueId}`,
          { ticketId, queueId, oldQueueId }
        );

        try {
          const randomizationResult = await ListUserQueueImmediateService(queueId, Number(ticketId));

          if (randomizationResult && randomizationResult.userId) {
            userId = randomizationResult.userId;

            logger.info(
              `[AUTO ASSIGN] Usuário atribuído pela randomização imediata`,
              {
                ticketId,
                queueId,
                newUserId: userId,
                typeRandomMode: queue.typeRandomMode
              }
            );

            if (!isNil(userId)) {
              status = ticket.isGroup ? "group" : "pending";
            }
          }
        } catch (error: any) {
          logger.error(
            `[AUTO ASSIGN] Erro ao aplicar randomização imediata`,
            { ticketId, queueId, error: error.message }
          );
        }
      }
    }

    if (isTransfered) {
      logger.info(
        `[TICKET TRANSFER] Transferência manual - IGNORANDO randomização automática`,
        {
          ticketId,
          queueId,
          userId: userId || "null (sem usuário específico)",
          isTransfered
        }
      );
    }

    if (isTransfered) {
      if (settings.closeTicketOnTransfer) {
        let newTicketTransfer = ticket;
        if (oldQueueId !== queueId) {
          await ticket.update({
            status: "closed"
          });

          await ticket.reload();

          io.of(String(companyId))
            .emit(`company-${ticket.companyId}-ticket`, {
              action: "delete",
              ticketId: ticket.id
            });

          newTicketTransfer = await FindOrCreateTicketService(
            ticket.contact,
            ticket.whatsapp,
            1,
            ticket.companyId,
            queueId,
            userId,
            null,
            ticket.channel,
            false,
            false,
            settings,
            isTransfered
          );

          await FindOrCreateATicketTrakingService({
            ticketId: newTicketTransfer.id,
            companyId,
            whatsappId: ticket.whatsapp.id,
            userId
          });
        }

        if (!isNil(msgTransfer)) {
          const messageData = {
            wid: `PVT${newTicketTransfer.updatedAt
              .toString()
              .replace(" ", "")}`,
            ticketId: newTicketTransfer.id,
            contactId: undefined,
            body: msgTransfer,
            fromMe: true,
            mediaType: "extendedTextMessage",
            read: true,
            quotedMsgId: null,
            ack: 2,
            remoteJid: newTicketTransfer.contact?.remoteJid,
            participant: null,
            dataJson: null,
            ticketTrakingId: null,
            isPrivate: true
          };

          await CreateMessageService({
            messageData,
            companyId: ticket.companyId
          });
        }

        await newTicketTransfer.update({
          queueId,
          userId,
          status
        });

        await newTicketTransfer.reload();

        if (settings.sendMsgTransfTicket === "enabled") {
          if (
            (oldQueueId !== queueId || oldUserId !== userId) &&
            !isNil(queueId) &&
            queue &&
            ticket.whatsapp?.status === "CONNECTED"
          ) {
            let transferUserName = "";

            if (!isNil(userId)) {
              const transferUser = await ShowUserService(userId, companyId);
              transferUserName = transferUser?.name || "";
            }

            const msgtxt = buildTransferMessageSafely({
              template: settings.transferMessage,
              queueName: queue?.name,
              userName: transferUserName,
              ticket
            });

            if (msgtxt.length > 0) {
              if (ticket.channel === "whatsapp") {
                const wbot = await GetTicketWbot(ticket);
                const queueChangedMessage = await wbot.sendMessage(
                  getJidOf(ticket),
                  {
                    text: msgtxt
                  }
                );

                await verifyMessage(
                  queueChangedMessage,
                  ticket,
                  ticket.contact,
                  ticketTraking
                );
              }

              if (ticket.channel === "whatsapp_oficial") {
                await SendWhatsAppOficialMessage({
                  body: msgtxt,
                  ticket: ticket,
                  quotedMsg: null,
                  type: "text",
                  media: null,
                  vCard: null
                });
              }
            }
          }
        }

        if (
          oldUserId !== userId &&
          oldQueueId === queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        } else if (
          oldUserId !== userId &&
          oldQueueId === queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });

          await CreateLogTicketService({
            userId,
            queueId: oldQueueId,
            ticketId: newTicketTransfer.id,
            type: "receivedTransfer"
          });
        } else if (
          oldUserId !== userId &&
          oldQueueId !== queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });

          await CreateLogTicketService({
            userId,
            queueId,
            ticketId: newTicketTransfer.id,
            type: "receivedTransfer"
          });
        } else if (
          oldUserId !== undefined &&
          isNil(userId) &&
          oldQueueId !== queueId &&
          !isNil(queueId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        }

        if (
          newTicketTransfer.status !== oldStatus ||
          newTicketTransfer.user?.id !== oldUserId
        ) {
          await ticketTraking.update({
            userId: newTicketTransfer.userId
          });

          io.of(String(companyId))
            .emit(`company-${companyId}-ticket`, {
              action: "delete",
              ticketId: newTicketTransfer.id
            });
        }

        io.of(String(companyId))
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket: newTicketTransfer
          });

        return { ticket: newTicketTransfer, oldStatus, oldUserId };
      } else {
        if (settings.sendMsgTransfTicket === "enabled") {
          if (
            (oldQueueId !== queueId || oldUserId !== userId) &&
            !isNil(queueId) &&
            queue &&
            ticket.whatsapp?.status === "CONNECTED"
          ) {
            let transferUserName = "";

            if (!isNil(userId)) {
              const transferUser = await ShowUserService(userId, companyId);
              transferUserName = transferUser?.name || "";
            }

            const msgtxt = buildTransferMessageSafely({
              template: settings.transferMessage,
              queueName: queue?.name,
              userName: transferUserName,
              ticket
            });

            if (msgtxt.length > 0) {
              if (ticket.channel === "whatsapp") {
                const wbot = await GetTicketWbot(ticket);
                const queueChangedMessage = await wbot.sendMessage(
                  `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
                  {
                    text: msgtxt
                  }
                );
                await verifyMessage(
                  queueChangedMessage,
                  ticket,
                  ticket.contact,
                  ticketTraking
                );
              }

              if (ticket.channel === "whatsapp_oficial") {
                await SendWhatsAppOficialMessage({
                  body: msgtxt,
                  ticket: ticket,
                  quotedMsg: null,
                  type: "text",
                  media: null,
                  vCard: null
                });
              }
            }
          }
        }

        if (!isNil(msgTransfer)) {
          const messageData = {
            wid: `PVT${ticket.updatedAt.toString().replace(" ", "")}`,
            ticketId: ticket.id,
            contactId: undefined,
            body: msgTransfer,
            fromMe: true,
            mediaType: "extendedTextMessage",
            read: true,
            quotedMsgId: null,
            ack: 2,
            remoteJid: ticket.contact?.remoteJid,
            participant: null,
            dataJson: null,
            ticketTrakingId: null,
            isPrivate: true
          };

          await CreateMessageService({
            messageData,
            companyId: ticket.companyId
          });
        }

        if (
          oldUserId !== userId &&
          oldQueueId === queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        } else if (
          oldUserId !== userId &&
          oldQueueId === queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });

          await CreateLogTicketService({
            userId,
            queueId: oldQueueId,
            ticketId: ticket.id,
            type: "receivedTransfer"
          });
        } else if (
          oldUserId !== userId &&
          oldQueueId !== queueId &&
          !isNil(oldUserId) &&
          !isNil(userId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });

          await CreateLogTicketService({
            userId,
            queueId,
            ticketId: ticket.id,
            type: "receivedTransfer"
          });
        } else if (
          oldUserId !== undefined &&
          isNil(userId) &&
          oldQueueId !== queueId &&
          !isNil(queueId)
        ) {
          await CreateLogTicketService({
            userId: oldUserId,
            queueId: oldQueueId,
            ticketId,
            type: "transfered"
          });
        }
      }
    }

    status = queue && queue.closeTicket ? "closed" : status;

    if (!status && isNil(queueId)) {
      status = !isNil(userId) ? "open" : "pending";
      logger.info(`[TICKET UPDATE] Ticket ${ticketId} sem fila - status determinado automaticamente: ${status}`);
    }

    const isHumanAttendance = status === "open" && !isNil(userId);
    await ticket.update({
      status,
      queueId,
      userId,
      isBot: isHumanAttendance ? false : isBot,
      queueOptionId,
      amountUsedBotQueues:
        status === "closed"
          ? 0
          : amountUsedBotQueues
            ? amountUsedBotQueues
            : ticket.amountUsedBotQueues,
      lastMessage: lastMessage ? lastMessage : ticket.lastMessage,
      useIntegration: isHumanAttendance ? false : useIntegration,
      integrationId: isHumanAttendance ? null : integrationId,
      typebotSessionId: isHumanAttendance || !useIntegration ? null : ticket.typebotSessionId,
      typebotStatus: isHumanAttendance ? false : useIntegration,
      flowWebhook: isHumanAttendance ? false : ticket.flowWebhook,
      lastFlowId: isHumanAttendance ? null : ticket.lastFlowId,
      flowStopped: isHumanAttendance ? null : ticket.flowStopped,
      hashFlowId: isHumanAttendance ? null : ticket.hashFlowId,
      dataWebhook: isHumanAttendance ? null : ticket.dataWebhook,
      unreadMessages,
      valorVenda,
      motivoNaoVenda,
      motivoFinalizacao,
      finalizadoComVenda
    });

    ticketTraking.queuedAt = moment().toDate();
    ticketTraking.queueId = queueId;

    await ticket.reload();

    if (status !== undefined && ["pending"].indexOf(status) > -1) {
      await CreateLogTicketService({
        userId: oldUserId,
        ticketId,
        type: "pending"
      });

      await ticketTraking.update({
        whatsappId: ticket.whatsappId,
        startedAt: null,
        userId: null
      });
    }

    if (status !== undefined && ["open"].indexOf(status) > -1) {
      await ticketTraking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId,
        queueId: ticket.queueId
      });

      await CreateLogTicketService({
        userId: userId,
        queueId: ticket.queueId,
        ticketId,
        type: oldStatus === "pending" ? "open" : "reopen"
      });
    }

    await ticketTraking.save();

    ticket = await ShowTicketService(ticket.id, companyId);

    if (
      ticket.status !== oldStatus ||
      ticket.user?.id !== oldUserId ||
      ticket.queueId !== oldQueueId
    ) {
      io.of(String(companyId))
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticketId: ticket.id
        });
    }

    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return { ticket, oldStatus, oldUserId };
  } catch (err) {
    console.log(
      "erro ao atualizar o ticket",
      ticketId,
      "ticketData",
      ticketData
    );
    Sentry.captureException(err);
    throw err;
  }
};

export default UpdateTicketService;
