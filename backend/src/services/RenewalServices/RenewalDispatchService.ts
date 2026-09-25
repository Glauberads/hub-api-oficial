import sequelize from "../../database";

import AppError from "../../errors/AppError";

import Whatsapp from "../../models/Whatsapp";
import CompaniesSettings from "../../models/CompaniesSettings";

import RenewalSubscription from "../../models/RenewalSubscription";
import RenewalCustomer from "../../models/RenewalCustomer";
import RenewalNotification from "../../models/RenewalNotification";

import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";

import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import CheckContactNumber from "../WbotServices/CheckNumber";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";

import CreateMessageService from "../MessageServices/CreateMessageService";

import { ensureRenewalContact } from "./RenewalContactService";

const normalize = (value: any): string =>
  String(value || "")
    .trim()
    .toLowerCase();

export const isOfficialConnection = (
  whatsapp: Whatsapp
): boolean => {
  const channel = normalize(
    whatsapp.channel
  );

  const provider = normalize(
    whatsapp.provider
  );

  return (
    channel.includes("oficial") ||
    channel.includes("official") ||
    provider.includes("oficial") ||
    provider.includes("official")
  );
};


const resolveWhatsapp = async (
  subscription: RenewalSubscription
): Promise<Whatsapp> => {
  let whatsapp: Whatsapp | null = null;

  if (subscription.whatsappId) {
    whatsapp = await Whatsapp.findOne({
      where: {
        id: subscription.whatsappId,
        companyId: subscription.companyId
      }
    });
  }

  if (!whatsapp) {
    whatsapp = await GetDefaultWhatsApp(
      subscription.companyId
    );
  }

  if (!whatsapp) {
    throw new AppError(
      "Nenhuma conexão WhatsApp disponível para a renovação.",
      400
    );
  }

  return whatsapp;
};


export const sendSubscriptionMessage = async (
  subscriptionId: number,
  companyId: number,
  body: string
): Promise<void> => {
  const subscription =
    await RenewalSubscription.findOne({
      where: {
        id: subscriptionId,
        companyId
      }
    });

  if (!subscription) {
    throw new AppError(
      "Assinatura não encontrada para envio.",
      404
    );
  }

  const customer =
    await RenewalCustomer.findOne({
      where: {
        id: subscription.customerId,
        companyId
      }
    });

  if (!customer) {
    throw new AppError(
      "Cliente de renovação não encontrado para envio.",
      404
    );
  }

  const whatsapp =
    await resolveWhatsapp(
      subscription
    );

  const contact =
    await ensureRenewalContact(
      customer,
      companyId
    );

  /*
   * Clientes cadastrados manualmente em Renovações podem ainda
   * não possuir remoteJid/LID.
   *
   * Antes do primeiro envio Baileys consultamos a sessão REAL
   * para descobrir a identidade correta do WhatsApp.
   */
  if (!isOfficialConnection(whatsapp)) {
    const cleanNumber =
      String(customer.phone || "")
        .replace(/\D/g, "");

    try {
      const resolved =
        await CheckContactNumber(
          cleanNumber,
          companyId,
          false,
          undefined,
          whatsapp
        );

      const resolvedJid =
        String(
          resolved?.jid || ""
        ).trim();

      let resolvedLid =
        String(
          (resolved as any)?.lid || ""
        ).trim();

      if (
        resolvedLid &&
        !resolvedLid.includes("@")
      ) {
        resolvedLid =
          `${resolvedLid}@lid`;
      }

      const contactUpdate: any = {};

      if (resolvedJid) {
        contactUpdate.remoteJid =
          resolvedJid;
      }

      if (resolvedLid) {
        contactUpdate.lid =
          resolvedLid;
      }

      if (
        Object.keys(
          contactUpdate
        ).length > 0
      ) {
        await contact.update(
          contactUpdate
        );
      }

      console.log(
        `[RENEWAL] Identidade WhatsApp resolvida: ` +
        `contactId=${contact.id} ` +
        `number=${cleanNumber} ` +
        `jid=${resolvedJid || "null"} ` +
        `lid=${resolvedLid || "null"}`
      );

    } catch (err: any) {
      console.error(
        `[RENEWAL] Falha ao validar WhatsApp ` +
        `${cleanNumber}:`,
        err?.message || err
      );

      throw new AppError(
        `Número ${cleanNumber} não foi localizado no WhatsApp.`,
        400
      );
    }
  }

  const settings =
    await CompaniesSettings.findOne({
      where: {
        companyId
      }
    });

  const ticket =
    await FindOrCreateTicketService(
      contact,
      whatsapp,
      0,
      companyId,
      null,
      null,
      null,
      whatsapp.channel,
      null,
      false,
      settings || {},
      false,
      false
    );

  if (
    isOfficialConnection(
      whatsapp
    )
  ) {
    await SendWhatsAppOficialMessage({
      body,
      ticket,
      type: "text"
    } as any);

    return;
  }

  const sentMessage =
    await SendWhatsAppMessage({
      body: `\u200e ${body}`,
      ticket
    });

  /*
   * Persistência no histórico do ticket,
   * mesmo padrão usado pelo módulo de aniversário.
   */
  try {
    const wid =
      (sentMessage as any)?.key?.id;

    if (wid) {
      /*
       * O envio Baileys já foi aceito quando chegamos aqui.
       *
       * Algumas mensagens automáticas podem receber o evento
       * messages.update antes de a linha ser criada em Messages.
       * Nessa situação o ACK inicial seria perdido e a mensagem
       * ficaria eternamente com ack=0 (relógio).
       *
       * Aproveitamos o status retornado pela própria WAMessage.
       * Se ele ainda não vier preenchido, usamos SERVER_ACK (2),
       * que é o mesmo padrão já utilizado em outros envios
       * automáticos deste sistema.
       *
       * ACKs posteriores 3/4 continuam sendo atualizados pelo
       * wbotMessageListener normalmente.
       */
      const rawAck =
        Number(
          (sentMessage as any)?.status
        );

      /*
       * Não inventamos SERVER_ACK.
       * Se o Baileys ainda não informou status,
       * a mensagem permanece pendente e o
       * messages.update fará a evolução real.
       */
      const initialAck =
        Number.isFinite(rawAck) &&
        rawAck > 0
          ? rawAck
          : 0;

      await CreateMessageService({
        companyId,

        messageData: {
          wid,
          ticketId: ticket.id,
          contactId: contact.id,
          body,
          fromMe: true,
          read: true,
          ack: initialAck,
          channel:
            whatsapp.channel
        }
      });

      console.log(
        `[RENEWAL] Mensagem persistida: wid=${wid} ack=${initialAck}`
      );
    }
  } catch (err) {
    console.error(
      "[RENEWAL] Falha ao persistir mensagem no ticket:",
      err
    );
  }
};


export const dispatchNotification = async (
  notificationId: number
): Promise<boolean> => {
  return sequelize.transaction(
    async transaction => {
      const notification =
        await RenewalNotification.findByPk(
          notificationId,
          {
            transaction,
            lock:
              transaction.LOCK.UPDATE
          }
        );

      if (!notification) {
        return false;
      }

      if (
        notification.status !==
        "processing"
      ) {
        return false;
      }

      /*
       * Também travamos a assinatura.
       *
       * Se uma baixa estiver ocorrendo ao mesmo tempo,
       * um dos dois processos aguarda o outro.
       */
      const subscription =
        await RenewalSubscription.findOne({
          where: {
            id:
              notification.subscriptionId,
            companyId:
              notification.companyId
          },

          transaction,

          lock:
            transaction.LOCK.UPDATE
        });

      if (
        !subscription ||
        !subscription.active ||
        subscription.status ===
          "canceled" ||
        subscription.dueDate !==
          notification.cycleDueDate
      ) {
        await notification.update(
          {
            status: "canceled",
            canceledAt: new Date()
          },
          {
            transaction
          }
        );

        return false;
      }

      /*
       * O lock da assinatura permanece durante o envio.
       *
       * Assim, se a baixa acontecer primeiro,
       * esta cobrança não será enviada.
       */
      await sendSubscriptionMessage(
        subscription.id,
        subscription.companyId,
        notification.body
      );

      await notification.update(
        {
          status: "sent",
          sentAt: new Date(),
          nextAttemptAt: null,
          errorMessage: null
        },
        {
          transaction
        }
      );

      return true;
    }
  );
};
