import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";
import LandingWebhookLog from "../../models/LandingWebhookLog";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";

import SendLandingWebhookWelcomeMessageService from "./SendLandingWebhookWelcomeMessageService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import TriggerFlowService from "../TicketServices/TriggerFlowService";

interface Request {
  token: string;
  payload: any;
}

interface LeadData {
  name: string;
  phone: string;
  email?: string | null;
  product?: string | null;
  source?: string | null;
  message?: string | null;
}

const normalizePhone = (phone: string): string => {
  let cleaned = String(phone || "").replace(/\D/g, "");

  while (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }

  // Regra BR para WhatsApp/Baileys:
  // Remove o 9 extra depois do DDD.
  //
  // Exemplos:
  // 32991311415  -> 553291311415
  // 32999561699  -> 553299561699
  if (cleaned.startsWith("55")) {
    const withoutDdi = cleaned.substring(2);

    if (withoutDdi.length === 11 && withoutDdi[2] === "9") {
      const ddd = withoutDdi.substring(0, 2);
      const numberWithoutNine = withoutDdi.substring(3);

      cleaned = `55${ddd}${numberWithoutNine}`;
    }
  }

  return cleaned;
};

const getBrazilPhoneVariants = (phone: string): string[] => {
  const normalized = normalizePhone(phone);
  const variants = new Set<string>();

  if (normalized) {
    variants.add(normalized);
  }

  // Também procura contato antigo salvo com o 9,
  // mas o padrão oficial usado pelo webhook será sempre sem o 9.
  if (normalized.startsWith("55")) {
    const withoutDdi = normalized.substring(2);

    if (withoutDdi.length === 10) {
      const ddd = withoutDdi.substring(0, 2);
      const number = withoutDdi.substring(2);

      variants.add(`55${ddd}9${number}`);
    }
  }

  return Array.from(variants);
};

const normalizeKey = (value: string): string => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const getPayloadValue = (payload: any, keys: string[]): any => {
  const normalizedKeys = keys.map((key) => normalizeKey(key));

  for (const key of keys) {
    if (payload?.[key] !== undefined && payload?.[key] !== null) {
      return payload[key];
    }

    if (
      payload?.form_fields?.[key] !== undefined &&
      payload?.form_fields?.[key] !== null
    ) {
      return payload.form_fields[key];
    }

    if (
      payload?.fields?.[key]?.value !== undefined &&
      payload?.fields?.[key]?.value !== null
    ) {
      return payload.fields[key].value;
    }

    if (
      payload?.raw_fields?.[key]?.value !== undefined &&
      payload?.raw_fields?.[key]?.value !== null
    ) {
      return payload.raw_fields[key].value;
    }

    const elementorKey = `form_fields[${key}]`;

    if (
      payload?.[elementorKey] !== undefined &&
      payload?.[elementorKey] !== null
    ) {
      return payload[elementorKey];
    }

    const fieldsKey = `fields[${key}]`;

    if (payload?.[fieldsKey] !== undefined && payload?.[fieldsKey] !== null) {
      return payload[fieldsKey];
    }
  }

  if (payload && typeof payload === "object") {
    for (const payloadKey of Object.keys(payload)) {
      const normalizedPayloadKey = normalizeKey(payloadKey);

      if (normalizedKeys.includes(normalizedPayloadKey)) {
        return payload[payloadKey];
      }
    }
  }

  return null;
};

const extractLeadData = (payload: any): LeadData => {
  const name =
    getPayloadValue(payload, [
      "name",
      "nome",
      "nome completo",
      "Nome completo",
      "full_name",
      "fullName",
      "cliente",
      "customer_name",
    ]) || "Lead";

  const rawPhone = getPayloadValue(payload, [
    "phone",
    "telefone",
    "whatsapp",
    "WhatsApp",
    "celular",
    "mobile",
    "customer_phone",
    "numero",
  ]);

  const email =
    getPayloadValue(payload, [
      "email",
      "e-mail",
      "E-mail",
      "mail",
      "customer_email",
      "e_mail",
    ]) || null;

  const product =
    getPayloadValue(payload, [
      "product",
      "produto",
      "Tenho interesse em",
      "tenho interesse em",
      "interest",
      "interesse",
      "offer",
      "oferta",
      "item",
    ]) || null;

  const source =
    getPayloadValue(payload, [
      "source",
      "origem",
      "Origem",
      "utm_source",
      "plataforma",
      "platform",
    ]) || "Landing Page Elementor";

  const message =
    getPayloadValue(payload, [
      "leadMessage",
      "message",
      "mensagem",
      "msg",
      "observacao",
      "observação",
      "comentario",
      "comentário",
      "comments",
      "descricao",
      "descrição",
      "description",
      "duvida",
      "dúvida",
    ]) || null;

  const phone = normalizePhone(rawPhone);

  if (!phone || phone.length < 12) {
    console.log(
      "[LANDING-WEBHOOK] Payload recebido sem telefone válido:",
      payload,
    );

    throw new AppError("Telefone do lead inválido ou não informado.", 400);
  }

  return {
    name: String(name).trim() || "Lead",
    phone,
    email: email ? String(email).trim() : null,
    product: product ? String(product).trim() : null,
    source: source ? String(source).trim() : "Landing Page Elementor",
    message: message ? String(message).trim() : null,
  };
};

const replaceVariables = (message: string, lead: LeadData): string => {
  return message
    .replace(/{{name}}/g, lead.name || "")
    .replace(/{{nome}}/g, lead.name || "")
    .replace(/{{phone}}/g, lead.phone || "")
    .replace(/{{telefone}}/g, lead.phone || "")
    .replace(/{{email}}/g, lead.email || "")
    .replace(/{{product}}/g, lead.product || "")
    .replace(/{{produto}}/g, lead.product || "")
    .replace(/{{source}}/g, lead.source || "")
    .replace(/{{origem}}/g, lead.source || "")
    .replace(/{{message}}/g, lead.message || "")
    .replace(/{{mensagem}}/g, lead.message || "");
};

const findOrCreateContact = async (
  companyId: number,
  lead: LeadData,
): Promise<Contact> => {
  const canonicalPhone = normalizePhone(lead.phone);
  const phoneVariants = getBrazilPhoneVariants(canonicalPhone);

  let contact = await Contact.findOne({
    where: {
      number: {
        [Op.in]: phoneVariants,
      },
      companyId,
    },
  });

  if (contact) {
    if (contact.number !== canonicalPhone) {
      const contactWithCanonical = await Contact.findOne({
        where: {
          number: canonicalPhone,
          companyId,
        },
      });

      if (contactWithCanonical) {
        contact = contactWithCanonical;
      } else {
        await contact.update({
          number: canonicalPhone,
        } as any);
      }
    }

    await contact.update({
      name: lead.name || contact.name,
      email: lead.email || contact.email,
    } as any);

    lead.phone = canonicalPhone;

    return contact;
  }

  contact = await Contact.create({
    name: lead.name,
    number: canonicalPhone,
    email: lead.email,
    companyId,
  } as any);

  lead.phone = canonicalPhone;

  return contact;
};

const findOrCreateTicket = async (
  config: LandingWebhookConfig,
  contact: Contact,
  lead: LeadData,
): Promise<Ticket> => {
  let ticket = await Ticket.findOne({
    where: {
      contactId: contact.id,
      companyId: config.companyId,
      status: {
        [Op.in]: ["open", "pending"],
      },
    },
    order: [["updatedAt", "DESC"]],
  });

  const lastMessage = config.welcomeMessage
    ? replaceVariables(config.welcomeMessage, lead)
    : `Novo lead recebido via ${lead.source}`;

  if (ticket) {
    await ticket.update({
      whatsappId: config.whatsappId || ticket.whatsappId,
      queueId: config.queueId || ticket.queueId,
      userId: config.userId || ticket.userId,
      lastMessage,
    } as any);

    return ticket;
  }

  ticket = await Ticket.create({
    contactId: contact.id,
    companyId: config.companyId,
    whatsappId: config.whatsappId,
    queueId: config.queueId,
    userId: config.userId,
    status: "pending",
    lastMessage,
  } as any);

  return ticket;
};

const formatLeadInitialMessage = (lead: LeadData): string => {
  const lines = [
    "📥 Novo lead recebido pela Landing Page",
    "",
    `👤 Nome: ${lead.name || "Lead"}`,
    `📱 WhatsApp: ${lead.phone || "Não informado"}`,
  ];

  if (lead.email) {
    lines.push(`📧 E-mail: ${lead.email}`);
  }

  if (lead.product) {
    lines.push(`🎯 Interesse: ${lead.product}`);
  }

  if (lead.source) {
    lines.push(`🌐 Origem: ${lead.source}`);
  }

  if (lead.message) {
    lines.push("", "💬 Mensagem do lead:", lead.message);
  }

  return lines.join("\n").trim();
};

const getLeadLastMessage = (lead: LeadData): string => {
  const fallback = `Novo lead recebido via ${lead.source || "Landing Page"}`;
  const base = lead.message || fallback;
  const normalized = String(base).replace(/\s+/g, " ").trim();

  if (!normalized) return fallback;

  return normalized.length > 150
    ? `${normalized.substring(0, 147)}...`
    : normalized;
};

const saveLeadInitialMessage = async ({
  ticket,
  contact,
  lead,
  companyId,
}: {
  ticket: Ticket;
  contact: Contact;
  lead: LeadData;
  companyId: number;
}): Promise<boolean> => {
  const body = formatLeadInitialMessage(lead);

  if (!body) return false;

  await CreateMessageService({
    messageData: {
      wid: `landing-${ticket.id}-${Date.now()}`,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: false,
      read: false,
      mediaType: "chat",
      ack: 0,
      queueId: ticket.queueId,
    } as any,
    companyId,
  });

  await ticket.update({
    lastMessage: getLeadLastMessage(lead),
  } as any);

  return true;
};

const applyTags = async (
  companyId: number,
  contact: Contact,
  tags: any[] = [],
): Promise<void> => {
  if (!Array.isArray(tags) || !tags.length) return;

  for (const item of tags) {
    try {
      let tagId: number | null = null;

      if (typeof item === "number") {
        tagId = item;
      }

      if (typeof item === "string") {
        const tag = await Tag.findOne({
          where: {
            name: item,
            companyId,
          },
        });

        if (tag) {
          tagId = tag.id;
        }
      }

      if (typeof item === "object" && item?.id) {
        tagId = Number(item.id);
      }

      if (!tagId) continue;

      const exists = await ContactTag.findOne({
        where: {
          contactId: contact.id,
          tagId,
        },
      } as any);

      if (!exists) {
        await ContactTag.create({
          contactId: contact.id,
          tagId,
        } as any);
      }
    } catch (err) {
      // Não interrompe a captura do lead caso uma tag esteja inválida.
    }
  }
};

const startFlowIfEnabled = async ({
  config,
  ticket,
}: {
  config: LandingWebhookConfig;
  ticket: Ticket;
}): Promise<{
  flowStarted: boolean;
  flowError: string | null;
}> => {
  if (!config.autoStartFlow || !config.flowId) {
    return {
      flowStarted: false,
      flowError: null,
    };
  }

  try {
    const userId = Number(config.userId || ticket.userId || 1);

    // O TriggerFlowService atual busca ticket com status "open".
    // Então, quando o lead vem da landing, abrimos o ticket antes de iniciar o fluxo.
    if (ticket.status !== "open") {
      await ticket.update({
        status: "open",
        userId: config.userId || ticket.userId || null,
        queueId: config.queueId || ticket.queueId || null,
        whatsappId: config.whatsappId || ticket.whatsappId || null,
      } as any);
    }

    await TriggerFlowService({
      ticketId: ticket.id,
      flowId: Number(config.flowId),
      companyId: config.companyId,
      userId,
    });

    return {
      flowStarted: true,
      flowError: null,
    };
  } catch (err) {
    const flowError =
      err instanceof Error ? err.message : "Erro ao iniciar fluxo automático.";

    console.log(
      "[LANDING-WEBHOOK] Lead capturado, mas falhou ao iniciar fluxo:",
      err,
    );

    return {
      flowStarted: false,
      flowError,
    };
  }
};

const ProcessLandingWebhookLeadService = async ({
  token,
  payload,
}: Request): Promise<any> => {
  const config = await LandingWebhookConfig.findOne({
    where: {
      token,
    },
  });

  if (!config) {
    throw new AppError("Webhook de Landing Page não encontrado.", 404);
  }

  if (!config.isActive) {
    await LandingWebhookLog.create({
      companyId: config.companyId,
      configId: config.id,
      payload,
      status: "inactive",
      errorMessage: "Webhook inativo.",
    } as any);

    throw new AppError("Webhook de Landing Page inativo.", 403);
  }

  try {
    const lead = extractLeadData(payload);

    const contact = await findOrCreateContact(config.companyId, lead);

    const ticket = await findOrCreateTicket(config, contact, lead);

    const leadMessageRegistered = await saveLeadInitialMessage({
      ticket,
      contact,
      lead,
      companyId: config.companyId,
    });

    await applyTags(config.companyId, contact, config.tags || []);

    let welcomeMessageSent = false;
    let welcomeMessageError: string | null = null;

    if (config.autoSendMessage && config.welcomeMessage) {
      const messageBody = replaceVariables(config.welcomeMessage, lead).trim();

      if (messageBody) {
        try {
          await SendLandingWebhookWelcomeMessageService({
            ticketId: ticket.id,
            companyId: config.companyId,
            body: messageBody,
          });

          welcomeMessageSent = true;
        } catch (err) {
          welcomeMessageError =
            err instanceof Error ? err.message : JSON.stringify(err);

          console.log(
            "[LANDING-WEBHOOK] Lead capturado, mas falhou ao enviar mensagem automática:",
            err,
          );
        }
      }
    }

    const { flowStarted, flowError } = await startFlowIfEnabled({
      config,
      ticket,
    });

    let status = "success";
    const errors: string[] = [];

    if (welcomeMessageError) {
      errors.push(`Mensagem automática: ${welcomeMessageError}`);
    }

    if (flowError) {
      errors.push(`Fluxo automático: ${flowError}`);
    }

    if (welcomeMessageError && flowError) {
      status = "success_message_flow_error";
    } else if (welcomeMessageError) {
      status = "success_message_error";
    } else if (flowError) {
      status = "success_flow_error";
    }

    const log = await LandingWebhookLog.create({
      companyId: config.companyId,
      configId: config.id,
      contactId: contact.id,
      ticketId: ticket.id,
      payload,
      status,
      errorMessage: errors.length ? errors.join(" | ") : null,
    } as any);

    return {
      logId: log.id,
      contactId: contact.id,
      ticketId: ticket.id,
      companyId: config.companyId,
      welcomeMessageSent,
      welcomeMessageError,
      flowStarted,
      flowError,
      leadMessageRegistered,
      lead: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        product: lead.product,
        source: lead.source,
        message: lead.message,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao processar lead.";

    await LandingWebhookLog.create({
      companyId: config.companyId,
      configId: config.id,
      payload,
      status: "error",
      errorMessage,
    } as any);

    throw error;
  }
};

export default ProcessLandingWebhookLeadService;
