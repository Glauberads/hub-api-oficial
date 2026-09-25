// src/services/UserServices/UpdateUserService.ts
import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  startWork?: string;
  endWork?: string;
  farewellMessage?: string;
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
  profileImage?: string;
  finalizacaoComValorVendaAtiva?: boolean;
  birthDate?: Date | string;
  allowSeeMessagesInPendingTickets?: string;
  showReturnQueueButton?: string;
  showTransferTicketButton?: string;
  allowAiSuggestions?: string;
  timezone?: string;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId, companyId);

  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === false && userData.companyId !== companyId) {
    throw new AppError("O usuário não pertence à esta empresa");
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    allHistoric: Yup.string(),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
    birthDate: Yup.date()
      .nullable()
      .max(new Date(), "Data de nascimento não pode ser no futuro"),
    allowAiSuggestions: Yup.string()
      .oneOf(
        ["enabled", "disabled"],
        "allowAiSuggestions deve ser 'enabled' ou 'disabled'"
      )
      .nullable(),
    timezone: Yup.string()
  });

  const oldUserEmail = user.email;

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    startWork,
    endWork,
    farewellMessage,
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
    allowConnections,
    defaultTicketsManagerWidth = 550,
    allowRealTime,
    showContacts,
    showCampaign,
    showFlow,
    profileImage,
    finalizacaoComValorVendaAtiva,
    birthDate,
    allowSeeMessagesInPendingTickets,
    showReturnQueueButton,
    showTransferTicketButton,
    allowAiSuggestions,
    timezone
  } = userData;

  try {
    await schema.validate({
      email,
      password,
      profile,
      name,
      birthDate,
      allowAiSuggestions,
      timezone
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let processedBirthDate: Date | null = user.birthDate;

  if (birthDate !== undefined) {
    if (birthDate === null || birthDate === "") {
      processedBirthDate = null;
    } else if (typeof birthDate === "string") {
      const dateOnly = birthDate.split("T")[0];
      processedBirthDate = new Date(dateOnly + "T12:00:00");
    } else if (birthDate instanceof Date) {
      const year = birthDate.getFullYear();
      const month = birthDate.getMonth();
      const day = birthDate.getDate();
      processedBirthDate = new Date(year, month, day, 12, 0, 0);
    }
  }

  await user.update({
    email,
    password,
    profile,
    name,
    startWork,
    endWork,
    farewellMessage,
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
    profileImage,
    allowConnections,
    showContacts,
    showCampaign,
    showFlow,
    finalizacaoComValorVendaAtiva,
    birthDate: processedBirthDate,
    allowSeeMessagesInPendingTickets,
    showReturnQueueButton,
    showTransferTicketButton,
    allowAiSuggestions:
      allowAiSuggestions === "enabled" ? "enabled" : "disabled",
    timezone: timezone || user.timezone || "America/Sao_Paulo"
  });

  await user.$set("queues", queueIds);

  const finalWhatsappIds =
    whatsappIds.length > 0 ? whatsappIds : whatsappId ? [whatsappId] : [];

  await user.$set("whatsapps", finalWhatsappIds);

  await user.reload();

  const company = await Company.findByPk(user.companyId);

  if (company.email === oldUserEmail) {
    await company.update({
      email,
      password
    });
  }

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues,
    whatsapps: user.whatsapps,
    whatsappId: user.whatsappId,
    startWork: user.startWork,
    endWork: user.endWork,
    greetingMessage: user.farewellMessage,
    allTicket: user.allTicket,
    defaultMenu: user.defaultMenu,
    defaultTheme: user.defaultTheme,
    allowGroup: user.allowGroup,
    allHistoric: user.allHistoric,
    userClosePendingTicket: user.userClosePendingTicket,
    showDashboard: user.showDashboard,
    defaultTicketsManagerWidth: user.defaultTicketsManagerWidth,
    allowRealTime: user.allowRealTime,
    allowConnections: user.allowConnections,
    showContacts: user.showContacts,
    showCampaign: user.showCampaign,
    profileImage: user.profileImage,
    showFlow: user.showFlow,
    finalizacaoComValorVendaAtiva: user.finalizacaoComValorVendaAtiva,
    birthDate: user.birthDate,
    allowSeeMessagesInPendingTickets: user.allowSeeMessagesInPendingTickets,
    showReturnQueueButton: user.showReturnQueueButton,
    showTransferTicketButton: user.showTransferTicketButton,
    allowAiSuggestions: user.allowAiSuggestions,
    timezone: user.timezone
  };

  return serializedUser;
};

export default UpdateUserService;