import RenewalNotification from "../../models/RenewalNotification";
import RenewalPayment from "../../models/RenewalPayment";
import RenewalSubscription from "../../models/RenewalSubscription";
import sequelize from "../../database";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import RenewalProduct, {
  RenewalDueRule,
  RenewalFrom
} from "../../models/RenewalProduct";
import SyncRenewalProductNotificationsService from "./SyncRenewalProductNotificationsService";

interface ProductData {
  name?: string;
  description?: string;
  amount?: number | string | null;
  dueRule?: RenewalDueRule;
  runningDays?: number | string | null;
  fixedDay?: number | string | null;
  renewFrom?: RenewalFrom;
  reminderTime?: string;
  reminderDays?: number[];
  messageTemplates?: Record<string, string> | null;
  active?: boolean;
}

const normalizeProductData = (data: ProductData): ProductData => {
  const dueRule = data.dueRule || "running_days";

  if (!["running_days", "fixed_day"].includes(dueRule)) {
    throw new AppError("Regra de vencimento inválida.", 400);
  }

  if (
    data.renewFrom &&
    !["due_date", "payment_date"].includes(data.renewFrom)
  ) {
    throw new AppError("Regra de renovação inválida.", 400);
  }

  if (dueRule === "running_days") {
    const days = Number(data.runningDays);

    if (!Number.isInteger(days) || days <= 0) {
      throw new AppError(
        "Informe uma quantidade válida de dias corridos.",
        400
      );
    }

    data.runningDays = days;
    data.fixedDay = null;
  }

  if (dueRule === "fixed_day") {
    const day = Number(data.fixedDay);

    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new AppError(
        "O dia fixo deve estar entre 1 e 31.",
        400
      );
    }

    data.fixedDay = day;
    data.runningDays = null;

    /*
     * Dia fixo sempre mantém o calendário mensal.
     * renewFrom só é aplicável a produtos de dias corridos.
     */
    data.renewFrom = "due_date";
  }

  const reminderTime =
    String(
      data.reminderTime ||
      "09:00"
    ).trim();

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      reminderTime
    )
  ) {
    throw new AppError(
      "Horário de envio inválido.",
      400
    );
  }

  data.reminderTime =
    reminderTime;

  if (data.amount !== undefined && data.amount !== null && data.amount !== "") {
    const amount = Number(data.amount);

    if (Number.isNaN(amount) || amount < 0) {
      throw new AppError("Valor do produto inválido.", 400);
    }

    data.amount = amount;
  } else {
    data.amount = null;
  }

  if (data.reminderDays) {
    if (!Array.isArray(data.reminderDays)) {
      throw new AppError("Os lembretes devem ser uma lista de dias.", 400);
    }

    data.reminderDays = Array.from(
      new Set(
        data.reminderDays
          .map(item => Number(item))
          .filter(item => Number.isInteger(item))
      )
    ).sort((a, b) => b - a);
  }

  return data;
};

export const list = async (
  companyId: number,
  searchParam?: string,
  active?: string
): Promise<RenewalProduct[]> => {
  const where: any = { companyId };

  if (searchParam) {
    where.name = {
      [Op.iLike]: `%${searchParam.trim()}%`
    };
  }

  if (active === "true") {
    where.active = true;
  }

  if (active === "false") {
    where.active = false;
  }

  return RenewalProduct.findAll({
    where,
    order: [["name", "ASC"]]
  });
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<RenewalProduct> => {
  const product = await RenewalProduct.findOne({
    where: {
      id: Number(id),
      companyId
    }
  });

  if (!product) {
    throw new AppError("Produto não encontrado.", 404);
  }

  return product;
};

export const create = async (
  data: ProductData,
  companyId: number
): Promise<RenewalProduct> => {
  if (!data.name || !data.name.trim()) {
    throw new AppError("Informe o nome do produto.", 400);
  }

  const payload = normalizeProductData({
    ...data,
    name: data.name.trim(),
    dueRule: data.dueRule || "running_days",
    renewFrom: data.renewFrom || "due_date",
    reminderTime: data.reminderTime || "09:00",
    reminderDays: data.reminderDays || [3, 2, 1, 0, -1],
    active: data.active !== false
  });

  return RenewalProduct.create({
    ...payload,
    companyId
  } as any);
};

export const update = async (
  id: string | number,
  data: ProductData,
  companyId: number
): Promise<RenewalProduct> => {
  const product = await show(id, companyId);

  const merged: ProductData = {
    name: data.name !== undefined ? data.name : product.name,
    description:
      data.description !== undefined
        ? data.description
        : product.description,
    amount:
      data.amount !== undefined
        ? data.amount
        : product.amount,
    dueRule:
      data.dueRule !== undefined
        ? data.dueRule
        : product.dueRule,
    runningDays:
      data.runningDays !== undefined
        ? data.runningDays
        : product.runningDays,
    fixedDay:
      data.fixedDay !== undefined
        ? data.fixedDay
        : product.fixedDay,
    renewFrom:
      data.renewFrom !== undefined
        ? data.renewFrom
        : product.renewFrom,
    reminderTime:
      data.reminderTime !== undefined
        ? data.reminderTime
        : product.reminderTime,

    reminderDays:
      data.reminderDays !== undefined
        ? data.reminderDays
        : product.reminderDays,
    messageTemplates:
      data.messageTemplates !== undefined
        ? data.messageTemplates
        : product.messageTemplates,
    active:
      data.active !== undefined
        ? data.active
        : product.active
  };

  if (!merged.name || !merged.name.trim()) {
    throw new AppError("Informe o nome do produto.", 400);
  }

  merged.name = merged.name.trim();

  const payload = normalizeProductData(merged);

  await product.update(payload as any);

  await SyncRenewalProductNotificationsService(
    product,
    companyId
  );

  return product.reload();
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const product = await show(
    id,
    companyId
  );

  await sequelize.transaction(
    async transaction => {
      const subscriptions =
        await RenewalSubscription.findAll({
          where: {
            companyId,
            productId: product.id
          },

          attributes: ["id"],

          transaction,

          lock:
            transaction.LOCK.UPDATE
        });

      for (
        const subscription
        of subscriptions
      ) {
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

      /*
       * Remove qualquer pagamento histórico
       * que ainda esteja referenciando o produto.
       */
      await RenewalPayment.destroy({
        where: {
          companyId,
          productId: product.id
        },

        transaction
      });

      await product.destroy({
        transaction
      });
    }
  );
};
