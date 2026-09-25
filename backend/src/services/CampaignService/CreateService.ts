import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Queue from "../../models/Queue";
import { zonedTimeToUtc } from "date-fns-tz";

interface Data {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;

  contactListId?: number | null;
  tagListId?: number | string | null;

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

  userId?: number | string | null;
  queueId?: number | string | null;

  statusTicket: string;
  openTicket: string;
  whatsappId?: number | null;

  isRecurring?: boolean;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDaysOfWeek?: string | null;
  recurrenceDayOfMonth?: number | null;
  recurrenceEndDate?: string | null;
  maxExecutions?: number | null;

  templateId?: number | null;
  templateVariables?: string | null;

  // Campos de email
  campaignType?: string;
  emailSubject?: string | null;
  emailHtml?: string | null;
  emailHtml2?: string | null;
  emailHtml3?: string | null;
  emailHtml4?: string | null;
  emailHtml5?: string | null;
  emailFromName?: string | null;
  emailFromAddress?: string | null;

  emailTotal?: number;
  emailSent?: number;
  emailFailed?: number;
  emailOpened?: number;
  emailClicked?: number;
  emailBounced?: number;
  emailUnsubscribed?: number;

  emailRatePerMinute?: number | null;
  emailDailyLimit?: number | null;
  emailContinueHour?: string | null;
  emailProvider?: string | null;
}

const CreateService = async (data: Data): Promise<Campaign> => {
  const { name } = data;

  const ticketnoteSchema = Yup.object().shape({
    name: Yup.string()
      .min(3, "ERR_CAMPAIGN_INVALID_NAME")
      .required("ERR_CAMPAIGN_REQUIRED")
  });

  try {
    await ticketnoteSchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const createData: any = { ...data };

  const campaignType = String(createData.campaignType || "whatsapp")
    .trim()
    .toLowerCase();

  createData.campaignType = campaignType;

  if (createData.scheduledAt != null && createData.scheduledAt !== "") {
    createData.status = "PROGRAMADA";

    try {
      let userTimezone = "America/Sao_Paulo";

      if (createData.userId) {
        const user = await User.findByPk(Number(createData.userId), {
          attributes: ["id", "timezone"]
        });

        if (user?.timezone) {
          userTimezone = user.timezone;
        }
      }

      createData.scheduledAt = zonedTimeToUtc(
        createData.scheduledAt,
        userTimezone
      );
    } catch (error) {
      createData.scheduledAt = new Date(createData.scheduledAt);
    }
  }

  if (campaignType === "email") {
    createData.emailTotal = createData.emailTotal || 0;
    createData.emailSent = createData.emailSent || 0;
    createData.emailFailed = createData.emailFailed || 0;
    createData.emailOpened = createData.emailOpened || 0;
    createData.emailClicked = createData.emailClicked || 0;
    createData.emailBounced = createData.emailBounced || 0;
    createData.emailUnsubscribed = createData.emailUnsubscribed || 0;

    createData.emailRatePerMinute = Number(createData.emailRatePerMinute);
    createData.emailDailyLimit = Number(createData.emailDailyLimit);
    createData.emailContinueHour = createData.emailContinueHour || "08:00";

    if (
      !Number.isFinite(createData.emailRatePerMinute) ||
      createData.emailRatePerMinute < 1
    ) {
      throw new AppError("Informe uma quantidade válida de emails por minuto.", 400);
    }

    if (
      !Number.isFinite(createData.emailDailyLimit) ||
      createData.emailDailyLimit < 1
    ) {
      throw new AppError("Informe um limite diário válido de emails.", 400);
    }

    if (!createData.emailContinueHour) {
      throw new AppError("Informe o horário para continuar os envios.", 400);
    }

    const normalizedEmailProvider = String(createData.emailProvider || "")
      .trim()
      .toLowerCase();

    if (!["sendgrid", "smtp"].includes(normalizedEmailProvider)) {
      throw new AppError("Selecione um provedor de email válido.", 400);
    }

    createData.emailProvider = normalizedEmailProvider;
  } else {
    createData.emailProvider = null;

    createData.emailSubject = null;
    createData.emailHtml = null;
    createData.emailHtml2 = null;
    createData.emailHtml3 = null;
    createData.emailHtml4 = null;
    createData.emailHtml5 = null;
    createData.emailFromName = null;
    createData.emailFromAddress = null;

    // Mantém valores padrão porque essas colunas podem estar como NOT NULL no banco
    createData.emailRatePerMinute =
      Number(createData.emailRatePerMinute) > 0
        ? Number(createData.emailRatePerMinute)
        : 5;

    createData.emailDailyLimit =
      Number(createData.emailDailyLimit) > 0
        ? Number(createData.emailDailyLimit)
        : 99;

    createData.emailContinueHour = createData.emailContinueHour || "08:00";

    createData.emailTotal = 0;
    createData.emailSent = 0;
    createData.emailFailed = 0;
    createData.emailOpened = 0;
    createData.emailClicked = 0;
    createData.emailBounced = 0;
    createData.emailUnsubscribed = 0;
  }

  const record = await Campaign.create(createData);

  await record.reload({
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name", "color"] },
      { model: User, attributes: ["id", "name"] },
      { model: Queue, attributes: ["id", "name", "color"] }
    ]
  });

  return record;
};

export default CreateService;
