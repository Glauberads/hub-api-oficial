import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { head } from "lodash";
import fs from "fs";
import path from "path";

import ListService from "../services/CampaignService/ListService";
import CreateService from "../services/CampaignService/CreateService";
import ShowService from "../services/CampaignService/ShowService";
import UpdateService from "../services/CampaignService/UpdateService";
import DeleteService from "../services/CampaignService/DeleteService";
import FindService from "../services/CampaignService/FindService";
import ShippingService from "../services/CampaignService/ShippingService";
import CampaignStatsService from "../services/CampaignService/CampaignStatsService";

import Campaign from "../models/Campaign";

import ContactTag from "../models/ContactTag";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";

import AppError from "../errors/AppError";
import { CancelService } from "../services/CampaignService/CancelService";
import { RestartService } from "../services/CampaignService/RestartService";
import RecurrenceService from "../services/CampaignService/RecurrenceService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  pageSize?: string;
  companyId: string | number;
  status?: string;
  isRecurring?: string;
};

// src/controllers/CampaignController.ts - Type StoreData completo

type StoreData = {
  name: string;
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
  status?: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId?: number | null;
  tagListId?: number | string | null;
  userId?: number | string | null;
  queueId?: number | string | null;
  whatsappId: number;
  statusTicket: string;
  openTicket: string;
  templateId?: number | null;
  templateVariables?: string | null;
  // Novos campos de recorrência
  isRecurring?: boolean;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDaysOfWeek?: number[] | string | null; // Aceita array do frontend ou string do banco
  recurrenceDayOfMonth?: number | null;
  recurrenceEndDate?: string | null;
  maxExecutions?: number | null;
  executionCount?: number;
  nextScheduledAt?: Date | null;
  lastExecutedAt?: Date | null;
  // Novos campos de email
  campaignType?: string;
  emailSubject?: string | null;
  emailHtml?: string | null;
  emailHtml2?: string | null;
  emailHtml3?: string | null;
  emailHtml4?: string | null;
  emailHtml5?: string | null;
  emailFromName?: string | null;
  emailFromAddress?: string | null;
  emailRatePerMinute?: number | null;
  emailDailyLimit?: number | null;
  emailContinueHour?: string | null;
  emailProvider?: string | null;
};

type FindParams = {
  companyId: string;
};

// 1. Função normalizeEmailProvider alterada
const normalizeEmailProvider = (
  campaignType?: string,
  emailProvider?: string | null
): string | null => {
  const type = String(campaignType || "whatsapp")
    .trim()
    .toLowerCase();

  if (type !== "email") {
    return null;
  }

  const provider = String(emailProvider || "")
    .trim()
    .toLowerCase();

  if (provider === "sendgrid" || provider === "smtp") {
    return provider;
  }

  throw new AppError("Selecione um provedor de email válido.", 400);
};

// 2. Helper emailProviderSchema
const emailProviderSchema = Yup.string()
  .nullable()
  .transform((value, originalValue) => {
    if (
      originalValue === "" ||
      originalValue === null ||
      originalValue === undefined
    ) {
      return null;
    }

    return String(originalValue).trim().toLowerCase();
  })
  .test(
    "email-provider-by-campaign-type",
    "emailProvider must be one of the following values: sendgrid, smtp",
    function (value) {
      const campaignType = String(this.parent?.campaignType || "whatsapp")
        .trim()
        .toLowerCase();

      if (campaignType !== "email") {
        return true;
      }

      return value === "sendgrid" || value === "smtp";
    }
  );

const normalizeInteractiveButtons = (
  value: StoreData["interactiveButtons"],
  campaignType: string
) => {
  if (campaignType !== "whatsapp" || !Array.isArray(value)) return [];

  const allowedTypes = new Set(["quick_reply", "cta_url", "cta_copy", "cta_call"]);
  const buttons = value
    .map((button, index) => ({
      type: String(button?.type || "quick_reply").trim().toLowerCase(),
      text: String(button?.text || "").trim(),
      id: String(button?.id || `campaign_button_${index + 1}`).trim(),
      url: String(button?.url || "").trim(),
      copyCode: String(button?.copyCode || "").trim(),
      phoneNumber: String(button?.phoneNumber || "").trim()
    }))
    .filter(button => button.text)
    .slice(0, 5);

  for (const button of buttons) {
    if (!allowedTypes.has(button.type)) {
      throw new AppError(`Tipo de botão inválido: ${button.type}`, 400);
    }
    if (button.text.length > 25) {
      throw new AppError("O texto de cada botão deve ter no máximo 25 caracteres.", 400);
    }
    if (button.type === "cta_url") {
      try {
        const parsedUrl = new URL(button.url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        throw new AppError(`Informe uma URL válida para o botão "${button.text}".`, 400);
      }
    }
    if (button.type === "cta_copy" && !button.copyCode) {
      throw new AppError(`Informe o código do botão "${button.text}".`, 400);
    }
    if (button.type === "cta_call" && !/^\+?[0-9]{8,15}$/.test(button.phoneNumber)) {
      throw new AppError(`Informe um telefone válido para o botão "${button.text}".`, 400);
    }
  }

  return buttons.map(button => ({
    type: button.type,
    text: button.text,
    ...(button.type === "quick_reply" ? { id: button.id.slice(0, 200) } : {}),
    ...(button.type === "cta_url" ? { url: button.url } : {}),
    ...(button.type === "cta_copy" ? { copyCode: button.copyCode.slice(0, 500) } : {}),
    ...(button.type === "cta_call" ? { phoneNumber: button.phoneNumber } : {})
  }));
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, pageSize, status, isRecurring } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore, totalPages, currentPage, pageSize: limit } = await ListService({
    searchParam,
    pageNumber,
    pageSize,
    companyId,
    status,
    isRecurring
  });

  return res.json({ records, count, hasMore, totalPages, currentPage, pageSize: limit });
};

// src/controllers/CampaignController.ts - Store method completo

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    confirmation: Yup.boolean().required(),
    scheduledAt: Yup.string().required(),
    contactListId: Yup.number().nullable(),
    tagListId: Yup.string().nullable(),
    whatsappId: Yup.number().when("campaignType", {
      is: "email",
      then: Yup.number().nullable(),
      otherwise: Yup.number().required()
    }),
    userId: Yup.number().nullable(),
    queueId: Yup.number().nullable(),
    statusTicket: Yup.string().required(),
    openTicket: Yup.string().required(),
    // Validação de recorrência
    isRecurring: Yup.boolean().default(false),
    recurrenceType: Yup.string().when('isRecurring', {
      is: true,
      then: Yup.string().oneOf(['minutely', 'hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly']).required(),
      otherwise: Yup.string().nullable()
    }),
    recurrenceInterval: Yup.number().when('isRecurring', {
      is: true,
      then: Yup.number().min(1).required(),
      otherwise: Yup.number().nullable()
    }),
    recurrenceDaysOfWeek: Yup.mixed().nullable(),
    recurrenceDayOfMonth: Yup.number().when(['isRecurring', 'recurrenceType'], {
      is: (isRecurring, recurrenceType) => isRecurring && recurrenceType === 'monthly',
      then: Yup.number().min(1).max(31).required(),
      otherwise: Yup.number().nullable()
    }),
    recurrenceEndDate: Yup.date().when('isRecurring', {
      is: true,
      then: Yup.date().min(new Date(), 'Data final deve ser futura').nullable(),
      otherwise: Yup.date().nullable()
    }),
    maxExecutions: Yup.number().when('isRecurring', {
      is: true,
      then: Yup.number().min(1).nullable(),
      otherwise: Yup.number().nullable()
    }),
    // Validações para email
    campaignType: Yup.string().oneOf(["whatsapp", "email"]).default("whatsapp"),
    emailSubject: Yup.string().when("campaignType", {
      is: "email",
      then: Yup.string().required("Assunto do email é obrigatório"),
      otherwise: Yup.string().nullable()
    }),
    emailHtml: Yup.string().nullable(),
    emailHtml2: Yup.string().nullable(),
    emailHtml3: Yup.string().nullable(),
    emailHtml4: Yup.string().nullable(),
    emailHtml5: Yup.string().nullable(),
    emailFromName: Yup.string().nullable(),
    emailFromAddress: Yup.string().email().nullable(),
    emailRatePerMinute: Yup.number().min(1).nullable(),
    emailDailyLimit: Yup.number()
      .transform((value, originalValue) => {
        return originalValue === "" || originalValue === null || originalValue === undefined
          ? null
          : Number(originalValue);
      })
      .nullable()
      .min(1, "Informe um limite diário válido de emails."),
    emailContinueHour: Yup.string().nullable(),
    // 3. Troca da validação do emailProvider no store
    emailProvider: emailProviderSchema,
  });

  try {
    const {
      name,
      message1,
      message2,
      message3,
      message4,
      message5,
      interactiveButtons,
      confirmationMessage1,
      confirmationMessage2,
      confirmationMessage3,
      confirmationMessage4,
      confirmationMessage5,
      confirmation,
      scheduledAt,
      contactListId,
      tagListId,
      whatsappId,
      userId,
      queueId,
      statusTicket,
      openTicket,
      templateId,
      templateVariables,
      // Novos campos de recorrência
      isRecurring,
      recurrenceType,
      recurrenceInterval,
      recurrenceDaysOfWeek,
      recurrenceDayOfMonth,
      recurrenceEndDate,
      maxExecutions,
      // Novos campos de email
      campaignType,
      emailSubject,
      emailHtml,
      emailHtml2,
      emailHtml3,
      emailHtml4,
      emailHtml5,
      emailFromName,
      emailFromAddress,
      emailRatePerMinute,
      emailDailyLimit,
      emailContinueHour,
      emailProvider,
    }: StoreData = req.body;

    console.log('[Campaign Store] Dados recebidos:', {
      isRecurring,
      recurrenceType,
      recurrenceDaysOfWeek,
      recurrenceDaysOfWeekType: typeof recurrenceDaysOfWeek,
      recurrenceDaysOfWeekIsArray: Array.isArray(recurrenceDaysOfWeek),
      campaignType,
      emailProvider,
      emailSubject,
      emailHtml
    });

    // Processar dados de recorrência com logs
    const processedRecurrenceData = {
      isRecurring: isRecurring || false,
      recurrenceType: isRecurring ? recurrenceType : null,
      recurrenceInterval: isRecurring ? (recurrenceInterval || 1) : null,
      recurrenceDaysOfWeek: (() => {
        if (!isRecurring) return null;
        if (!recurrenceDaysOfWeek) return null;
        if (Array.isArray(recurrenceDaysOfWeek)) {
          return recurrenceDaysOfWeek.length > 0 ? JSON.stringify(recurrenceDaysOfWeek) : null;
        }
        if (typeof recurrenceDaysOfWeek === 'string') {
          return recurrenceDaysOfWeek;
        }
        return null;
      })(),
      recurrenceDayOfMonth: (isRecurring && recurrenceType === 'monthly') ? recurrenceDayOfMonth : null,
      recurrenceEndDate: (isRecurring && recurrenceEndDate) ? new Date(recurrenceEndDate) : null,
      maxExecutions: (isRecurring && maxExecutions) ? maxExecutions : null,
      executionCount: 0,
      nextScheduledAt: null,
      lastExecutedAt: null
    };

    console.log('[Campaign Store] Dados processados:', processedRecurrenceData);

    // 4. Normalize processedCampaignType no store
    const processedCampaignType = String(campaignType || "whatsapp")
      .trim()
      .toLowerCase();

    const processedData = {
      name,
      message1: message1 || null,
      message2: message2 || null,
      message3: message3 || null,
      message4: message4 || null,
      message5: message5 || null,
      interactiveButtons: normalizeInteractiveButtons(
        interactiveButtons,
        processedCampaignType
      ),
      confirmationMessage1: confirmationMessage1 || null,
      confirmationMessage2: confirmationMessage2 || null,
      confirmationMessage3: confirmationMessage3 || null,
      confirmationMessage4: confirmationMessage4 || null,
      confirmationMessage5: confirmationMessage5 || null,
      confirmation: processedCampaignType === "email" ? false : confirmation,
      scheduledAt,
      contactListId: contactListId || null,
      tagListId: tagListId === "Nenhuma" ? null : tagListId,
      whatsappId: processedCampaignType === "email" ? null : whatsappId,
      userId: userId || null,
      queueId: queueId || null,
      statusTicket,
      openTicket,
      companyId,
      status: "PROGRAMADA",
      templateId: templateId || null,
      templateVariables: templateVariables || null,
      // Adicionar campos de recorrência processados
      ...processedRecurrenceData,
      // Adicionar campos de email
      campaignType: processedCampaignType,
      emailSubject: emailSubject || null,
      emailHtml: emailHtml || null,
      emailHtml2: emailHtml2 || null,
      emailHtml3: emailHtml3 || null,
      emailHtml4: emailHtml4 || null,
      emailHtml5: emailHtml5 || null,
      emailFromName: emailFromName || null,
      emailFromAddress: emailFromAddress || null,
      emailRatePerMinute: Number(emailRatePerMinute) || 5,
      emailDailyLimit: Number(emailDailyLimit) || 99,
      emailContinueHour: emailContinueHour || "08:00",
      emailProvider: normalizeEmailProvider(processedCampaignType, emailProvider),
    };

    await schema.validate(processedData);

    const campaign = await CreateService(processedData as any);

    console.log('[Campaign Store] Campanha criada:', campaign.id);

    // Log detalhado com informações da lista/tag
    let totalContacts = 0;
    if (campaign.contactListId) {
      // Buscar total de contatos na lista
      totalContacts = await ContactListItem.count({
        where: { contactListId: campaign.contactListId }
      });
      console.log(`[Campaign Store] Campanha por lista - Total de contatos: ${totalContacts}`);
    } else if (campaign.tagListId) {
      // Buscar total de contatos na tag
      totalContacts = await ContactTag.count({
        where: { tagId: campaign.tagListId },
        include: [{
          model: Contact,
          as: "contact",
          where: { companyId: campaign.companyId, active: true },
          required: true
        }]
      });
      console.log(`[Campaign Store] Campanha por tag - Total de contatos: ${totalContacts}`);
    }

    // Se for recorrente, calcular próxima execução
    if (campaign.isRecurring) {
      console.log('[Campaign Store] Configurando próxima execução para campanha recorrente');
      await RecurrenceService.scheduleNextExecution(campaign.id);
      // Recarregar campanha para ter o nextScheduledAt atualizado
      await campaign.reload();
    }

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record: campaign
      });

    return res.status(200).json(campaign);
  } catch (err: any) {
    console.error('[Campaign Store] Erro:', err.message);
    throw new AppError(err.message);
  }
};

// Update method com as alterações solicitadas
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id, campaignId: campaignIdParam } = req.params;

  const campaignId = id || campaignIdParam;

  if (!campaignId) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 400);
  }

  // 1) Schema com emailContinueHour
  const schema = Yup.object().shape({
    name: Yup.string().required(),
    confirmation: Yup.boolean().required(),
    scheduledAt: Yup.string().required(),
    contactListId: Yup.number().nullable(),
    tagListId: Yup.string().nullable(),
    whatsappId: Yup.number().when("campaignType", {
      is: "email",
      then: Yup.number().nullable(),
      otherwise: Yup.number().required()
    }),
    userId: Yup.number().nullable(),
    queueId: Yup.number().nullable(),
    statusTicket: Yup.string().required(),
    openTicket: Yup.string().required(),
    // Validação de recorrência
    isRecurring: Yup.boolean().default(false),
    recurrenceType: Yup.string().when('isRecurring', {
      is: true,
      then: Yup.string().oneOf(['minutely', 'hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly']).required(),
      otherwise: Yup.string().nullable()
    }),
    recurrenceInterval: Yup.number().when('isRecurring', {
      is: true,
      then: Yup.number().min(1).required(),
      otherwise: Yup.number().nullable()
    }),
    recurrenceDaysOfWeek: Yup.mixed().nullable(),
    recurrenceDayOfMonth: Yup.number().when(['isRecurring', 'recurrenceType'], {
      is: (isRecurring, recurrenceType) => isRecurring && recurrenceType === 'monthly',
      then: Yup.number().min(1).max(31).required(),
      otherwise: Yup.number().nullable()
    }),
    recurrenceEndDate: Yup.date().when('isRecurring', {
      is: true,
      then: Yup.date().min(new Date(), 'Data final deve ser futura').nullable(),
      otherwise: Yup.date().nullable()
    }),
    maxExecutions: Yup.number().when('isRecurring', {
      is: true,
      then: Yup.number().min(1).nullable(),
      otherwise: Yup.number().nullable()
    }),
    // Validações para email
    campaignType: Yup.string().oneOf(["whatsapp", "email"]).default("whatsapp"),
    emailSubject: Yup.string().when("campaignType", {
      is: "email",
      then: Yup.string().required("Assunto do email é obrigatório"),
      otherwise: Yup.string().nullable()
    }),
    emailHtml: Yup.string().nullable(),
    emailHtml2: Yup.string().nullable(),
    emailHtml3: Yup.string().nullable(),
    emailHtml4: Yup.string().nullable(),
    emailHtml5: Yup.string().nullable(),
    emailFromName: Yup.string().nullable(),
    emailFromAddress: Yup.string().email().nullable(),
    emailRatePerMinute: Yup.number().min(1).nullable(),
    emailDailyLimit: Yup.number()
      .transform((value, originalValue) => {
        return originalValue === "" || originalValue === null || originalValue === undefined
          ? null
          : Number(originalValue);
      })
      .nullable()
      .min(1, "Informe um limite diário válido de emails."),
    emailContinueHour: Yup.string().nullable(),
    // 3. Troca da validação do emailProvider no update
    emailProvider: emailProviderSchema,
  });

  try {
    // 2) Destructuring com emailDailyLimit e emailHtml2-5
    const {
      name,
      message1,
      message2,
      message3,
      message4,
      message5,
      interactiveButtons,
      confirmationMessage1,
      confirmationMessage2,
      confirmationMessage3,
      confirmationMessage4,
      confirmationMessage5,
      confirmation,
      scheduledAt,
      contactListId,
      tagListId,
      whatsappId,
      userId,
      queueId,
      statusTicket,
      openTicket,
      templateId,
      templateVariables,
      // Novos campos de recorrência
      isRecurring,
      recurrenceType,
      recurrenceInterval,
      recurrenceDaysOfWeek,
      recurrenceDayOfMonth,
      recurrenceEndDate,
      maxExecutions,
      // Novos campos de email
      campaignType,
      emailSubject,
      emailHtml,
      emailHtml2,
      emailHtml3,
      emailHtml4,
      emailHtml5,
      emailFromName,
      emailFromAddress,
      emailRatePerMinute,
      emailDailyLimit,
      emailContinueHour,
      emailProvider,
    }: StoreData = req.body;

    console.log('[Campaign Update] Dados recebidos:', {
      id,
      campaignIdParam,
      campaignId,
      isRecurring,
      recurrenceType,
      recurrenceDaysOfWeek,
      recurrenceDaysOfWeekType: typeof recurrenceDaysOfWeek,
      recurrenceDaysOfWeekIsArray: Array.isArray(recurrenceDaysOfWeek),
      campaignType,
      emailProvider,
      emailSubject,
      emailHtml
    });

    // Processar dados de recorrência
    const processedRecurrenceData = {
      isRecurring: isRecurring || false,
      recurrenceType: isRecurring ? recurrenceType : null,
      recurrenceInterval: isRecurring ? (recurrenceInterval || 1) : null,
      recurrenceDaysOfWeek: (() => {
        if (!isRecurring) return null;
        if (!recurrenceDaysOfWeek) return null;
        if (Array.isArray(recurrenceDaysOfWeek)) {
          return recurrenceDaysOfWeek.length > 0 ? JSON.stringify(recurrenceDaysOfWeek) : null;
        }
        if (typeof recurrenceDaysOfWeek === 'string') {
          return recurrenceDaysOfWeek;
        }
        return null;
      })(),
      recurrenceDayOfMonth: (isRecurring && recurrenceType === 'monthly') ? recurrenceDayOfMonth : null,
      recurrenceEndDate: (isRecurring && recurrenceEndDate) ? new Date(recurrenceEndDate) : null,
      maxExecutions: (isRecurring && maxExecutions) ? maxExecutions : null
    };

    // 4. Normalize processedCampaignType no update
    const processedCampaignType = String(campaignType || "whatsapp")
      .trim()
      .toLowerCase();

    // 3) ProcessedData com emailDailyLimit e emailHtml2-5
    const processedData = {
      name,

      message1: message1 || null,
      message2: message2 || null,
      message3: message3 || null,
      message4: message4 || null,
      message5: message5 || null,
      interactiveButtons: normalizeInteractiveButtons(
        interactiveButtons,
        processedCampaignType
      ),

      confirmationMessage1: confirmationMessage1 || null,
      confirmationMessage2: confirmationMessage2 || null,
      confirmationMessage3: confirmationMessage3 || null,
      confirmationMessage4: confirmationMessage4 || null,
      confirmationMessage5: confirmationMessage5 || null,

      confirmation: processedCampaignType === "email" ? false : confirmation,

      scheduledAt,

      contactListId: contactListId || null,
      tagListId: tagListId === "Nenhuma" ? null : tagListId,

      whatsappId: processedCampaignType === "email" ? null : whatsappId,

      userId: userId || null,
      queueId: queueId || null,

      statusTicket,
      openTicket,

      companyId,

      templateId: templateId || null,
      templateVariables: templateVariables || null,

      // Recorrência
      ...processedRecurrenceData,

      // Email
      campaignType: processedCampaignType,

      emailSubject: emailSubject || null,

      // HTML principal SEMPRE recebe algum conteúdo válido
      emailHtml:
        emailHtml ||
        emailHtml2 ||
        emailHtml3 ||
        emailHtml4 ||
        emailHtml5 ||
        "",

      // HTMLs extras
      emailHtml2: emailHtml2 || "",
      emailHtml3: emailHtml3 || "",
      emailHtml4: emailHtml4 || "",
      emailHtml5: emailHtml5 || "",

      emailFromName: emailFromName || null,
      emailFromAddress: emailFromAddress || null,

      emailRatePerMinute:
        Number(emailRatePerMinute) > 0
          ? Number(emailRatePerMinute)
          : 5,

      emailDailyLimit:
        Number(emailDailyLimit) > 0
          ? Number(emailDailyLimit)
          : 99,

      emailContinueHour: emailContinueHour || "08:00",

      emailProvider: normalizeEmailProvider(processedCampaignType, emailProvider),
    };

    // Validação adicional para email
    if (processedData.campaignType === "email") {
      const hasAnyHtml = [
        processedData.emailHtml,
        processedData.emailHtml2,
        processedData.emailHtml3,
        processedData.emailHtml4,
        processedData.emailHtml5,
      ].some(
        html => html && String(html).trim() !== ""
      );

      if (!hasAnyHtml) {
        throw new AppError(
          "Preencha pelo menos um HTML para a campanha."
        );
      }
    }

    await schema.validate(processedData);

    const campaign = await UpdateService({
      id: campaignId,
      ...(processedData as any)
    });

    console.log('[Campaign Update] Campanha atualizada:', campaign.id);

    // Se for recorrente, recalcular próxima execução
    if (campaign.isRecurring) {
      console.log('[Campaign Update] Reconfigurando próxima execução para campanha recorrente');
      await RecurrenceService.scheduleNextExecution(campaign.id);
      // Recarregar campanha para ter o nextScheduledAt atualizado
      await campaign.reload();
    }

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-campaign`, {
        action: "update",
        record: campaign
      });

    return res.status(200).json(campaign);
  } catch (err: any) {
    console.error('[Campaign Update] Erro:', err.message);
    throw new AppError(err.message);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const cancel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await CancelService(+id);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await RestartService(+id);

  return res.status(204).json({ message: "Reinício dos disparos" });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-campaign`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Campaign deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const records: Campaign[] = await FindService(params);

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const campaign = await Campaign.findByPk(id);
    campaign.mediaPath = file.filename;
    campaign.mediaName = file.originalname;
    await campaign.save();
    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const campaign = await Campaign.findByPk(id);
    const filePath = path.resolve("public", `company${companyId}`, campaign.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }

    campaign.mediaPath = null;
    campaign.mediaName = null;
    await campaign.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const previewRecurrence = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { recurrenceType, recurrenceInterval, recurrenceDaysOfWeek, recurrenceDayOfMonth } = req.query;

  try {
    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      throw new AppError("Campanha não encontrada", 404);
    }

    const config = {
      type: recurrenceType as string,
      interval: parseInt(recurrenceInterval as string),
      daysOfWeek: recurrenceDaysOfWeek ? JSON.parse(recurrenceDaysOfWeek as string) : undefined,
      dayOfMonth: recurrenceDayOfMonth ? parseInt(recurrenceDayOfMonth as string) : undefined
    };

    const executions = [];
    let currentDate = new Date(campaign.scheduledAt);

    for (let i = 0; i < 10; i++) { // Preview das próximas 10 execuções
      executions.push(new Date(currentDate));
      currentDate = RecurrenceService.calculateNextExecution(currentDate, config);
    }

    return res.json({ executions });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const stopRecurrence = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      throw new AppError("Campanha não encontrada", 404);
    }

    await campaign.update({
      isRecurring: false,
      nextScheduledAt: null,
      status: campaign.status === 'PROGRAMADA' ? 'FINALIZADA' : campaign.status
    });

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-campaign`, {
        action: "update",
        record: campaign
      });

    return res.status(200).json({ message: "Recorrência interrompida com sucesso" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

// Novo endpoint para dados de shipping com paginação
export const getShipping = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { page = 1, pageSize = 50, searchParam, status } = req.query;

  try {
    const result = await ShippingService({
      campaignId: id,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      searchParam: searchParam as string,
      status: status as 'delivered' | 'pending' | 'failed'
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("Erro ao buscar dados de shipping:", err);
    throw new AppError(err.message || "Erro interno do servidor", 500);
  }
};

// Novo endpoint para estatísticas da campanha
export const getStats = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  try {
    const stats = await CampaignStatsService(id);
    return res.status(200).json(stats);
  } catch (err: any) {
    console.error("Erro ao buscar estatísticas da campanha:", err);
    throw new AppError(err.message || "Erro interno do servidor", 500);
  }
};
