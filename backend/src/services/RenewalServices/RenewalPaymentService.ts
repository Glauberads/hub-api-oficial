import { Op } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";

import RenewalSubscription from "../../models/RenewalSubscription";
import RenewalProduct from "../../models/RenewalProduct";
import RenewalCustomer from "../../models/RenewalCustomer";
import RenewalPayment from "../../models/RenewalPayment";
import RenewalNotification from "../../models/RenewalNotification";

import {
  calculateNextDueDate,
  parseDateOnly
} from "./RenewalDateService";

import {
  buildCycleNotifications,
  buildThankYouMessage
} from "./RenewalNotificationService";
import { sendSubscriptionMessage } from "./RenewalDispatchService";

interface RenewData {
  expectedDueDate?: string;
  paymentDate?: string;
  amount?: number | string | null;
  notes?: string | null;
}

interface RenewResult {
  payment: RenewalPayment;
  subscription: RenewalSubscription;
  previousDueDate: string;
  nextDueDate: string;
  canceledNotifications: number;
  createdNotifications: number;
  thankYouMessage: string;
  thankYouSent: boolean;
  thankYouError?: string;
}

export const renew = async (
  subscriptionId: string | number,
  data: RenewData,
  companyId: number,
  userId: number
): Promise<RenewResult> => {
  if (!data.expectedDueDate) {
    throw new AppError(
      "Informe o vencimento atual esperado.",
      400
    );
  }

  if (!data.paymentDate) {
    throw new AppError(
      "Informe a data do pagamento.",
      400
    );
  }

  parseDateOnly(data.expectedDueDate);
  parseDateOnly(data.paymentDate);

  const result: RenewResult = await sequelize.transaction(
    async transaction => {
      /*
       * LOCK impede duas baixas simultâneas
       * na mesma assinatura.
       */
      const subscription =
        await RenewalSubscription.findOne({
          where: {
            id: Number(subscriptionId),
            companyId
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });

      if (!subscription) {
        throw new AppError(
          "Assinatura não encontrada.",
          404
        );
      }

      if (
        !subscription.active ||
        subscription.status === "canceled"
      ) {
        throw new AppError(
          "Esta assinatura está cancelada ou inativa.",
          400
        );
      }

      /*
       * Proteção contra clique duplo / tela desatualizada.
       */
      if (
        subscription.dueDate !==
        data.expectedDueDate
      ) {
        throw new AppError(
          `O vencimento desta assinatura já foi alterado para ${subscription.dueDate}. Atualize a tela antes de dar nova baixa.`,
          409
        );
      }

      const product =
        await RenewalProduct.findOne({
          where: {
            id: subscription.productId,
            companyId
          },
          transaction
        });

      if (!product) {
        throw new AppError(
          "Produto da assinatura não encontrado.",
          404
        );
      }

      const customer =
        await RenewalCustomer.findOne({
          where: {
            id: subscription.customerId,
            companyId
          },
          transaction
        });

      if (!customer) {
        throw new AppError(
          "Cliente da assinatura não encontrado.",
          404
        );
      }

      const previousDueDate =
        subscription.dueDate;

      const nextDueDate =
        calculateNextDueDate(
          {
            dueRule: product.dueRule,
            runningDays:
              product.runningDays,
            fixedDay:
              product.fixedDay,
            renewFrom:
              product.renewFrom
          },
          previousDueDate,
          data.paymentDate
        );

      let amount: number | null = null;

      if (
        data.amount !== undefined &&
        data.amount !== null &&
        data.amount !== ""
      ) {
        amount = Number(data.amount);

        if (
          Number.isNaN(amount) ||
          amount < 0
        ) {
          throw new AppError(
            "Valor recebido inválido.",
            400
          );
        }
      } else if (
        product.amount !== null &&
        product.amount !== undefined
      ) {
        amount = Number(product.amount);
      }

      /*
       * Usamos meio-dia UTC para preservar corretamente
       * a data informada sem mudança de dia por timezone.
       */
      const paidAt = new Date(
        `${data.paymentDate}T12:00:00.000Z`
      );

      const payment =
        await RenewalPayment.create(
          {
            companyId,

            subscriptionId:
              subscription.id,

            customerId:
              subscription.customerId,

            productId:
              subscription.productId,

            userId,

            amount,

            paidAt,

            previousDueDate,
            nextDueDate,

            notes:
              data.notes || null
          } as any,
          {
            transaction
          }
        );

      /*
       * Cancela toda a régua ainda não concluída
       * do vencimento antigo.
       */
      const [
        canceledNotifications
      ] =
        await RenewalNotification.update(
          {
            status: "canceled",
            canceledAt: new Date()
          },
          {
            where: {
              companyId,

              subscriptionId:
                subscription.id,

              cycleDueDate:
                previousDueDate,

              status: {
                [Op.in]: [
                  "pending",
                  "processing",
                  "failed"
                ]
              }
            },

            transaction
          }
        );

      await subscription.update(
        {
          dueDate: nextDueDate,
          lastPaymentAt: paidAt,
          status: "active",
          active: true
        },
        {
          transaction
        }
      );

      /*
       * Cria a régua do próximo ciclo.
       */
      const createdNotifications =
        await buildCycleNotifications({
          companyId,

          subscriptionId:
            subscription.id,

          whatsappId:
            subscription.whatsappId,

          dueDate:
            nextDueDate,

          product,
          customer,

          paymentDate:
            data.paymentDate,

          transaction
        });

      const thankYouMessage =
        buildThankYouMessage(
          customer,
          product,
          nextDueDate
        );

      return {
        payment,
        subscription,
        previousDueDate,
        nextDueDate,
        canceledNotifications,
        createdNotifications,
        thankYouMessage,
        thankYouSent: false
      };
    }
  );

  /*
   * O envio externo acontece somente após
   * o COMMIT do pagamento.
   *
   * Se o WhatsApp falhar, a baixa continua válida.
   */
  try {
    await sendSubscriptionMessage(
      result.subscription.id,
      companyId,
      result.thankYouMessage
    );

    result.thankYouSent = true;
  } catch (error: any) {
    result.thankYouSent = false;
    result.thankYouError =
      String(
        error?.message ||
        error ||
        "Erro ao enviar agradecimento"
      );
  }

  return result;
};


export const listPayments = async (
  companyId: number,
  subscriptionId?: string
): Promise<RenewalPayment[]> => {
  const where: any = {
    companyId
  };

  if (subscriptionId) {
    where.subscriptionId =
      Number(subscriptionId);
  }

  return RenewalPayment.findAll({
    where,

    include: [
      {
        model: RenewalCustomer,
        as: "customer"
      },
      {
        model: RenewalProduct,
        as: "product"
      }
    ],

    order: [
      ["paidAt", "DESC"],
      ["id", "DESC"]
    ]
  });
};
