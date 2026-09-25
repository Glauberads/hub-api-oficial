import { Request, Response } from "express";
import AppError from "../errors/AppError";
import fs from "fs";
import axios from "axios";
import { getWbot } from "../libs/wbot";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import path from "path";
import { isNil, isNull } from "lodash";
import { Mutex } from "async-mutex";
import logger from "../utils/logger";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../services/MessageServices/CreateMessageService";

import { sendFacebookMessageMedia } from "../services/FacebookServices/sendFacebookMessageMedia";
import { sendFacebookMessage } from "../services/FacebookServices/sendFacebookMessage";

import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import ListMessagesServiceAll from "../services/MessageServices/ListMessagesServiceAll";
import ShowContactService from "../services/ContactServices/ShowContactService";

import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";

import Contact from "../models/Contact";

import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import ShowMessageService, { GetWhatsAppFromMessage } from "../services/MessageServices/ShowMessageService";
import CompaniesSettings from "../models/CompaniesSettings";
import { verifyMessageFace } from "../services/FacebookServices/facebookMessageListener";
import EditWhatsAppMessage from "../services/MessageServices/EditWhatsAppMessage";
import SendWhatsAppOficialMessage from "../services/WhatsAppOficial/SendWhatsAppOficialMessage";
import SendTelegramMessageService from "../services/TelegramServices/SendTelegramMessageService";
import SendTelegramMediaService from "../services/TelegramServices/SendTelegramMediaService";
import ShowService from "../services/QuickMessageService/ShowService";
import { IMetaMessageTemplateComponents, IMetaMessageTemplate } from "../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import TranscribeAudioMessageToText from "../services/MessageServices/TranscribeAudioMessageService";

type IndexQuery = {
  pageNumber: string;
  ticketTrakingId: string;
  selectedQueues?: string;
};

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  isPrivate?: string;
  vCard?: Contact;
  quickMessageId?: number | string;
};

type MessageTemplateData = {
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  templateId: string;
  variables: string[];
  bodyToSave: string;
};

type ParsedLocationPayload = {
  latitude: number;
  longitude: number;
  locationName?: string;
  locationAddress?: string;
  googleMapsUrl: string;
};

const isValidLatitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const buildGoogleMapsUrl = (latitude: number, longitude: number): string =>
  `https://maps.google.com/maps?q=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&z=17&hl=pt-BR`;

const normalizeLocationPayload = (
  latitudeRaw: any,
  longitudeRaw: any,
  locationName?: any,
  locationAddress?: any
): ParsedLocationPayload | null => {
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    locationName: locationName ? String(locationName) : undefined,
    locationAddress: locationAddress ? String(locationAddress) : undefined,
    googleMapsUrl: buildGoogleMapsUrl(latitude, longitude)
  };
};

const parseLocationFromUnknown = (value: any): ParsedLocationPayload | null => {
  if (isNil(value)) {
    return null;
  }

  if (typeof value === "object") {
    const direct =
      normalizeLocationPayload(
        value?.latitude ?? value?.degreesLatitude,
        value?.longitude ?? value?.degreesLongitude,
        value?.name ?? value?.locationName,
        value?.address ?? value?.locationAddress
      );

    if (direct) {
      return direct;
    }
  }

  const text = typeof value === "string" ? value.trim() : String(value || "").trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const fromJson = parseLocationFromUnknown(parsed);
    if (fromJson) {
      return fromJson;
    }
  } catch (error) { }

  const pipeParts = text.split("|").map(item => item.trim()).filter(Boolean);
  const coordsCandidate = pipeParts[pipeParts.length - 1] || text;
  const coordsMatch = coordsCandidate.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);

  if (coordsMatch) {
    const latitude = Number(coordsMatch[1]);
    const longitude = Number(coordsMatch[2]);

    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
      const mapsPart = pipeParts.find(part => /^https?:\/\/.*maps/i.test(part));
      return {
        latitude,
        longitude,
        googleMapsUrl: mapsPart || buildGoogleMapsUrl(latitude, longitude)
      };
    }
  }

  try {
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const parsedUrl = new URL(urlMatch[0]);
      const q = parsedUrl.searchParams.get("q");

      if (q) {
        const qMatch = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (qMatch) {
          const latitude = Number(qMatch[1]);
          const longitude = Number(qMatch[2]);

          if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
            return {
              latitude,
              longitude,
              googleMapsUrl: buildGoogleMapsUrl(latitude, longitude)
            };
          }
        }
      }
    }
  } catch (error) { }

  return null;
};

const safeMessageBodyToString = (body: any): string => {
  if (typeof body === "string") {
    return body;
  }

  if (isNil(body)) {
    return "";
  }

  try {
    return JSON.stringify(body);
  } catch (error) {
    return String(body);
  }
};

const normalizeTemplateButtonsToSave = (components: any[] = []): any[] => {
  const result: any[] = [];

  components.forEach((component: any) => {
    const componentType = String(component?.type || "").toUpperCase();

    if (componentType !== "BUTTONS" && componentType !== "BUTTON") {
      return;
    }

    let rawButtons: any = component?.buttons ?? component?.button ?? [];

    if (typeof rawButtons === "string") {
      try {
        rawButtons = JSON.parse(rawButtons);
      } catch (error) {
        rawButtons = [];
      }
    }

    if (!Array.isArray(rawButtons)) {
      rawButtons = rawButtons ? [rawButtons] : [];
    }

    rawButtons.forEach((button: any, index: number) => {
      result.push({
        type: String(
          button?.type ||
          button?.sub_type ||
          (button?.url
            ? "URL"
            : button?.phone_number
              ? "PHONE_NUMBER"
              : button?.example
                ? "COPY_CODE"
                : "QUICK_REPLY")
        ).toUpperCase(),
        text:
          button?.text ||
          button?.label ||
          button?.display_text ||
          button?.title ||
          button?.payload ||
          `Botão ${index + 1}`,
        url: button?.url || button?.link || null,
        phone_number: button?.phone_number || button?.phoneNumber || null,
        example: Array.isArray(button?.example)
          ? button.example
          : button?.example
            ? [button.example]
            : []
      });
    });
  });

  return result;
};

const loadQuickMessageInteractiveButtons = async (
  quickMessageId: number | string,
  companyId: number
): Promise<any[]> => {
  const quickMessage = await ShowService(quickMessageId, companyId);
  const buttonComponent = (quickMessage.components || []).find(
    (component: any) => String(component?.type || "").toUpperCase() === "BUTTONS"
  );

  if (!buttonComponent?.buttons) return [];

  try {
    const parsedButtons = typeof buttonComponent.buttons === "string"
      ? JSON.parse(buttonComponent.buttons)
      : buttonComponent.buttons;
    const savedButtons = Array.isArray(parsedButtons) ? parsedButtons : [];

    return savedButtons.slice(0, 3).map((button: any, index: number) => ({
      displayText: String(button?.text || `Opção ${index + 1}`),
      id: String(button?.id || `quick_message_${quickMessageId}_${index + 1}`),
      type: button?.type || "quick_reply",
      url: button?.url,
      copyCode: button?.copyCode,
      phoneNumber: button?.phoneNumber
    }));
  } catch (error) {
    logger.warn(`[STORE] Botões inválidos na mensagem rápida ${quickMessageId}`);
    return [];
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, selectedQueues: queueIdsStringified } = req.query as IndexQuery;
  const { companyId, profile } = req.user;
  let queues: number[] = [];

  const user = await User.findByPk(req.user.id, {
    include: [{ model: Queue, as: "queues" }]
  });

  const sanitizeQueueIds = (values: unknown): number[] => {
    if (!Array.isArray(values)) return [];
    return values
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0);
  };

  if (queueIdsStringified) {
    try {
      queues = sanitizeQueueIds(JSON.parse(queueIdsStringified));
    } catch (error) {
      logger.warn(`[messages.index] selectedQueues inválido: ${queueIdsStringified}`);
      queues = [];
    }
  } else {
    queues = sanitizeQueueIds((user?.queues || []).map(queue => queue.id));
  }

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId,
    companyId,
    queues,
    user
  });

  if (["whatsapp", "whatsapp_oficial", "telegram"].includes(ticket.channel) && ticket.whatsappId) {
    SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

export const react = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { reaction } = req.body;
  const { companyId } = req.user;

  if (!reaction || typeof reaction !== "string" || !reaction.trim()) {
    throw new AppError("Emoji da reação não informado.", 400);
  }

  const targetMessage = await Message.findOne({
    where: {
      id: messageId,
      companyId
    }
  });

  if (!targetMessage) {
    throw new AppError("Mensagem não encontrada.", 404);
  }

  const ticket = await ShowTicketService(String(targetMessage.ticketId), companyId);

  if (!ticket) {
    throw new AppError("Ticket da mensagem não encontrado.", 404);
  }

  // API Oficial
  if (ticket.channel === "whatsapp_oficial") {
    if (targetMessage.fromMe) {
      throw new AppError(
        "Na API Oficial, a reação só pode ser enviada para uma mensagem recebida do cliente.",
        400
      );
    }

    await SendWhatsAppOficialMessage({
      body: reaction,
      ticket,
      quotedMsg: targetMessage,
      type: "reaction",
      media: null
    });

    return res.json({ success: true });
  }

  // Baileys / WhatsApp Web
  if (ticket.channel === "whatsapp") {
    if (!ticket.whatsappId) {
      throw new AppError("Conexão do WhatsApp não encontrada.", 400);
    }

    const wbot = getWbot(ticket.whatsappId);

    const remoteJid =
      targetMessage.remoteJid ||
      ticket.contact?.remoteJid ||
      `${ticket.contact.number}@s.whatsapp.net`;

    await wbot.sendMessage(remoteJid, {
      react: {
        text: reaction,
        key: {
          remoteJid,
          id: targetMessage.wid,
          fromMe: !!targetMessage.fromMe,
          participant: targetMessage.participant || undefined
        }
      }
    });

    const messageData = {
      wid: `reaction_${targetMessage.wid}_${Date.now()}`,
      ticketId: ticket.id,
      contactId: undefined,
      body: reaction,
      fromMe: true,
      read: true,
      quotedMsgId: targetMessage.id,
      ack: 2,
      channel: ticket.channel,
      remoteJid,
      participant: null,
      dataJson: JSON.stringify({
        type: "reaction",
        reaction,
        reactionTo: targetMessage.wid
      }),
      mediaType: "reactionMessage",
      ticketTrakingId: null,
      isPrivate: false
    };

    await CreateMessageService({
      messageData,
      companyId: ticket.companyId
    });

    return res.json({ success: true });
  }

  throw new AppError("Reações disponíveis apenas para WhatsApp e API Oficial.", 400);
};

export function obterNomeEExtensaoDoArquivo(url: string): string {
  try {
    let filename: string;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      filename = pathname.split("/").pop() || "";
    } else {
      filename = url.split("/").pop()?.split("\\").pop() || "";
    }

    const parts = filename.split(".");

    if (parts.length < 2) {
      return filename;
    }

    const nomeDoArquivo = parts[0];
    const extensao = parts[1];

    return `${nomeDoArquivo}.${extensao}`;
  } catch (error) {
    logger.error(`[obterNomeEExtensaoDoArquivo] Erro ao processar: ${url} - ${error}`);
    const filename = url.split("/").pop()?.split("\\").pop();
    return filename || "arquivo";
  }
}
export const download = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await Message.findOne({
    where: {
      id: messageId,
      companyId
    }
  });

  if (!message) {
    throw new AppError("Mensagem não encontrada", 404);
  }

  if (!message.mediaUrl) {
    throw new AppError("Esta mensagem não possui arquivo para download.", 404);
  }

  let mediaUrl = String(message.mediaUrl).trim().replace(/\\/g, "/");

  if (!mediaUrl) {
    throw new AppError("Arquivo inválido.", 404);
  }

  if (/^https?:\/\//i.test(mediaUrl)) {
    try {
      const parsedUrl = new URL(mediaUrl);
      mediaUrl = parsedUrl.pathname.replace(/^\/+/, "");
    } catch (error) {
      mediaUrl = mediaUrl
        .replace(/^https?:\/\/[^/]+\//i, "")
        .replace(/^\/+/, "");
    }
  }

  mediaUrl = mediaUrl.replace(/^\/+/, "");

  const buildCandidatePaths = (urlPath: string): string[] => {
    const cleaned = urlPath.replace(/^\/+/, "");
    const officialTail = cleaned.replace(/^official-public\//, "");
    const publicTail = cleaned.replace(/^public\//, "");

    return [
      path.resolve(__dirname, "..", "..", cleaned),
      path.resolve(__dirname, "..", "..", "public", cleaned),
      path.resolve(__dirname, "..", "..", "official-public", officialTail),
      path.resolve(__dirname, "..", "..", "public", officialTail),
      path.resolve(__dirname, "..", "..", "public", "official-public", officialTail),

      path.resolve(process.cwd(), cleaned),
      path.resolve(process.cwd(), "public", cleaned),
      path.resolve(process.cwd(), "official-public", officialTail),
      path.resolve(process.cwd(), "public", officialTail),
      path.resolve(process.cwd(), "public", "official-public", officialTail),
      path.resolve(process.cwd(), "public", publicTail),
      path.resolve(process.cwd(), publicTail)
    ];
  };

  const buildCandidateUrls = (urlPath: string): string[] => {
    const cleaned = urlPath.replace(/^\/+/, "");
    const officialTail = cleaned.replace(/^official-public\//, "");
    const backendUrl = String(process.env.BACKEND_URL || "").replace(/\/+$/, "");

    if (!backendUrl) {
      return [];
    }

    const urls = [
      `${backendUrl}/${cleaned}`,
      `${backendUrl}/public/${officialTail}`,
      `${backendUrl}/public/${cleaned}`,
      `${backendUrl}/${officialTail}`
    ];

    return [...new Set(urls)];
  };

  const candidatePaths = [...new Set(buildCandidatePaths(mediaUrl))];
  const filePath = candidatePaths.find(candidate => fs.existsSync(candidate));

  const bodyName =
    typeof message.body === "string" ? message.body.trim() : "";

  const buildDownloadName = (sourceFileName: string): string => {
    const safeSourceName = path.basename(
      String(sourceFileName || "arquivo").replace(/\\\\/g, "/")
    );

    const sourceExtension = path.extname(safeSourceName);

    const safeCaption = bodyName
      .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, "")
      .replace(/[\\r\\n]+/g, " ")
      .trim()
      .slice(0, 180);

    if (!safeCaption || /^https?:\/\//i.test(safeCaption)) {
      return safeSourceName;
    }

    if (path.extname(safeCaption)) {
      return safeCaption;
    }

    return `${safeCaption}${sourceExtension}`;
  };

  if (filePath) {
    const fileNameFromPath = path.basename(filePath);
    const downloadName = buildDownloadName(fileNameFromPath);

    return res.download(filePath, downloadName);
  }

  logger.warn(`[messages.download] Arquivo não encontrado. mediaUrl=${mediaUrl}`);
  logger.warn(`[messages.download] Caminhos testados: ${JSON.stringify(candidatePaths, null, 2)}`);

  const candidateUrls = buildCandidateUrls(mediaUrl);

  for (const url of candidateUrls) {
    try {
      const response = await axios.get(url, {
        responseType: "stream",
        validateStatus: () => true
      });

      if (response.status >= 200 && response.status < 300) {
        const urlFileName = path.basename(url.split("?")[0]);
        const downloadName = buildDownloadName(
          urlFileName || "arquivo"
        );

        const rawContentType = response.headers["content-type"];

        const contentType =
          typeof rawContentType === "string"
            ? rawContentType
            : Array.isArray(rawContentType)
              ? rawContentType[0]
              : "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(downloadName)}"`
        );

        response.data.pipe(res);
        return;
      }
    } catch (error) {
      logger.warn(`[messages.download] Falha ao tentar URL ${url}`);
    }
  }

  logger.warn(`[messages.download] URLs testadas: ${JSON.stringify(candidateUrls, null, 2)}`);
  throw new AppError(`Arquivo não encontrado no servidor: ${mediaUrl}`, 404);
};


const isAudioFile = (media: Express.Multer.File): boolean => {
  logger.debug(`[isAudioFile] Verificando: ${media.originalname} (mime: ${media.mimetype}, field: ${media.fieldname})`);

  if (media.fieldname === "audio") {
    return true;
  }

  if (media.mimetype && media.mimetype.startsWith("audio/")) {
    return true;
  }

  if (media.originalname) {
    const audioExtensions = [".mp3", ".ogg", ".wav", ".webm", ".m4a", ".aac", ".opus"];
    const extension = path.extname(media.originalname).toLowerCase();

    if (audioExtensions.includes(extension)) {
      return true;
    }
  }

  if (
    media.originalname &&
    (media.originalname.includes("audio_") ||
      media.originalname.includes("áudio") ||
      media.originalname.includes("voice"))
  ) {
    return true;
  }

  return false;
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const {
    body,
    quotedMsg,
    vCard,
    isPrivate = "false",
    latitude,
    longitude,
    locationName,
    locationAddress,
    quickMessageId
  }: MessageData & any = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket.whatsappId) {
    throw new AppError("Este ticket não possui conexão vinculada, provavelmente foi excluída a conexão.", 400);
  }

  if (ticket.channel === "whatsapp_oficial" && isPrivate === "false") {
    await ticket.reload({
      include: [{ model: Contact, as: "contact" }]
    });

    const lastInteraction = ticket.contact.lastInteractionClient;

    logger.info(`[STORE] Validando janela 24h - Ticket ${ticketId} - lastInteraction: ${lastInteraction}, contactId: ${ticket.contact.id}`);

    if (!lastInteraction) {
      throw new AppError("Janela de 24h expirada. Envie um template primeiro para iniciar a conversa.", 400);
    }

    const now = new Date();
    const diffMs = now.getTime() - new Date(lastInteraction).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    logger.info(`[STORE] Janela 24h - Diferença: ${diffHours.toFixed(2)} horas`);

    if (diffHours >= 24) {
      throw new AppError("Janela de 24h expirada. Envie um template primeiro para retomar a conversa.", 400);
    }
  }

  SetTicketMessagesAsRead(ticket);

  try {
    const locationPayload = normalizeLocationPayload(
      latitude,
      longitude,
      locationName,
      locationAddress
    );

    if (medias && medias.length > 0) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          logger.debug(`[STORE] Processando mídia ${index + 1}: ${media.originalname} (mime: ${media.mimetype}, size: ${media.size})`);

          if (ticket.channel === "whatsapp") {
            let sentAsInteractiveImage = false;
            const mediaBody = Array.isArray(body) ? body[index] : body;

            if (
              quickMessageId &&
              isPrivate === "false" &&
              medias.length === 1 &&
              String(media.mimetype || "").startsWith("image/")
            ) {
              const buttons = await loadQuickMessageInteractiveButtons(
                quickMessageId,
                companyId
              );

              if (buttons.length > 0) {
                const SendWhatsAppInteractive = (await import("../services/WbotServices/SendWhatsAppInteractive")).default;
                await SendWhatsAppInteractive({
                  ticket,
                  interactiveType: "button",
                  bodyText: mediaBody || "Selecione uma opção:",
                  buttons,
                  headerImageFullPath: media.path
                });
                sentAsInteractiveImage = true;
              }
            }

            if (!sentAsInteractiveImage) {
              await SendWhatsAppMedia({
                media,
                ticket,
                body: mediaBody,
                isPrivate: isPrivate === "true",
                isForwarded: false
              });
            }
          }

          if (ticket.channel == "whatsapp_oficial") {
            await SendWhatsAppOficialMessage({
              media,
              body: Array.isArray(body) ? body[index] : body,
              ticket,
              type: null,
              quotedMsg
            });
          }

          if (["facebook", "instagram"].includes(ticket.channel)) {
            try {
              const sentMedia = await sendFacebookMessageMedia({
                media,
                ticket,
                body: Array.isArray(body) ? body[index] : body
              });

              // O Media Template gera prévia no Messenger, mas seu webhook
              // is_echo não retorna o vídeo como um anexo comum.
              if (sentMedia?.localMedia) {
                const wid =
                  sentMedia?.message_id ||
                  `fb-local-video-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(7)}`;

                const localMessageData = {
                  wid,
                  ticketId: ticket.id,
                  contactId: undefined,
                  body: (Array.isArray(body) ? body[index] : body) || sentMedia.localMedia.filename,
                  fromMe: true,
                  read: true,
                  mediaType: sentMedia.localMedia.mediaType,
                  mediaUrl: sentMedia.localMedia.filename,
                  quotedMsgId: null,
                  ack: 3,
                  dataJson: JSON.stringify(sentMedia),
                  channel: ticket.channel
                };

                const existingMessage = await Message.findOne({
                  where: {
                    wid,
                    companyId,
                    ticketId: ticket.id
                  }
                });

                if (existingMessage) {
                  await existingMessage.update(localMessageData);
                } else {
                  await CreateMessageService({
                    messageData: localMessageData,
                    companyId
                  });
                }

                logger.info(
                  `[FACEBOOK] Vídeo Media Template registrado localmente: ${sentMedia.localMedia.filename}`
                );
              }
            } catch (error) {
              logger.error(`[STORE] Erro ao enviar mídia Facebook/Instagram: ${error}`);
            }
          }

          if (ticket.channel === "telegram") {
            await SendTelegramMediaService({
              media,
              ticket,
              body: Array.isArray(body) ? body[index] : body
            });
          }
        })
      );
    } else if (locationPayload && isPrivate === "false" && ["whatsapp", "whatsapp_oficial"].includes(ticket.channel)) {
      const SendWhatsAppInteractive = (await import("../services/WbotServices/SendWhatsAppInteractive")).default;

      await SendWhatsAppInteractive({
        ticket,
        interactiveType: "location",
        bodyText: body || "",
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude,
        locationName: locationPayload.locationName,
        locationAddress: locationPayload.locationAddress || locationPayload.googleMapsUrl
      });
    } else {
      if (ticket.channel === "whatsapp" && isPrivate === "false") {
        let sentAsInteractive = false;

        if (quickMessageId) {
          const buttons = await loadQuickMessageInteractiveButtons(
            quickMessageId,
            companyId
          );

          if (buttons.length > 0) {
            const SendWhatsAppInteractive = (await import("../services/WbotServices/SendWhatsAppInteractive")).default;
            await SendWhatsAppInteractive({
              ticket,
              interactiveType: "button",
              bodyText: body,
              buttons
            });
            sentAsInteractive = true;
          }
        }

        if (!sentAsInteractive) {
          await SendWhatsAppMessage({ body, ticket, quotedMsg, vCard });
        }
      } else if (ticket.channel == "whatsapp_oficial" && isPrivate === "false") {
        await SendWhatsAppOficialMessage({
          body,
          ticket,
          quotedMsg,
          type: !isNil(vCard) ? "contacts" : "text",
          media: null,
          vCard
        });
      } else if (ticket.channel === "telegram" && isPrivate === "false") {
        await SendTelegramMessageService({ body, ticket });
      } else if (isPrivate === "true") {
        const messageData = {
          wid: `PVT${ticket.updatedAt.toString().replace(" ", "")}`,
          ticketId: ticket.id,
          contactId: undefined,
          body,
          fromMe: true,
          mediaType: !isNil(vCard) ? "contactMessage" : "extendedTextMessage",
          read: true,
          quotedMsgId: null,
          ack: 2,
          remoteJid: ticket.contact?.remoteJid,
          participant: null,
          dataJson: null,
          ticketTrakingId: null,
          isPrivate: isPrivate === "true"
        };

        await CreateMessageService({ messageData, companyId: ticket.companyId });
      } else if (["facebook", "instagram"].includes(ticket.channel) && isPrivate === "false") {
        const sendResult = await sendFacebookMessage({ body, ticket, quotedMsg });

        if (ticket.channel === "facebook") {
          const bodyToSave = sendResult?.processedBody || body;
          await verifyMessageFace({}, bodyToSave, ticket, ticket.contact, true);
        }
      }
    }

    return res.send();
  } catch (error) {
    logger.error(`[STORE] Erro no envio de mensagem: ${error}`);
    return res.status(400).json({ error: error.message });
  }
};

export const forwardMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { quotedMsg, signMessage, messageId, contactId } = req.body;
  const { id: userId, companyId } = req.user;
  const requestUser = await User.findByPk(userId);

  if (!messageId || !contactId) {
    return res.status(200).send("MessageId or ContactId not found");
  }

  const message = await ShowMessageService(messageId);
  const contact = await ShowContactService(contactId, companyId);

  if (!message) {
    return res.status(404).send("Message not found");
  }

  if (!contact) {
    return res.status(404).send("Contact not found");
  }

  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  const whatsAppConnectionId = await GetWhatsAppFromMessage(message);
  if (!whatsAppConnectionId) {
    return res.status(404).send("Whatsapp from message not found");
  }

  const ticket = await ShowTicketService(message.ticketId, message.companyId);

  const mutex = new Mutex();

  const createTicket = await mutex.runExclusive(async () => {
    const result = await FindOrCreateTicketService(
      contact,
      ticket?.whatsapp,
      0,
      ticket.companyId,
      ticket.queueId,
      requestUser.id,
      contact.isGroup ? contact : null,
      ticket.channel,
      null,
      true,
      settings,
      false,
      false
    );
    return result;
  });

  let ticketData;

  if (isNil(createTicket?.queueId)) {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser.id,
      queueId: ticket.queueId
    };
  } else {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser.id
    };
  }

  await UpdateTicketService({
    ticketData,
    ticketId: createTicket.id,
    companyId: createTicket.companyId
  });

  let body = safeMessageBodyToString(message.body);
  const mediaType = message.mediaType || "";

  const isTextLikeMessage =
    mediaType === "conversation" ||
    mediaType === "extendedTextMessage" ||
    mediaType === "text" ||
    mediaType === "contactMessage" ||
    mediaType === "interactive";

  const isLocationMessage =
    mediaType === "location" || mediaType === "locationMessage";

  if (isLocationMessage) {
    const locationPayload =
      parseLocationFromUnknown(message.body) ||
      parseLocationFromUnknown(message.dataJson);

    if (locationPayload) {
      try {
        const SendWhatsAppInteractive = (await import("../services/WbotServices/SendWhatsAppInteractive")).default;

        await SendWhatsAppInteractive({
          ticket: createTicket,
          interactiveType: "location",
          bodyText: "",
          latitude: locationPayload.latitude,
          longitude: locationPayload.longitude,
          locationName: locationPayload.locationName,
          locationAddress: locationPayload.locationAddress || locationPayload.googleMapsUrl
        });

        return res.send();
      } catch (error) {
        logger.error(`[forwardMessage] Erro ao encaminhar localização nativa: ${error}`);
        const fallbackBody = `_Mensagem encaminhada_:\n📍 Localização\n${locationPayload.googleMapsUrl}`;

        if (ticket.channel === "whatsapp") {
          await SendWhatsAppMessage({
            body: fallbackBody,
            ticket: createTicket,
            quotedMsg,
            isForwarded: message.fromMe ? false : true
          });
        }

        if (ticket.channel === "whatsapp_oficial") {
          await SendWhatsAppOficialMessage({
            body: fallbackBody,
            ticket: createTicket,
            quotedMsg,
            type: "text",
            media: null
          });
        }

        return res.send();
      }
    }

    const fallbackLocationBody = body || "_Mensagem encaminhada_:\n📍 Localização";

    if (ticket.channel === "whatsapp") {
      await SendWhatsAppMessage({
        body: fallbackLocationBody,
        ticket: createTicket,
        quotedMsg,
        isForwarded: message.fromMe ? false : true
      });
    }

    if (ticket.channel === "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: fallbackLocationBody,
        ticket: createTicket,
        quotedMsg,
        type: "text",
        media: null
      });
    }

    return res.send();
  }

  if (isTextLikeMessage) {
    if (ticket.channel === "whatsapp") {
      await SendWhatsAppMessage({
        body,
        ticket: createTicket,
        quotedMsg,
        isForwarded: message.fromMe ? false : true
      });
    }

    if (ticket.channel === "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: `_Mensagem encaminhada_:\n ${body}`,
        ticket: createTicket,
        quotedMsg,
        type: "text",
        media: null
      });
    }

    return res.send();
  }

  const rawMediaUrl = typeof message.mediaUrl === "string" ? message.mediaUrl : null;

  if (!rawMediaUrl) {
    logger.warn(
      `[forwardMessage] Mensagem ${messageId} sem mediaUrl para mediaType=${mediaType}. Usando fallback textual.`
    );

    const fallbackBody = body || "_Mensagem encaminhada_";

    if (ticket.channel === "whatsapp") {
      await SendWhatsAppMessage({
        body: fallbackBody,
        ticket: createTicket,
        quotedMsg,
        isForwarded: message.fromMe ? false : true
      });
    }

    if (ticket.channel === "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: `_Mensagem encaminhada_:\n ${fallbackBody}`,
        ticket: createTicket,
        quotedMsg,
        type: "text",
        media: null
      });
    }

    return res.send();
  }

  const mediaUrl = rawMediaUrl.replace(`:${process.env.PORT}`, "");
  const fileName = obterNomeEExtensaoDoArquivo(mediaUrl);

  if (body === fileName) {
    body = "";
  }

  const publicFolder = path.join(__dirname, "..", "..", "..", "backend", "public");
  const filePath = path.join(publicFolder, `company${createTicket.companyId}`, fileName);

  const mediaSrc = {
    fieldname: "medias",
    originalname: fileName,
    encoding: "7bit",
    mimetype: message.mediaType,
    filename: fileName,
    path: filePath
  } as Express.Multer.File;

  if (ticket.channel === "whatsapp") {
    await SendWhatsAppMedia({
      media: mediaSrc,
      ticket: createTicket,
      body,
      isForwarded: message.fromMe ? false : true
    });
  }

  if (ticket.channel === "whatsapp_oficial") {
    await SendWhatsAppOficialMessage({
      body: `_Mensagem encaminhada_:\n ${body}`,
      ticket: createTicket,
      quotedMsg,
      type: null,
      media: mediaSrc
    });
  }

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId, companyId);
  const io = getIO();

  if (message.isPrivate) {
    await Message.destroy({
      where: {
        id: message.id
      }
    });
    io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
      action: "delete",
      message
    });
  }

  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res.send();
};

export const allMe = async (req: Request, res: Response): Promise<Response> => {
  const dateStart: any = req.query.dateStart;
  const dateEnd: any = req.query.dateEnd;
  const fromMe: any = req.query.fromMe;

  const { companyId } = req.user;

  const { count } = await ListMessagesServiceAll({
    companyId,
    fromMe,
    dateStart,
    dateEnd
  });

  return res.json({ count });
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const authHeader = req.headers.authorization;
    const [, token] = authHeader.split(" ");

    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (!whatsapp) {
      return res.status(401).json({ error: "Token inválido ou WhatsApp não encontrado" });
    }
    const companyId = whatsapp.companyId;
    const company = await ShowPlanCompanyService(companyId);
    const sendMessageWithExternalApi = company?.plan?.useExternalApi;

    if (sendMessageWithExternalApi) {
      if (!whatsapp) {
        throw new Error("Não foi possível realizar a operação");
      }

      if (messageData.number === undefined) {
        throw new Error("O número é obrigatório");
      }

      const number = messageData.number;
      const body = messageData.body;

      if (medias) {
        await Promise.all(
          medias.map(async (media: Express.Multer.File) => {
            req.app.get("queues").messageQueue.add(
              "SendMessage",
              {
                whatsappId: whatsapp.id,
                data: {
                  number,
                  body: media.originalname.replace("/", "-"),
                  mediaPath: media.path
                }
              },
              { removeOnComplete: true, attempts: 3 }
            );
          })
        );
      } else {
        req.app.get("queues").messageQueue.add(
          "SendMessage",
          {
            whatsappId: whatsapp.id,
            data: {
              number,
              body
            }
          },
          { removeOnComplete: true, attempts: 3 }
        );
      }
      return res.send({ mensagem: "Mensagem enviada!" });
    }
    return res.status(400).json({ error: "Essa empresa não tem permissão para usar a API Externa. Entre em contato com o Suporte para verificar nossos planos!" });
  } catch (err: any) {
    logger.error(`[SEND] Erro ao enviar mensagem: ${err.message || err}`);
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "Não foi possível enviar a mensagem, tente novamente em alguns instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};

export const edit = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;

  const { ticket, message } = await EditWhatsAppMessage({ messageId, body });

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket
  });
  return res.send();
};

export const storeTemplate = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const { quotedMsg, templateId, variables, bodyToSave }: MessageTemplateData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);

  const template = await ShowService(templateId, companyId);

  if (!template) {
    throw new Error("Template not found");
  }

  let templateData: IMetaMessageTemplate = {
    name: template.shortcode,
    language: {
      code: template.language
    }
  };

  if (Object.keys(variables).length > 0) {
    templateData = {
      name: template.shortcode,
      language: {
        code: template.language
      }
    };

    if (Array.isArray(template.components) && template.components.length > 0) {
      template.components.forEach((component, index) => {
        const componentType = component.type.toLowerCase() as "header" | "body" | "footer" | "button" | "buttons";

        if (variables[componentType] && Object.keys(variables[componentType]).length > 0) {
          let newComponent;

          if (componentType.replace("buttons", "button") === "button") {
            let buttons: any[] = [];

            try {
              buttons = typeof component.buttons === "string"
                ? JSON.parse(component.buttons)
                : Array.isArray(component.buttons)
                  ? component.buttons
                  : [];
            } catch (error) {
              buttons = [];
            }

            buttons.forEach((button, buttonIndex) => {
              const subButton = Object.values(variables[componentType]);

              subButton.forEach((sub: any) => {
                if (sub.buttonIndex === buttonIndex) {
                  const buttonType = button.type;
                  newComponent = {
                    type: componentType.replace("buttons", "button"),
                    sub_type: buttonType,
                    index: buttonIndex,
                    parameters: []
                  };
                }
              });
            });
          } else {
            newComponent = {
              type: componentType,
              parameters: []
            };
          }

          if (newComponent) {
            Object.keys(variables[componentType]).forEach(key => {
              if (componentType.replace("buttons", "button") === "button") {
                if ((newComponent as any)?.sub_type === "COPY_CODE") {
                  (newComponent as any).parameters.push({
                    type: "coupon_code",
                    coupon_code: variables[componentType][key].value
                  });
                } else {
                  (newComponent as any).parameters.push({
                    type: "text",
                    text: variables[componentType][key].value
                  });
                }
              } else {
                if (template.components[index].format === "IMAGE") {
                  (newComponent as any).parameters.push({
                    type: "image",
                    image: {
                      link: variables[componentType][key].value
                    }
                  });
                } else {
                  const variableValue = variables[componentType][key].value;
                  (newComponent as any).parameters.push({
                    type: "text",
                    text: variableValue
                  });
                }
              }
            });
          }

          if (!Array.isArray(templateData.components)) {
            templateData.components = [];
          }

          templateData.components.push(newComponent as IMetaMessageTemplateComponents);
        }
      });
    }
  }

  const buttonsToSave = normalizeTemplateButtonsToSave(template.components || []);

  logger.debug(`[STORE_TEMPLATE] templateData: ${JSON.stringify(templateData)}`);
  logger.debug(`[STORE_TEMPLATE] buttonsToSave: ${JSON.stringify(buttonsToSave)}`);

  const newBodyToSave = `${String(bodyToSave || "")}||||${JSON.stringify(buttonsToSave)}`;

  if (["whatsapp_oficial"].includes(ticket.channel) && ticket.whatsappId) {
    SetTicketMessagesAsRead(ticket);
  }

  try {
    if (ticket.channel == "whatsapp_oficial") {
      await SendWhatsAppOficialMessage({
        body: newBodyToSave,
        bodyToSave: newBodyToSave,
        ticket,
        quotedMsg,
        type: "template",
        media: null,
        template: templateData
      });

      await ticket.reload({
        include: [{ model: Contact, as: "contact" }]
      });

      await ticket.contact.update({
        lastInteractionClient: new Date()
      });

      logger.info(
        `[STORE_TEMPLATE] Template enviado - Janela de 24h aberta para o contato ${ticket.contact.id}`
      );
    }

    return res.sendStatus(200);
  } catch (error) {
    logger.error(`[STORE_TEMPLATE] Erro ao enviar template: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<String> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("Não foi possível realizar a operação");
    }

    if (messageData.number === undefined) {
      throw new Error("O número é obrigatório");
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const companyId = messageData.companyId;

    const CheckValidNumber: any = await CheckContactNumber(numberToTest, companyId);
    const number = CheckValidNumber.jid.split("@")[0];

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body
          }
        },

        { removeOnComplete: false, attempts: 3 }
      );
    }

    return "Mensagem enviada";
  } catch (err: any) {
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "Não foi possível enviar a mensagem, tente novamente em alguns instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};

export const transcribeAudioMessage = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { wid } = req.body;

  const transcribedText = await TranscribeAudioMessageToText(wid, companyId.toString());

  return res.send(transcribedText);
};

export const storeInteractive = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const {
    interactiveType,
    bodyText,
    footerText,
    headerText,
    headerImage,
    buttons,
    listButtonText,
    sections,
    latitude,
    longitude,
    locationName,
    locationAddress,
    urlText,
    url,
    callText,
    callNumber,
    pixKey,
    pixName,
    pixCity,
    pixAmount,
    pollQuestion,
    pollOptions,
    offerTitle,
    offerPrice,
    offerDescription,
    offerImageUrl,
    carouselCards,
    cobrancaNumber,
    cobrancaDescription,
    cobrancaQuantity,
    cobrancaAmount,
    cobrancaMessage,
    cobrancaPaymentUrl,
    cobrancaButtonText,
    cobrancaPdfPath
  } = req.body;

  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket.whatsappId) {
    throw new AppError("Este ticket não possui conexão vinculada.", 400);
  }

  SetTicketMessagesAsRead(ticket);

  try {
    const SendWhatsAppInteractive = (await import("../services/WbotServices/SendWhatsAppInteractive")).default;

    const result = await SendWhatsAppInteractive({
      ticket,
      interactiveType,
      bodyText: bodyText || "",
      footerText,
      headerText,
      headerImage,
      buttons,
      listButtonText,
      sections,
      latitude,
      longitude,
      locationName,
      locationAddress,
      urlText,
      url,
      callText,
      callNumber,
      pixKey,
      pixName,
      pixCity,
      pixAmount,
      pollQuestion,
      pollOptions,
      offerTitle,
      offerPrice,
      offerDescription,
      offerImageUrl,
      carouselCards,
      cobrancaNumber,
      cobrancaDescription,
      cobrancaQuantity: cobrancaQuantity ? parseInt(cobrancaQuantity) : undefined,
      cobrancaAmount: cobrancaAmount ? parseFloat(cobrancaAmount) : undefined,
      cobrancaMessage,
      cobrancaPaymentUrl,
      cobrancaButtonText,
      cobrancaPdfPath
    });

    return res.json({ message: "Mensagem interativa enviada com sucesso", result });
  } catch (error) {
    logger.error(`[storeInteractive] Erro: ${error?.message}`);
    return res.status(400).json({ error: error?.message || "Erro ao enviar mensagem interativa" });
  }
};
