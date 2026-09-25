import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import User from "../../models/User";
import { zonedTimeToUtc } from "date-fns-tz";

interface Request {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  ticketUserId?: number | string;
  queueId?: number | string;
  openTicket?: string;
  statusTicket?: string;
  whatsappId?: number | string;
  intervalo?: number;
  valorIntervalo?: number;
  enviarQuantasVezes?: number;
  tipoDias?: number;
  contadorEnvio?: number;
  assinar?: boolean;
  reminderDate?: string;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  ticketUserId,
  queueId,
  openTicket,
  statusTicket,
  whatsappId,
  intervalo,
  valorIntervalo,
  enviarQuantasVezes,
  tipoDias,
  assinar,
  contadorEnvio,
  reminderDate
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let userTimezone = "America/Sao_Paulo";

  try {
    if (userId) {
      const user = await User.findByPk(Number(userId), {
        attributes: ["id", "timezone"]
      });

      if (user?.timezone) {
        userTimezone = user.timezone;
      }
    }
  } catch (error) {
    userTimezone = "America/Sao_Paulo";
  }

  let sendAtUtc: Date;
  let reminderDateUtc: Date | null = null;

  try {
    sendAtUtc = zonedTimeToUtc(sendAt, userTimezone);
  } catch (error) {
    sendAtUtc = new Date(sendAt);
  }

  if (reminderDate) {
    try {
      reminderDateUtc = zonedTimeToUtc(reminderDate, userTimezone);
    } catch (error) {
      reminderDateUtc = new Date(reminderDate);
    }
  }

  const schedule = await Schedule.create({
    body,
    sendAt: sendAtUtc,
    contactId,
    companyId,
    userId,
    status: reminderDateUtc ? "AGUARDANDO_LEMBRETE" : "PENDENTE",
    ticketUserId,
    queueId,
    openTicket,
    statusTicket,
    whatsappId,
    intervalo,
    valorIntervalo,
    enviarQuantasVezes,
    tipoDias,
    assinar,
    contadorEnvio,
    reminderDate: reminderDateUtc,
    reminderMessage: null,
    reminderStatus: reminderDateUtc ? "PENDENTE" : null
  });

  await schedule.reload();

  return schedule;
};

export default CreateService;