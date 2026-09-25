import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import { isNil } from "lodash";
import { sendMessageWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import {
  IMetaMessageTemplate,
  IMetaMessageinteractive,
  IReturnMessageMeta,
  ISendMessageOficial
} from "../../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";

interface Request {
  body: string;
  ticket: Ticket;
  type:
  | "text"
  | "reaction"
  | "audio"
  | "document"
  | "image"
  | "sticker"
  | "video"
  | "location"
  | "contacts"
  | "interactive"
  | "template";
  quotedMsg?: Message;
  msdelay?: number;
  media?: Express.Multer.File;
  vCard?: Contact;
  template?: IMetaMessageTemplate;
  interative?: IMetaMessageinteractive;
  bodyToSave?: string;
}

type ParsedLocationPayload = {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
  url: string;
  previewUrl: string;
  bodyText: string;
};

// ==================== HELPER ADICIONADO ====================
const normalizeReactionEmoji = (value?: string): string => {
  const emoji = String(value || "").trim();

  if (!emoji) {
    throw new AppError("Emoji da reação não informado.", 400);
  }

  return emoji;
};
// ==========================================================

// Função para extrair botões do body da mensagem - VERSÃO MELHORADA
const extractButtonsFromBody = (body: string): any[] => {
  if (!body || typeof body !== "string") return [];

  try {
    const lastSeparatorIndex = body.lastIndexOf("||||");
    if (lastSeparatorIndex === -1) return [];

    const buttonsPart = body.substring(lastSeparatorIndex + 4).trim();
    if (!buttonsPart) return [];

    const parsed = JSON.parse(buttonsPart);

    if (!Array.isArray(parsed)) return [];

    const flatButtons: any[] = [];

    parsed.forEach((item: any) => {
      if (Array.isArray(item)) {
        item.forEach(sub => flatButtons.push(sub));
        return;
      }

      if (typeof item === "string") {
        try {
          const parsedItem = JSON.parse(item);
          if (Array.isArray(parsedItem)) {
            parsedItem.forEach(sub => flatButtons.push(sub));
          } else if (parsedItem && typeof parsedItem === "object") {
            flatButtons.push(parsedItem);
          }
        } catch (error) { }
        return;
      }

      if (item && typeof item === "object") {
        flatButtons.push(item);
      }
    });

    return flatButtons.map((button: any, index: number) => ({
      type: String(
        button?.type ||
        (button?.url ? "URL" : button?.phone_number ? "PHONE_NUMBER" : "QUICK_REPLY")
      ).toUpperCase(),
      index,
      text:
        button?.text ||
        button?.label ||
        button?.display_text ||
        button?.title ||
        button?.payload ||
        `Botão ${index + 1}`,
      payload: button?.payload || null,
      url: button?.url || button?.link || null,
      phone_number: button?.phone_number || button?.phoneNumber || null,
      example: Array.isArray(button?.example)
        ? button.example
        : button?.example
          ? [button.example]
          : []
    }));
  } catch (error) {
    console.error("[extractButtonsFromBody] Erro ao extrair botões:", error);
    return [];
  }
};

const extractOfficialTemplateHeaderMedia = (
  templatePayload: any
): { mediaType: string | null; mediaUrl: string | null } => {
  const components = Array.isArray(templatePayload?.components)
    ? templatePayload.components
    : [];

  const header = components.find(
    (component: any) => String(component?.type || "").toLowerCase() === "header"
  );

  const parameters = Array.isArray(header?.parameters) ? header.parameters : [];

  for (const parameter of parameters) {
    const paramType = String(parameter?.type || "").toLowerCase();

    if (paramType === "image" && parameter?.image?.link) {
      return { mediaType: "image", mediaUrl: String(parameter.image.link) };
    }

    if (paramType === "video" && parameter?.video?.link) {
      return { mediaType: "video", mediaUrl: String(parameter.video.link) };
    }

    if (paramType === "document" && parameter?.document?.link) {
      return { mediaType: "document", mediaUrl: String(parameter.document.link) };
    }
  }

  return { mediaType: null, mediaUrl: null };
};

const extractOfficialTemplateButtons = (templatePayload: any) => {
  const components = Array.isArray(templatePayload?.components)
    ? templatePayload.components
    : [];

  const normalizeButtonType = (value: any) => {
    const rawType = String(value || "").toUpperCase();

    if (rawType === "URL" || rawType === "CTA_URL") return "URL";
    if (rawType === "PHONE_NUMBER" || rawType === "CTA_CALL") return "PHONE_NUMBER";
    if (rawType === "COPY_CODE" || rawType === "COUPON_CODE") return "COPY_CODE";
    if (rawType === "QUICK_REPLY" || rawType === "QUICK_REPLY_BUTTON") return "QUICK_REPLY";

    return rawType && rawType !== "BUTTON" && rawType !== "BUTTONS"
      ? rawType
      : "QUICK_REPLY";
  };

  const normalizeExample = (value: any) => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  };

  const normalizeButton = (button: any, index: number) => {
    const parameters = Array.isArray(button?.parameters)
      ? button.parameters
      : [];

    const firstParam = parameters[0] || {};

    const fallbackType =
      button?.url || button?.link || firstParam?.url || firstParam?.link
        ? "URL"
        : button?.phone_number ||
          button?.phoneNumber ||
          firstParam?.phone_number ||
          firstParam?.phoneNumber
          ? "PHONE_NUMBER"
          : button?.example || firstParam?.example
            ? "COPY_CODE"
            : "QUICK_REPLY";

    return {
      type: normalizeButtonType(button?.sub_type || button?.type || fallbackType),
      index: button?.index ?? index,
      text:
        button?.text ||
        button?.label ||
        button?.display_text ||
        button?.title ||
        firstParam?.text ||
        firstParam?.button_text ||
        firstParam?.payload ||
        button?.payload ||
        `Botão ${index + 1}`,
      url:
        button?.url ||
        button?.link ||
        firstParam?.url ||
        firstParam?.link ||
        null,
      phone_number:
        button?.phone_number ||
        button?.phoneNumber ||
        firstParam?.phone_number ||
        firstParam?.phoneNumber ||
        null,
      payload:
        button?.payload ||
        firstParam?.payload ||
        null,
      example: normalizeExample(button?.example || firstParam?.example),
      raw: button
    };
  };

  const result: any[] = [];

  components.forEach((component: any, componentIndex: number) => {
    const componentType = String(component?.type || "").toUpperCase();

    if (componentType === "BUTTONS" && Array.isArray(component?.buttons)) {
      component.buttons.forEach((button: any, index: number) => {
        result.push(normalizeButton(button, index));
      });
      return;
    }

    if (componentType === "BUTTON" || componentType === "BUTTONS") {
      result.push(normalizeButton(component, componentIndex));
    }
  });

  return result;
};

const getTypeMessage = (
  type: string
):
  | "text"
  | "reaction"
  | "audio"
  | "document"
  | "image"
  | "sticker"
  | "video"
  | "location"
  | "contacts"
  | "interactive"
  | "template" => {
  console.log("type", type);
  switch (type) {
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "image":
      return "image";
    case "application":
      return "document";
    case "document":
      return "document";
    case "text":
      return "text";
    case "interactive":
      return "interactive";
    case "contacts":
      return "contacts";
    case "location":
      return "location";
    case "template":
      return "template";
    case "reaction":
      return "reaction";
    default:
      return null as any;
  }
};

const formatOfficialDateFolder = (date = new Date()): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getDate()}`;
};

const getOnlyFileName = (value?: string | null): string => {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim() || "";
};

const buildOfficialRelativePath = (
  companyId: number,
  whatsappId: number,
  fileName: string
): string => {
  return `${formatOfficialDateFolder()}/${companyId}/${whatsappId}/${getOnlyFileName(fileName)}`;
};

const normalizeOfficialCandidate = (
  rawValue?: string | null,
  ticket?: Ticket
): string | null => {
  const raw = String(rawValue || "").trim().replace(/\\/g, "/");

  if (!raw) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  let cleanRaw = raw;

  cleanRaw = cleanRaw.replace(/^(?:\.\/*)+/, "");
  cleanRaw = cleanRaw.replace(/^\/+/, "");

  if (cleanRaw.startsWith("official-public/")) {
    return cleanRaw;
  }

  const officialFsMarker = "api_oficial/public/";
  const fsMarkerIndex = cleanRaw.indexOf(officialFsMarker);

  if (fsMarkerIndex !== -1) {
    const relative = cleanRaw
      .substring(fsMarkerIndex + officialFsMarker.length)
      .replace(/^\/+/, "");

    return relative ? `official-public/${relative}` : null;
  }

  if (cleanRaw.startsWith("public/")) {
    return `official-public/${cleanRaw.replace(/^public\//, "")}`;
  }

  if (/^\d{4}-\d{2}-\d{1,2}\//.test(cleanRaw)) {
    return `official-public/${cleanRaw}`;
  }

  if (/^[^/]+\.[a-zA-Z0-9]+$/.test(cleanRaw) && ticket?.companyId && ticket?.whatsappId) {
    return `official-public/${buildOfficialRelativePath(
      ticket.companyId,
      ticket.whatsappId,
      cleanRaw
    )}`;
  }

  return null;
};

const resolveOfficialMediaUrl = (
  sendMessageResult: any,
  media: Express.Multer.File | undefined,
  ticket: Ticket
): string | null => {
  const candidates = [
    sendMessageResult?.pathFile,
    sendMessageResult?.mediaUrl,
    sendMessageResult?.fileUrl,
    sendMessageResult?.url,
    sendMessageResult?.path,
    sendMessageResult?.filePath,
    sendMessageResult?.relativePath,
    sendMessageResult?.mediaPath,
    sendMessageResult?.fileName,
    sendMessageResult?.filename,

    sendMessageResult?.data?.pathFile,
    sendMessageResult?.data?.mediaUrl,
    sendMessageResult?.data?.fileUrl,
    sendMessageResult?.data?.url,
    sendMessageResult?.data?.path,
    sendMessageResult?.data?.filePath,
    sendMessageResult?.data?.relativePath,
    sendMessageResult?.data?.mediaPath,
    sendMessageResult?.data?.fileName,
    sendMessageResult?.data?.filename,

    media?.path,
    media?.destination,
    media?.filename
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOfficialCandidate(candidate, ticket);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const isValidLatitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const buildGoogleMapsUrl = (latitude: number, longitude: number): string =>
  `https://maps.google.com/maps?q=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&z=17&hl=pt-BR`;

const buildLocationPreviewUrl = (latitude: number, longitude: number): string => {
  const lat = encodeURIComponent(String(latitude));
  const lng = encodeURIComponent(String(longitude));

  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x300&markers=${lat},${lng},red-pushpin`;
};

const buildLocationBodyText = (latitude: number, longitude: number): string => {
  const previewUrl = buildLocationPreviewUrl(latitude, longitude);
  const googleMapsUrl = buildGoogleMapsUrl(latitude, longitude);
  const coordsText = `${latitude}, ${longitude}`;

  return `${previewUrl} | ${googleMapsUrl}|${coordsText}`;
};

const normalizeLocationPayload = (
  latitudeRaw: any,
  longitudeRaw: any,
  name?: any,
  address?: any
): ParsedLocationPayload | null => {
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  const url = buildGoogleMapsUrl(latitude, longitude);
  const previewUrl = buildLocationPreviewUrl(latitude, longitude);

  return {
    latitude,
    longitude,
    name: name ? String(name) : null,
    address: address ? String(address) : null,
    url,
    previewUrl,
    bodyText: buildLocationBodyText(latitude, longitude)
  };
};

const parseLocationFromBody = (body: any): ParsedLocationPayload | null => {
  if (isNil(body)) {
    return null;
  }

  if (typeof body === "object") {
    const direct = normalizeLocationPayload(
      body?.latitude ?? body?.degreesLatitude,
      body?.longitude ?? body?.degreesLongitude,
      body?.name ?? body?.locationName,
      body?.address ?? body?.locationAddress
    );

    if (direct) {
      return direct;
    }
  }

  const text = typeof body === "string" ? body.trim() : String(body || "").trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const fromJson = parseLocationFromBody(parsed);
    if (fromJson) {
      return fromJson;
    }
  } catch (error) { }

  const parts = text.split("|").map(item => item.trim()).filter(Boolean);
  const coordsCandidate = parts[parts.length - 1] || text;
  const coordsMatch = coordsCandidate.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);

  if (coordsMatch) {
    const latitude = Number(coordsMatch[1]);
    const longitude = Number(coordsMatch[2]);
    const normalized = normalizeLocationPayload(latitude, longitude);

    if (normalized) {
      return normalized;
    }
  }

  try {
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const url = new URL(urlMatch[0]);
      const q = url.searchParams.get("q");

      if (q) {
        const qMatch = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (qMatch) {
          const latitude = Number(qMatch[1]);
          const longitude = Number(qMatch[2]);
          const normalized = normalizeLocationPayload(latitude, longitude);

          if (normalized) {
            return normalized;
          }
        }
      }
    }
  } catch (error) { }

  return null;
};

const getSafeOfficialValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const escapeOfficialRegExp = (value = ""): string => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const normalizeOfficialTemplateKey = (value = ""): string => {
  const clean = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9\s_]/g, " ")
    .trim();

  if (!clean) return "";

  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
};

const buildOfficialVariables = (ticket: any): Record<string, string> => {
  const fullName = getSafeOfficialValue(ticket?.contact?.name);
  const firstName = fullName.trim().split(/\s+/)[0] || "";

  const variables: Record<string, string> = {
    name: fullName,
    firstName,
    number: getSafeOfficialValue(ticket?.contact?.number),
    email: getSafeOfficialValue(ticket?.contact?.email),
    userName: getSafeOfficialValue(ticket?.user?.name),
    queue: getSafeOfficialValue(ticket?.queue?.name),
    companyName: getSafeOfficialValue(ticket?.company?.name),
    whatsappName: getSafeOfficialValue(ticket?.whatsapp?.name),
    protocol: getSafeOfficialValue(ticket?.protocol || ticket?.id || ""),
    ticketId: getSafeOfficialValue(ticket?.id || "")
  };

  const extraInfoList = Array.isArray(ticket?.contact?.contactCustomFields)
    ? ticket.contact.contactCustomFields
    : [];

  for (const item of extraInfoList) {
    const rawKey = item?.name || item?.fieldName || "";
    const rawValue = item?.value || item?.fieldValue || "";
    const normalizedKey = normalizeOfficialTemplateKey(rawKey);

    if (normalizedKey) {
      variables[normalizedKey] = getSafeOfficialValue(rawValue);
    }
  }

  return variables;
};

const renderOfficialTemplateString = (
  content = "",
  variables: Record<string, string> = {}
): string => {
  let result = String(content || "");

  if (!result || !result.includes("{{")) {
    return result;
  }

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(
      `{{\\s*${escapeOfficialRegExp(key)}\\s*}}`,
      "gi"
    );
    result = result.replace(regex, getSafeOfficialValue(value));
  });

  return result;
};

const renderOfficialTemplateObject = <T = any>(
  payload: T,
  variables: Record<string, string> = {}
): T => {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === "string") {
    return renderOfficialTemplateString(payload, variables) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map(item =>
      renderOfficialTemplateObject(item, variables)
    ) as unknown as T;
  }

  if (typeof payload === "object") {
    const clone: any = {};

    Object.keys(payload as any).forEach(key => {
      clone[key] = renderOfficialTemplateObject(
        (payload as any)[key],
        variables
      );
    });

    return clone;
  }

  return payload;
};

const readTemplateString = (obj: any, keys: string[]): string => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const readTemplateNumber = (
  obj: any,
  keys: string[],
  fallback = 0
): number => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
};

const normalizeOfficialTemplatePayload = (templatePayload: any): any => {
  if (!templatePayload || typeof templatePayload !== "object") {
    return templatePayload;
  }

  const normalized: any = {
    name: templatePayload.name,
    language: templatePayload.language
  };

  if (!Array.isArray(templatePayload.components)) {
    return normalized;
  }

  const components = templatePayload.components
    .map((comp: any) => {
      const componentType = readTemplateString(comp, [
        "type",
        "componentType",
        "component_type"
      ]).toLowerCase();

      if (!componentType) {
        return null;
      }

      if (componentType === "button") {
        const subType = readTemplateString(comp, [
          "sub_type",
          "subType",
          "buttonType",
          "button_type"
        ]).toLowerCase();

        const buttonIndex = readTemplateNumber(
          comp,
          ["index", "buttonIndex", "button_index", "position"],
          0
        );

        if (!subType) {
          logger.warn(
            `[SendWhatsAppOficialMessage] Button ignorado por falta de sub_type. comp=${JSON.stringify(comp)}`
          );
          return null;
        }

        const buttonComponent: any = {
          type: "button",
          sub_type: subType,
          index: String(buttonIndex)
        };

        if (Array.isArray(comp.parameters) && comp.parameters.length > 0) {
          buttonComponent.parameters = comp.parameters;
        }

        return buttonComponent;
      }

      if (
        ["header", "body", "footer"].includes(componentType) &&
        Array.isArray(comp.parameters) &&
        comp.parameters.length > 0
      ) {
        return {
          type: componentType,
          parameters: comp.parameters
        };
      }

      return null;
    })
    .filter(Boolean);

  if (components.length > 0) {
    normalized.components = components;
  }

  return normalized;
};

const SendWhatsAppOficialMessage = async ({
  body,
  ticket,
  media,
  type,
  vCard,
  template,
  interative,
  quotedMsg,
  bodyToSave
}: Request): Promise<IReturnMessageMeta> => {
  const hydratedTicket: any =
    (await Ticket.findOne({
      where: {
        id: ticket.id,
        companyId: ticket.companyId
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "email", "profilePicUrl"]
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        },
        {
          model: Queue,
          as: "queue",
          attributes: ["id", "name"]
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "name"]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name", "token"]
        }
      ]
    })) || ticket;

  const contact =
    hydratedTicket?.contact || (await Contact.findByPk(hydratedTicket.contactId));

  if (!contact) {
    throw new AppError(`Contato não encontrado para o ticket ${hydratedTicket.id}`);
  }

  hydratedTicket.contact = hydratedTicket.contact || contact;

  const officialVariables = buildOfficialVariables(hydratedTicket);
  const renderedBodyToSave = renderOfficialTemplateString(
    bodyToSave || "",
    officialVariables
  );

  const pathMedia = !!media ? media.path : null;
  // ==================== DECLARAÇÃO DE OPTIONS ATUALIZADA ====================
  const options = {} as ISendMessageOficial & {
    variables?: Record<string, string>;
    templateButtons?: any[];
    body_reaction?: {
      message_id: string;
      emoji: string;
    };
  };
  // ==========================================================================

  const typeMessage = media ? (["image", "video", "audio"].includes(media.mimetype.split("/")[0]) ? media.mimetype.split("/")[0] : "application") : null;
  let bodyTicket = "";
  let mediaType: string;
  let locationPayload: ParsedLocationPayload | null = null;

  const formattedBody =
    typeof body === "string"
      ? renderOfficialTemplateString(formatBody(body, hydratedTicket), officialVariables)
      : renderOfficialTemplateObject(body, officialVariables);

  type = !type ? getTypeMessage(typeMessage) : type;

  switch (type) {
    case "video":
      options.body_video = {
        caption: typeof formattedBody === "string" ? formattedBody : ""
      };
      options.type = "video";
      options.fileName = media.originalname.replace("/", "-");
      bodyTicket = "🎥 Arquivo de vídeo";
      mediaType = "video";
      break;

    case "audio":
      options.type = "audio";
      options.fileName = media.originalname.replace("/", "-");
      bodyTicket = "🎵 Arquivo de áudio";
      mediaType = "audio";
      break;

    case "document":
      options.type = "document";
      options.body_document = {
        caption: typeof formattedBody === "string" ? formattedBody : ""
      };
      options.fileName = media.originalname.replace("/", "-");
      bodyTicket = "📂 Arquivo de Documento";
      mediaType = "document";
      break;

    case "image":
      options.type = "image";
      options.body_image = {
        caption: typeof formattedBody === "string" ? formattedBody : ""
      };
      options.fileName = media.originalname.replace("/", "-");
      bodyTicket = "📷 Arquivo de Imagem";
      mediaType = "image";
      break;

    case "text":
      options.type = "text";
      options.body_text = {
        body: typeof formattedBody === "string" ? formattedBody : ""
      };
      mediaType = "conversation";
      break;

    case "interactive":
      options.type = "interactive";
      mediaType = interative?.type === "button" ? "interative" : "listMessage";
      options.body_interactive = renderOfficialTemplateObject(
        interative,
        officialVariables
      );
      break;

    case "contacts":
      options.type = "contacts";
      mediaType = "contactMessage";
      const first_name = vCard?.name?.split(" ")[0];
      const last_name = String(vCard?.name).replace(vCard?.name?.split(" ")[0], "");
      options.body_contacts = {
        name: {
          first_name: first_name,
          last_name: last_name,
          formatted_name: `${first_name} ${last_name}`.trim()
        },
        phones: [{ phone: `+${vCard?.number}`, wa_id: +vCard?.number, type: "CELL" }],
        emails: [{ email: vCard?.email }]
      };
      break;

    case "location":
      locationPayload = parseLocationFromBody(formattedBody);

      if (!locationPayload) {
        throw new Error("Localização inválida para enviar à Meta");
      }

      options.type = "location";
      (options as any).body_location = {
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude,
        name: locationPayload.name || "Localização",
        address: locationPayload.address || locationPayload.url
      };
      bodyTicket = "📍 Localização";
      mediaType = "location";
      break;

    case "template": {
      options.type = "template";

      const renderedTemplate = renderOfficialTemplateObject(
        template,
        officialVariables
      );

      const normalizedTemplate = normalizeOfficialTemplatePayload(renderedTemplate);

      let templateButtons = extractOfficialTemplateButtons(renderedTemplate);

      if (!templateButtons.length) {
        templateButtons = extractOfficialTemplateButtons(normalizedTemplate);
      }

      if (!templateButtons.length && renderedBodyToSave) {
        console.log("[DEBUG] Tentando extrair botões do body da mensagem...");
        templateButtons = extractButtonsFromBody(renderedBodyToSave);
        console.log(
          "[DEBUG] Botões extraídos do body:",
          JSON.stringify(templateButtons, null, 2)
        );
      }

      const templateHeaderMedia =
        extractOfficialTemplateHeaderMedia(normalizedTemplate);

      options.body_template = normalizedTemplate;
      options.templateButtons = templateButtons;

      logger.info(
        `[SendWhatsAppOficialMessage] Template buttons para salvar: ${JSON.stringify(templateButtons)}`
      );
      logger.info(
        `[SendWhatsAppOficialMessage] Template normalizado: ${JSON.stringify(
          options.body_template
        )}`
      );

      bodyTicket = renderedBodyToSave || "🧩 Template";
      mediaType = "template";
      break;
    }

    // ==================== CASE "reaction" ATUALIZADO ====================
    case "reaction": {
      if (!quotedMsg?.wid) {
        throw new Error("Mensagem alvo da reação não encontrada para a Meta");
      }

      if (quotedMsg.fromMe) {
        throw new Error(
          "A API Oficial só permite reagir a mensagens recebidas do cliente."
        );
      }

      const emoji = normalizeReactionEmoji(
        typeof formattedBody === "string" ? formattedBody : body
      );

      options.type = "reaction";
      options.body_reaction = {
        message_id: quotedMsg.wid,
        emoji
      };

      bodyTicket = emoji;
      mediaType = "reactionMessage";
      break;
    }
    // ====================================================================

    default:
      throw new Error(`Tipo ${type} não configurado para enviar mensagem a Meta`);
  }

  let vcard;

  if (!isNil(vCard)) {
    const numberContact = vCard.number;
    const firstName = vCard.name.split(" ")[0];
    const lastName = String(vCard.name).replace(vCard.name.split(" ")[0], "");
    vcard =
      `BEGIN:VCARD\n` +
      `VERSION:3.0\n` +
      `N:${lastName};${firstName};;;\n` +
      `FN:${vCard.name}\n` +
      `TEL;type=CELL;waid=${numberContact}:+${numberContact}\n` +
      `END:VCARD`;
  }

  options.to = `+${contact.number}`;
  options.type = type;
  options.quotedId = quotedMsg?.wid;
  options.variables = officialVariables;

  try {
    const whatsappToken = hydratedTicket?.whatsapp?.token || ticket?.whatsapp?.token;

    if (!whatsappToken) {
      console.error(
        `[SendWhatsAppOficialMessage] ERRO: ticket.whatsapp.token ausente. ticket.whatsappId=${hydratedTicket.whatsappId}, whatsapp carregado=${!!hydratedTicket?.whatsapp}`
      );
      throw new Error(
        `Token da conexão WhatsApp Oficial não encontrado para o ticket ${hydratedTicket.id}. Verifique se o whatsapp está carregado no ticket.`
      );
    }

    const sendMessage = await sendMessageWhatsAppOficial(
      pathMedia,
      whatsappToken,
      options
    );

    const mediaDescriptions: Record<string, string> = {
      image: "📷 Imagem",
      video: "🎥 Vídeo",
      audio: "🎵 Áudio",
      document: "📄 Documento",
      sticker: "🏷️ Figurinha",
      location: "📍 Localização",
      contacts: "👤 Contato",
      template: "🧩 Template"
    };

    // ==================== lastMsg ATUALIZADO ====================
    let lastMsg =
      type === "location"
        ? "📍 Localização"
        : type === "interactive"
          ? renderedBodyToSave || (typeof formattedBody === "string" ? formattedBody : "")
          : type === "template"
            ? renderedBodyToSave || bodyTicket
            : type === "reaction"
              ? bodyTicket
              : !formattedBody && !!media
                ? bodyTicket
                : typeof formattedBody === "string"
                  ? formattedBody
                  : bodyTicket;
    // ============================================================

    if (!lastMsg && mediaType in mediaDescriptions) {
      lastMsg = mediaDescriptions[mediaType];
    }

    await hydratedTicket.update({
      lastMessage: lastMsg || (typeof formattedBody === "string" ? formattedBody : bodyTicket),
      imported: null,
      unreadMessages: 0
    });

    const wid: any = sendMessage;

    // ==================== bodyMessage ATUALIZADO ====================
    const bodyMessage =
      type === "location"
        ? locationPayload?.bodyText || ""
        : type === "interactive"
          ? renderedBodyToSave || (typeof formattedBody === "string" ? formattedBody : "")
          : type === "template"
            ? renderedBodyToSave || bodyTicket || ""
            : type === "reaction"
              ? normalizeReactionEmoji(typeof formattedBody === "string" ? formattedBody : body)
              : !isNil(vCard)
                ? vcard
                : typeof formattedBody === "string"
                  ? formattedBody
                  : "";
    // ================================================================

    // Remove os botões do body para não duplicar
    let cleanBodyMessage = bodyMessage;
    if (type === "template" && cleanBodyMessage) {
      const lastSeparatorIndex = cleanBodyMessage.lastIndexOf("||||");
      if (lastSeparatorIndex !== -1) {
        cleanBodyMessage = cleanBodyMessage.substring(0, lastSeparatorIndex);
      }
    }

    const templatePayload =
      type === "template" ? options.body_template : null;

    const templateHeaderMedia =
      type === "template"
        ? extractOfficialTemplateHeaderMedia(templatePayload)
        : { mediaType: null, mediaUrl: null };

    const templateButtons =
      type === "template" ? (options.templateButtons || []) : [];

    const officialMediaUrl =
      type === "template"
        ? templateHeaderMedia.mediaUrl
        : media
          ? resolveOfficialMediaUrl(sendMessage as any, media, hydratedTicket)
          : null;

    // ==================== dataJson CORRIGIDO - PERSISTINDO BOTÕES ====================
    const messageData = {
      wid: wid?.idMessageWhatsApp?.[0],
      ticketId: hydratedTicket.id,
      contactId: contact.id,
      body: cleanBodyMessage || bodyMessage,
      fromMe: true,
      mediaType: mediaType,
      mediaUrl: officialMediaUrl,
      read: true,
      quotedMsgId: quotedMsg?.id || null,
      ack: 2,
      channel: "whatsapp_oficial",
      remoteJid: `${contact.number}@s.whatsapp.net`,
      participant: null,
      dataJson: JSON.stringify(
        type === "location"
          ? {
            latitude: locationPayload?.latitude,
            longitude: locationPayload?.longitude,
            name: locationPayload?.name || null,
            address: locationPayload?.address || null,
            url: locationPayload?.url || null
          }
          : type === "template"
            ? {
              type: "template",
              body: cleanBodyMessage || bodyMessage,
              template: templatePayload,
              templateButtons: templateButtons, // BOTÕES PERSISTIDOS AQUI!
              mediaUrl: officialMediaUrl,
              mediaType: templateHeaderMedia.mediaType || null
            }
            : type === "interactive"
              ? {
                type: "interactive",
                body: renderedBodyToSave || (typeof formattedBody === "string" ? formattedBody : ""),
                interactive: interative
              }
            : type === "reaction"
              ? {
                type: "reaction",
                reaction: bodyMessage,
                reactionTo: quotedMsg?.wid || null
              }
              : typeof formattedBody === "string"
                ? formattedBody
                : body
      ),
      ticketTrakingId: null,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      ticketImported: hydratedTicket.imported,
      isForwarded: false,
      originalName: !!media ? media.originalname : null
    };
    // ==============================================================

    console.log("[DEBUG] MessageData.dataJson com botões persistidos:", JSON.stringify(messageData.dataJson, null, 2));

    await CreateMessageService({
      messageData,
      companyId: hydratedTicket.companyId
    });

    return sendMessage;
  } catch (err) {
    const errDetail = err?.response?.data
      ? JSON.stringify(err.response.data)
      : err?.message || String(err);

    console.log(
      `erro ao enviar mensagem na company ${hydratedTicket.companyId} - body: ${typeof body === "string" ? body : JSON.stringify(body)} - erro: ${errDetail}`
    );

    Sentry.captureException(err);
    throw new AppError(err?.message || "ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppOficialMessage;