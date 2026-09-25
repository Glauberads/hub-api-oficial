import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import sequelize from "../../database";
import CompaniesSettings from "../../models/CompaniesSettings";
import axios from "axios";
import Invoice from "../../models/Invoices";
import Plan from "../../models/Plan";
import logger from "../../utils/logger";
import { SendMail } from "../../helpers/SendMail";
import EnsureDefaultCompanySettingsService from "./EnsureDefaultCompanySettingsService";

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
  password?: string;
  companyUserName?: string;
  generateInvoice?: boolean;
}

const validateCnpjWithReceita = async (cnpj: string): Promise<boolean> => {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, "");

    const response = await axios.get(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
    const data = response.data;

    if (data.status === "ERROR") {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao validar CNPJ:", error);
    return false;
  }
};

const generateEmailVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const CreateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const {
    name,
    phone,
    password,
    email,
    status,
    planId,
    dueDate,
    recurrence,
    document,
    paymentMethod,
    companyUserName,
    generateInvoice
  } = companyData;

  const companySchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_COMPANY_INVALID_NAME")
      .required("ERR_COMPANY_INVALID_NAME")
  });

  try {
    await companySchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (document && document.trim() !== "") {
    const cleanDoc = document.replace(/\D/g, "");

    if (cleanDoc.length === 14) {
      const isCnpjValid = await validateCnpjWithReceita(document);
      if (!isCnpjValid) {
        throw new AppError("CNPJ inválido ou não encontrado na Receita Federal", 400);
      }
    }
  }

  const t = await sequelize.transaction();
  let company: Company;
  let createdUser: User | null = null;
  const emailVerificationCode = generateEmailVerificationCode();
  const emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const emailVerificationSentAt = new Date();

  try {
    company = await Company.create(
      {
        name,
        phone,
        email,
        status,
        planId,
        dueDate,
        recurrence,
        document: document ? document.replace(/\D/g, "") : "",
        paymentMethod,
        generateInvoice
      },
      { transaction: t }
    );

    createdUser = await User.create(
      {
        name: companyUserName ? companyUserName : name,
        email: company.email,
        password: password ? password : "mudar123",
        profile: "admin",
        companyId: company.id,
        emailVerified: false,
        emailVerificationCode,
        emailVerificationExpiresAt,
        emailVerificationSentAt
      },
      { transaction: t }
    );

    await CompaniesSettings.create(
      {
        companyId: company.id,
        hoursCloseTicketsAuto: "9999999999",
        chatBotType: "text",
        acceptCallWhatsapp: "enabled",
        userRandom: "enabled",
        sendGreetingMessageOneQueues: "enabled",
        sendSignMessage: "enabled",
        sendFarewellWaitingTicket: "disabled",
        userRating: "disabled",
        sendGreetingAccepted: "enabled",
        CheckMsgIsGroup: "enabled",
        sendQueuePosition: "disabled",
        scheduleType: "disabled",
        acceptAudioMessageContact: "enabled",
        sendMsgTransfTicket: "disabled",
        enableLGPD: "disabled",
        requiredTag: "disabled",
        lgpdDeleteMessage: "disabled",
        lgpdHideNumber: "disabled",
        lgpdConsent: "disabled",
        lgpdLink: "",
        lgpdMessage: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        closeTicketOnTransfer: false,
        DirectTicketsToWallets: false
      },
      { transaction: t }
    );

    await EnsureDefaultCompanySettingsService({
      companyId: company.id,
      transaction: t
    });

    if (generateInvoice !== false) {
      const plan = planId ? await Plan.findByPk(planId, { transaction: t }) : null;
      const planData: any = plan ? (plan.toJSON ? plan.toJSON() : plan) : {};

      const invoiceDueDate = company.dueDate
        ? new Date(company.dueDate as any).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      await Invoice.create(
        {
          companyId: company.id,
          dueDate: invoiceDueDate,
          detail: planData?.name ? `Fatura inicial - ${planData.name}` : "Fatura inicial",
          status: "open",
          value: Number(planData?.amount ?? planData?.value ?? planData?.price ?? 0),
          currency: String(planData?.currency || "BRL"),
          users: Number(planData?.users ?? planData?.maxUsers ?? 0),
          connections: Number(planData?.connections ?? planData?.maxConnections ?? 0),
          queues: Number(planData?.queues ?? planData?.maxQueues ?? 0),
          useWhatsapp: Boolean(planData?.useWhatsapp),
          useFacebook: Boolean(planData?.useFacebook),
          useInstagram: Boolean(planData?.useInstagram),
          useCampaigns: Boolean(planData?.useCampaigns),
          useSchedules: Boolean(planData?.useSchedules),
          useInternalChat: Boolean(planData?.useInternalChat),
          useExternalApi: Boolean(planData?.useExternalApi),
          linkInvoice: ""
        },
        { transaction: t }
      );

      logger.info(`[COMPANY] Fatura inicial criada imediatamente para company ${company.id}`);
    }

    await t.commit();

    if (createdUser?.email) {
      try {
        await SendMail({
          to: createdUser.email,
          subject: `Código de confirmação de cadastro - ${company.name}`,
          text: `Olá ${createdUser.name}, este é seu código de confirmação de cadastro:<br><br><strong style="font-size:24px; letter-spacing:4px;">${emailVerificationCode}</strong><br><br>Esse código expira em 10 minutos.`
        });
      } catch (error) {
        logger.warn(`[COMPANY] Não foi possível enviar o código de confirmação por e-mail para a company ${company.id}`);
      }
    }

    return company;
  } catch (error) {
    await t.rollback();
    throw new AppError("Não foi possível criar a empresa!", error);
  }
};

export default CreateCompanyService;
