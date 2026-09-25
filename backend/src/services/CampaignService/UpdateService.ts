import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import ContactList from "../../models/ContactList";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { zonedTimeToUtc } from "date-fns-tz";

interface Data {
  id: number | string;
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId?: number;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  message5?: string;
  interactiveButtons?: Array<{
    type: "quick_reply" | "cta_url" | "cta_copy" | "cta_call";
    text: string;
    id?: string;
    url?: string;
    copyCode?: string;
    phoneNumber?: string;
  }>;
  confirmationMessage1?: string;
  confirmationMessage2?: string;
  confirmationMessage3?: string;
  confirmationMessage4?: string;
  confirmationMessage5?: string;
  userId?: number | string;
  queueId?: number | string;
  whatsappId?: number | null;
  statusTicket: string;
  openTicket: string;
  isRecurring?: boolean;
  recurrenceType?: string;
  recurrenceInterval?: number;
  recurrenceDaysOfWeek?: string;
  recurrenceDayOfMonth?: number;
  recurrenceEndDate?: string;
  maxExecutions?: number;
  campaignType?: string;
  emailSubject?: string;
  emailHtml?: string;
  emailFromName?: string;
  emailFromAddress?: string;
  emailTotal?: number;
  emailSent?: number;
  emailFailed?: number;
  emailOpened?: number;
  emailClicked?: number;
  emailBounced?: number;
  emailUnsubscribed?: number;
  emailRatePerMinute?: number;
  emailDailyLimit?: number;
  emailContinueHour?: string;
  emailProvider?: string;
}

const UpdateService = async (data: Data): Promise<Campaign> => {
  const { id } = data;

  const record = await Campaign.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  const statusToValidate = data.status || record.status;

  if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(statusToValidate) === -1) {
    throw new AppError(
      "Só é permitido alterar campanha Inativa e Programada",
      400
    );
  }

  const updateData: any = { ...data };

  if (!updateData.status) {
    updateData.status = record.status;
  }

  if (
    updateData.scheduledAt != null &&
    updateData.scheduledAt !== "" &&
    updateData.status === "INATIVA"
  ) {
    updateData.status = "PROGRAMADA";
  }

  if (updateData.scheduledAt != null && updateData.scheduledAt !== "") {
    try {
      let userTimezone = "America/Sao_Paulo";

      if (updateData.userId) {
        const user = await User.findByPk(Number(updateData.userId), {
          attributes: ["id", "timezone"]
        });

        if (user?.timezone) {
          userTimezone = user.timezone;
        }
      }

      updateData.scheduledAt = zonedTimeToUtc(
        updateData.scheduledAt,
        userTimezone
      );
    } catch (error) {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
    }
  }

  if (updateData.campaignType === "email" || record.campaignType === "email") {
    updateData.emailRatePerMinute = Number(updateData.emailRatePerMinute);
    updateData.emailDailyLimit = Number(updateData.emailDailyLimit);
    updateData.emailContinueHour = updateData.emailContinueHour;
  }

  await record.update(updateData);

  await record.reload({
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name", "color"] },
      { model: User, attributes: ["id", "name"] },
      { model: Queue, attributes: ["id", "name", "color"] },
    ]
  });

  return record;
};

export default UpdateService;
