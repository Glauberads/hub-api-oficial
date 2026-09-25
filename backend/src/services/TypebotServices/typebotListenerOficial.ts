import axios from "axios";
import fs from "fs/promises";
import os from "os";
import path from "path";
import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import moment from "moment";
import formatBody from "../../helpers/Mustache";
import sharp from "sharp";
import delay from "../../utils/delay";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import {
  handleIntegrationGatilho,
  handleIntegrationTransfer,
  handleIntegrationCloseTicket,
  handleIntegrationOpenTicket
} from "../IntegrationServices/IntegrationActionsService";

const forceFileNameExtensionByMimeType = (fileName: string, mimeType?: string): string => {
  const normalizedFileName = sanitizeFileName(fileName || "arquivo");
  const parsed = path.parse(normalizedFileName);
  const extFromMime = getExtensionFromMimeType(mimeType);

  if (!extFromMime) {
    return normalizedFileName;
  }

  return `${parsed.name}.${extFromMime}`;
};

interface Request {
  msg?: any;
  body?: string;
  ticket: Ticket;
  typebot: QueueIntegrations & Record<string, any>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  rar: "application/vnd.rar",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4"
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/vnd.rar": "rar",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "application/octet-stream": "bin"
};

const isUrl = (value?: string): boolean => {
  if (!value || typeof value !== "string") return false;
  return /^https?:\/\//i.test(value);
};

const tryParseJson = (value: any): any => {
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const sanitizeFileName = (value?: string): string => {
  const safe = (value || "arquivo")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();

  return safe || "arquivo";
};

const getFileNameFromUrl = (url?: string): string => {
  if (!url) return "arquivo";

  try {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const basename = path.basename(cleanUrl);
    const decoded = decodeURIComponent(basename || "arquivo");
    return sanitizeFileName(decoded);
  } catch (error) {
    return "arquivo";
  }
};

const getMimeTypeFromFileName = (fileName?: string): string | undefined => {
  if (!fileName) return undefined;

  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  if (!ext) return undefined;

  return MIME_BY_EXTENSION[ext];
};

const getExtensionFromMimeType = (mimeType?: string): string => {
  if (!mimeType) return "";
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] || "";
};

const ensureExtension = (fileName: string, mimeType?: string): string => {
  const normalizedFileName = sanitizeFileName(fileName);

  if (path.extname(normalizedFileName)) {
    return normalizedFileName;
  }

  const ext = getExtensionFromMimeType(mimeType);
  if (!ext) return normalizedFileName;

  return `${normalizedFileName}.${ext}`;
};

const getContentObject = (message: any): any => {
  if (!message) return null;
  if (typeof message.content === "object" && message.content !== null) {
    return message.content;
  }
  return tryParseJson(message.content);
};

const resolveMediaUrl = (message: any): string | null => {
  const contentObj = getContentObject(message);

  const directCandidates = [
    message?.url,
    message?.src,
    message?.fileUrl,
    message?.link,
    contentObj?.url,
    contentObj?.src,
    contentObj?.fileUrl,
    contentObj?.link,
    contentObj?.downloadUrl,
    contentObj?.publicUrl
  ];

  for (const candidate of directCandidates) {
    if (isUrl(candidate)) {
      return candidate;
    }
  }

  if (typeof message?.content === "string" && isUrl(message.content)) {
    return message.content;
  }

  return null;
};

const resolveMediaName = (
  message: any,
  mediaUrl?: string,
  mimeType?: string
): string => {
  const contentObj = getContentObject(message);

  const candidate =
    contentObj?.originalname ||
    contentObj?.fileName ||
    contentObj?.filename ||
    contentObj?.name ||
    message?.originalname ||
    message?.fileName ||
    message?.filename ||
    message?.name ||
    getFileNameFromUrl(mediaUrl);

  return ensureExtension(sanitizeFileName(candidate), mimeType);
};

const resolveMediaMimeType = (
  message: any,
  fallbackMimeType?: string,
  fileName?: string
): string => {
  const contentObj = getContentObject(message);

  const rawMimeType =
    contentObj?.mimetype ||
    contentObj?.mimeType ||
    message?.mimetype ||
    message?.mimeType ||
    fallbackMimeType ||
    getMimeTypeFromFileName(fileName) ||
    "application/octet-stream";

  return String(rawMimeType).split(";")[0].trim().toLowerCase();
};

const resolveMediaCaption = (message: any): string => {
  const contentObj = getContentObject(message);

  const caption =
    contentObj?.caption ||
    contentObj?.text ||
    contentObj?.description ||
    message?.caption ||
    "";

  return typeof caption === "string" ? caption : "";
};

const resolveOfficialType = (
  messageType: string,
  mimeType?: string
): "audio" | "image" | "video" | "document" => {
  const normalizedMessageType = String(messageType || "").toLowerCase();
  const normalizedMimeType = String(mimeType || "").toLowerCase();

  if (normalizedMessageType === "audio") return "audio";
  if (normalizedMessageType === "image") return "image";
  if (normalizedMessageType === "video") return "video";
  if (normalizedMessageType === "file" || normalizedMessageType === "document") return "document";

  if (normalizedMimeType.startsWith("audio/")) return "audio";
  if (normalizedMimeType.startsWith("image/")) return "image";
  if (normalizedMimeType.startsWith("video/")) return "video";

  return "document";
};

const buildTempMediaFile = async (message: any): Promise<Express.Multer.File | null> => {
  const mediaUrl = resolveMediaUrl(message);

  if (!mediaUrl) {
    logger.warn(`[TYPEBOT OFICIAL] Mídia sem URL válida. Tipo recebido: ${message?.type}`);
    return null;
  }

  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  let buffer = Buffer.from(response.data);

  const headerMimeType = response.headers?.["content-type"]
    ? String(response.headers["content-type"]).split(";")[0].trim().toLowerCase()
    : undefined;

  let fileName = resolveMediaName(message, mediaUrl, headerMimeType);
  let mimeType = resolveMediaMimeType(message, headerMimeType, fileName);
  const officialType = resolveOfficialType(message?.type, mimeType);

  if (officialType === "image" && mimeType === "image/webp") {
    buffer = await sharp(buffer).png().toBuffer();
    mimeType = "image/png";
    fileName = forceFileNameExtensionByMimeType(fileName, mimeType);
  } else {
    fileName = forceFileNameExtensionByMimeType(fileName, mimeType);
  }

  const finalExt = path.extname(fileName) || `.${getExtensionFromMimeType(mimeType) || "bin"}`;
  const tempFileName = `typebot-${Date.now()}-${Math.random().toString(36).slice(2)}${finalExt}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  await fs.writeFile(tempFilePath, buffer);

  logger.info(
    `[TYPEBOT OFICIAL][MEDIA DEBUG] type=${message?.type} url=${mediaUrl} filename=${fileName} mimetype=${mimeType} tempPath=${tempFilePath}`
  );

  const mediaSrc = {
    fieldname: "medias",
    originalname: fileName,
    encoding: "7bit",
    mimetype: mimeType,
    filename: tempFileName,
    path: tempFilePath,
    size: buffer.length,
    destination: os.tmpdir()
  } as Express.Multer.File;

  return mediaSrc;
};

const removeTempMediaFile = async (media?: Express.Multer.File | null): Promise<void> => {
  try {
    if (!media?.path) return;
    if (!media.path.startsWith(os.tmpdir())) return;

    await fs.unlink(media.path);
  } catch (error) {
    logger.warn(`[TYPEBOT OFICIAL] Não foi possível remover arquivo temporário: ${media?.path}`);
  }
};

const resolveValidIntegrationId = async (
  ticket: Ticket,
  typebot: QueueIntegrations & Record<string, any>
): Promise<number | null> => {
  const candidates = [
    typebot?.integrationId,
    ticket?.integrationId
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);

    if (Number.isInteger(id) && id > 0) {
      const exists = await QueueIntegrations.findByPk(id);
      if (exists) {
        return id;
      }
    }
  }

  return null;
};

const typebotListenerOficial = async ({
  msg,
  body: explicitBody,
  ticket,
  typebot
}: Request): Promise<void> => {

  const {
    urlN8N: url,
    typebotExpires,
    typebotKeywordFinish,
    typebotKeywordRestart,
    typebotUnknownMessage,
    typebotSlug,
    typebotDelayMessage,
    typebotRestartMessage
  } = typebot;

  const number = ticket.contact.number;

  let body = String(
    explicitBody ||
    msg?.message?.conversation ||
    msg?.message?.text ||
    msg?.body ||
    msg?.text ||
    ""
  ).trim();

  async function createSession(msg, typebot, number) {
    try {
      const reqData = JSON.stringify({
        isStreamEnabled: true,
        message: "string",
        resultId: "string",
        isOnlyRegistering: false,
        prefilledVariables: {
          number,
          pushName: ticket?.contact?.name || "",
          remoteJid: ticket?.contact?.remoteJid
        }
      });

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${url}/api/v1/typebots/${typebotSlug}/startChat`,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        data: reqData
      };

      const request = await axios.request(config);
      return request.data;

    } catch (err) {
      logger.info("Erro ao criar sessão do typebot: ", err);
      throw err;
    }
  }

  let sessionId;
  let dataStart;
  let status = false;

  try {
    let Agora = new Date();
    Agora.setMinutes(Agora.getMinutes() - Number(typebotExpires));

    if (typebotExpires > 0 && ticket.typebotSessionTime && Agora > ticket.typebotSessionTime) {
      await ticket.update({
        typebotSessionId: null,
        typebotSessionTime: null,
        isBot: true
      });

      await ticket.reload();
    }

    if (isNil(ticket.typebotSessionId)) {
      dataStart = await createSession(msg, typebot, number);
      sessionId = dataStart?.sessionId;
      status = true;

      const validIntegrationId = await resolveValidIntegrationId(ticket, typebot);

      await ticket.update({
        typebotSessionId: sessionId,
        typebotStatus: true,
        useIntegration: true,
        integrationId: validIntegrationId,
        typebotSessionTime: moment().toDate()
      });

      await ticket.reload();
    } else {
      sessionId = ticket.typebotSessionId;
      status = ticket.typebotStatus;
    }

    if (!status) return;

    if (
      body.toLocaleLowerCase().trim() !== String(typebotKeywordFinish || "").toLocaleLowerCase().trim() &&
      body.toLocaleLowerCase().trim() !== String(typebotKeywordRestart || "").toLocaleLowerCase().trim()
    ) {
      let requestContinue;
      let messages;
      let input;
      let clientSideActions;

      if (dataStart?.messages?.length === 0 || dataStart === undefined) {
        const reqData = JSON.stringify({
          message: body
        });

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `${url}/api/v1/sessions/${sessionId}/continueChat`,
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          data: reqData
        };

        requestContinue = await axios.request(config);
        messages = requestContinue.data?.messages;
        input = requestContinue.data?.input;
        clientSideActions = requestContinue.data?.clientSideActions;

      } else {
        messages = dataStart?.messages;
        input = dataStart?.input;
        clientSideActions = dataStart?.clientSideActions;
      }

      if (messages?.length === 0) {
        await SendWhatsAppOficialMessage({
          body: typebotUnknownMessage,
          ticket,
          quotedMsg: null,
          type: "text",
          media: null,
          vCard: null
        });
      } else {
        for (const message of messages) {
          if (message.type === "text") {
            let formattedText = "";

            if (typeof message.content === "string") {
              formattedText = message.content;
            } else if (message.content?.richText) {
              let linkPreview = false;

              for (const richText of message.content.richText) {
                for (const element of richText.children) {
                  let text = "";

                  if (element.text) {
                    text = element.text;
                  }

                  if (element.type && element.children) {
                    for (const subelement of element.children) {
                      let subText = "";

                      if (subelement.text) {
                        subText = subelement.text;
                      }

                      if (subelement.type && subelement.children) {
                        for (const subelement2 of subelement.children) {
                          let subText2 = "";

                          if (subelement2.text) {
                            subText2 = subelement2.text;
                          }

                          if (subelement2.bold) {
                            subText2 = `*${subText2}*`;
                          }
                          if (subelement2.italic) {
                            subText2 = `_${subText2}_`;
                          }
                          if (subelement2.underline) {
                            subText2 = `~${subText2}~`;
                          }
                          if (subelement2.url && subelement2.children?.[0]?.text) {
                            const linkText = subelement2.children[0].text;
                            subText2 = `[${linkText}](${subelement2.url})`;
                            linkPreview = true;
                          }

                          formattedText += subText2;
                        }
                      }

                      if (subelement.bold) {
                        subText = `*${subText}*`;
                      }
                      if (subelement.italic) {
                        subText = `_${subText}_`;
                      }
                      if (subelement.underline) {
                        subText = `~${subText}~`;
                      }
                      if (subelement.url && subelement.children?.[0]?.text) {
                        const linkText = subelement.children[0].text;
                        subText = `[${linkText}](${subelement.url})`;
                        linkPreview = true;
                      }

                      formattedText += subText;
                    }
                  }

                  if (element.bold) {
                    text = `*${text}*`;
                  }
                  if (element.italic) {
                    text = `_${text}_`;
                  }
                  if (element.underline) {
                    text = `~${text}~`;
                  }

                  if (element.url && element.children?.[0]?.text) {
                    const linkText = element.children[0].text;
                    text = `[${linkText}](${element.url})`;
                    linkPreview = true;
                  }

                  formattedText += text;
                }

                formattedText += "\n";
              }

              formattedText = formattedText.replace("**", "").replace(/\n$/, "");
            }

            if (formattedText === "Invalid message. Please, try again.") {
              formattedText = typebotUnknownMessage;
            }

            if (formattedText.startsWith("#")) {
              const gatilho = formattedText.replace("#", "");

              const handled = await handleIntegrationGatilho(gatilho, typebot, ticket);
              if (handled) return;

              try {
                const jsonGatilho = JSON.parse(gatilho);

                if (jsonGatilho.stopBot && isNil(jsonGatilho.userId) && isNil(jsonGatilho.queueId)) {
                  await ticket.update({
                    useIntegration: false,
                    integrationId: null,
                    isBot: false
                  });

                  return;
                }

                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && isNil(jsonGatilho.userId)) {
                  await UpdateTicketService({
                    ticketData: {
                      queueId: jsonGatilho.queueId,
                      isBot: false,
                      useIntegration: false,
                      integrationId: null
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                  });

                  return;
                }

                if (!isNil(jsonGatilho.queueId) && jsonGatilho.queueId > 0 && !isNil(jsonGatilho.userId) && jsonGatilho.userId > 0) {
                  await UpdateTicketService({
                    ticketData: {
                      queueId: jsonGatilho.queueId,
                      userId: jsonGatilho.userId,
                      isBot: false,
                      useIntegration: false,
                      integrationId: null
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                  });

                  return;
                }

                if (
                  !isNil(jsonGatilho.openTicketQueueId) ||
                  !isNil(jsonGatilho.openTicketUserId)
                ) {
                  await handleIntegrationOpenTicket(typebot, ticket);
                  return;
                }
              } catch (err) {
                throw err;
              }
            }

            await delay(typebotDelayMessage || 1000);

            await SendWhatsAppOficialMessage({
              body: formatBody(formattedText, ticket),
              ticket,
              quotedMsg: null,
              type: "text",
              media: null,
              vCard: null
            });
          }

          if (
            message.type === "audio" ||
            message.type === "image" ||
            message.type === "video" ||
            message.type === "file" ||
            message.type === "document"
          ) {
            await delay(typebotDelayMessage || 1000);

            const mediaSrc = await buildTempMediaFile(message);
            const caption = resolveMediaCaption(message);
            const contentObj = getContentObject(message);
            const mimeType =
              mediaSrc?.mimetype ||
              contentObj?.mimetype ||
              contentObj?.mimeType ||
              "application/octet-stream";

            const officialType = resolveOfficialType(message.type, mimeType);

            if (!mediaSrc) {
              logger.warn(`[TYPEBOT OFICIAL] Falha ao preparar mídia do Typebot. type=${message.type}`);
            } else {
              try {
                await SendWhatsAppOficialMessage({
                  body: caption ? formatBody(caption, ticket) : "",
                  ticket,
                  quotedMsg: null,
                  type: officialType,
                  media: mediaSrc,
                  vCard: null
                });
              } finally {
                await removeTempMediaFile(mediaSrc);
              }
            }
          }

          if (clientSideActions) {
            for (const action of clientSideActions) {
              if (action?.lastBubbleBlockId === message.id) {
                if (action.wait) {
                  await delay(action.wait.secondsToWaitFor * 1000);
                }
              }
            }
          }
        }

        if (input) {
          if (input.type === "choice input") {
            let formattedText = "";
            const items = input.items || [];

            for (const item of items) {
              formattedText += `▶️ ${item.content}\n`;
            }

            formattedText = formattedText.replace(/\n$/, "");

            await delay(typebotDelayMessage || 1000);

            await SendWhatsAppOficialMessage({
              body: formattedText,
              ticket,
              quotedMsg: null,
              type: "text",
              media: null,
              vCard: null
            });
          }
        }
      }
    }

    if (body.toLocaleLowerCase().trim() === String(typebotKeywordRestart || "").toLocaleLowerCase().trim()) {
      await ticket.update({
        isBot: true,
        typebotSessionId: null
      });

      await ticket.reload();

      await SendWhatsAppOficialMessage({
        body: typebotRestartMessage,
        ticket,
        quotedMsg: null,
        type: "text",
        media: null,
        vCard: null
      });
    }

    if (body.toLocaleLowerCase().trim() === String(typebotKeywordFinish || "").toLocaleLowerCase().trim()) {
      if (typebot.enableCloseTicket) {
        await handleIntegrationCloseTicket(typebot, ticket);
        return;
      }

      if (typebot.enableTransfer) {
        await handleIntegrationTransfer(typebot, ticket);
        return;
      }

      await UpdateTicketService({
        ticketData: {
          status: "closed",
          useIntegration: false,
          integrationId: null,
          sendFarewellMessage: true
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      return;
    }
  } catch (error) {
    logger.info("Error on typebotListenerOficial: ", error);

    await ticket.update({
      typebotSessionId: null
    });

    throw error;
  }
};

export default typebotListenerOficial;