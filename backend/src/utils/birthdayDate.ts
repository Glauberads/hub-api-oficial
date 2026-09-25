import moment, { Moment } from "moment-timezone";

const BIRTHDAY_TIMEZONE = "America/Sao_Paulo";

/** Preserva datas DATEONLY sem deslocá-las para a véspera por conversão UTC. */
export const parseBirthdayDate = (value: Date | string): Moment => {
  const dateOnly = String(value).slice(0, 10);
  const parsed = moment.tz(dateOnly, "YYYY-MM-DD", true, BIRTHDAY_TIMEZONE);

  return parsed.isValid() ? parsed : moment(value).tz(BIRTHDAY_TIMEZONE);
};

export default parseBirthdayDate;
