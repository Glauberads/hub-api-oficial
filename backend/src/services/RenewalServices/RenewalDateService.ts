import AppError from "../../errors/AppError";
import {
  RenewalDueRule,
  RenewalFrom
} from "../../models/RenewalProduct";

interface RenewalRule {
  dueRule: RenewalDueRule;
  runningDays?: number | null;
  fixedDay?: number | null;
  renewFrom?: RenewalFrom;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const parseDateOnly = (value: string): Date => {
  if (!DATE_ONLY_REGEX.test(String(value || ""))) {
    throw new AppError("Data inválida. Use o formato YYYY-MM-DD.", 400);
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError("Data de vencimento inválida.", 400);
  }

  return date;
};

export const formatDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getLastDayOfMonth = (
  year: number,
  monthIndex: number
): number => {
  return new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();
};

export const buildFixedDayDate = (
  year: number,
  monthIndex: number,
  fixedDay: number
): Date => {
  if (
    !Number.isInteger(fixedDay) ||
    fixedDay < 1 ||
    fixedDay > 31
  ) {
    throw new AppError(
      "O dia fixo deve estar entre 1 e 31.",
      400
    );
  }

  const lastDay = getLastDayOfMonth(
    year,
    monthIndex
  );

  const effectiveDay = Math.min(
    fixedDay,
    lastDay
  );

  return new Date(
    Date.UTC(
      year,
      monthIndex,
      effectiveDay
    )
  );
};

export const addRunningDays = (
  dateOnly: string,
  days: number
): string => {
  if (!Number.isInteger(days) || days <= 0) {
    throw new AppError(
      "Quantidade de dias corridos inválida.",
      400
    );
  }

  const date = parseDateOnly(dateOnly);

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return formatDateOnly(date);
};

const nextFixedDayFromDueDate = (
  currentDueDate: string,
  fixedDay: number
): string => {
  const current = parseDateOnly(
    currentDueDate
  );

  let year = current.getUTCFullYear();
  let month = current.getUTCMonth() + 1;

  if (month > 11) {
    month = 0;
    year += 1;
  }

  return formatDateOnly(
    buildFixedDayDate(
      year,
      month,
      fixedDay
    )
  );
};

const nextFixedDayFromPaymentDate = (
  paymentDate: string,
  fixedDay: number
): string => {
  const paid = parseDateOnly(paymentDate);

  let year = paid.getUTCFullYear();
  let month = paid.getUTCMonth();

  let candidate = buildFixedDayDate(
    year,
    month,
    fixedDay
  );

  /*
   * Se o vencimento calculado neste mês já passou
   * ou é hoje, avançamos para o mês seguinte.
   */
  if (candidate.getTime() <= paid.getTime()) {
    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }

    candidate = buildFixedDayDate(
      year,
      month,
      fixedDay
    );
  }

  return formatDateOnly(candidate);
};

export const calculateNextDueDate = (
  rule: RenewalRule,
  currentDueDate: string,
  paymentDate?: string
): string => {
  parseDateOnly(currentDueDate);

  const renewFrom =
    rule.renewFrom || "due_date";

  if (rule.dueRule === "running_days") {
    const runningDays = Number(
      rule.runningDays
    );

    const baseDate =
      renewFrom === "payment_date"
        ? paymentDate
        : currentDueDate;

    if (!baseDate) {
      throw new AppError(
        "Data do pagamento não informada.",
        400
      );
    }

    return addRunningDays(
      baseDate,
      runningDays
    );
  }

  if (rule.dueRule === "fixed_day") {
    const fixedDay = Number(
      rule.fixedDay
    );

    if (
      !Number.isInteger(fixedDay) ||
      fixedDay < 1 ||
      fixedDay > 31
    ) {
      throw new AppError(
        "Dia fixo do produto inválido.",
        400
      );
    }

    /*
     * Produtos com dia fixo mantêm o calendário.
     *
     * O pagamento quita o ciclo atual e o próximo
     * vencimento é sempre o mês seguinte ao vencimento
     * atual, independentemente da data do pagamento.
     */
    return nextFixedDayFromDueDate(
      currentDueDate,
      fixedDay
    );
  }

  throw new AppError(
    "Regra de vencimento inválida.",
    400
  );
};
