import { Transaction } from "sequelize";
import moment from "moment-timezone";

import RenewalNotification from "../../models/RenewalNotification";
import RenewalProduct from "../../models/RenewalProduct";
import RenewalCustomer from "../../models/RenewalCustomer";

import {
  parseDateOnly,
  formatDateOnly
} from "./RenewalDateService";

interface BuildCycleParams {
  companyId: number;
  subscriptionId: number;
  whatsappId?: number | null;
  dueDate: string;
  product: RenewalProduct;
  customer: RenewalCustomer;
  paymentDate?: string;
  minimumDate?: string;
  transaction?: Transaction;
}

const formatBR = (dateOnly: string): string => {
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
};

const formatMoney = (value: any): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number);
};

const replaceVariables = (
  template: string,
  customer: RenewalCustomer,
  product: RenewalProduct,
  dueDate: string
): string => {
  return template
    .replace(/\{\{nome\}\}/g, customer.name || "")
    .replace(/\{\{produto\}\}/g, product.name || "")
    .replace(/\{\{valor\}\}/g, formatMoney(product.amount))
    .replace(/\{\{vencimento\}\}/g, formatBR(dueDate));
};

const defaultTemplate = (
  offsetDays: number
): string => {
  if (offsetDays > 1) {
    return `Olá, {{nome}}! 😊

Seu {{produto}} vence em ${offsetDays} dias, no dia {{vencimento}}.

Valor para renovação: {{valor}}.

Para evitar interrupções, faça sua renovação até o vencimento.`;
  }

  if (offsetDays === 1) {
    return `Olá, {{nome}}! 😊

Seu {{produto}} vence amanhã, dia {{vencimento}}.

Valor para renovação: {{valor}}.

Não esqueça de realizar sua renovação.`;
  }

  if (offsetDays === 0) {
    return `Olá, {{nome}}! 😊

Seu {{produto}} vence hoje, {{vencimento}}.

Valor para renovação: {{valor}}.

Realize sua renovação para continuar utilizando o serviço.`;
  }

  if (offsetDays === -1) {
    return `Olá, {{nome}}!

Seu {{produto}} venceu ontem, em {{vencimento}}.

Valor para renovação: {{valor}}.

Faça sua renovação para regularizar o serviço.`;
  }

  return `Olá, {{nome}}!

Seu {{produto}} está vencido desde {{vencimento}}.

Valor para renovação: {{valor}}.`;
};

const getTemplate = (
  product: RenewalProduct,
  offsetDays: number
): string => {
  const templates: any =
    product.messageTemplates || {};

  const custom =
    templates[String(offsetDays)];

  return custom || defaultTemplate(offsetDays);
};

const calculateNotificationDate = (
  dueDate: string,
  offsetDays: number
): string => {
  const date = parseDateOnly(dueDate);

  /*
   * 3  => vencimento - 3 dias
   * 0  => vencimento
   * -1 => vencimento + 1 dia
   */
  date.setUTCDate(
    date.getUTCDate() - offsetDays
  );

  return formatDateOnly(date);
};

const buildScheduledAt = (
  dateOnly: string,
  reminderTime: string = "09:00"
): Date => {
  const normalizedTime =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(
      String(reminderTime || "")
    )
      ? reminderTime
      : "09:00";

  return moment
    .tz(
      `${dateOnly} ${normalizedTime}`,
      "YYYY-MM-DD HH:mm",
      "America/Sao_Paulo"
    )
    .utc()
    .toDate();
};

export const buildCycleNotifications = async ({
  companyId,
  subscriptionId,
  whatsappId,
  dueDate,
  product,
  customer,
  paymentDate,
  minimumDate,
  transaction
}: BuildCycleParams): Promise<number> => {
  const reminderDays =
    Array.isArray(product.reminderDays)
      ? product.reminderDays
      : [3, 2, 1, 0, -1];

  const rows: any[] = [];

  for (const rawOffset of reminderDays) {
    const offsetDays = Number(rawOffset);

    if (!Number.isInteger(offsetDays)) {
      continue;
    }

    const notificationDate =
      calculateNotificationDate(
        dueDate,
        offsetDays
      );

    /*
     * Ao renovar atrasado, não vamos criar cobranças
     * cujo dia já passou ou seja o próprio dia do pagamento.
     */
    if (
      minimumDate &&
      notificationDate < minimumDate
    ) {
      continue;
    }

    if (
      paymentDate &&
      notificationDate <= paymentDate
    ) {
      continue;
    }

    const template =
      getTemplate(
        product,
        offsetDays
      );

    rows.push({
      companyId,
      subscriptionId,
      whatsappId: whatsappId || null,

      cycleDueDate: dueDate,

      offsetDays,

      scheduledAt:
        buildScheduledAt(
          notificationDate,
          product.reminderTime || "09:00"
        ),

      status: "pending",

      body: replaceVariables(
        template,
        customer,
        product,
        dueDate
      ),

      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  if (!rows.length) {
    return 0;
  }

  await RenewalNotification.bulkCreate(
    rows,
    {
      transaction,
      ignoreDuplicates: true
    }
  );

  return rows.length;
};


export const buildThankYouMessage = (
  customer: RenewalCustomer,
  product: RenewalProduct,
  nextDueDate: string
): string => {
  const templates: any =
    product.messageTemplates || {};

  const template =
    templates.paymentConfirmation ||
    `Olá, {{nome}}! 😊

Pagamento confirmado com sucesso!

✅ Produto: {{produto}}
📅 Próximo vencimento: {{proximoVencimento}}

Muito obrigado pela preferência!`;

  return template
    .replace(/\{\{nome\}\}/g, customer.name || "")
    .replace(/\{\{produto\}\}/g, product.name || "")
    .replace(/\{\{valor\}\}/g, formatMoney(product.amount))
    .replace(
      /\{\{proximoVencimento\}\}/g,
      formatBR(nextDueDate)
    );
};
