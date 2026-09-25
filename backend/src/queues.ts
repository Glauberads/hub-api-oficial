import * as Sentry from "@sentry/node";
import BullQueue from "bull";
import { MessageData, SendMessage } from "./helpers/SendMessage";
import Whatsapp from "./models/Whatsapp";
import logger from "./utils/logger";
import moment from "moment-timezone";
import Schedule from "./models/Schedule";
import { Op, QueryTypes } from "sequelize";
import GetDefaultWhatsApp from "./helpers/GetDefaultWhatsApp";
import Campaign from "./models/Campaign";
import Queues from "./models/Queue";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";
import { isEmpty, isNil, isArray } from "lodash";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";
import GetWhatsappWbot from "./helpers/GetWhatsappWbot";
import sequelize from "./database";
import { getMessageOptions } from "./services/WbotServices/SendWhatsAppMedia";
import { emitCompanyEvent } from "./libs/socket";
import path from "path";
import fs from "fs";
import User from "./models/User";
import Company from "./models/Company";
import Contact from "./models/Contact";
import Queue from "./models/Queue";
import { ClosedAllOpenTickets } from "./services/WbotServices/wbotClosedTickets";
import Ticket from "./models/Ticket";
import UserQueue from "./models/UserQueue";
import ContactWallet from "./models/ContactWallet";
import ShowTicketService from "./services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "./services/WbotServices/SendWhatsAppMessage";
import SendWhatsAppMedia from "./services/WbotServices/SendWhatsAppMedia";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import { addSeconds, differenceInSeconds } from "date-fns";
const CronJob = require("cron").CronJob;
import CompaniesSettings from "./models/CompaniesSettings";
import {
  verifyMediaMessage,
  verifyMessage
} from "./services/WbotServices/wbotMessageListener";
import CreateLogTicketService from "./services/TicketServices/CreateLogTicketService";
import formatBody from "./helpers/Mustache";
import TicketTag from "./models/TicketTag";
import Tag from "./models/Tag";
import ContactTag from "./models/ContactTag";
import Plan from "./models/Plan";
import { getWbot } from "./libs/wbot";
import { initializeBirthdayJobs } from "./jobs/BirthdayJob";
import { getJidOf } from "./services/WbotServices/getJidOf";
import RecurrenceService from "./services/CampaignService/RecurrenceService";
import WhatsappLidMap from "./models/WhatsapplidMap";
import { checkAndDedup } from "./services/WbotServices/verifyContact";
import SendWhatsAppOficialMessage from "./services/WhatsAppOficial/SendWhatsAppOficialMessage";
import { obterNomeEExtensaoDoArquivo } from "./controllers/MessageController";
import QuickMessage from "./models/QuickMessage";
import QuickMessageComponent from "./models/QuickMessageComponent";
import EmailMarketingService from "./services/EmailMarketing/EmailMarketingService";
import EmailSetting from "./models/EmailSetting";
import { delay } from "./utils/delay";
import { sendInteractiveMixedButtons } from "./helpers/SendInteractiveMsg";

import ProcessRenewalNotificationsService from "./services/RenewalServices/ProcessRenewalNotificationsService";

const connection = process.env.REDIS_URI || "";
const limiterMax = process.env.REDIS_OPT_LIMITER_MAX || 1;
const limiterDuration = process.env.REDIS_OPT_LIMITER_DURATION || 3000;

// Lock para evitar processamento paralelo de verifyAndFinalizeCampaign
const campaignVerificationLocks = new Map<number, Promise<void>>();

// ─── Cache de campanhas (TTL 60s) ────────────────────────────────────────────
const campaignCache = new Map<number, { campaign: any; timestamp: number }>();
const CAMPAIGN_CACHE_TTL = 60 * 1000;

function getCachedCampaign(id: number) {
  const cached = campaignCache.get(id);
  if (cached && Date.now() - cached.timestamp < CAMPAIGN_CACHE_TTL) {
    return cached.campaign;
  }
  campaignCache.delete(id);
  return null;
}

function setCachedCampaign(id: number, campaign: any) {
  campaignCache.set(id, { campaign, timestamp: Date.now() });
  if (campaignCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of campaignCache) {
      if (now - value.timestamp > CAMPAIGN_CACHE_TTL) campaignCache.delete(key);
    }
  }
}

function invalidateCampaignCache(id: number) {
  campaignCache.delete(id);
}

type CampaignButton = {
  type: "quick_reply" | "cta_url" | "cta_copy" | "cta_call";
  text: string;
  id?: string;
  url?: string;
  copyCode?: string;
  phoneNumber?: string;
};

const getCampaignInteractiveButtons = (campaign: any): CampaignButton[] => {
  let value = campaign?.interactiveButtons;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? value.filter(button => button?.text && button?.type).slice(0, 5)
    : [];
};

const buildCampaignButtonsFallback = (
  bodyText: string,
  buttons: CampaignButton[]
): string => {
  const lines = buttons.map((button, index) => {
    const target =
      button.type === "cta_url" ? button.url :
        button.type === "cta_copy" ? button.copyCode :
          button.type === "cta_call" ? button.phoneNumber :
            button.id;
    return `${index + 1}. ${button.text}${target ? `: ${target}` : ""}`;
  });
  return [bodyText?.trim(), ...lines].filter(Boolean).join("\n");
};

const sendCampaignButtons = async ({
  wbot,
  jid,
  bodyText,
  buttons,
  headerImageBuffer,
  headerVideoBuffer,
  headerMediaMimeType
}: {
  wbot: any;
  jid: string;
  bodyText: string;
  buttons: CampaignButton[];
  headerImageBuffer?: Buffer;
  headerVideoBuffer?: Buffer;
  headerMediaMimeType?: string;
}) => {
  try {
    return await sendInteractiveMixedButtons({
      wbot,
      jid,
      bodyText: bodyText || "\u200c",
      footerText: "",
      buttons,
      headerImageBuffer,
      headerVideoBuffer,
      headerMediaMimeType
    });
  } catch (error: any) {
    logger.warn(
      `[CAMPAIGN-BUTTONS] Falha no interativo para ${jid}; usando fallback em texto: ${error?.message}`
    );
    return wbot.sendMessage(jid, {
      text: buildCampaignButtonsFallback(bodyText, buttons)
    });
  }
};

// ─── Cache de settings por empresa (TTL 5 min) ───────────────────────────────
const settingsCache = new Map<number, { settings: CampaignSettings; timestamp: number }>();
const SETTINGS_CACHE_TTL = 5 * 60 * 1000;

function getCachedSettings(companyId: number): CampaignSettings | null {
  const cached = settingsCache.get(companyId);
  if (cached && Date.now() - cached.timestamp < SETTINGS_CACHE_TTL) return cached.settings;
  settingsCache.delete(companyId);
  return null;
}

function setCachedSettings(companyId: number, settings: CampaignSettings) {
  settingsCache.set(companyId, { settings, timestamp: Date.now() });
}

export function invalidateSettingsCache(companyId: number) {
  settingsCache.delete(companyId);
}

// ─── Cache de contatos (TTL 10 min) ─────────────────────────────────────────
const contactCache = new Map<string, { contact: any; timestamp: number }>();
const CONTACT_CACHE_TTL = 10 * 60 * 1000;

function getCachedContact(key: string) {
  const cached = contactCache.get(key);
  if (cached && Date.now() - cached.timestamp < CONTACT_CACHE_TTL) return cached.contact;
  contactCache.delete(key);
  return null;
}

function setCachedContact(key: string, contact: any) {
  contactCache.set(key, { contact, timestamp: Date.now() });
  if (contactCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of contactCache) {
      if (now - v.timestamp > CONTACT_CACHE_TTL) contactCache.delete(k);
    }
  }
}

interface ProcessCampaignData {
  id: number;
  delay: number;
  restartMode?: boolean;
  messageInterval?: number;
  longerIntervalAfter?: number;
  greaterInterval?: number;
}

interface CampaignSettings {
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  jitterPercent: number;   // % de variação aleatória (0-80)
  longPauseEvery: number;  // pausa extra a cada N mensagens (0 = desabilitado)
  longPauseDuration: number; // duração em segundos da pausa periódica
  variables: any[];
}

interface PrepareContactData {
  contactId: number;
  campaignId: number;
  variables: any[];
}

interface DispatchCampaignData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

interface LidRetryData {
  contactId: number;
  whatsappId: number;
  companyId: number;
  number: string;
  retryCount: number;
  maxRetries?: number;
}

export const userMonitor = new BullQueue("UserMonitor", connection);
export const scheduleMonitor = new BullQueue("ScheduleMonitor", connection);
export const renewalMonitor = new BullQueue("RenewalMonitor", connection);
export const sendScheduledMessages = new BullQueue("SendSacheduledMessages", connection);
export const campaignQueue = new BullQueue("CampaignQueue", connection);
export const queueMonitor = new BullQueue("QueueMonitor", connection);
export const lidRetryQueue = new BullQueue("LidRetryQueue", connection);

export const messageQueue = new BullQueue("MessageQueue", connection, {
  limiter: {
    max: limiterMax as number,
    duration: limiterDuration as number
  }
});

let isProcessing = false;

// ─── Helpers de timezone ─────────────────────────────────────────────────────
const getUserTimezone = async (userId?: number | string, fallbackUser?: any) => {
  let timezone = "America/Sao_Paulo";

  if (fallbackUser?.timezone) {
    return fallbackUser.timezone;
  }

  if (userId) {
    const user = await User.findByPk(Number(userId), {
      attributes: ["id", "timezone"]
    });

    if (user?.timezone) {
      timezone = user.timezone;
    }
  }

  return timezone;
};

const timeToMinutes = (value?: string) => {
  const [hh, mm] = String(value || "00:00")
    .split(":")
    .map(v => Number(v));

  return (hh || 0) * 60 + (mm || 0);
};

// ─── Funções de janela horária com timezone ──────────────────────────────────
const checkerWeek = async (
  companyId: number,
  timezone = "America/Sao_Paulo"
) => {
  const now = moment().tz(timezone);
  const sab = now.day() === 6;
  const dom = now.day() === 0;

  const [sabado, domingo] = await Promise.all([
    CampaignSetting.findOne({
      where: { companyId, key: "sabado" }
    }),
    CampaignSetting.findOne({
      where: { companyId, key: "domingo" }
    })
  ]);

  if (sabado?.value === "false" && sab) {
    return true;
  }

  if (domingo?.value === "false" && dom) {
    return true;
  }

  return false;
};

const checkTime = async (
  companyId: number,
  timezone = "America/Sao_Paulo"
) => {
  const [startHour, endHour] = await Promise.all([
    CampaignSetting.findOne({
      where: { companyId, key: "startHour" }
    }),
    CampaignSetting.findOne({
      where: { companyId, key: "endHour" }
    })
  ]);

  const now = moment().tz(timezone);
  const nowMinutes = now.hours() * 60 + now.minutes();

  const startMinutes = timeToMinutes(String(startHour?.value || "00:00"));
  const endMinutes = timeToMinutes(String(endHour?.value || "23:59"));

  if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
    return true;
  }

  logger.info(
    `Envio inicia às ${String(startHour?.value || "00:00")} e termina às ${String(
      endHour?.value || "23:59"
    )}, hora atual ${now.format("HH:mm")} (${timezone}) não está dentro do horário`
  );

  return false;
};

async function handleSendMessage(job) {
  try {
    const { data } = job;

    const whatsapp = await Whatsapp.findByPk(data.whatsappId);

    if (whatsapp === null) {
      throw Error("Whatsapp não identificado");
    }

    const messageData: MessageData = data.data;

    logger.info(`[QUEUE] Processando mensagem para whatsapp ${data.whatsappId}`);
    await SendMessage(whatsapp, messageData);
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("MessageQueue -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifyReminders(job) {
  try {
    const nowUtc = moment.utc();
    const limitUtc = nowUtc.clone().add(30, "seconds");

    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        reminderStatus: "PENDENTE",
        reminderSentAt: null,
        reminderDate: {
          [Op.gte]: nowUtc.toDate(),
          [Op.lte]: limitUtc.toDate()
        }
      },
      include: [
        { model: Contact, as: "contact" },
        { model: User, as: "user", attributes: ["id", "name", "timezone"] }
      ],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      schedules.map(async schedule => {
        await schedule.update({
          reminderStatus: "AGENDADA"
        });

        sendScheduledMessages.add(
          "SendReminder",
          { schedule },
          { delay: 40000 }
        );

        logger.info(`Lembrete agendado para: ${schedule.contact.name}`);
      });
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendReminder -> Verify: error", e.message);
    throw e;
  }
}

async function handleVerifySchedules(job) {
  try {
    const nowUtc = moment.utc();
    const limitUtc = nowUtc.clone().add(30, "seconds");

    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        status: "PENDENTE",
        sentAt: null,
        sendAt: {
          [Op.lte]: limitUtc.toDate()
        }
      },
      include: [
        { model: Contact, as: "contact" },
        { model: User, as: "user", attributes: ["id", "name", "timezone"] }
      ],
      distinct: true,
      subQuery: false
    });

    if (count > 0) {
      for (const schedule of schedules) {
        const [updatedCount] = await Schedule.update(
          {
            status: "AGENDADA"
          },
          {
            where: {
              id: schedule.id,
              status: "PENDENTE",
              sentAt: null
            }
          }
        );

        if (updatedCount === 0) {
          logger.info(
            `[SCHEDULE] Ignorando agendamento já processado: scheduleId=${schedule.id}`
          );
          continue;
        }

        await sendScheduledMessages.add(
          "SendMessage",
          { schedule },
          {
            delay: 40000,
            jobId: `schedule-send-${schedule.id}`,
            removeOnComplete: true,
            removeOnFail: false
          }
        );

        logger.info(
          `[SCHEDULE] Disparo agendado para fila: scheduleId=${schedule.id}, contato=${schedule.contact?.name}`
        );
      }
    }
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SendScheduledMessage -> Verify: error", e.message);
    throw e;
  }
}

async function handleSendScheduledMessage(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    if (schedule.reminderDate && schedule.reminderStatus === "PENDENTE") {
      logger.info(`Agendamento ${schedule.id} tem lembrete configurado - não enviando mensagem no horário original`);

      await scheduleRecord?.update({
        status: "CANCELADO_POR_LEMBRETE"
      });

      return;
    }

    let whatsapp;

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
    }

    if (!whatsapp) whatsapp = await GetDefaultWhatsApp(schedule.companyId);

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve(
        "public",
        `company${schedule.companyId}`,
        schedule.mediaPath
      );
    }

    if (schedule.openTicket === "enabled") {
      let ticket = await Ticket.findOne({
        where: {
          contactId: schedule.contact.id,
          companyId: schedule.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket)
        ticket = await Ticket.create({
          companyId: schedule.companyId,
          contactId: schedule.contactId,
          whatsappId: whatsapp.id,
          queueId: schedule.queueId,
          userId: schedule.ticketUserId,
          status: schedule.statusTicket
        });

      ticket = await ShowTicketService(ticket.id, schedule.companyId);

      let bodyMessage;

      if (schedule.assinar && !isNil(schedule.userId)) {
        bodyMessage = `*${schedule?.user?.name}:*\n${schedule.body.trim()}`;
      } else {
        bodyMessage = schedule.body.trim();
      }

      const dataAgendamento = await agendamentoContato(schedule);
      let bodySchedule = bodyMessage.replace("{{dataAgendamento}}", dataAgendamento);
      bodySchedule = `${formatBody(bodySchedule, ticket)}`;

      const sentMessage = await SendMessage(
        whatsapp,
        {
          number: schedule.contact.number,
          body: bodySchedule,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );

      if (schedule.mediaPath) {
        await verifyMediaMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false,
          whatsapp
        );
      } else {
        await verifyMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false
        );
      }
    } else {

      const dataAgendamento = await agendamentoContato(schedule);
      let bodySchedule = schedule.body.replace("{{dataAgendamento}}", dataAgendamento);
      bodySchedule = `${formatBody(bodySchedule, null)}`;

      await SendMessage(
        whatsapp,
        {
          number: schedule.contact.number,
          body: bodySchedule,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );
    }

    if (
      schedule.valorIntervalo > 0 &&
      (isNil(schedule.contadorEnvio) ||
        schedule.contadorEnvio < schedule.enviarQuantasVezes)
    ) {
      const userTimezone = await getUserTimezone(
        schedule.userId,
        (schedule as any)?.user
      );

      let novaDataMoment = moment
        .utc(schedule.sendAt)
        .tz(userTimezone);

      switch (schedule.intervalo) {
        case 1:
          novaDataMoment = novaDataMoment.add(
            Number(schedule.valorIntervalo),
            "days"
          );
          break;
        case 2:
          novaDataMoment = novaDataMoment.add(
            Number(schedule.valorIntervalo),
            "weeks"
          );
          break;
        case 3:
          novaDataMoment = novaDataMoment.add(
            Number(schedule.valorIntervalo),
            "months"
          );
          break;
        case 4:
          novaDataMoment = novaDataMoment.add(
            Number(schedule.valorIntervalo),
            "minutes"
          );
          break;
        default:
          throw new Error("Intervalo inválido");
      }

      const isDiaUtil = (dateMoment: moment.Moment) => {
        const dayOfWeek = dateMoment.day();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      };

      const proximoDiaUtil = (dateMoment: moment.Moment) => {
        let proximoDia = dateMoment.clone();
        do {
          proximoDia.add(1, "day");
        } while (!isDiaUtil(proximoDia));
        return proximoDia;
      };

      const diaUtilAnterior = (dateMoment: moment.Moment) => {
        let diaAnterior = dateMoment.clone();
        do {
          diaAnterior.subtract(1, "day");
        } while (!isDiaUtil(diaAnterior));
        return diaAnterior;
      };

      if (schedule.tipoDias === 5 && !isDiaUtil(novaDataMoment)) {
        novaDataMoment = diaUtilAnterior(novaDataMoment);
      } else if (schedule.tipoDias === 6 && !isDiaUtil(novaDataMoment)) {
        novaDataMoment = proximoDiaUtil(novaDataMoment);
      }

      await scheduleRecord?.update({
        status: "PENDENTE",
        contadorEnvio: (Number(schedule.contadorEnvio) || 0) + 1,
        sendAt: novaDataMoment.utc().toDate()
      });
    } else {
      await scheduleRecord?.update({
        sentAt: new Date(),
        status: "ENVIADA"
      });
    }
    logger.info(`Mensagem agendada enviada para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      status: "ERRO"
    });
    logger.error("SendScheduledMessage -> SendMessage: error", e.message);
    throw e;
  }
}

export const agendamentoContato = async (schedule: Schedule): Promise<string> => {
  try {
    const sendAt = schedule?.sendAt;
    if (!sendAt) return "";

    const userTimezone = await getUserTimezone(
      schedule.userId,
      (schedule as any)?.user
    );

    return moment
      .utc(sendAt)
      .tz(userTimezone)
      .format("DD/MM/YYYY [às] HH:mm[hs]");
  } catch (error) {
    console.error("Erro ao buscar agendamento do contato:", error);
    return "";
  }
};

const readComponentString = (comp: any, keys: string[]): string => {
  for (const key of keys) {
    const value = comp?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const readComponentNumber = (
  comp: any,
  keys: string[],
  fallback = 0
): number => {
  for (const key of keys) {
    const value = comp?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
};

const extractTemplateVars = (text: string): string[] => {
  const regex = /\{\{(\d+)\}\}/g;
  const vars: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(String(text || ""))) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }

  return vars;
};

function renderCampaignOfficialTemplateBody(
  templateBodyText: string,
  resolvedParameters: Array<{ type?: string; text?: string }>
): string {
  let finalText = String(templateBodyText || "")
    .replace(/\u200c/g, "")
    .trim();

  resolvedParameters.forEach((param, index) => {
    const value = String(param?.text || "").trim();
    const position = index + 1;

    finalText = finalText.replace(
      new RegExp(`{{\\s*${position}\\s*}}`, "g"),
      value
    );
  });

  if (!finalText.trim()) {
    finalText = resolvedParameters
      .map(param => String(param?.text || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  return finalText.trim();
}

async function handleDispatchCampaignOficial(campaign, campaignShipping, chatId) {
  const whatsapp = campaign.whatsapp;

  const [contact] = await Contact.findOrCreate({
    where: {
      number: campaignShipping.number,
      companyId: campaign.companyId
    },
    defaults: {
      companyId: campaign.companyId,
      name: campaignShipping.contact ? campaignShipping.contact.name : "Contato da Campanha",
      number: campaignShipping.number,
      email: campaignShipping.contact ? campaignShipping.contact.email : "",
      whatsappId: campaign.whatsappId,
      profilePicUrl: ""
    }
  });

  let ticket = null;

  if (campaign.openTicket === "enabled") {
    ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId: campaign.companyId,
        whatsappId: whatsapp.id,
        status: ["open", "pending"]
      }
    });

    if (!ticket) {
      ticket = await Ticket.create({
        companyId: campaign.companyId,
        contactId: contact.id,
        whatsappId: whatsapp.id,
        queueId: campaign?.queueId,
        userId: campaign?.userId,
        status: campaign?.statusTicket,
        channel: "whatsapp_oficial"
      });
    }

    ticket = await ShowTicketService(ticket.id, campaign.companyId);
  } else {
    ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        companyId: campaign.companyId,
        whatsappId: whatsapp.id
      },
      order: [["createdAt", "DESC"]]
    });

    if (!ticket) {
      ticket = await Ticket.create({
        companyId: campaign.companyId,
        contactId: contact.id,
        whatsappId: whatsapp.id,
        status: "closed",
        channel: "whatsapp_oficial"
      });
    }

    ticket = await ShowTicketService(ticket.id, campaign.companyId);
  }

  if (campaign.templateId) {
    const template = await QuickMessage.findByPk(campaign.templateId, {
      include: [{ model: QuickMessageComponent, as: "components" }]
    });

    if (template) {
      logger.info(
        `[DISPATCH-CAMPAIGN-OFICIAL] Enviando template "${template.shortcode}" para ${campaignShipping.number}`
      );

      const templateData: any = {
        name: template.shortcode,
        language: { code: template.language || "pt_BR" }
      };

      const components: any[] = [];

      const savedVarsRaw = campaign.templateVariables
        ? JSON.parse(campaign.templateVariables)
        : {};

      const savedVars: Record<string, string> = {};
      for (const key of Object.keys(savedVarsRaw)) {
        const val = String(savedVarsRaw[key] || "").trim();
        if (val) {
          savedVars[key] = val;
        }
      }

      logger.info(
        `[DISPATCH-CAMPAIGN-OFICIAL] savedVars processados: ${JSON.stringify(savedVars)}`
      );

      const templateComponents = Array.isArray(template.components)
        ? template.components
        : [];

      const originalHeaderComponent = templateComponents.find((comp: any) => {
        const type = readComponentString(comp, [
          "type",
          "componentType",
          "component_type"
        ]).toLowerCase();

        return type === "header";
      });

      const originalHeaderFormat = readComponentString(originalHeaderComponent, [
        "format",
        "headerFormat",
        "header_format"
      ]).toUpperCase();

      if (templateComponents.length > 0) {
        templateComponents.forEach((comp: any) => {
          const componentType = readComponentString(comp, [
            "type",
            "componentType",
            "component_type"
          ]).toLowerCase();

          const componentFormat = readComponentString(comp, [
            "format",
            "headerFormat",
            "header_format"
          ]).toUpperCase();

          const componentText = readComponentString(comp, [
            "text",
            "body",
            "content",
            "value",
            "message"
          ]);

          if (componentType === "header" && componentFormat === "TEXT" && componentText) {
            const headerVars = extractTemplateVars(componentText);

            if (headerVars.length > 0) {
              const params = headerVars.map(num => ({
                type: "text",
                text:
                  savedVars[num] ||
                  savedVars[`Header_${num}`] ||
                  `{{${num}}}`
              }));

              const hasInvalidHeaderParam = params.some(
                p =>
                  !p.text ||
                  !String(p.text).trim() ||
                  /^\{\{\d+\}\}$/.test(String(p.text).trim())
              );

              if (hasInvalidHeaderParam) {
                logger.warn(
                  `[DISPATCH-CAMPAIGN-OFICIAL] Header com variável não resolvida. params=${JSON.stringify(params)}`
                );
              } else {
                components.push({
                  type: "header",
                  parameters: params
                });
              }
            }

            return;
          }

          if (componentType === "body") {
            const bodyVars = extractTemplateVars(componentText || "");
            const cleanMessage = String(campaignShipping.message || "")
              .replace(/\u200c\s?/, "")
              .trim();

            if (bodyVars.length > 0) {
              const params = bodyVars.map(num => {
                const resolved =
                  savedVars[num] ||
                  savedVars[`Body_${num}`] ||
                  (bodyVars.length === 1 ? cleanMessage : "") ||
                  `{{${num}}}`;

                return {
                  type: "text",
                  text: resolved
                };
              });

              const hasEmptyParam = params.some(
                p =>
                  !p.text ||
                  !String(p.text).trim() ||
                  /^\{\{\d+\}\}$/.test(String(p.text).trim())
              );

              if (hasEmptyParam) {
                logger.warn(
                  `[DISPATCH-CAMPAIGN-OFICIAL] Body com parâmetro vazio/placeholder. savedVars=${JSON.stringify(
                    savedVars
                  )}, bodyVars=${JSON.stringify(bodyVars)}, message="${cleanMessage}". Omitindo componente body para evitar erro 400.`
                );
              } else {
                components.push({
                  type: "body",
                  parameters: params
                });
              }
            }

            return;
          }

          if (componentType === "footer") {
            return;
          }

          if (componentType === "button") {
            const subType = readComponentString(comp, [
              "subType",
              "sub_type",
              "buttonType",
              "button_type"
            ]).toLowerCase();

            const buttonIndex = readComponentNumber(
              comp,
              ["index", "buttonIndex", "button_index", "position"],
              0
            );

            const buttonText = readComponentString(comp, [
              "payload",
              "text",
              "value",
              "buttonText",
              "button_text",
              "example",
              "urlSuffix",
              "url_suffix",
              "couponCode",
              "coupon_code"
            ]);

            if (!subType) {
              logger.warn(
                `[DISPATCH-CAMPAIGN-OFICIAL] Componente button sem subType/sub_type/buttonType/button_type. Registro: ${JSON.stringify(comp)}`
              );
              return;
            }

            if (subType === "quick_reply") {
              logger.info(
                `[DISPATCH-CAMPAIGN-OFICIAL] Button quick_reply índice ${buttonIndex} é estático no envio. Não será enviado como componente dinâmico.`
              );
              return;
            }

            if (subType === "url") {
              if (!buttonText) {
                logger.warn(
                  `[DISPATCH-CAMPAIGN-OFICIAL] Button URL sem texto dinâmico. Índice=${buttonIndex}. Registro=${JSON.stringify(comp)}`
                );
                return;
              }

              components.push({
                type: "button",
                sub_type: "url",
                index: String(buttonIndex),
                parameters: [
                  {
                    type: "text",
                    text: buttonText
                  }
                ]
              });

              return;
            }

            if (subType === "copy_code") {
              if (!buttonText) {
                logger.warn(
                  `[DISPATCH-CAMPAIGN-OFICIAL] Button copy_code sem coupon_code. Índice=${buttonIndex}. Registro=${JSON.stringify(comp)}`
                );
                return;
              }

              components.push({
                type: "button",
                sub_type: "copy_code",
                index: String(buttonIndex),
                parameters: [
                  {
                    type: "coupon_code",
                    coupon_code: buttonText
                  }
                ]
              });

              return;
            }

            logger.warn(
              `[DISPATCH-CAMPAIGN-OFICIAL] subType de button não suportado para envio dinâmico: ${subType}`
            );
          }
        });
      }

      if (campaign.mediaPath) {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
        const proxyPort = process.env.PROXY_PORT;
        const baseUrl = proxyPort ? `${backendUrl}:${proxyPort}` : backendUrl;
        const mediaUrl = `${baseUrl}/public/company${campaign.companyId}/${campaign.mediaPath}`;

        const ext = campaign.mediaPath.split(".").pop()?.toLowerCase();
        let mediaType = "image";

        if (["mp4", "3gp", "webm"].includes(ext || "")) {
          mediaType = "video";
        } else if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
          mediaType = "document";
        }

        const templateAcceptsThisHeader =
          (mediaType === "image" && originalHeaderFormat === "IMAGE") ||
          (mediaType === "video" && originalHeaderFormat === "VIDEO") ||
          (mediaType === "document" && originalHeaderFormat === "DOCUMENT");

        if (templateAcceptsThisHeader) {
          logger.info(
            `[DISPATCH-CAMPAIGN-OFICIAL] Incluindo mídia ${mediaType} no header: ${mediaUrl}`
          );

          const headerParam: any = { type: mediaType };

          if (mediaType === "image") {
            headerParam.image = { link: mediaUrl };
          } else if (mediaType === "video") {
            headerParam.video = { link: mediaUrl };
          } else {
            headerParam.document = {
              link: mediaUrl,
              filename: campaign.mediaName || "document"
            };
          }

          components.push({
            type: "header",
            parameters: [headerParam]
          });
        } else {
          logger.warn(
            `[DISPATCH-CAMPAIGN-OFICIAL] Mídia ignorada: template não possui header compatível. headerFormat=${originalHeaderFormat}, mediaType=${mediaType}`
          );
        }
      }

      if (components.length > 0) {
        templateData.components = components;
      }

      if (ticket && !ticket.whatsapp) {
        ticket.whatsapp = campaign.whatsapp;
      }

      const originalBodyComponent = templateComponents.find((comp: any) => {
        const type = readComponentString(comp, [
          "type",
          "componentType",
          "component_type"
        ]).toLowerCase();

        return type === "body";
      });

      const originalBodyText = readComponentString(originalBodyComponent, [
        "text",
        "body",
        "content",
        "value",
        "message"
      ]);

      const resolvedBodyComponent: any = components.find(
        (comp: any) => comp.type === "body"
      );

      const renderedTemplateBody = renderCampaignOfficialTemplateBody(
        String(
          originalBodyText ||
          template.message ||
          campaignShipping.message ||
          ""
        ),
        Array.isArray(resolvedBodyComponent?.parameters)
          ? resolvedBodyComponent.parameters
          : []
      );

      logger.info(
        `[DISPATCH-CAMPAIGN-OFICIAL] Texto renderizado do template: ${renderedTemplateBody}`
      );

      await SendWhatsAppOficialMessage({
        body:
          renderedTemplateBody ||
          campaignShipping.message ||
          template.message ||
          "",
        bodyToSave:
          renderedTemplateBody ||
          campaignShipping.message ||
          template.message ||
          "",
        ticket,
        type: "template",
        template: templateData,
        quotedMsg: null,
        media: null,
        vCard: null
      });

      return;
    }
  }

  logger.error(
    `[DISPATCH-CAMPAIGN-OFICIAL] Campanha ${campaign.id} sem template para ${campaignShipping.number}. Envio cancelado - API Oficial requer template fora da janela de 24h.`
  );

  throw new Error(
    "Campanha via API Oficial requer um template configurado. Configure um template aprovado na campanha."
  );
}

async function handleSendReminder(job) {
  const {
    data: { schedule }
  } = job;
  let scheduleRecord: Schedule | null = null;

  try {
    scheduleRecord = await Schedule.findByPk(schedule.id);
  } catch (e) {
    Sentry.captureException(e);
    logger.info(`Erro ao tentar consultar agendamento: ${schedule.id}`);
  }

  try {
    let whatsapp;

    if (!isNil(schedule.whatsappId)) {
      whatsapp = await Whatsapp.findByPk(schedule.whatsappId);
    }

    if (!whatsapp) whatsapp = await GetDefaultWhatsApp(schedule.companyId);

    let filePath = null;
    if (schedule.mediaPath) {
      filePath = path.resolve(
        "public",
        `company${schedule.companyId}`,
        schedule.mediaPath
      );
    }

    if (schedule.openTicket === "enabled") {

      let ticket = await Ticket.findOne({
        where: {
          contactId: schedule.contact.id,
          companyId: schedule.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket)
        ticket = await Ticket.create({
          companyId: schedule.companyId,
          contactId: schedule.contactId,
          whatsappId: whatsapp.id,
          queueId: schedule.queueId,
          userId: schedule.ticketUserId,
          status: schedule.statusTicket
        });

      ticket = await ShowTicketService(ticket.id, schedule.companyId);

      let bodyMessage;

      if (schedule.assinar && !isNil(schedule.userId)) {
        bodyMessage = `*${schedule?.user?.name}:*\n${schedule.body.trim()}`;
      } else {
        bodyMessage = schedule.body.trim();
      }

      const dataAgendamento = await agendamentoContato(schedule);
      let bodySchedule = bodyMessage.replace("{{dataAgendamento}}", dataAgendamento);
      bodySchedule = `${formatBody(bodySchedule, ticket)}`;

      const sentMessage = await SendMessage(
        whatsapp,
        {
          number: schedule.contact.number,
          body: bodySchedule,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );

      if (schedule.mediaPath) {
        await verifyMediaMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false,
          whatsapp
        );
      } else {
        await verifyMessage(
          sentMessage,
          ticket,
          ticket.contact,
          null,
          true,
          false
        );
      }
    } else {

      const dataAgendamento = await agendamentoContato(schedule);
      let bodySchedule = schedule.body.replace("{{dataAgendamento}}", dataAgendamento);
      bodySchedule = `${formatBody(bodySchedule, null)}`;

      await SendMessage(
        whatsapp,
        {
          number: schedule.contact.number,
          body: bodySchedule,
          mediaPath: filePath,
          companyId: schedule.companyId
        },
        schedule.contact.isGroup
      );
    }

    await scheduleRecord?.update({
      reminderSentAt: new Date(),
      reminderStatus: "ENVIADA"
    });

    logger.info(`Lembrete enviado para: ${schedule.contact.name}`);
    sendScheduledMessages.clean(15000, "completed");
  } catch (e: any) {
    Sentry.captureException(e);
    await scheduleRecord?.update({
      reminderStatus: "ERRO"
    });
    logger.error("SendReminder -> SendMessage: error", e.message);
    throw e;
  }
}

async function handleVerifyCampaigns(job) {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    await new Promise(r => setTimeout(r, 1500));

    const nowUtc = moment.utc();
    const fromUtc = nowUtc.clone().subtract(1, "minute");
    const toUtc = nowUtc.clone().add(1, "minute");

    const campaigns: {
      id: number;
      scheduledAt: string;
      nextScheduledAt: string;
      campaignType: string;
      status: string;
    }[] = await sequelize.query(
      `SELECT id, "scheduledAt", "nextScheduledAt", "campaignType", status
   FROM "Campaigns" c
   WHERE (
     (
       "scheduledAt" BETWEEN :fromUtc AND :toUtc
       AND status = 'PROGRAMADA'
       AND "executionCount" = 0
     )
     OR
     (
       "nextScheduledAt" BETWEEN :fromUtc AND :toUtc
       AND status = 'PROGRAMADA'
       AND "isRecurring" = true
     )
     OR
     (
       "campaignType" = 'email'
       AND status = 'EM_ANDAMENTO'
       AND "nextScheduledAt" IS NOT NULL
       AND "nextScheduledAt" <= :toUtc
     )
   )
   AND status NOT IN ('FINALIZADA', 'CANCELADA')`,
      {
        replacements: {
          fromUtc: fromUtc.toDate(),
          toUtc: toUtc.toDate()
        },
        type: QueryTypes.SELECT
      }
    );

    if (campaigns.length > 0) {
      logger.info(`Campanhas encontradas: ${campaigns.length}`);

      const promises = campaigns.map(async campaign => {
        try {
          const result = await sequelize.query(
            `UPDATE "Campaigns"
 SET
   status = 'EM_ANDAMENTO',
   "nextScheduledAt" = NULL,
   "lastExecutedAt" = NOW(),
   "updatedAt" = NOW()
 WHERE id = :id
   AND status IN ('PROGRAMADA', 'EM_ANDAMENTO')
   AND status NOT IN ('FINALIZADA', 'CANCELADA')
 RETURNING id, "scheduledAt", "nextScheduledAt"`,
            {
              replacements: { id: campaign.id },
              type: QueryTypes.SELECT
            }
          );

          if (!result || result.length === 0) {
            logger.info(
              `[VERIFY-CAMPAIGNS] Campanha ${campaign.id} não está mais disponível para processamento`
            );
            return null;
          }

          const executeAt = campaign.nextScheduledAt || campaign.scheduledAt;
          const scheduledAt =
            executeAt && moment.utc(executeAt).isValid()
              ? moment.utc(executeAt)
              : moment.utc();

          const delay = Math.max(
            0,
            scheduledAt.diff(moment.utc(), "milliseconds")
          );

          logger.info(
            `[VERIFY-CAMPAIGNS] Campanha ${campaign.id} enviada para processamento: Delay=${delay}ms, Horário agendado=${executeAt || "agora"}`
          );

          const campaignDetails = await Campaign.findByPk(campaign.id);

          if (campaignDetails?.isRecurring) {
            const timeDiff = scheduledAt.diff(moment.utc(), "seconds");

            if (timeDiff > 120) {
              logger.info(
                `[VERIFY-CAMPAIGNS] Campanha ${campaign.id} recorrente: horário agendado ainda está muito no futuro (${timeDiff}s)`
              );
              return null;
            }
          }

          if (delay < 1000) {
            return campaignQueue.add(
              "ProcessCampaign",
              { id: campaign.id },
              {
                priority: 3,
                removeOnComplete: { age: 60 * 60, count: 10 },
                removeOnFail: { age: 60 * 60, count: 10 }
              }
            );
          }

          return campaignQueue.add(
            "ProcessCampaign",
            { id: campaign.id },
            {
              priority: 3,
              delay,
              removeOnComplete: { age: 60 * 60, count: 10 },
              removeOnFail: { age: 60 * 60, count: 10 }
            }
          );
        } catch (err) {
          Sentry.captureException(err);
          return null;
        }
      });

      const validPromises = (await Promise.all(promises)).filter(p => p !== null);
      logger.info(`${validPromises.length} campanhas processadas efetivamente`);
    }
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Error processing campaigns: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

async function getCampaign(id, useCache = true) {
  if (useCache) {
    const cached = getCachedCampaign(id);
    if (cached) return cached;
  }

  const campaign = await Campaign.findOne({
    where: { id },
    include: [
      {
        model: ContactList,
        as: "contactList",
        attributes: ["id", "name"],
        required: false,
        include: [
          {
            model: ContactListItem,
            as: "contacts",
            attributes: [
              "id",
              "name",
              "number",
              "email",
              "isWhatsappValid",
              "isGroup"
            ],
            required: false
          }
        ]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "channel", "token", "status"]
      }
    ]
  });

  if (!campaign) {
    return null;
  }

  if (campaign.tagListId && !campaign.contactListId) {
    logger.info(`[TAG-CAMPAIGN] Buscando contatos por tagId: ${campaign.tagListId} para campanha: ${id}`);

    const contacts = await Contact.findAll({
      attributes: [
        "id",
        "name",
        "number",
        "email",
        "isGroup"
      ],
      where: {
        companyId: campaign.companyId,
        active: true
      },
      include: [{
        model: ContactTag,
        as: "contactTags",
        where: { tagId: campaign.tagListId },
        attributes: [],
        required: true
      }]
    });

    logger.info(`[TAG-CAMPAIGN] ${contacts.length} contatos encontrados para tag ${campaign.tagListId} na campanha ${id}`);

    const formattedContacts = contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      number: contact.number,
      email: contact.email,
      isWhatsappValid: true,
      isGroup: contact.isGroup || false
    }));

    (campaign as any).contactList = {
      id: null,
      name: `Tag ${campaign.tagListId}`,
      contacts: formattedContacts
    };
  }

  setCachedCampaign(id, campaign);
  return campaign;
}

async function getContact(id, campaignId = null) {
  const cacheKey = `${id}:${campaignId}`;
  const cached = getCachedContact(cacheKey);
  if (cached) return cached;

  let companyId = null;
  let isTagCampaign = false;
  if (campaignId) {
    const cachedCampaign = getCachedCampaign(campaignId);
    if (cachedCampaign) {
      companyId = cachedCampaign.companyId;
      isTagCampaign = cachedCampaign.tagListId && !cachedCampaign.contactListId;
    } else {
      const campaign = await Campaign.findByPk(campaignId, {
        attributes: ["companyId", "tagListId", "contactListId"]
      });
      if (campaign) {
        companyId = campaign.companyId;
        isTagCampaign = campaign.tagListId && !campaign.contactListId;
      }
    }
  }

  let result = null;

  if (isTagCampaign) {
    const whereClause = companyId ? { id, companyId } : { id };
    result = await Contact.findOne({
      where: whereClause,
      attributes: ["id", "name", "number", "email", "isGroup"]
    });
    if (!result) {
      logger.error(`[CAMPAIGN] Contato ${id} não encontrado (tag, company: ${companyId})`);
    }
  } else {
    result = await ContactListItem.findByPk(id, {
      attributes: ["id", "name", "number", "email", "isGroup"]
    });
    if (!result) {
      const whereClause = companyId ? { id, companyId } : { id };
      result = await Contact.findOne({
        where: whereClause,
        attributes: ["id", "name", "number", "email", "isGroup"]
      });
      if (!result) {
        logger.error(`[CAMPAIGN] Contato ${id} não encontrado em nenhuma tabela (company: ${companyId})`);
      }
    }
  }

  if (result) setCachedContact(cacheKey, result);
  return result;
}

async function getSettings(campaign): Promise<CampaignSettings> {
  const cached = getCachedSettings(campaign.companyId);
  if (cached) return cached;

  try {
    const settings = await CampaignSetting.findAll({
      where: { companyId: campaign.companyId },
      attributes: ["key", "value"]
    });

    let messageInterval: number = 20;
    let longerIntervalAfter: number = 20;
    let greaterInterval: number = 60;
    let jitterPercent: number = 40;
    let longPauseEvery: number = 50;
    let longPauseDuration: number = 30;
    let variables: any[] = [];

    settings.forEach(setting => {
      try {
        const val = JSON.parse(setting.value);
        if (setting.key === "messageInterval") messageInterval = val;
        else if (setting.key === "longerIntervalAfter") longerIntervalAfter = val;
        else if (setting.key === "greaterInterval") greaterInterval = val;
        else if (setting.key === "jitterPercent") jitterPercent = val;
        else if (setting.key === "longPauseEvery") longPauseEvery = val;
        else if (setting.key === "longPauseDuration") longPauseDuration = val;
        else if (setting.key === "variables") variables = val;
      } catch (_) { }
    });

    const result: CampaignSettings = {
      messageInterval,
      longerIntervalAfter,
      greaterInterval,
      jitterPercent,
      longPauseEvery,
      longPauseDuration,
      variables
    };

    setCachedSettings(campaign.companyId, result);
    return result;
  } catch (error) {
    logger.error(`[CAMPAIGN] Erro ao buscar settings: ${error.message}`);
    throw error;
  }
}

export function parseToMilliseconds(seconds) {
  return seconds * 1000;
}

async function sleep(seconds) {
  logger.info(
    `Sleep de ${seconds} segundos iniciado: ${moment().format("HH:mm:ss")}`
  );
  return new Promise(resolve => {
    setTimeout(() => {
      logger.info(
        `Sleep de ${seconds} segundos finalizado: ${moment().format(
          "HH:mm:ss"
        )}`
      );
      resolve(true);
    }, parseToMilliseconds(seconds));
  });
}

function getCampaignValidMessages(campaign) {
  const messages = [];

  if (!isEmpty(campaign.message1) && !isNil(campaign.message1)) {
    messages.push(campaign.message1);
  }

  if (!isEmpty(campaign.message2) && !isNil(campaign.message2)) {
    messages.push(campaign.message2);
  }

  if (!isEmpty(campaign.message3) && !isNil(campaign.message3)) {
    messages.push(campaign.message3);
  }

  if (!isEmpty(campaign.message4) && !isNil(campaign.message4)) {
    messages.push(campaign.message4);
  }

  if (!isEmpty(campaign.message5) && !isNil(campaign.message5)) {
    messages.push(campaign.message5);
  }

  return messages;
}

function getCampaignValidConfirmationMessages(campaign) {
  const messages = [];

  if (
    !isEmpty(campaign.confirmationMessage1) &&
    !isNil(campaign.confirmationMessage1)
  ) {
    messages.push(campaign.confirmationMessage1);
  }

  if (
    !isEmpty(campaign.confirmationMessage2) &&
    !isNil(campaign.confirmationMessage2)
  ) {
    messages.push(campaign.confirmationMessage2);
  }

  if (
    !isEmpty(campaign.confirmationMessage3) &&
    !isNil(campaign.confirmationMessage3)
  ) {
    messages.push(campaign.confirmationMessage3);
  }

  if (
    !isEmpty(campaign.confirmationMessage4) &&
    !isNil(campaign.confirmationMessage4)
  ) {
    messages.push(campaign.confirmationMessage4);
  }

  if (
    !isEmpty(campaign.confirmationMessage5) &&
    !isNil(campaign.confirmationMessage5)
  ) {
    messages.push(campaign.confirmationMessage5);
  }

  return messages;
}

function getProcessedMessage(
  msg: string,
  variables: any[],
  contact: any,
  timezone = "America/Sao_Paulo"
) {
  let finalMessage = msg;
  const now = moment().tz(timezone);

  if (finalMessage.includes("{nome}")) {
    finalMessage = finalMessage.replace(/{nome}/g, contact.name);
  }

  if (finalMessage.includes("{primeiroNome}")) {
    const firstName = contact.name ? contact.name.split(" ")[0] : "";
    finalMessage = finalMessage.replace(/{primeiroNome}/g, firstName);
  }

  if (finalMessage.includes("{email}")) {
    finalMessage = finalMessage.replace(/{email}/g, contact.email);
  }

  if (finalMessage.includes("{numero}")) {
    finalMessage = finalMessage.replace(/{numero}/g, contact.number);
  }

  if (finalMessage.includes("{atendente}")) {
    finalMessage = finalMessage.replace(/{atendente}/g, contact.userName || "Atendente");
  }

  if (finalMessage.includes("{greeting}")) {
    const hour = now.hour();
    let greeting = "Olá";

    if (hour >= 6 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    else greeting = "Boa noite";

    finalMessage = finalMessage.replace(/{greeting}/g, greeting);
  }

  if (finalMessage.includes("{protocol}")) {
    const protocol = `${now.format("YYYYMMDDHHmmss")}${contact.id || ""}`;
    finalMessage = finalMessage.replace(/{protocol}/g, protocol);
  }

  if (variables[0]?.value !== "[]") {
    variables.forEach(variable => {
      if (finalMessage.includes(`{${variable.key}}`)) {
        const regex = new RegExp(`{${variable.key}}`, "g");
        finalMessage = finalMessage.replace(regex, variable.value);
      }
    });
  }

  return finalMessage;
}

export function randomValue(min, max) {
  return Math.floor(Math.random() * max) + min;
}

export function calcHumanizedDelay(params: {
  index: number;
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  jitterPercent?: number;
  longPauseEvery?: number;
  longPauseDuration?: number;
}): number {
  const MIN_DELAY_MS = 5000;

  const {
    index,
    messageInterval,
    longerIntervalAfter,
    greaterInterval,
    jitterPercent = 40,
    longPauseEvery = 50,
    longPauseDuration = 30,
  } = params;

  let baseSeconds: number;
  if (index > longerIntervalAfter) {
    const progress = Math.min((index - longerIntervalAfter) / Math.max(longerIntervalAfter, 1), 1);
    baseSeconds = messageInterval + (greaterInterval - messageInterval) * progress;
  } else {
    baseSeconds = messageInterval;
  }

  const jitterFactor = jitterPercent > 0
    ? (1 - jitterPercent / 100) + Math.random() * (2 * jitterPercent / 100)
    : 1;
  let delayMs = baseSeconds * 1000 * jitterFactor;

  if (longPauseEvery > 0 && index > 0 && index % longPauseEvery === 0) {
    const extraPause = longPauseDuration * 1000 + Math.random() * (longPauseDuration * 500);
    delayMs += extraPause;
    logger.info(`[CAMPAIGN-DELAY] Pausa longa aplicada no contato ${index} (+${Math.round(extraPause / 1000)}s)`);
  }

  return Math.max(delayMs, MIN_DELAY_MS);
}

async function verifyAndFinalizeCampaign(campaign) {
  const campaignId = campaign.id;

  const existingLock = campaignVerificationLocks.get(campaignId);
  if (existingLock) {
    logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} já está sendo processada, aguardando conclusão...`);
    try {
      await existingLock;
    } catch (err) { }
    return;
  }

  const verificationPromise = (async () => {
    try {
      const freshCampaign = await Campaign.findByPk(campaignId);
      if (!freshCampaign) {
        logger.warn(`[VERIFY CAMPAIGN] Campanha ${campaignId} não encontrada`);
        return;
      }

      if (freshCampaign.status === 'FINALIZADA' || freshCampaign.status === 'CANCELADA') {
        logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} já está ${freshCampaign.status}, ignorando verificação`);
        return;
      }

      const campaignWithContacts = await getCampaign(campaignId);

      let totalContacts = 0;

      if (freshCampaign.tagListId && !freshCampaign.contactListId) {
        totalContacts = await CampaignShipping.count({
          where: { campaignId: campaignId }
        });
      } else if (campaignWithContacts?.contactList?.contacts) {
        totalContacts = campaignWithContacts.contactList.contacts.length;
      }

      if (totalContacts === 0) {
        logger.warn(`[VERIFY CAMPAIGN] Campanha ${campaignId} não tem contatos para verificar`);
        return;
      }

      const companyId = freshCampaign.companyId;

      const deliveredCount = await CampaignShipping.count({
        where: {
          campaignId: campaignId,
          deliveredAt: {
            [Op.ne]: null
          }
        }
      });

      const currentExecutionCount = Math.floor(deliveredCount / totalContacts);
      const remainingMessages = deliveredCount % totalContacts;

      logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId}: ${deliveredCount} mensagens entregues de ${totalContacts} contatos, ${currentExecutionCount} execuções completas, ${remainingMessages} mensagens restantes`);
      logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId}: isRecurring=${freshCampaign.isRecurring}, maxExecutions=${freshCampaign.maxExecutions}, status=${freshCampaign.status}`);

      if (freshCampaign.isRecurring) {
        if (remainingMessages === 0 && currentExecutionCount > freshCampaign.executionCount) {
          const [updatedRows] = await Campaign.update(
            {
              executionCount: currentExecutionCount,
              lastExecutedAt: new Date()
            },
            {
              where: {
                id: campaignId,
                executionCount: { [Op.lt]: currentExecutionCount }
              }
            }
          );

          if (updatedRows > 0) {
            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} recorrente: execução ${currentExecutionCount} completa, executionCount atualizado de ${freshCampaign.executionCount} para ${currentExecutionCount}`);

            await freshCampaign.reload();
          }
        } else if (remainingMessages > 0) {
          logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} recorrente: execução ${currentExecutionCount + 1} ainda em andamento (${remainingMessages}/${totalContacts} mensagens restantes), aguardando conclusão`);
          return;
        }
      } else {
        if (currentExecutionCount > freshCampaign.executionCount) {
          const [updatedRows] = await Campaign.update(
            {
              executionCount: currentExecutionCount,
              lastExecutedAt: new Date()
            },
            {
              where: {
                id: campaignId,
                executionCount: { [Op.lt]: currentExecutionCount }
              }
            }
          );

          if (updatedRows > 0) {
            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} executionCount atualizado de ${freshCampaign.executionCount} para ${currentExecutionCount}`);
            await freshCampaign.reload();
          }
        }
      }

      await freshCampaign.reload();
      const finalExecutionCount = freshCampaign.executionCount;

      if (freshCampaign.isRecurring) {
        if (freshCampaign.maxExecutions && finalExecutionCount >= freshCampaign.maxExecutions) {
          logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} atingiu limite de ${freshCampaign.maxExecutions} execuções - finalizando`);

          await Campaign.update(
            {
              status: "FINALIZADA",
              completedAt: moment(),
              nextScheduledAt: null
            },
            {
              where: {
                id: campaignId,
                status: { [Op.ne]: 'FINALIZADA' }
              }
            }
          );

          await emitCompanyEvent(companyId, `company-${companyId}-campaign`, {
            action: "update",
            record: await Campaign.findByPk(campaignId)
          });
          return;
        }

        if (finalExecutionCount < (freshCampaign.maxExecutions || Infinity)) {
          await freshCampaign.reload();

          if (freshCampaign.status !== 'FINALIZADA' && freshCampaign.status !== 'CANCELADA') {
            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} é recorrente - agendando próxima execução (${finalExecutionCount}/${freshCampaign.maxExecutions || 'ilimitado'})`);

            await RecurrenceService.scheduleNextExecution(campaignId);

            await Campaign.update(
              { status: 'PROGRAMADA' },
              {
                where: {
                  id: campaignId,
                  status: 'EM_ANDAMENTO'
                }
              }
            );

            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId}: status atualizado para PROGRAMADA após agendar próxima execução`);

            await freshCampaign.reload();

            await emitCompanyEvent(companyId, `company-${companyId}-campaign`, {
              action: "update",
              record: freshCampaign
            });
            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId}: notificação enviada ao frontend com nextScheduledAt=${freshCampaign.nextScheduledAt}`);
          } else {
            logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} está ${freshCampaign.status}, não agendando próxima execução`);
          }
        }
      } else {
        if (deliveredCount >= totalContacts) {
          logger.info(`[VERIFY CAMPAIGN] Campanha ${campaignId} não é recorrente - todas as ${deliveredCount} mensagens foram entregues - finalizando`);

          await Campaign.update(
            {
              status: "FINALIZADA",
              completedAt: moment()
            },
            {
              where: {
                id: campaignId,
                status: { [Op.ne]: 'FINALIZADA' }
              }
            }
          );
        }
      }

      const updatedCampaign = await Campaign.findByPk(campaignId);
      if (updatedCampaign) {
        await emitCompanyEvent(companyId, `company-${companyId}-campaign`, {
          action: "update",
          record: updatedCampaign
        });
      }
    } catch (err: any) {
      logger.error(`[VERIFY CAMPAIGN] Erro ao verificar campanha ${campaignId}: ${err.message}`);
      Sentry.captureException(err);
    } finally {
      campaignVerificationLocks.delete(campaignId);
    }
  })();

  campaignVerificationLocks.set(campaignId, verificationPromise);

  await verificationPromise;
}

async function handleProcessCampaign(job) {
  try {
    const {
      id,
      restartMode,
      messageInterval: customMessageInterval,
      longerIntervalAfter: customLongerIntervalAfter,
      greaterInterval: customGreaterInterval
    }: ProcessCampaignData = job.data;

    const campaign = await getCampaign(id, false);

    if (!campaign) {
      logger.error(`[PROCESS-CAMPAIGN] Campanha ${id} não encontrada`);
      return;
    }

    if (campaign.status === "FINALIZADA" || campaign.status === "CANCELADA") {
      logger.info(`[PROCESS-CAMPAIGN] Campanha ${id} está ${campaign.status}, abortando processamento`);
      return;
    }

    if (campaign.isRecurring && campaign.status !== "EM_ANDAMENTO") {
      logger.warn(`[PROCESS-CAMPAIGN] Campanha ${id} recorrente não está com status EM_ANDAMENTO, abortando`);
      return;
    }

    const settings = await getSettings(campaign);

    if (!campaign.contactList) {
      logger.error(`[PROCESS-CAMPAIGN] Campanha ${id} não tem contactList. Verificando se é campanha de tag...`);

      const freshCampaign = await getCampaign(id, false);

      if (!freshCampaign?.contactList) {
        logger.error(`[PROCESS-CAMPAIGN] Campanha ${id} ainda sem contactList após recarga. Abortando.`);
        return;
      }

      Object.assign(campaign, freshCampaign);
    }

    const contacts = campaign.contactList?.contacts;

    if (!isArray(contacts) || contacts.length === 0) {
      logger.error(
        `[PROCESS-CAMPAIGN] Campanha ${id} sem contatos válidos para disparar. contactList=${JSON.stringify(
          campaign.contactList?.id
        )}, contacts=${contacts?.length ?? "null"}`
      );
      return;
    }

    const filteredContacts =
      campaign.campaignType === "email"
        ? contacts.filter(contact => contact.email)
        : contacts.filter(contact => contact.isWhatsappValid === true && contact.number);

    let contactData = filteredContacts.map(contact => ({
      contactId: contact.id,
      campaignId: campaign.id,
      variables: settings.variables,
      isGroup: contact.isGroup
    }));

    if (campaign.campaignType === "email") {
      await Campaign.update(
        { emailTotal: contactData.length },
        { where: { id: campaign.id } }
      );

      const deliveredEmails = await CampaignShipping.findAll({
        where: {
          campaignId: campaign.id,
          emailStatus: "sent"
        },
        attributes: ["email"],
        raw: true
      });

      const deliveredEmailSet = new Set(
        deliveredEmails
          .map((item: any) => item.email)
          .filter(Boolean)
      );

      contactData = contactData.filter(item => {
        const contact = filteredContacts.find(c => c.id === item.contactId);
        return contact?.email && !deliveredEmailSet.has(contact.email);
      });

      logger.info(
        `[EMAIL-CAMPAIGN] Campanha ${campaign.id}: total=${filteredContacts.length}, já enviados=${deliveredEmailSet.size}, pendentes=${contactData.length}`
      );
    }

    if (campaign.isRecurring) {
      logger.info(
        `[PROCESS-CAMPAIGN] Campanha ${campaign.id} recorrente - execução ${campaign.executionCount + 1}: processando ${contactData.length} contatos`
      );
    }

    if (restartMode) {
      const deliveredNumbers = await CampaignShipping.findAll({
        where: {
          campaignId: campaign.id,
          deliveredAt: { [Op.ne]: null }
        },
        attributes: campaign.campaignType === "email" ? ["email"] : ["number"],
        raw: true
      });

      const deliveredKeysSet = new Set(
        deliveredNumbers.map((d: any) =>
          campaign.campaignType === "email" ? d.email : d.number
        )
      );

      const pendingContacts = contacts.filter(contact => {
        const key = campaign.campaignType === "email" ? contact.email : contact.number;
        return key && !deliveredKeysSet.has(key);
      });

      contactData = pendingContacts.map(contact => ({
        contactId: contact.id,
        campaignId: campaign.id,
        variables: settings.variables,
        isGroup: contact.isGroup
      }));

      console.log(`[RESTART] Campanha ${campaign.id}: ${contactData.length} contatos pendentes de ${contacts.length} total`);
    }

    const messageInterval = restartMode ? customMessageInterval || 20 : settings.messageInterval;
    const longerIntervalAfter = restartMode ? customLongerIntervalAfter || 20 : settings.longerIntervalAfter;
    const greaterInterval = restartMode ? customGreaterInterval || 60 : settings.greaterInterval;
    const jitterPercent = settings.jitterPercent ?? 40;
    const longPauseEvery = settings.longPauseEvery ?? 50;
    const longPauseDuration = settings.longPauseDuration ?? 30;
    const emailRatePerMinute = Number(campaign.emailRatePerMinute);
    const emailIntervalSeconds = Math.max(1, Math.ceil(60 / emailRatePerMinute));

    if (contactData.length === 0) {
      logger.info(`[PROCESS-CAMPAIGN] Nenhum contato pendente encontrado para campanha ${campaign.id}`);

      if (campaign.campaignType === "email") {
        await verifyAndFinalizeCampaign(campaign);
      }

      return;
    }

    if (campaign.campaignType === "email") {
      const emailProvider = campaign.emailProvider || "sendgrid";

      const setting = await EmailSetting.findOne({
        where: {
          companyId: campaign.companyId,
          provider: emailProvider,
          isActive: true
        }
      });

      if (!setting) {
        logger.error(
          `[EMAIL-CAMPAIGN] Configuração de email não encontrada ou inativa para o provedor. Campanha=${campaign.id}; Provider=${emailProvider}`
        );

        return;
      }

      const dailyLimit = Number(campaign.emailDailyLimit);

      const todayStart = moment().startOf("day").toDate();
      const todayEnd = moment().endOf("day").toDate();

      const sentToday = await CampaignShipping.count({
        where: {
          campaignId: campaign.id,
          emailStatus: "sent",
          emailSentAt: {
            [Op.gte]: todayStart as any,
            [Op.lte]: todayEnd as any
          } as any
        } as any
      });

      const remainingToday = Math.max(0, dailyLimit - sentToday);

      const continueHour = campaign.emailContinueHour;

      const [hour, minute] = String(continueHour).split(":").map(Number);

      const tomorrow = moment()
        .add(1, "day")
        .startOf("day")
        .hour(Number.isFinite(hour) ? hour : 8)
        .minute(Number.isFinite(minute) ? minute : 0)
        .second(0)
        .millisecond(0)
        .toDate();

      if (remainingToday <= 0) {
        logger.info(
          `[EMAIL-CAMPAIGN] Limite diário já atingido. Campanha=${campaign.id}; Enviados hoje=${sentToday}/${dailyLimit}; Próxima execução=${moment(tomorrow).format("YYYY-MM-DD HH:mm:ss")}`
        );

        await Campaign.update(
          {
            status: "EM_ANDAMENTO",
            nextScheduledAt: tomorrow,
            updatedAt: new Date()
          },
          { where: { id: campaign.id } }
        );

        return;
      }

      if (contactData.length > remainingToday) {
        logger.info(
          `[EMAIL-CAMPAIGN] Limitando jobs de hoje. Campanha=${campaign.id}; Criando ${remainingToday} de ${contactData.length} contatos pendentes; Próxima execução=${moment(tomorrow).format("YYYY-MM-DD HH:mm:ss")}`
        );

        contactData = contactData.slice(0, remainingToday);

        await Campaign.update(
          {
            status: "EM_ANDAMENTO",
            nextScheduledAt: tomorrow,
            updatedAt: new Date()
          },
          { where: { id: campaign.id } }
        );
      }
    }

    const queuePromises = [];
    let currentDelay = 0;

    for (let i = 0; i < contactData.length; i++) {
      const { contactId, campaignId, variables } = contactData[i];

      const stepDelay =
        campaign.campaignType === "email"
          ? emailIntervalSeconds * 1000
          : calcHumanizedDelay({
            index: i,
            messageInterval,
            longerIntervalAfter,
            greaterInterval,
            jitterPercent,
            longPauseEvery,
            longPauseDuration
          });

      currentDelay += stepDelay;

      const queuePromise = campaignQueue.add(
        "PrepareContact",
        { contactId, campaignId, variables },
        {
          removeOnComplete: true,
          delay: currentDelay
        }
      );

      queuePromises.push(queuePromise);
    }

    logger.info(`[CAMPAIGN] ${queuePromises.length} jobs adicionados à fila para campanha ${campaign.id}`);
    await Promise.all(queuePromises);
  } catch (err: any) {
    const campaignId = job?.data?.id ?? "desconhecido";
    logger.error(`[PROCESS-CAMPAIGN] ERRO CRÍTICO na campanha ${campaignId}: ${err.message}`);
    Sentry.captureException(err);
  }
}

function calculateDelay(
  index,
  baseDelay,
  longerIntervalAfter,
  greaterInterval,
  messageInterval
) {
  const diffSeconds = differenceInSeconds(baseDelay, new Date());

  const humanizedStep = calcHumanizedDelay({
    index,
    messageInterval,
    longerIntervalAfter,
    greaterInterval,
  });

  const finalDelay = diffSeconds * 1000 + humanizedStep;

  console.log(`[CALCULATE-DELAY] Index: ${index}, DiffSeconds: ${diffSeconds}, HumanizedStep: ${humanizedStep}ms, FinalDelay: ${finalDelay}ms`);

  return finalDelay;
}

async function handlePrepareContact(job) {
  try {
    const { contactId, campaignId, variables }: PrepareContactData = job.data;

    const campaign = await getCampaign(campaignId);

    if (!campaign) {
      return;
    }

    if (campaign.status === "CANCELADA") {
      return;
    }

    const contact = await getContact(contactId, campaignId);

    if (!contact) {
      logger.error(`[CAMPAIGN] Contato ${contactId} não encontrado para campanha ${campaignId}`);
      return;
    }

    // Validação baseada no tipo de campanha
    if (campaign.campaignType === "email") {
      if (!contact.email) {
        logger.error(`[EMAIL-CAMPAIGN] Contato ${contactId} (${contact.name || "sem nome"}) não possui email`);
        return;
      }
    } else {
      if (!contact.number) {
        logger.error(`[CAMPAIGN] Contato ${contactId} (${contact.name || 'sem nome'}) não possui número de telefone`);
        return;
      }
    }

    const userTimezone = await getUserTimezone(campaign.userId);

    const campaignShipping: any = {};
    campaignShipping.number = contact.number;
    campaignShipping.email = contact.email;
    campaignShipping.emailStatus = campaign.campaignType === "email" ? "pending" : null;

    if (campaign.tagListId && !campaign.contactListId) {
      campaignShipping.contactId = null;
    } else {
      campaignShipping.contactId = contactId;
    }

    campaignShipping.campaignId = campaignId;
    const messages = getCampaignValidMessages(campaign);

    if (messages.length >= 0) {
      const radomIndex = randomValue(0, messages.length);

      const message = getProcessedMessage(
        messages[radomIndex] || "",
        variables,
        contact,
        userTimezone
      );

      campaignShipping.message = message === null ? "" : `\u200c ${message}`;
    }

    if (campaign.confirmation) {
      const confirmationMessages = getCampaignValidConfirmationMessages(campaign);
      if (confirmationMessages.length) {
        const radomIndex = randomValue(0, confirmationMessages.length);
        const message = getProcessedMessage(
          confirmationMessages[radomIndex] || "",
          variables,
          contact,
          userTimezone
        );
        campaignShipping.confirmationMessage = `\u200c ${message}`;
      }
    }

    let record, created;

    if (campaign.isRecurring) {
      let whereClause;
      if (campaign.tagListId && !campaign.contactListId) {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          number: campaignShipping.number,
          deliveredAt: null
        };
      } else {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          contactId: campaignShipping.contactId,
          deliveredAt: null
        };
      }

      const existingRecord = await CampaignShipping.findOne({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      if (existingRecord) {
        record = existingRecord;
        created = false;
      } else {
        record = await CampaignShipping.create(campaignShipping);
        created = true;
        logger.info(`[PREPARE-CONTACT] Campanha ${campaign.id} recorrente: criado novo registro ${record.id} para contato ${campaignShipping.number}`);
      }
    } else {
      let whereClause;
      if (campaign.tagListId && !campaign.contactListId) {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          number: campaignShipping.number
        };
      } else {
        whereClause = {
          campaignId: campaignShipping.campaignId,
          contactId: campaignShipping.contactId
        };
      }

      [record, created] = await CampaignShipping.findOrCreate({
        where: whereClause,
        defaults: campaignShipping
      });
    }

    if (!created && record.deliveredAt !== null) {
      return;
    }

    if (
      !created &&
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      record.set(campaignShipping);
      await record.save();
    }

    if (
      record.deliveredAt === null &&
      record.confirmationRequestedAt === null
    ) {
      const nextJob = await campaignQueue.add(
        "DispatchCampaign",
        {
          campaignId: campaign.id,
          campaignShippingId: record.id,
          contactListItemId: contactId
        }
      );

      await record.update({ jobId: String(nextJob.id) });
    }

  } catch (err: any) {
    console.log(`[PREPARE-CONTACT] ERRO no job ${job.id}:`, err.message);
    console.log(`[PREPARE-CONTACT] Stack trace:`, err.stack);
    Sentry.captureException(err);
    logger.error(`campaignQueue -> PrepareContact -> error: ${err.message}`);
  }
}

async function handleDispatchCampaign(job) {
  try {
    const { data } = job;
    const { campaignShippingId, campaignId }: DispatchCampaignData = data;

    const campaign = await getCampaign(campaignId);

    if (!campaign) {
      logger.error(`[CAMPAIGN] Campanha ${campaignId} não encontrada`);
      return;
    }

    if (campaign.status === "CANCELADA") {
      return;
    }

    // Processamento de campanha de email
    if (campaign.campaignType === "email") {
      const campaignShipping = await CampaignShipping.findByPk(
        campaignShippingId,
        {
          include: [{ model: ContactListItem, as: "contact" }]
        }
      );

      if (!campaignShipping) {
        logger.error(`[EMAIL-CAMPAIGN] CampaignShipping ${campaignShippingId} não encontrado`);
        return;
      }

      // Verificar se já foi enviado
      if (campaignShipping.emailStatus === "sent") {
        logger.info(
          `[EMAIL-CAMPAIGN] Ignorando envio já realizado. CampaignShipping=${campaignShippingId}`
        );
        return;
      }

      const emailTo =
        campaignShipping.email ||
        campaignShipping.contact?.email;

      if (!emailTo) {
        await campaignShipping.update({
          emailStatus: "failed",
          emailError: "Contato sem email"
        });
        return;
      }

      try {
        const subject = campaign.emailSubject || campaign.name;

        const validEmailHtmls = [
          campaign.emailHtml,
          campaign.emailHtml2,
          campaign.emailHtml3,
          campaign.emailHtml4,
          campaign.emailHtml5
        ].filter(item => item && String(item).trim() !== "");

        const randomHtml =
          validEmailHtmls[randomValue(0, validEmailHtmls.length)] ||
          campaign.emailHtml ||
          campaign.message1 ||
          "";

        const html = getProcessedMessage(
          randomHtml,
          [],
          {
            name: campaignShipping.contact?.name || "",
            email: emailTo,
            number: campaignShipping.number || ""
          }
        );

        const emailProvider = campaign.emailProvider || "sendgrid";

        const setting = await EmailSetting.findOne({
          where: {
            companyId: campaign.companyId,
            provider: emailProvider,
            isActive: true
          }
        });

        if (!setting) {
          throw new Error("Configuração de email não encontrada ou inativa.");
        }

        const dailyLimit = Number(campaign.emailDailyLimit);
        const ratePerMinute = Number(campaign.emailRatePerMinute);

        const delayMs = Math.ceil(60000 / ratePerMinute);

        const todayStart = moment().startOf("day").toDate();
        const todayEnd = moment().endOf("day").toDate();

        const sentToday = await CampaignShipping.count({
          where: {
            campaignId: campaign.id,
            emailStatus: "sent",
            emailSentAt: {
              [Op.gte]: todayStart as any,
              [Op.lte]: todayEnd as any
            } as any
          }
        });

        if (sentToday >= dailyLimit) {
          const continueHour = campaign.emailContinueHour;
          const [hour, minute] = continueHour.split(":").map(Number);

          const tomorrow = moment()
            .add(1, "day")
            .startOf("day")
            .hour(Number.isFinite(hour) ? hour : 8)
            .minute(Number.isFinite(minute) ? minute : 0)
            .second(0)
            .millisecond(0)
            .toDate();

          await campaignShipping.update({
            emailStatus: "pending",
            emailError: null
          });

          const jobId = `email-campaign-${campaignId}-shipping-${campaignShippingId}-${moment(tomorrow).format("YYYYMMDDHHmm")}`;

          const existingJob = await campaignQueue.getJob(jobId);

          if (!existingJob) {
            await campaignQueue.add(
              "DispatchCampaign",
              {
                campaignShippingId,
                campaignId
              },
              {
                delay: moment(tomorrow).diff(moment()),
                jobId,
                removeOnComplete: true,
                removeOnFail: false
              }
            );

            logger.info(
              `[EMAIL-CAMPAIGN] Limite diário atingido. Campanha=${campaignId}; Enviados hoje=${sentToday}/${dailyLimit}; Reagendado para ${moment(tomorrow).format("YYYY-MM-DD HH:mm:ss")}`
            );
          }

          return;
        }

        const finalSubject = subject;
        const finalHtml = html;

        await EmailMarketingService.send(setting, {
          to: emailTo,
          subject: finalSubject,
          html: finalHtml
        });

        await delay(delayMs);

        const result = {
          messageId: null,
          statusCode: 202
        };

        await campaignShipping.update({
          emailStatus: "sent",
          emailMessageId: result.messageId,
          emailSentAt: moment(),
          deliveredAt: moment()
        });

        await Campaign.increment("emailSent", {
          by: 1,
          where: { id: campaign.id }
        });

        await verifyAndFinalizeCampaign(campaign);

        await emitCompanyEvent(
          campaign.companyId,
          `company-${campaign.companyId}-campaign`,
          {
            action: "update",
            record: await Campaign.findByPk(campaign.id)
          }
        );

        logger.info(
          `[EMAIL-CAMPAIGN] Email enviado: Campanha=${campaignId};Email=${emailTo}`
        );

        return;
      } catch (err: any) {
        await campaignShipping.update({
          emailStatus: "failed",
          emailError: err.message || String(err)
        });

        await Campaign.increment("emailFailed", {
          by: 1,
          where: { id: campaign.id }
        });

        logger.error(`[EMAIL-CAMPAIGN] Erro ao enviar email: ${err.message}`);
        Sentry.captureException(err);
        return;
      }
    }

    // Processamento de campanha de WhatsApp
    if (!campaign.whatsapp) {
      logger.error(`[CAMPAIGN] WhatsApp não encontrado para campanha ${campaignId}`);
      return;
    }

    const isOficial = campaign.whatsapp.channel === "whatsapp_oficial";

    let wbot = null;
    if (!isOficial) {
      wbot = await GetWhatsappWbot(campaign.whatsapp);

      if (!wbot) {
        logger.error(`[CAMPAIGN] Wbot não encontrado para campanha ${campaignId}`);
        return;
      }

      if (!wbot?.user?.id) {
        logger.error(`[CAMPAIGN] Usuário do wbot não encontrado para campanha ${campaignId}`);
        return;
      }
    }

    logger.info(`Disparo de campanha solicitado: Campanha=${campaignId};Registro=${campaignShippingId}${isOficial ? ' (API Oficial)' : ''}`);

    const campaignShipping = await CampaignShipping.findByPk(
      campaignShippingId,
      {
        include: [{ model: ContactListItem, as: "contact" }]
      }
    );

    if (!campaignShipping) {
      logger.error(`[CAMPAIGN] CampaignShipping ${campaignShippingId} não encontrado`);
      return;
    }

    let chatId;
    if (campaignShipping.contact && campaignShipping.contact.isGroup) {
      chatId = `${campaignShipping.number}@g.us`;
    } else {
      const isGroupNumber = campaignShipping.number.includes('@') || campaignShipping.number.length > 15;
      chatId = isGroupNumber
        ? `${campaignShipping.number}@g.us`
        : `${campaignShipping.number}@s.whatsapp.net`;
    }

    if (isOficial) {
      try {
        await handleDispatchCampaignOficial(campaign, campaignShipping, chatId);
        await campaignShipping.update({ deliveredAt: moment() });
      } catch (dispatchErr) {
        const errMsg = dispatchErr?.message || String(dispatchErr);
        logger.error(`[DISPATCH-CAMPAIGN-OFICIAL] Falha ao enviar para ${campaignShipping.number}: ${errMsg}`);

        await campaignShipping.update({ confirmationRequestedAt: null }).catch(() => { });

        const totalCount = await CampaignShipping.count({ where: { campaignId: campaign.id } });
        const deliveredCount = await CampaignShipping.count({ where: { campaignId: campaign.id, deliveredAt: { [Op.ne]: null } } });
        const pendingCount = await CampaignShipping.count({ where: { campaignId: campaign.id, deliveredAt: null, confirmationRequestedAt: null } });

        logger.warn(`[DISPATCH-CAMPAIGN-OFICIAL] Campanha ${campaign.id}: total=${totalCount}, entregues=${deliveredCount}, pendentes=${pendingCount}`);

        if (pendingCount === 0 && deliveredCount === 0 && totalCount > 0) {
          logger.error(`[DISPATCH-CAMPAIGN-OFICIAL] Campanha ${campaign.id} sem nenhuma entrega - mudando para CANCELADA`);
          await Campaign.update(
            { status: 'CANCELADA', completedAt: moment() },
            { where: { id: campaign.id, status: { [Op.ne]: 'FINALIZADA' } } }
          );
          await emitCompanyEvent(
            campaign.companyId,
            `company-${campaign.companyId}-campaign`,
            {
              action: "update",
              record: { id: campaign.id, status: "CANCELADA" }
            }
          );
        }

        return;
      }

      if (campaign.isRecurring) {
        await campaign.reload();
        if (campaign.status !== 'EM_ANDAMENTO') return;
        const deliveredCount = await CampaignShipping.count({
          where: { campaignId: campaign.id, deliveredAt: { [Op.ne]: null } }
        });
        const campaignWithContacts = await getCampaign(campaign.id);
        const totalContacts = campaignWithContacts?.contactList?.contacts?.length || 0;
        if (totalContacts > 0) {
          const remainingMessages = deliveredCount % totalContacts;
          const currentExecution = Math.floor(deliveredCount / totalContacts);
          if (remainingMessages === 0 && deliveredCount > 0) {
            const expectedExecution = campaign.executionCount;
            if (currentExecution > expectedExecution) {
              await verifyAndFinalizeCampaign(campaign);
            }
          }
        }
      } else {
        await verifyAndFinalizeCampaign(campaign);
      }

      await emitCompanyEvent(
        campaign.companyId,
        `company-${campaign.companyId}-campaign`,
        { action: "update", record: campaign }
      );
      return;
    }

    if (campaign.openTicket === "enabled") {
      const [contact] = await Contact.findOrCreate({
        where: {
          number: campaignShipping.number,
          companyId: campaign.companyId
        },
        defaults: {
          companyId: campaign.companyId,
          name: campaignShipping.contact ? campaignShipping.contact.name : "Contato da Campanha",
          number: campaignShipping.number,
          email: campaignShipping.contact ? campaignShipping.contact.email : "",
          whatsappId: campaign.whatsappId,
          profilePicUrl: ""
        }
      });
      const whatsapp = await Whatsapp.findByPk(campaign.whatsappId);

      let ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId: campaign.companyId,
          whatsappId: whatsapp.id,
          status: ["open", "pending"]
        }
      });

      if (!ticket) {
        ticket = await Ticket.create({
          companyId: campaign.companyId,
          contactId: contact.id,
          whatsappId: whatsapp.id,
          queueId: campaign?.queueId,
          userId: campaign?.userId,
          status: campaign?.statusTicket
        });
      }

      ticket = await ShowTicketService(ticket.id, campaign.companyId);

      if (whatsapp.status === "CONNECTED") {
        const interactiveButtons = getCampaignInteractiveButtons(campaign);
        const campaignJid = getJidOf(chatId);
        if (campaign.confirmation && campaignShipping.confirmation === null) {
          const confirmationMessage = await wbot.sendMessage(campaignJid, {
            text: `\u200c ${campaignShipping.confirmationMessage}`
          });

          await verifyMessage(
            confirmationMessage,
            ticket,
            contact,
            null,
            true,
            false
          );

          await campaignShipping.update({ confirmationRequestedAt: moment() });
        } else {
          if (!campaign.mediaPath) {
            const sentMessage = interactiveButtons.length
              ? await sendCampaignButtons({
                wbot,
                jid: campaignJid,
                bodyText: `\u200c ${campaignShipping.message}`,
                buttons: interactiveButtons
              })
              : await wbot.sendMessage(campaignJid, {
                text: `\u200c ${campaignShipping.message}`
              });

            await verifyMessage(
              sentMessage,
              ticket,
              contact,
              null,
              true,
              false
            );
          }

          if (campaign.mediaPath) {
            const publicFolder = path.resolve(__dirname, "..", "public");
            const filePath = path.join(
              publicFolder,
              `company${campaign.companyId}`,
              campaign.mediaPath
            );

            const options = await getMessageOptions(
              campaign.mediaName,
              filePath,
              String(campaign.companyId),
              `\u200c ${campaignShipping.message}`
            );
            if (Object.keys(options).length) {
              if (options.mimetype === "audio/mp4") {
                const audioMessage = await wbot.sendMessage(campaignJid, {
                  text: `\u200c ${campaignShipping.message}`
                });

                await verifyMessage(
                  audioMessage,
                  ticket,
                  contact,
                  null,
                  true,
                  false
                );
              }
              const attachImage = interactiveButtons.length > 0 && Boolean(options.image);
              const attachVideo = interactiveButtons.length > 0 && Boolean(options.video);

              if (attachImage || attachVideo) {
                const buttonsMessage = await sendCampaignButtons({
                  wbot,
                  jid: campaignJid,
                  bodyText: `\u200c ${campaignShipping.message}`,
                  buttons: interactiveButtons,
                  headerImageBuffer: attachImage ? fs.readFileSync(filePath) : undefined,
                  headerVideoBuffer: attachVideo ? fs.readFileSync(filePath) : undefined,
                  headerMediaMimeType: options.mimetype
                });
                await verifyMessage(
                  buttonsMessage,
                  ticket,
                  contact,
                  null,
                  true,
                  false
                );
              } else {
                const sentMessage = await wbot.sendMessage(campaignJid, {
                  ...options
                });

                await verifyMediaMessage(
                  sentMessage,
                  ticket,
                  ticket.contact,
                  null,
                  false,
                  true,
                  wbot
                );

                if (interactiveButtons.length) {
                  const buttonsMessage = await sendCampaignButtons({
                    wbot,
                    jid: campaignJid,
                    bodyText: `\u200c ${campaignShipping.message}`,
                    buttons: interactiveButtons
                  });
                  await verifyMessage(
                    buttonsMessage,
                    ticket,
                    contact,
                    null,
                    true,
                    false
                  );
                }
              }
            }
          }
        }
        await campaignShipping.update({ deliveredAt: moment() });
      }
    } else {
      const interactiveButtons = getCampaignInteractiveButtons(campaign);
      const campaignJid = getJidOf(chatId);
      if (campaign.confirmation && campaignShipping.confirmation === null) {
        await wbot.sendMessage(campaignJid, {
          text: campaignShipping.confirmationMessage
        });
        await campaignShipping.update({ confirmationRequestedAt: moment() });
      } else {
        if (!campaign.mediaPath) {
          if (interactiveButtons.length) {
            await sendCampaignButtons({
              wbot,
              jid: campaignJid,
              bodyText: campaignShipping.message,
              buttons: interactiveButtons
            });
          } else {
            await wbot.sendMessage(campaignJid, {
              text: campaignShipping.message
            });
          }
        }

        if (campaign.mediaPath) {
          const publicFolder = path.resolve(__dirname, "..", "public");
          const filePath = path.join(
            publicFolder,
            `company${campaign.companyId}`,
            campaign.mediaPath
          );

          const options = await getMessageOptions(
            campaign.mediaName,
            filePath,
            String(campaign.companyId),
            campaignShipping.message
          );
          if (Object.keys(options).length) {
            if (options.mimetype === "audio/mp4") {
              await wbot.sendMessage(campaignJid, {
                text: campaignShipping.message
              });
            }
            const attachImage = interactiveButtons.length > 0 && Boolean(options.image);
            const attachVideo = interactiveButtons.length > 0 && Boolean(options.video);

            if (attachImage || attachVideo) {
              await sendCampaignButtons({
                wbot,
                jid: campaignJid,
                bodyText: campaignShipping.message,
                buttons: interactiveButtons,
                headerImageBuffer: attachImage ? fs.readFileSync(filePath) : undefined,
                headerVideoBuffer: attachVideo ? fs.readFileSync(filePath) : undefined,
                headerMediaMimeType: options.mimetype
              });
            } else {
              await wbot.sendMessage(campaignJid, { ...options });
              if (interactiveButtons.length) {
                await sendCampaignButtons({
                  wbot,
                  jid: campaignJid,
                  bodyText: campaignShipping.message,
                  buttons: interactiveButtons
                });
              }
            }
          }
        }
      }

      await campaignShipping.update({ deliveredAt: moment() });
    }

    if (campaign.isRecurring) {
      await campaign.reload();

      if (campaign.status !== 'EM_ANDAMENTO') {
        logger.info(`[DISPATCH-CAMPAIGN] Campanha ${campaign.id} não está mais EM_ANDAMENTO (status: ${campaign.status}), não verificando`);
        return;
      }

      const deliveredCount = await CampaignShipping.count({
        where: {
          campaignId: campaign.id,
          deliveredAt: { [Op.ne]: null }
        }
      });

      let totalContacts = 0;
      if (campaign.tagListId && !campaign.contactListId) {
        totalContacts = await CampaignShipping.count({
          where: { campaignId: campaign.id }
        });
      } else {
        const campaignWithContacts = await getCampaign(campaign.id);
        totalContacts = campaignWithContacts?.contactList?.contacts?.length || 0;
      }

      if (totalContacts > 0) {
        const remainingMessages = deliveredCount % totalContacts;
        const currentExecution = Math.floor(deliveredCount / totalContacts);

        logger.info(`[DISPATCH-CAMPAIGN] Campanha ${campaign.id} recorrente: ${deliveredCount} mensagens entregues, execução ${currentExecution + 1}, ${remainingMessages}/${totalContacts} mensagens restantes`);

        if (remainingMessages === 0 && deliveredCount > 0) {
          const expectedExecution = campaign.executionCount;

          if (currentExecution > expectedExecution) {
            logger.info(`[DISPATCH-CAMPAIGN] Campanha ${campaign.id} recorrente: execução ${currentExecution} completa detectada (esperado ${expectedExecution}), verificando se deve agendar próxima`);
            await verifyAndFinalizeCampaign(campaign);
          } else if (currentExecution === expectedExecution) {
            logger.info(`[DISPATCH-CAMPAIGN] Campanha ${campaign.id} recorrente: execução ${currentExecution} já foi processada (executionCount=${expectedExecution}), aguardando próxima execução`);
          } else {
            logger.warn(`[DISPATCH-CAMPAIGN] Campanha ${campaign.id} recorrente: execução ${currentExecution} menor que esperado (${expectedExecution}), possível inconsistência`);
          }
        }
      }
    } else {
      await verifyAndFinalizeCampaign(campaign);
    }

    await emitCompanyEvent(
      campaign.companyId,
      `company-${campaign.companyId}-campaign`,
      {
        action: "update",
        record: campaign
      }
    );

    logger.info(
      `Campanha enviada para: Campanha=${campaignId};Contato=${campaignShipping.contact ? campaignShipping.contact.name : campaignShipping.number}`
    );
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(err.message);
    console.log(err.stack);
  }
}

async function handleLoginStatus(job) {
  const thresholdTime = new Date();
  thresholdTime.setMinutes(thresholdTime.getMinutes() - 5);

  await User.update(
    { online: false },
    {
      where: {
        updatedAt: { [Op.lt]: thresholdTime },
        online: true
      }
    }
  );
}

async function handleResumeTicketsOutOfHour(job) {
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"],
          where: {
            timeSendQueue: { [Op.gt]: 0 }
          }
        }
      ]
    });

    companies.map(async c => {
      c.whatsapps.map(async w => {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const tempoPassado = moment()
                .subtract(timeQueue, "minutes")
                .utc()
                .format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: [
                      "id",
                      "name",
                      "number",
                      "email",
                      "profilePicUrl",
                      "acceptAudioMessage",
                      "active",
                      "disableBot",
                      "urlPicture",
                      "lgpdAcceptedAt",
                      "companyId"
                    ],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: [
                      "id",
                      "name",
                      "expiresTicket",
                      "groupAsTicket",
                      "color"
                    ]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await ticket.reload();

                  await emitCompanyEvent(companyId, `company-${companyId}-ticket`, {
                    action: "update",
                    ticket,
                    ticketId: ticket.id
                  });

                  logger.info(
                    `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                  );
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}

async function handleVerifyQueue(job) {
  try {
    const companies = await Company.findAll({
      attributes: ["id", "name"],
      where: {
        status: true
      },
      include: [
        {
          model: Whatsapp,
          attributes: ["id", "name", "status", "timeSendQueue", "sendIdQueue"]
        }
      ]
    });

    companies.map(async c => {
      c.whatsapps.map(async w => {
        if (w.status === "CONNECTED") {
          var companyId = c.id;

          const moveQueue = w.timeSendQueue ? w.timeSendQueue : 0;
          const moveQueueId = w.sendIdQueue;
          const moveQueueTime = moveQueue;
          const idQueue = moveQueueId;
          const timeQueue = moveQueueTime;

          if (moveQueue > 0) {
            if (
              !isNaN(idQueue) &&
              Number.isInteger(idQueue) &&
              !isNaN(timeQueue) &&
              Number.isInteger(timeQueue)
            ) {
              const tempoPassado = moment()
                .subtract(timeQueue, "minutes")
                .utc()
                .format();

              const { count, rows: tickets } = await Ticket.findAndCountAll({
                attributes: ["id"],
                where: {
                  status: "pending",
                  queueId: null,
                  companyId: companyId,
                  whatsappId: w.id,
                  updatedAt: {
                    [Op.lt]: tempoPassado
                  }
                },
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: [
                      "id",
                      "name",
                      "number",
                      "email",
                      "profilePicUrl",
                      "acceptAudioMessage",
                      "active",
                      "disableBot",
                      "urlPicture",
                      "lgpdAcceptedAt",
                      "companyId"
                    ],
                    include: ["extraInfo", "tags"]
                  },
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  },
                  {
                    model: Whatsapp,
                    as: "whatsapp",
                    attributes: [
                      "id",
                      "name",
                      "expiresTicket",
                      "groupAsTicket",
                      "color"
                    ]
                  }
                ]
              });

              if (count > 0) {
                tickets.map(async ticket => {
                  await ticket.update({
                    queueId: idQueue
                  });

                  await CreateLogTicketService({
                    userId: null,
                    queueId: idQueue,
                    ticketId: ticket.id,
                    type: "redirect"
                  });

                  await ticket.reload();

                  await emitCompanyEvent(companyId, `company-${companyId}-ticket`, {
                    action: "update",
                    ticket,
                    ticketId: ticket.id
                  });

                  logger.info(
                    `Atendimento Perdido: ${ticket.id} - Empresa: ${companyId}`
                  );
                });
              }
            } else {
              logger.info(`Condição não respeitada - Empresa: ${companyId}`);
            }
          }
        }
      });
    });
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("SearchForQueue -> VerifyQueue: error", e.message);
    throw e;
  }
}

async function handleRandomUser() {
  const jobR = new CronJob('0 */5 * * * *', async () => {

    try {
      const companies = await Company.findAll({
        attributes: ['id', 'name'],
        where: {
          status: true
        },
        include: [
          {
            model: Queues,
            attributes: ["id", "name", "ativarRoteador", "tempoRoteador"],
            where: {
              ativarRoteador: true,
              tempoRoteador: {
                [Op.ne]: 0
              }
            }
          },
        ]
      });

      if (companies) {
        companies.map(async c => {
          c.queues.map(async q => {
            const { count, rows: tickets } = await Ticket.findAndCountAll({
              where: {
                companyId: c.id,
                status: "pending",
                queueId: q.id,
              },
              include: [
                {
                  model: Contact,
                  as: "contact",
                  include: [
                    {
                      model: ContactWallet,
                      as: "contactWallets",
                      where: {
                        queueId: q.id
                      },
                      required: false
                    }
                  ]
                }
              ]
            });

            const getRandomUserId = (userIds) => {
              const randomIndex = Math.floor(Math.random() * userIds.length);
              return userIds[randomIndex];
            };

            const findUserById = async (userId, companyId) => {
              try {
                const user = await User.findOne({
                  where: {
                    id: userId,
                    companyId
                  },
                });

                if (user && user?.profile === "user") {
                  if (user.online === true) {
                    return user.id;
                  } else {
                    return 0;
                  }
                } else {
                  return 0;
                }

              } catch (errorV) {
                Sentry.captureException(errorV);
                logger.error(`[VerifyUsersRandom] VerifyUsersRandom: error ${JSON.stringify(errorV)}`);
                throw errorV;
              }
            };

            if (count > 0) {
              for (const ticket of tickets) {
                const { queueId, userId } = ticket;
                const tempoRoteador = q.tempoRoteador;

                if (ticket.contact && ticket.contact.contactWallets && ticket.contact.contactWallets.length > 0) {
                  const hasWalletForQueue = ticket.contact.contactWallets.some(wallet => wallet.queueId === queueId);

                  if (hasWalletForQueue) {
                    logger.info(`[RANDOM USER] Ticket ${ticket.id} possui carteira definida para fila ${queueId} - pulando randomização`);
                    continue;
                  }
                }
                const userQueues = await UserQueue.findAll({
                  where: {
                    queueId: queueId,
                  },
                });

                const userIds = userQueues.map((userQueue) => userQueue.userId);

                const tempoPassadoB = moment().subtract(tempoRoteador, "minutes").utc().toDate();
                const updatedAtV = new Date(ticket.updatedAt);

                let settings = await CompaniesSettings.findOne({
                  where: {
                    companyId: ticket.companyId
                  }
                });

                const sendGreetingMessageOneQueues = settings.sendGreetingMessageOneQueues === "enabled" || false;

                if (!userId) {
                  const randomUserId = getRandomUserId(userIds);

                  if (randomUserId !== undefined && await findUserById(randomUserId, ticket.companyId) > 0) {

                    await UpdateTicketService({
                      ticketData: { status: "pending", userId: randomUserId, queueId: queueId },
                      ticketId: ticket.id,
                      companyId: ticket.companyId,

                    });

                    logger.info(`Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`);
                  } else {
                  }

                } else if (userIds.includes(userId)) {
                  if (tempoPassadoB > updatedAtV) {
                    const availableUserIds = userIds.filter((id) => id !== userId);

                    if (availableUserIds.length > 0) {
                      const randomUserId = getRandomUserId(availableUserIds);

                      if (randomUserId !== undefined && await findUserById(randomUserId, ticket.companyId) > 0) {

                        await UpdateTicketService({
                          ticketData: { status: "pending", userId: randomUserId, queueId: queueId },
                          ticketId: ticket.id,
                          companyId: ticket.companyId,

                        });

                        logger.info(`Ticket ID ${ticket.id} atualizado para UserId ${randomUserId} - ${ticket.updatedAt}`);
                      } else {
                      }

                    }
                  }
                }

              }
            }
          })
        })
      }
    } catch (e) {
      Sentry.captureException(e);
      logger.error(`[VerifyUsersRandom] VerifyUsersRandom: error ${JSON.stringify(e)}`);
      throw e;
    }

  });

  jobR.start();
}

async function handleProcessLanes() {
  const job = new CronJob("*/5 * * * *", async () => {
    const companies = await Company.findAll({
      include: [
        {
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "useKanban"],
          where: {
            useKanban: true
          }
        }
      ]
    });
    companies.map(async c => {
      try {
        const companyId = c.id;

        const ticketTags = await TicketTag.findAll({
          include: [
            {
              model: Ticket,
              as: "ticket",
              where: {
                status: "open",
                fromMe: true,
                companyId
              },
              attributes: ["id", "contactId", "updatedAt", "whatsappId"]
            },
            {
              model: Tag,
              as: "tag",
              attributes: [
                "id",
                "timeLane",
                "nextLaneId",
                "greetingMessageLane"
              ],
              where: {
                companyId
              }
            }
          ]
        });

        if (ticketTags.length > 0) {
          ticketTags.map(async t => {
            if (
              !isNil(t?.tag.nextLaneId) &&
              t?.tag.nextLaneId > 0 &&
              t?.tag.timeLane > 0
            ) {
              const nextTag = await Tag.findByPk(t?.tag.nextLaneId);

              const dataLimite = new Date();
              dataLimite.setMinutes(
                dataLimite.getMinutes() - Number(t.tag.timeLane)
              );
              const dataUltimaInteracaoChamado = new Date(t.ticket.updatedAt);

              if (dataUltimaInteracaoChamado < dataLimite) {
                await TicketTag.destroy({
                  where: { ticketId: t.ticketId, tagId: t.tagId }
                });
                await TicketTag.create({
                  ticketId: t.ticketId,
                  tagId: nextTag.id
                });

                const whatsapp = await Whatsapp.findByPk(t.ticket.whatsappId);

                if (
                  !isNil(nextTag.greetingMessageLane) &&
                  nextTag.greetingMessageLane !== ""
                ) {
                  const bodyMessage = nextTag.greetingMessageLane;

                  const ticketUpdate = await ShowTicketService(
                    t.ticketId,
                    companyId
                  );

                  if (ticketUpdate.channel === "whatsapp") {
                    const sentMessage = await SendWhatsAppMessage({
                      body: bodyMessage,
                      ticket: ticketUpdate
                    });

                    await verifyMessage(
                      sentMessage,
                      ticketUpdate,
                      ticketUpdate.contact
                    );
                  }

                  if (ticketUpdate.channel === "whatsapp_oficial") {
                    await SendWhatsAppOficialMessage({
                      body: bodyMessage,
                      ticket: ticketUpdate,
                      quotedMsg: null,
                      type: 'text',
                      media: null,
                      vCard: null
                    });
                  }

                  if (nextTag.mediaFiles) {
                    try {
                      const mediaFiles = JSON.parse(nextTag.mediaFiles);
                      for (const mediaFile of mediaFiles) {

                        if (ticketUpdate.channel === "whatsapp") {
                          const sentMedia = await SendWhatsAppMedia({
                            media: mediaFile,
                            ticket: ticketUpdate
                          });
                          await verifyMessage(
                            sentMedia,
                            ticketUpdate,
                            ticketUpdate.contact
                          );
                        }

                        if (ticketUpdate.channel === "whatsapp_oficial") {
                          const mediaSrc = {
                            fieldname: 'medias',
                            originalname: mediaFile.originalname,
                            encoding: '7bit',
                            mimetype: mediaFile.mimetype,
                            filename: mediaFile.filename,
                            path: mediaFile.path
                          } as Express.Multer.File

                          await SendWhatsAppOficialMessage({
                            body: "",
                            ticket: ticketUpdate,
                            type: mediaFile.mimetype.split("/")[0],
                            media: mediaSrc
                          });
                        }

                      }

                    } catch (error) {
                      console.log("Error sending media files in auto lane movement:", error);
                    }
                  }
                }
              }
            }
          });
        }
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("Process Lanes -> Verify: error", e.message);
        throw e;
      }
    });
  });
  job.start();
}

async function handleCloseTicketsAutomatic() {
  const job = new CronJob("0 * * * * *", async () => {
    const companies = await Company.findAll({
      where: {
        status: true
      }
    });

    companies.map(async c => {
      try {
        const companyId = c.id;
        await ClosedAllOpenTickets(companyId);
      } catch (e: any) {
        Sentry.captureException(e);
        logger.error("ClosedAllOpenTickets -> Verify: error", e.message);
        throw e;
      }
    });
  });

  job.start();
}

async function handleInvoiceCreate() {
  logger.info("GERANDO RECEITA...");
  const job = new CronJob("0 * * * *", async () => {
    try {
      const companies = await Company.findAll({
        where: {
          generateInvoice: true
        }
      });

      for (const c of companies) {
        try {
          const { status, dueDate, id: companyId, planId } = c;

          if (!dueDate || !moment(dueDate).isValid()) {
            logger.warn(`EMPRESA: ${companyId} - dueDate inválido ou nulo: ${dueDate}, pulando...`);
            continue;
          }

          const date = moment(dueDate).format();
          const timestamp = moment().format();
          const hoje = moment().format("DD/MM/yyyy");
          const vencimento = moment(dueDate).format("DD/MM/yyyy");
          const diff = moment(vencimento, "DD/MM/yyyy").diff(
            moment(hoje, "DD/MM/yyyy")
          );
          const dias = moment.duration(diff).asDays();

          if (status === true) {
            if (dias <= -3) {
              logger.info(
                `EMPRESA: ${companyId} está VENCIDA A MAIS DE 3 DIAS... INATIVANDO... ${dias}`
              );

              await c.update({ status: false });
              logger.info(`EMPRESA: ${companyId} foi INATIVADA.`);
              logger.info(
                `EMPRESA: ${companyId} Desativando conexões com o WhatsApp...`
              );

              try {
                const whatsapps = await Whatsapp.findAll({
                  where: { companyId },
                  attributes: ["id", "status", "session"]
                });

                for (const whatsapp of whatsapps) {
                  if (whatsapp.session) {
                    await whatsapp.update({
                      status: "DISCONNECTED",
                      session: ""
                    });

                    try {
                      const wbot = getWbot(whatsapp.id);
                      await wbot.logout();
                      logger.info(
                        `EMPRESA: ${companyId} teve o WhatsApp ${whatsapp.id} desconectado...`
                      );
                    } catch (wbotError) {
                      logger.warn(
                        `Erro ao desconectar WhatsApp ${whatsapp.id} da empresa ${companyId}: ${wbotError.message}`
                      );
                    }
                  }
                }
              } catch (whatsappError) {
                logger.error(
                  `Erro ao desconectar WhatsApps da empresa ${companyId}: ${whatsappError.message}`
                );
                Sentry.captureException(whatsappError);
              }
            } else {
              const plan = await Plan.findByPk(planId);

              if (!plan) {
                logger.error(
                  `EMPRESA: ${companyId} - Plano não encontrado (planId: ${planId})`
                );
                continue;
              }

              const valuePlan = plan.amount.replace(",", ".");

              const sql = `SELECT * FROM "Invoices" WHERE "companyId" = ${c.id} AND "status" = 'open';`
              const openInvoices = await sequelize.query(sql, { type: QueryTypes.SELECT }) as { id: number, dueDate: Date | string | null }[];
              const existingInvoice = openInvoices.find(invoice => {
                if (!invoice.dueDate) return false;
                try {
                  const invoiceDate = moment(invoice.dueDate);
                  if (!invoiceDate.isValid()) return false;
                  return invoiceDate.format("DD/MM/yyyy") === vencimento;
                } catch (error) {
                  logger.warn(`Erro ao processar dueDate da fatura ${invoice.id}: ${error.message}`);
                  return false;
                }
              });

              if (existingInvoice) {
              }

              if (openInvoices.length > 0) {
                const invoiceToUpdate = openInvoices[0];
                const planCurrency = ["BRL", "COP", "USD"].includes(String(plan.currency).toUpperCase())
                  ? String(plan.currency).toUpperCase()
                  : "BRL";
                const updateSql = `UPDATE "Invoices" SET "dueDate" = '${date}', value = ${valuePlan}, currency = '${planCurrency}' WHERE "id" = ${invoiceToUpdate.id};`;
                await sequelize.query(updateSql, { type: QueryTypes.UPDATE });

                logger.info(`Fatura Atualizada ID: ${invoiceToUpdate.id} com valor ${valuePlan}`);

              } else {
                const planCurrency = ["BRL", "COP", "USD"].includes(String(plan.currency).toUpperCase())
                  ? String(plan.currency).toUpperCase()
                  : "BRL";
                const sql = `INSERT INTO "Invoices" ("companyId", "dueDate", detail, status, value, currency, users, connections, queues, "updatedAt", "createdAt")
            VALUES (${c.id}, '${date}', '${plan.name}', 'open', ${valuePlan}, '${planCurrency}', ${plan.users}, ${plan.connections}, ${plan.queues}, '${timestamp}', '${timestamp}');`
                const invoiceInsert = await sequelize.query(sql, { type: QueryTypes.INSERT });

                logger.info(`Fatura Gerada para o cliente: ${c.id}`);
              }
            }
          }
        } catch (e: any) {
          Sentry.captureException(e);
          logger.error("InvoiceCreate -> Verify: error", e);
          throw e;
        }
      }
    } catch (e: any) {
      Sentry.captureException(e);
      logger.error("InvoiceCreate -> Verify: error", e);
      throw e;
    }
  });
  job.start();
}

async function handleLidRetry(job) {
  try {
    const { data } = job;
    const { contactId, whatsappId, companyId, number, retryCount, maxRetries = 5 } = data as LidRetryData;

    logger.info(`[RDS-LID-RETRY] Tentativa ${retryCount} de obter LID para contato ${contactId} (${number})`);

    const contact = await Contact.findByPk(contactId);
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!contact) {
      logger.error(`[RDS-LID-RETRY] Contato ${contactId} não encontrado. Cancelando retentativa.`);
      return;
    }

    if (!whatsapp || whatsapp.status !== "CONNECTED") {
      logger.error(`[RDS-LID-RETRY] WhatsApp ${whatsappId} não está conectado. Reagendando retentativa.`);

      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: 5 * 60 * 1000,
            attempts: 1,
            removeOnComplete: true
          }
        );
      } else {
        logger.warn(`[RDS-LID-RETRY] Número máximo de tentativas (${maxRetries}) atingido para contato ${contactId}. Desistindo.`);
      }
      return;
    }

    try {
      const localMap = await WhatsappLidMap.findOne({
        where: { companyId, contactId }
      });

      if (localMap) {
        logger.info(`[RDS-LID-RETRY] LID já existe localmente para contato ${contactId}: ${localMap.lid}`);

        if (!contact.lid || contact.lid !== localMap.lid) {
          await contact.update({ lid: localMap.lid });
        }

        return;
      }

      const wbot = getWbot(whatsappId);

      if (!wbot) {
        throw new Error(`Instância WhatsApp ${whatsappId} não encontrada no wbot`);
      }

      const formattedNumber = number.endsWith("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

      const ow = await wbot.onWhatsApp(formattedNumber);

      if (ow?.[0]?.exists) {
        const lid = (ow[0] as any).lid as string;

        if (lid) {
          logger.info(`[RDS-LID-RETRY] LID ${lid} obtido via onWhatsApp para contato ${contactId}`);

          await checkAndDedup(contact, lid);

          await WhatsappLidMap.findOrCreate({
            where: { companyId, contactId, lid },
            defaults: { companyId, contactId, lid }
          });

          if (!contact.lid) {
            await contact.update({ lid });
          }

          logger.info(`[RDS-LID-RETRY] Mapeamento de LID criado/atualizado para contato ${contactId}`);
          return;
        }
      }

      logger.warn(`[RDS-LID-RETRY] Não foi possível obter LID para contato ${contactId} (${number})`);

      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: Math.pow(2, retryCount) * 60 * 1000,
            attempts: 1,
            removeOnComplete: true
          }
        );

        logger.info(`[RDS-LID-RETRY] Reagendada tentativa ${retryCount + 1} para contato ${contactId}`);
      } else {
        logger.warn(`[RDS-LID-RETRY] Número máximo de tentativas (${maxRetries}) atingido para contato ${contactId}. Desistindo.`);
      }
    } catch (error) {
      logger.error(`[RDS-LID-RETRY] Erro ao processar retentativa para contato ${contactId}: ${error.message}`);

      if (retryCount < maxRetries) {
        await lidRetryQueue.add(
          "RetryLidLookup",
          {
            contactId,
            whatsappId,
            companyId,
            number,
            retryCount: retryCount + 1,
            maxRetries
          },
          {
            delay: Math.pow(2, retryCount) * 60 * 1000,
            attempts: 1,
            removeOnComplete: true
          }
        );
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[RDS-LID-RETRY] Erro geral no processador de retentativas: ${err.message}`);
  }
}

export async function startQueueProcess() {
  logger.info("Iniciando processamento de filas");

  messageQueue.process("SendMessage", handleSendMessage);

  scheduleMonitor.process("Verify", handleVerifySchedules);
  renewalMonitor.process(
    "VerifyRenewals",
    async () => {
      await ProcessRenewalNotificationsService();
    }
  );

  await renewalMonitor.add(
    "VerifyRenewals",
    {},
    {
      repeat: {
        cron: "0 * * * * *",
        key: "verify-renewals"
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  );

  scheduleMonitor.process("VerifyReminders", handleVerifyReminders);

  sendScheduledMessages.process("SendMessage", handleSendScheduledMessage);
  sendScheduledMessages.process("SendReminder", handleSendReminder);

  campaignQueue.process("VerifyCampaignsDaatabase", handleVerifyCampaigns);
  campaignQueue.process("ProcessCampaign", handleProcessCampaign);
  campaignQueue.process("PrepareContact", handlePrepareContact);
  campaignQueue.process("DispatchCampaign", 1, handleDispatchCampaign);

  userMonitor.process("VerifyLoginStatus", handleLoginStatus);
  queueMonitor.process("VerifyQueueStatus", handleVerifyQueue);
  lidRetryQueue.process("RetryLidLookup", handleLidRetry);

  initializeBirthdayJobs();

  const { initializeFloupJob } = await import("./jobs/FloupJob");
  initializeFloupJob();

  handleInvoiceCreate();
  handleProcessLanes();
  handleCloseTicketsAutomatic();
  handleRandomUser();

  scheduleMonitor.add(
    "Verify",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify" },
      removeOnComplete: true
    }
  );

  scheduleMonitor.add(
    "VerifyReminders",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-reminders" },
      removeOnComplete: true
    }
  );

  campaignQueue.add(
    "VerifyCampaignsDaatabase",
    {},
    {
      repeat: { cron: "*/60 * * * * *", key: "verify-campaing" },
      removeOnComplete: true
    }
  );

  userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "*/3 * * * *", key: "verify-login" },
      removeOnComplete: true
    }
  );

  queueMonitor.add(
    "VerifyQueueStatus",
    {},
    {
      repeat: { cron: "0 * * * * *", key: "verify-queue" },
      removeOnComplete: true
    }
  );
}
