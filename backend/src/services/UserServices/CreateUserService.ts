import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import SendVerificationCodeEmailService from "./SendVerificationCodeEmailService";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profile?: string;
  startWork?: string;
  endWork?: string;
  whatsappId?: number;
  whatsappIds?: number[];
  allTicket?: string;
  defaultTheme?: string;
  defaultMenu?: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  defaultTicketsManagerWidth?: number;
  allowRealTime?: string;
  allowConnections?: string;
  showContacts?: string;
  showCampaign?: string;
  showFlow?: string;
  finalizacaoComValorVendaAtiva?: boolean;
  birthDate?: Date | string;
  allowSeeMessagesInPendingTickets?: string;
  showReturnQueueButton?: string;
  showTransferTicketButton?: string;
  allowAiSuggestions?: string;
  timezone?: string;
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const generateEmailVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "admin",
  startWork,
  endWork,
  whatsappId,
  whatsappIds = [],
  allTicket,
  defaultTheme,
  defaultMenu,
  allowGroup,
  allHistoric,
  allUserChat,
  userClosePendingTicket,
  showDashboard,
  defaultTicketsManagerWidth = 550,
  allowRealTime,
  allowConnections,
  showContacts,
  showCampaign,
  showFlow,
  finalizacaoComValorVendaAtiva,
  birthDate,
  allowSeeMessagesInPendingTickets = "enabled",
  showReturnQueueButton = "enabled",
  showTransferTicketButton = "enabled",
  allowAiSuggestions = "disabled",
  timezone = "America/Sao_Paulo"
}: Request): Promise<Response> => {
  if (companyId !== undefined) {
    const company = await Company.findOne({
      where: {
        id: companyId
      },
      include: [{ model: Plan, as: "plan" }]
    });

    if (company !== null) {
      const usersCount = await User.count({
        where: {
          companyId
        }
      });

      if (usersCount >= company.plan.users) {
        throw new AppError(
          `Número máximo de usuários já alcançado: ${usersCount}`
        );
      }
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    allHistoric: Yup.string(),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5),
    birthDate: Yup.date()
      .nullable()
      .max(new Date(), "Data de nascimento não pode ser no futuro"),
    allowSeeMessagesInPendingTickets: Yup.string()
      .oneOf(
        ["enabled", "disabled"],
        "allowSeeMessagesInPendingTickets deve ser 'enabled' ou 'disabled'"
      )
      .default("enabled"),
    allowAiSuggestions: Yup.string()
      .oneOf(
        ["enabled", "disabled"],
        "allowAiSuggestions deve ser 'enabled' ou 'disabled'"
      )
      .default("disabled"),
    timezone: Yup.string().required()
  });

  try {
    await schema.validate({
      email,
      password,
      name,
      birthDate,
      allowSeeMessagesInPendingTickets,
      allowAiSuggestions,
      timezone
    });
  } catch (err) {
    throw new AppError(err.message);
  }

  let processedBirthDate: Date | null = null;
  if (birthDate) {
    if (typeof birthDate === "string") {
      const dateOnly = birthDate.split("T")[0];
      processedBirthDate = new Date(dateOnly + "T12:00:00");
    } else if (birthDate instanceof Date) {
      const year = birthDate.getFullYear();
      const month = birthDate.getMonth();
      const day = birthDate.getDate();
      processedBirthDate = new Date(year, month, day, 12, 0, 0);
    }
  }

  const emailVerificationCode = generateEmailVerificationCode();
  const emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const emailVerificationSentAt = new Date();

  const user = await User.create(
    {
      email,
      password,
      name,
      companyId,
      profile,
      startWork,
      endWork,
      whatsappId: whatsappId || null,
      allTicket,
      defaultTheme,
      defaultMenu,
      allowGroup,
      allHistoric,
      allUserChat,
      userClosePendingTicket,
      showDashboard,
      defaultTicketsManagerWidth,
      allowRealTime,
      allowConnections,
      showContacts,
      showCampaign,
      showFlow,
      finalizacaoComValorVendaAtiva,
      birthDate: processedBirthDate,
      allowSeeMessagesInPendingTickets,
      showReturnQueueButton,
      showTransferTicketButton,
      allowAiSuggestions,
      timezone: timezone || "America/Sao_Paulo",
      emailVerified: false,
      emailVerificationCode,
      emailVerificationExpiresAt,
      emailVerificationSentAt
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);

  const finalWhatsappIds =
    whatsappIds.length > 0 ? whatsappIds : whatsappId ? [whatsappId] : [];

  if (finalWhatsappIds.length > 0) {
    await user.$set("whatsapps", finalWhatsappIds);
  }

  await user.reload();

  try {
    if (!user.companyId) {
      throw new AppError(
        "Empresa do usuário não informada para envio do código de confirmação."
      );
    }

    await SendVerificationCodeEmailService({
      email: user.email,
      name: user.name,
      code: emailVerificationCode,
      companyId: user.companyId
    });
  } catch (err) {
    await user.destroy();
    throw new AppError(
      err.message ||
        "Não foi possível enviar o código de confirmação para o e-mail informado."
    );
  }

  const serializedUser = SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;