import RenewalNotification from "../../models/RenewalNotification";
import RenewalPayment from "../../models/RenewalPayment";
import RenewalSubscription from "../../models/RenewalSubscription";
import sequelize from "../../database";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import RenewalCustomer from "../../models/RenewalCustomer";

interface CustomerData {
  name?: string;
  phone?: string;
  notes?: string | null;
  active?: boolean;
}

const normalizePhone = (phone: string): string => {
  return String(phone || "").replace(/\D/g, "");
};

export const list = async (
  companyId: number,
  searchParam?: string,
  active?: string
): Promise<RenewalCustomer[]> => {
  const where: any = {
    companyId
  };

  if (active === "true") {
    where.active = true;
  }

  if (active === "false") {
    where.active = false;
  }

  if (searchParam && searchParam.trim()) {
    const search = searchParam.trim();
    const digits = normalizePhone(search);

    where[Op.or] = [
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

  return RenewalCustomer.findAll({
    where,
    order: [["name", "ASC"]]
  });
};

export const show = async (
  id: string | number,
  companyId: number
): Promise<RenewalCustomer> => {
  const customer = await RenewalCustomer.findOne({
    where: {
      id: Number(id),
      companyId
    }
  });

  if (!customer) {
    throw new AppError("Cliente não encontrado.", 404);
  }

  return customer;
};

export const create = async (
  data: CustomerData,
  companyId: number
): Promise<RenewalCustomer> => {
  const name = String(data.name || "").trim();
  const phone = normalizePhone(data.phone || "");

  if (!name) {
    throw new AppError("Informe o nome do cliente.", 400);
  }

  if (phone.length < 8) {
    throw new AppError("Informe um telefone válido.", 400);
  }

  const exists = await RenewalCustomer.findOne({
    where: {
      companyId,
      phone
    }
  });

  if (exists) {
    throw new AppError(
      "Já existe um cliente de renovação com este telefone.",
      400
    );
  }

  return RenewalCustomer.create({
    companyId,
    name,
    phone,
    notes: data.notes || null,
    active: data.active !== false
  } as any);
};

export const update = async (
  id: string | number,
  data: CustomerData,
  companyId: number
): Promise<RenewalCustomer> => {
  const customer = await show(id, companyId);

  const name =
    data.name !== undefined
      ? String(data.name).trim()
      : customer.name;

  const phone =
    data.phone !== undefined
      ? normalizePhone(data.phone)
      : customer.phone;

  if (!name) {
    throw new AppError("Informe o nome do cliente.", 400);
  }

  if (phone.length < 8) {
    throw new AppError("Informe um telefone válido.", 400);
  }

  const duplicate = await RenewalCustomer.findOne({
    where: {
      companyId,
      phone,
      id: {
        [Op.ne]: customer.id
      }
    }
  });

  if (duplicate) {
    throw new AppError(
      "Já existe outro cliente com este telefone.",
      400
    );
  }

  await customer.update({
    name,
    phone,
    notes:
      data.notes !== undefined
        ? data.notes
        : customer.notes,
    active:
      data.active !== undefined
        ? data.active
        : customer.active
  });

  return customer.reload();
};

export const remove = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const customer = await show(
    id,
    companyId
  );

  await sequelize.transaction(
    async transaction => {
      /*
       * Primeiro encontramos todas as assinaturas
       * pertencentes ao cliente.
       */
      const subscriptions =
        await RenewalSubscription.findAll({
          where: {
            companyId,
            customerId: customer.id
          },

          attributes: ["id"],

          transaction,

          lock:
            transaction.LOCK.UPDATE
        });

      /*
       * Excluímos filhos explicitamente para não
       * depender da ordem dos CASCADE/RESTRICT.
       */
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
       * Segurança para eventual pagamento antigo
       * ainda ligado diretamente ao cliente.
       */
      await RenewalPayment.destroy({
        where: {
          companyId,
          customerId: customer.id
        },

        transaction
      });

      await customer.destroy({
        transaction
      });
    }
  );
};
