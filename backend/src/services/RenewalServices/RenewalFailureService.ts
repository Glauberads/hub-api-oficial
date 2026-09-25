import { Op } from "sequelize";

import AppError from "../../errors/AppError";

import RenewalNotification from "../../models/RenewalNotification";
import RenewalSubscription from "../../models/RenewalSubscription";
import RenewalCustomer from "../../models/RenewalCustomer";
import RenewalProduct from "../../models/RenewalProduct";
import Whatsapp from "../../models/Whatsapp";

export const listFailures = async (
  companyId: number
): Promise<RenewalNotification[]> => {
  return RenewalNotification.findAll({
    where: {
      companyId,

      /*
       * Exibe:
       * - falhas definitivas;
       * - retries pendentes;
       * - processing em andamento.
       *
       * Registros normais que nunca falharam
       * não aparecem nesta central.
       */
      [Op.and]: [
        {
          status: {
            [Op.in]: [
              "failed",
              "pending",
              "processing"
            ]
          }
        },

        {
          [Op.or]: [
            {
              attempts: {
                [Op.gt]: 0
              }
            },
            {
              errorMessage: {
                [Op.ne]: null
              }
            }
          ]
        }
      ]
    },

    include: [
      {
        model: RenewalSubscription,
        as: "subscription",

        include: [
          {
            model: RenewalCustomer,
            as: "customer"
          },
          {
            model: RenewalProduct,
            as: "product"
          },
          {
            model: Whatsapp,
            as: "whatsapp",
            required: false
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        required: false
      }
    ],

    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"]
    ],

    limit: 500
  });
};


const showNotification = async (
  id: string | number,
  companyId: number
): Promise<RenewalNotification> => {
  const notification =
    await RenewalNotification.findOne({
      where: {
        id: Number(id),
        companyId
      }
    });

  if (!notification) {
    throw new AppError(
      "Notificação de renovação não encontrada.",
      404
    );
  }

  return notification;
};


export const retryNow = async (
  id: string | number,
  companyId: number
): Promise<RenewalNotification> => {
  const notification =
    await showNotification(
      id,
      companyId
    );

  if (
    notification.status === "sent"
  ) {
    throw new AppError(
      "Esta notificação já foi enviada.",
      400
    );
  }

  if (
    notification.status === "canceled"
  ) {
    throw new AppError(
      "Esta notificação está cancelada.",
      400
    );
  }

  if (
    notification.status === "processing"
  ) {
    throw new AppError(
      "Esta notificação já está sendo processada.",
      400
    );
  }

  /*
   * Se já era FAILED definitivo, começa
   * um novo ciclo manual de até 3 tentativas.
   *
   * Se ainda estava em retry automático,
   * preservamos as tentativas já consumidas
   * e apenas antecipamos a próxima execução.
   */
  const resetAttempts =
    notification.status === "failed";

  await notification.update({
    status: "pending",

    attempts:
      resetAttempts
        ? 0
        : notification.attempts,

    lastAttemptAt:
      resetAttempts
        ? null
        : notification.lastAttemptAt,

    nextAttemptAt:
      new Date(),

    errorMessage:
      null,

    canceledAt:
      null
  } as any);

  return notification.reload();
};


export const cancelFailure = async (
  id: string | number,
  companyId: number
): Promise<RenewalNotification> => {
  const notification =
    await showNotification(
      id,
      companyId
    );

  if (
    notification.status === "sent"
  ) {
    throw new AppError(
      "Uma notificação já enviada não pode ser cancelada.",
      400
    );
  }

  if (
    notification.status === "canceled"
  ) {
    return notification;
  }

  await notification.update({
    status: "canceled",
    canceledAt: new Date(),
    nextAttemptAt: null
  } as any);

  return notification.reload();
};
