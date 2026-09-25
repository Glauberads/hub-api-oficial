import RenewalPayment from "../../models/RenewalPayment";
import sequelize from "../../database";
import { Op } from "sequelize";
import moment from "moment-timezone";
import { ensureRenewalContact } from "./RenewalContactService";
import { buildCycleNotifications } from "./RenewalNotificationService";

import AppError from "../../errors/AppError";

import RenewalSubscription from "../../models/RenewalSubscription";
import RenewalCustomer from "../../models/RenewalCustomer";
import RenewalProduct from "../../models/RenewalProduct";
import RenewalNotification from "../../models/RenewalNotification";
import Whatsapp from "../../models/Whatsapp";

import {
  calculateNextDueDate,
  parseDateOnly
} from "./RenewalDateService";

interface SubscriptionData {
  customerId?: number | string;
  productId?: number | string;
  whatsappId?: number | string | null;
  dueDate?: string;
  status?:
    | "active"
    | "overdue"
    | "paused"
    | "canceled";
  active?: boolean;
}

const validateEntities = async (
  companyId: number,
  customerId: number,
  productId: number,
  whatsappId?: number | null
): Promise<{
  customer: RenewalCustomer;
  product: RenewalProduct;
  whatsapp: Whatsapp | null;
}> => {
  const customer = await RenewalCustomer.findOne({
    where: {
      id: customerId,
      companyId,
      active: true
    }
  });

  if (!customer) {
    throw new AppError(
      "Cliente de renovação não encontrado.",
      404
    );
  }

  const product = await RenewalProduct.findOne({
    where: {
      id: productId,
      companyId,
      active: true
    }
  });

  if (!product) {
    throw new AppError(
      "Produto de renovação não encontrado.",
      404
    );
  }

  let whatsapp: Whatsapp | null = null;

  if (whatsappId) {
    whatsapp = await Whatsapp.findOne({
      where: {
        id: whatsappId,
        companyId
      }
    });

    if (!whatsapp) {
      throw new AppError(
        "Conexão WhatsApp não encontrada.",
        404
      );
    }
  }

  return {
    customer,
    product,
    whatsapp
  };
};

export const list = async (
  companyId: number,
  searchParam?: string,
  status?: string
): Promise<RenewalSubscription[]> => {
  const where: any = {
    companyId
  };

  if (status) {
    where.status = status;
  }

  const customerWhere: any = {};

  if (
    searchParam &&
    searchParam.trim()
  ) {
    const search = searchParam.trim();
    const digits = search.replace(
      /\D/g,
      ""
    );

    customerWhere[Op.or] = [
      {
        name: {
          [Op.iLike]: `%${search}%`
        }
      },
      ...(digits
        ? [
            {
              phone: {
                [Op.like]: `%${digits}%`
              }
            }
          ]
        : [])
    ];
  }

  return RenewalSubscription.findAll({
    where,

    include: [
      {
        model: RenewalCustomer,
        as: "customer",
        required: Boolean(searchParam),
        where:
          Object.keys(customerWhere).length
            ? customerWhere
            : undefined
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
    ],

    order: [
      ["dueDate", "ASC"],
      ["id", "ASC"]
    ]
  });
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<RenewalSubscription> => {
  const subscription =
    await RenewalSubscription.findOne({
      where: {
        id: Number(id),
        companyId
      },

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
    });

  if (!subscription) {
    throw new AppError(
      "Assinatura não encontrada.",
      404
    );
  }

  return subscription;
};

export const create = async (
  data: SubscriptionData,
  companyId: number
): Promise<RenewalSubscription> => {
  const customerId = Number(
    data.customerId
  );

  const productId = Number(
    data.productId
  );

  const whatsappId =
    data.whatsappId
      ? Number(data.whatsappId)
      : null;

  if (!customerId) {
    throw new AppError(
      "Informe o cliente.",
      400
    );
  }

  if (!productId) {
    throw new AppError(
      "Informe o produto.",
      400
    );
  }

  if (!data.dueDate) {
    throw new AppError(
      "Informe a data de vencimento.",
      400
    );
  }

  parseDateOnly(data.dueDate);

  const {
    customer,
    product
  } = await validateEntities(
    companyId,
    customerId,
    productId,
    whatsappId
  );

  const existing =
    await RenewalSubscription.findOne({
      where: {
        companyId,
        customerId,
        productId,
        active: true,
        status: {
          [Op.notIn]: [
            "canceled"
          ]
        }
      }
    });

  if (existing) {
    throw new AppError(
      "Este cliente já possui uma assinatura ativa para este produto.",
      400
    );
  }

  const subscription =
    await RenewalSubscription.create({
      companyId,
      customerId,
      productId,
      whatsappId,
      dueDate: data.dueDate,
      status: data.status || "active",
      active: data.active !== false
    } as any);

  /*
   * Garante que o cliente também exista
   * em Contacts do MULTIZAP.
   */
  await ensureRenewalContact(
    customer,
    companyId
  );

  /*
   * Gera a primeira régua automaticamente.
   * Lembretes anteriores a hoje são ignorados.
   */
  const today =
    moment()
      .tz("America/Sao_Paulo")
      .format("YYYY-MM-DD");

  await buildCycleNotifications({
    companyId,
    subscriptionId:
      subscription.id,
    whatsappId,
    dueDate:
      subscription.dueDate,
    product,
    customer,
    minimumDate: today
  });

  return show(
    subscription.id,
    companyId
  );
};

export const update = async (
  id: string | number,
  data: SubscriptionData,
  companyId: number
): Promise<RenewalSubscription> => {
  const subscription =
    await RenewalSubscription.findOne({
      where: {
        id: Number(id),
        companyId
      }
    });

  if (!subscription) {
    throw new AppError(
      "Assinatura não encontrada.",
      404
    );
  }

  const customerId =
    data.customerId !== undefined
      ? Number(data.customerId)
      : subscription.customerId;

  const productId =
    data.productId !== undefined
      ? Number(data.productId)
      : subscription.productId;

  const whatsappId =
    data.whatsappId !== undefined
      ? (
          data.whatsappId
            ? Number(data.whatsappId)
            : null
        )
      : subscription.whatsappId;

  const dueDate =
    data.dueDate !== undefined
      ? data.dueDate
      : subscription.dueDate;

  parseDateOnly(dueDate);

  const {
    customer,
    product
  } = await validateEntities(
    companyId,
    customerId,
    productId,
    whatsappId
  );

  const nextStatus =
    data.status !== undefined
      ? data.status
      : subscription.status;

  let nextActive =
    data.active !== undefined
      ? data.active
      : subscription.active;

  /*
   * Uma assinatura cancelada nunca deve
   * continuar marcada como ativa.
   */
  if (nextStatus === "canceled") {
    nextActive = false;
  }

  /*
   * Evita duas assinaturas ativas do mesmo
   * cliente para o mesmo produto.
   */
  if (
    nextActive &&
    nextStatus !== "canceled"
  ) {
    const duplicate =
      await RenewalSubscription.findOne({
        where: {
          companyId,
          customerId,
          productId,

          id: {
            [Op.ne]: subscription.id
          },

          active: true,

          status: {
            [Op.notIn]: [
              "canceled"
            ]
          }
        }
      });

    if (duplicate) {
      throw new AppError(
        "Este cliente já possui uma assinatura ativa para este produto.",
        400
      );
    }
  }

  await subscription.update({
    customerId,
    productId,
    whatsappId,
    dueDate,
    status: nextStatus,
    active: nextActive
  });

  /*
   * Caso o cliente tenha sido alterado,
   * também garantimos sua existência em Contacts.
   */
  await ensureRenewalContact(
    customer,
    companyId
  );

  const shouldSchedule =
    Boolean(nextActive) &&
    nextStatus !== "paused" &&
    nextStatus !== "canceled";

  const now = new Date();

  if (!shouldSchedule) {
    /*
     * PAUSADA / CANCELADA / INATIVA:
     * interrompe imediatamente tudo que ainda
     * poderia ser disparado.
     */
    await RenewalNotification.update(
      {
        status: "canceled",
        canceledAt: now
      } as any,
      {
        where: {
          companyId,

          subscriptionId:
            subscription.id,

          status: {
            [Op.in]: [
              "pending",
              "processing",
              "failed"
            ]
          }
        }
      }
    );

    return show(
      subscription.id,
      companyId
    );
  }

  /*
   * Assinatura ativa:
   *
   * Qualquer régua de outro vencimento fica
   * cancelada. Isso elimina agendas antigas
   * quando o vencimento é editado.
   */
  await RenewalNotification.update(
    {
      status: "canceled",
      canceledAt: now
    } as any,
    {
      where: {
        companyId,

        subscriptionId:
          subscription.id,

        cycleDueDate: {
          [Op.ne]: dueDate
        },

        status: {
          [Op.in]: [
            "pending",
            "processing",
            "failed"
          ]
        }
      }
    }
  );

  /*
   * Para o ciclo atual removemos somente
   * notificações que NÃO foram enviadas.
   *
   * Isso permite reconstruir corpo, horário,
   * produto e conexão sem reenviar mensagens
   * já concluídas.
   */
  await RenewalNotification.destroy({
    where: {
      companyId,

      subscriptionId:
        subscription.id,

      cycleDueDate:
        dueDate,

      status: {
        [Op.in]: [
          "pending",
          "processing",
          "failed",
          "canceled"
        ]
      }
    }
  });

  /*
   * Descobre offsets que já foram realmente
   * enviados neste ciclo para não duplicá-los.
   */
  const sentNotifications =
    await RenewalNotification.findAll({
      where: {
        companyId,

        subscriptionId:
          subscription.id,

        cycleDueDate:
          dueDate,

        status: "sent"
      },

      attributes: [
        "offsetDays"
      ]
    });

  const sentOffsets =
    new Set(
      sentNotifications.map(
        item =>
          Number(item.offsetDays)
      )
    );

  const originalReminderDays =
    Array.isArray(product.reminderDays)
      ? [...product.reminderDays]
      : [3, 2, 1, 0, -1];

  /*
   * O model é alterado somente em memória.
   * Nada é salvo no produto.
   */
  (product as any).reminderDays =
    originalReminderDays.filter(
      offset =>
        !sentOffsets.has(
          Number(offset)
        )
    );

  const today =
    moment()
      .tz("America/Sao_Paulo")
      .format("YYYY-MM-DD");

  try {
    await buildCycleNotifications({
      companyId,

      subscriptionId:
        subscription.id,

      whatsappId,

      dueDate,

      product,

      customer,

      minimumDate:
        today
    });
  } finally {
    /*
     * Restaura a configuração original
     * do objeto em memória.
     */
    (product as any).reminderDays =
      originalReminderDays;
  }

  return show(
    subscription.id,
    companyId
  );
};


export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  await sequelize.transaction(
    async transaction => {
      const subscription =
        await RenewalSubscription.findOne({
          where: {
            id: Number(id),
            companyId
          },

          transaction,

          lock:
            transaction.LOCK.UPDATE
        });

      if (!subscription) {
        throw new AppError(
          "Assinatura não encontrada.",
          404
        );
      }

      /*
       * Remove toda a fila/histórico específico
       * desta assinatura antes dela própria.
       */
      await RenewalNotification.destroy({
        where: {
          companyId,
          subscriptionId:
            subscription.id
        },

        transaction
      });

      await RenewalPayment.destroy({
        where: {
          companyId,
          subscriptionId:
            subscription.id
        },

        transaction
      });

      await subscription.destroy({
        transaction
      });
    }
  );
};


export const previewNextDueDate = async (
  id: string | number,
  companyId: number,
  paymentDate?: string
): Promise<{
  currentDueDate: string;
  nextDueDate: string;
  dueRule: string;
  renewFrom: string;
}> => {
  const subscription =
    await show(
      id,
      companyId
    );

  if (!subscription.product) {
    throw new AppError(
      "Produto da assinatura não encontrado.",
      404
    );
  }

  const product =
    subscription.product;

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
      subscription.dueDate,
      paymentDate
    );

  return {
    currentDueDate:
      subscription.dueDate,
    nextDueDate,
    dueRule:
      product.dueRule,
    renewFrom:
      product.renewFrom
  };
};
