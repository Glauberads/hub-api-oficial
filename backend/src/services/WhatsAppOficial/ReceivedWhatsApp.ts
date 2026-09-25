import path from "path";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import moment from "moment";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import verifyMessageOficial from "./VerifyMessageOficial";
import verifyQueueOficial from "./VerifyQueue";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { handleMessageIntegration } from "../WbotServices/wbotMessageListener";
import { flowbuilderIntegration } from "../WbotServices/wbotMessageListener";
import { WebhookModel } from "../../models/Webhook";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import ContactTag from "../../models/ContactTag";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import cacheLayer from "../../libs/cache";
import { isNil } from "lodash";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import SendWhatsAppOficialMessage from "./SendWhatsAppOficialMessage";
import typebotListenerOficial from "../TypebotServices/typebotListenerOficial";
import UserRating from "../../models/UserRating";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import ResolveOrCreateContactByIdentifierService from "../ContactServices/ResolveOrCreateContactByIdentifierService";

const mimeToExtension: { [key: string]: string } = {
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/oga': 'ogg',
    'audio/opus': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'weba',
    'audio/3gpp': '3gp',
    'audio/3gpp2': '3g2',
    'audio/x-wav': 'wav',
    'audio/midi': 'midi',
    'application/x-abiword': 'abw',
    'application/octet-stream': 'arc',
    'video/x-msvideo': 'avi',
    'application/vnd.amazon.ebook': 'azw',
    'application/x-bzip': 'bz',
    'application/x-bzip2': 'bz2',
    'application/x-csh': 'csh',
    'text/css': 'css',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-fontobject': 'eot',
    'application/epub+zip': 'epub',
    'image/gif': 'gif',
    'text/html': 'html',
    'image/x-icon': 'ico',
    'text/calendar': 'ics',
    'image/jpeg': 'jpg',
    'application/json': 'json',
    'video/mpeg': 'mpeg',
    'application/vnd.apple.installer+xml': 'mpkg',
    'video/ogg': 'ogv',
    'application/ogg': 'ogx',
    'font/otf': 'otf',
    'image/png': 'png',
    'application/pdf': 'pdf',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/x-rar-compressed': 'rar',
    'application/rtf': 'rtf',
    'application/x-sh': 'sh',
    'image/svg+xml': 'svg',
    'application/x-shockwave-flash': 'swf',
    'image/tiff': 'tiff',
    'application/typescript': 'ts',
    'font/ttf': 'ttf',
    'application/vnd.visio': 'vsd',
    'application/xhtml+xml': 'xhtml',
    'application/xml': 'xml',
    'application/zip': 'zip',
    'application/x-7z-compressed': '7z',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/x-msdownload': 'exe',
    'application/x-executable': 'exe',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/3gpp2': '3g2',
};

const getOfficialPublicRoot = (): string => {
    return path.resolve(__dirname, "..", "..", "..", "..", "api_oficial", "public");
};

const sanitizeFileName = (fileName: string): string => {
    return String(fileName || "arquivo")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim();
};

const getExtensionFromMime = (mimeType?: string): string => {
    const normalizedMime = String(mimeType || "").toLowerCase().trim();

    if (normalizedMime && mimeToExtension[normalizedMime]) {
        return mimeToExtension[normalizedMime];
    }

    const subtype = normalizedMime.split("/")[1] || "bin";

    return subtype
        .split(";")[0]
        .replace(/[^a-zA-Z0-9]/g, "") || "bin";
};

const buildOfficialMediaRelativePath = (
    companyId: number,
    whatsappId: number,
    fileName: string
): string => {
    const dateFolder = moment().format("YYYY-MM-D");
    return path.posix.join(
        dateFolder,
        String(companyId),
        String(whatsappId),
        sanitizeFileName(fileName)
    );
};

const saveBufferToOfficialPublic = (
    buffer: Buffer,
    companyId: number,
    whatsappId: number,
    fileName: string
): string => {
    const publicRoot = getOfficialPublicRoot();
    const relativePath = buildOfficialMediaRelativePath(companyId, whatsappId, fileName);
    const absolutePath = path.join(publicRoot, relativePath);
    const targetDir = path.dirname(absolutePath);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
        chmodSync(targetDir, 0o777);
    }

    writeFileSync(absolutePath, new Uint8Array(buffer));

    try {
        chmodSync(absolutePath, 0o664);
    } catch (error) {
        logger.warn(`[RECEIVED WHATSAPP] Não foi possível ajustar permissão do arquivo ${absolutePath}`);
    }

    return relativePath.replace(/\\/g, "/");
};

/**
 * Converte o retorno técnico da permissão de chamadas da API Oficial
 * em uma mensagem amigável para exibição no atendimento.
 *
 * Exemplo recebido:
 * {
 *   "type": "callpermissionreply",
 *   "callpermissionreply": {
 *     "response": "accept",
 *     "ispermanent": true,
 *     "responsesource": "user_action"
 *   }
 * }
 */
const buildCallPermissionReplyFriendlyText = (
    rawValue: unknown
): string | null => {
    let payload: any = rawValue;

    if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();

        if (!trimmed.startsWith("{")) {
            return null;
        }

        try {
            payload = JSON.parse(trimmed);
        } catch {
            return null;
        }
    }

    if (!payload || typeof payload !== "object") {
        return null;
    }

    const normalizedType = String(payload?.type || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    if (normalizedType !== "callpermissionreply") {
        return null;
    }

    const reply =
        payload?.callpermissionreply ||
        payload?.callPermissionReply ||
        payload?.call_permission_reply ||
        {};

    const response = String(reply?.response || "")
        .toLowerCase()
        .trim();

    const permanentRaw =
        reply?.ispermanent ??
        reply?.isPermanent ??
        reply?.is_permanent;

    const isPermanent =
        permanentRaw === true ||
        String(permanentRaw).toLowerCase() === "true";

    if (
        response === "accept" ||
        response === "accepted" ||
        response === "allow" ||
        response === "allowed"
    ) {
        if (isPermanent) {
            return [
                "📞 Permissão para chamadas aceita",
                "",
                "O cliente autorizou permanentemente o recebimento de chamadas."
            ].join("\\n");
        }

        return [
            "📞 Permissão para chamada aceita",
            "",
            "O cliente autorizou o recebimento desta chamada."
        ].join("\\n");
    }

    if (
        response === "reject" ||
        response === "rejected" ||
        response === "decline" ||
        response === "declined" ||
        response === "deny" ||
        response === "denied"
    ) {
        return [
            "🚫 Permissão para chamadas recusada",
            "",
            "O cliente não autorizou o recebimento de chamadas."
        ].join("\\n");
    }

    return [
        "📞 Resposta à solicitação de chamada recebida",
        "",
        "O cliente respondeu à solicitação de permissão para chamadas."
    ].join("\\n");
};

const officialMediaTypes = new Set([
    "audio",
    "image",
    "video",
    "document",
    "sticker"
]);

const shouldBypassFlowWebhookForIntegration = (
    ticket: Ticket,
    message: IMessageReceived
): boolean => {
    return Boolean(
        ticket.useIntegration &&
        !isNil(ticket.integrationId) &&
        ticket.isBot !== false
    );
};

const normalizeStringValue = (value?: string | null): string => {
    return String(value || "").trim();
};

const normalizeUsernameValue = (value?: string | null): string => {
    return normalizeStringValue(value).replace(/^@+/, "").toLowerCase();
};

const normalizePhoneDigitsValue = (value?: string | null): string => {
    return normalizeStringValue(value).replace(/\D+/g, "");
};

const buildSimulatedMsgOficial = (
    message: IMessageReceived,
    fromNumber: string,
    fileName: string
): any => {
    const simulatedMsg: any = {
        key: {
            fromMe: false,
            remoteJid: `${fromNumber}@s.whatsapp.net`,
            id: message.idMessage
        },
        messageTimestamp: message.timestamp,
        isOfficial: true,
        mediaPath: fileName || null,
        mediaType: message.type,
        mimetype: message.mimeType || null,
        fileUrl: message.fileUrl || null,
        fileSize: message.fileSize || null,
        message: {
            timestamp: message.timestamp,
            text: message.text || ""
        }
    };

    if (message.text) {
        simulatedMsg.message.conversation = message.text;
        simulatedMsg.message.extendedTextMessage = {
            text: message.text
        };
    }

    if (message.type === "interactive") {
        simulatedMsg.message.buttonsResponseMessage = message.text
            ? { selectedButtonId: message.text }
            : undefined;

        simulatedMsg.message.listResponseMessage = message.text
            ? { singleSelectReply: { selectedRowId: message.text } }
            : undefined;

        return simulatedMsg;
    }

    if (message.type === "audio") {
        simulatedMsg.message.audioMessage = {
            mimetype: message.mimeType || "audio/ogg",
            seconds: 0,
            ptt: true,
            fileLength: message.fileSize || 0,
            url: fileName || undefined
        };
        return simulatedMsg;
    }

    if (message.type === "image") {
        simulatedMsg.message.imageMessage = {
            mimetype: message.mimeType || "image/jpeg",
            caption: message.text || "",
            fileLength: message.fileSize || 0,
            url: fileName || undefined
        };
        return simulatedMsg;
    }

    if (message.type === "video") {
        simulatedMsg.message.videoMessage = {
            mimetype: message.mimeType || "video/mp4",
            caption: message.text || "",
            fileLength: message.fileSize || 0,
            url: fileName || undefined
        };
        return simulatedMsg;
    }

    if (message.type === "document") {
        simulatedMsg.message.documentMessage = {
            mimetype: message.mimeType || "application/octet-stream",
            fileName: fileName ? path.basename(fileName) : `${message.idFile || "documento"}.${getExtensionFromMime(message.mimeType)}`,
            fileLength: message.fileSize || 0,
            url: fileName || undefined
        };
        return simulatedMsg;
    }

    if (message.type === "sticker") {
        simulatedMsg.message.stickerMessage = {
            mimetype: message.mimeType || "image/webp",
            fileLength: message.fileSize || 0,
            url: fileName || undefined
        };
        return simulatedMsg;
    }

    if (message.type === "location") {
        simulatedMsg.message.locationMessage = {};
        return simulatedMsg;
    }

    if (message.type === "contacts") {
        simulatedMsg.message.contactMessage = {};
        return simulatedMsg;
    }

    return simulatedMsg;
};

export interface IReceivedWhatsppOficial {
    token: string;
    fromNumber: string;
    fromWaId?: string | null;
    fromUserId?: string | null;
    fromBsuid?: string | null;
    fromUsername?: string | null;
    remoteIdentifierType?: string | null;
    remoteIdentifierValue?: string | null;
    nameContact: string;
    companyId: number;
    fromMe?: boolean;
    source?: string | null;
    message: IMessageReceived;
}

export interface IReceivedReadWhatsppOficialRead {
    messageId: string;
    companyId: number;
    token: string;
}

export interface IReferralAdMeta {
    sourceId?: string | null;
    sourceUrl?: string | null;
    sourceType?: string | null;
    headline?: string | null;
    body?: string | null;
    imageUrl?: string | null;
    mediaType?: string | null;
    ctwaClid?: string | null;
}

export interface IMessageReceived {
    type:
    | 'text'
    | 'image'
    | 'audio'
    | 'document'
    | 'video'
    | 'location'
    | 'contacts'
    | 'sticker'
    | 'order'
    | 'reaction'
    | 'interactive'
    | 'adMetaPreview';
    timestamp: number;
    idMessage: string;
    idFile?: string;
    text?: string;
    file?: string;
    mimeType?: string;
    quoteMessageId?: string;
    fileUrl?: string;
    fileSize?: number;
    referral?: IReferralAdMeta | null;
    dataJson?: string | null;
    remoteIdentifierType?: string | null;
    remoteIdentifierValue?: string | null;
    remoteUsername?: string | null;
    remoteWaId?: string | null;
    remotePhone?: string | null;
    remoteUserId?: string | null;
    remoteBsuid?: string | null;
    rawMetaPayload?: any;
}

/**
 * ✅ NOVA FUNÇÃO: Baixa arquivo da URL da Meta e retorna o base64
 */
async function downloadFileFromMetaUrl(
    fileUrl: string,
    whatsappToken: string,
    fileSize?: number
): Promise<string> {
    try {
        const axios = require('axios');

        logger.info(`[META DOWNLOAD] Iniciando download - Tamanho: ${fileSize ? (fileSize / 1024 / 1024).toFixed(2) : '?'} MB`);

        const response = await axios.get(fileUrl, {
            headers: {
                'Authorization': `Bearer ${whatsappToken}`,
                'User-Agent': 'curl/7.64.1'
            },
            responseType: 'arraybuffer',
            timeout: 60000 // 60 segundos de timeout
        });

        if (response.status !== 200) {
            throw new Error(`Falha ao baixar arquivo da Meta: HTTP ${response.status}`);
        }

        const base64 = Buffer.from(response.data).toString('base64');

        logger.info(`[META DOWNLOAD] ✅ Download concluído - Base64 gerado: ${(base64.length / 1024 / 1024).toFixed(2)} MB`);

        return base64;
    } catch (error: any) {
        logger.error(`[META DOWNLOAD] ❌ Erro ao baixar arquivo da Meta: ${error.message}`);
        throw new Error(`Erro ao baixar arquivo da Meta: ${error.message}`);
    }
}

export async function generateVCard(contact: any): Promise<string> {
    const firstName = contact?.name?.first_name || contact?.name?.formatted_name?.split(' ')[0];
    const lastName = String(contact?.name?.formatted_name).replace(firstName, '')
    const formattedName = contact?.name?.formatted_name || '';
    const phoneEntries = contact?.phones?.map((phone: any) => {
        const phoneNumber = phone?.phone || '';
        const waId = phone?.wa_id || '';
        const phoneType = phone?.type || 'CELL';
        return `TEL;type=${phoneType};waid=${waId}:+${phoneNumber}\n`;
    });

    const vcard = `BEGIN:VCARD\n`
        + `VERSION:3.0\n`
        + `N:${lastName};${firstName};;;\n`
        + `FN:${formattedName}\n`
        + `${phoneEntries}`
        + `END:VCARD`;
    return vcard;
}

/**
 * Verifica se o ticket está em estado de avaliação pendente
 */
export const verifyRating = (ticketTraking: any) => {
    if (
        ticketTraking &&
        ticketTraking.finishedAt === null &&
        ticketTraking.closedAt !== null &&
        ticketTraking.userId !== null &&
        ticketTraking.ratingAt === null
    ) {
        return true;
    }
    return false;
};

/**
 * Processa a avaliação do atendimento (NPS)
 */
export const handleRating = async (
    rate: number,
    ticket: Ticket,
    ticketTraking: any
) => {
    const io = getIO();
    const companyId = ticket.companyId;

    const { complationMessage } = await ShowWhatsAppService(
        ticket.whatsappId,
        companyId
    );

    let finalRate = rate;

    if (rate < 0) {
        finalRate = 0;
    }
    if (rate > 10) {
        finalRate = 10;
    }

    await UserRating.create({
        ticketId: ticketTraking.ticketId,
        companyId: ticketTraking.companyId,
        userId: ticketTraking.userId,
        rate: finalRate
    });

    if (
        !isNil(complationMessage) &&
        complationMessage !== "" &&
        !ticket.isGroup
    ) {
        const body = complationMessage
            .replace("{{nome}}", ticket.contact.name || "")
            .replace("{{ticket}}", ticket.id.toString());

        await SendWhatsAppOficialMessage({
            body: body,
            ticket: ticket,
            quotedMsg: null,
            type: 'text',
            media: null,
            vCard: null
        });
    }

    await ticket.update({
        isBot: false,
        status: "closed",
        amountUsedBotQueuesNPS: 0
    });

    // Loga fim de atendimento
    await CreateLogTicketService({
        userId: ticket.userId,
        queueId: ticket.queueId,
        ticketId: ticket.id,
        type: "closed"
    });

    io.of(String(companyId))
        .emit(`company-${companyId}-ticket`, {
            action: "delete",
            ticket,
            ticketId: ticket.id
        });

    io.of(String(companyId))
        .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket,
            ticketId: ticket.id
        });
};

// ✅ IMPORTAÇÃO DO CHATBOT LISTENER OFICIAL
import { sayChatbotOficial } from "./ChatBotListenerOficial";

// ============================================
// ✅ NOVOS HELPERS PARA TRATAMENTO DE AD META PREVIEW
// ============================================
const sanitizePreviewPart = (value?: string | null): string => {
    return String(value || "")
        .replace(/\|/g, "/")
        .replace(/\r/g, "")
        .trim();
};

const buildAdMetaPreviewBody = (message: IMessageReceived): string | null => {
    const referral = message?.referral;

    if (!referral) {
        return null;
    }

    const image = sanitizePreviewPart(referral.imageUrl);
    const sourceUrl = sanitizePreviewPart(referral.sourceUrl);
    const title = sanitizePreviewPart(referral.headline);
    const body = sanitizePreviewPart(referral.body);
    const messageUser = sanitizePreviewPart(
        message?.text || "Olá! Tenho interesse e queria mais informações, por favor."
    );

    return [image, sourceUrl, title, body, messageUser].join("|");
};

const normalizeOfficialMessageForPersistence = (
    message: IMessageReceived
): IMessageReceived => {
    if (!message?.referral) {
        return {
            ...message,
            dataJson: message?.dataJson || null
        };
    }

    const previewBody = buildAdMetaPreviewBody(message);

    return {
        ...message,
        type: "adMetaPreview",
        text: previewBody || message.text || "",
        dataJson: JSON.stringify({
            referral: message.referral,
            originalType: message.type || "text",
            originalText: message.text || ""
        })
    };
};

const buildOfficialIncomingDataForPersistence = (
    data: IReceivedWhatsppOficial,
    messageToPersist: IMessageReceived
): IReceivedWhatsppOficial => {
    return {
        ...data,
        message: messageToPersist
    };
};
// ============================================

export class ReceibedWhatsAppService {

    constructor() { }

    async getMessage(data: IReceivedWhatsppOficial) {
        try {
            const { message, fromNumber, token } = data;
            const isFromMe = data.fromMe === true;
            let { nameContact } = data;

            if (isFromMe) {
                logger.info(
                    `[COEXISTENCE ECHO] Recebido eco do celular. messageId=${message?.idMessage || "N/A"} fromNumber=${fromNumber || "N/A"}`
                );
            }

            const rawFromWaId =
                normalizeStringValue(data.fromWaId) ||
                normalizeStringValue(message.remoteWaId) ||
                null;

            const rawFromBsuid =
                normalizeStringValue(data.fromBsuid) ||
                normalizeStringValue(data.fromUserId) ||
                normalizeStringValue(message.remoteBsuid) ||
                normalizeStringValue(message.remoteUserId) ||
                null;

            const rawFromUsername =
                normalizeUsernameValue(data.fromUsername) ||
                normalizeUsernameValue(message.remoteUsername) ||
                null;

            const rawRemoteIdentifierType =
                normalizeStringValue(data.remoteIdentifierType) ||
                normalizeStringValue(message.remoteIdentifierType) ||
                null;

            const rawRemoteIdentifierValue =
                normalizeStringValue(data.remoteIdentifierValue) ||
                normalizeStringValue(message.remoteIdentifierValue) ||
                null;

            // ✅ FIX NOME LID: Se o nameContact for numérico (LID sem @lid) ou vazio,
            // não usar como nome de contato — evita salvar "16265796141093" como nome.
            const isNameLikeLid = nameContact && /^\d{10,}$/.test(nameContact.trim());
            if (!nameContact || isNameLikeLid) {
                // Usar fromNumber como nome provisório (número de telefone é mais legível que LID)
                nameContact = fromNumber;
                logger.info(`[OFICIAL-NOME] nameContact era numérico/vazio (${data.nameContact}), usando fromNumber como nome temporário: ${fromNumber}`);
            }

            // ✅ DEDUPLICAÇÃO: Verificar se a mensagem já foi processada (Meta pode enviar webhooks duplicados)
            const existingMessage = await Message.findOne({
                where: { wid: message.idMessage }
            });

            if (existingMessage) {
                logger.info(`[DEDUP] Mensagem ${message.idMessage} já existe, ignorando webhook duplicado`);
                return;
            }

            const conexao = await Whatsapp.findOne({ where: { token } });

            if (!conexao) {
                logger.error('getMessage - Nenhum whatsApp encontrado para token: ' + token);
                return;
            }

            const { companyId } = conexao;

            const whatsapp = await ShowWhatsAppService(conexao.id, companyId);

            // ✅ Detectar se fromNumber é um LID (identificador interno do WhatsApp)
            const isLidFormat = fromNumber.length >= 15 && /^\d+$/.test(fromNumber);

            const phoneFromPayload =
                rawRemoteIdentifierType === "phone_e164"
                    ? rawRemoteIdentifierValue
                    : null;

            const waIdFromPayload =
                rawFromWaId ||
                (rawRemoteIdentifierType === "wa_id" ? rawRemoteIdentifierValue : null);

            const bsuidFromPayload =
                rawFromBsuid ||
                (rawRemoteIdentifierType === "bsuid" ? rawRemoteIdentifierValue : null);

            const usernameFromPayload =
                rawFromUsername ||
                (rawRemoteIdentifierType === "username" ? rawRemoteIdentifierValue : null);

            const normalizedFromNumberDigits = normalizePhoneDigitsValue(fromNumber);
            const normalizedPayloadPhoneDigits = normalizePhoneDigitsValue(
                phoneFromPayload || message.remotePhone || null
            );

            const resolvedPhone =
                normalizeStringValue(message.remotePhone) ||
                phoneFromPayload ||
                (!isLidFormat ? fromNumber : "") ||
                null;

            const resolvedWaId =
                waIdFromPayload ||
                (!isLidFormat ? fromNumber : "") ||
                null;

            const resolvedBsuid = bsuidFromPayload || null;
            const resolvedUsername = usernameFromPayload || null;
            const resolvedLid = isLidFormat ? fromNumber : null;

            const effectiveRemoteNumber =
                normalizeStringValue(resolvedWaId) ||
                normalizeStringValue(resolvedPhone) ||
                fromNumber;

            const effectiveRemoteJid =
                effectiveRemoteNumber
                    ? `${effectiveRemoteNumber}@s.whatsapp.net`
                    : `${fromNumber}@s.whatsapp.net`;

            logger.info(
                `[OFICIAL-ID] messageId=${message.idMessage} fromNumber=${fromNumber} ` +
                `phone=${resolvedPhone || "null"} waId=${resolvedWaId || "null"} ` +
                `bsuid=${resolvedBsuid || "null"} username=${resolvedUsername || "null"} ` +
                `remoteIdentifierType=${rawRemoteIdentifierType || "null"} ` +
                `remoteIdentifierValue=${rawRemoteIdentifierValue || "null"}`
            );

            let contact = await ResolveOrCreateContactByIdentifierService({
                companyId,
                channel: "whatsapp_cloud",
                provider: "meta",
                name: nameContact,
                number: resolvedPhone || fromNumber,
                phone: resolvedPhone || null,
                waId: resolvedWaId || null,
                bsuid: resolvedBsuid || null,
                username: resolvedUsername || null,
                remoteJid: effectiveRemoteJid,
                lid: resolvedLid,
                whatsappId: whatsapp.id,
                source: "received_whatsapp_oficial",
                metadata: {
                    token,
                    messageId: message.idMessage,
                    originalFromNumber: fromNumber,
                    remoteIdentifierType: rawRemoteIdentifierType,
                    remoteIdentifierValue: rawRemoteIdentifierValue
                }
            });

            if (!contact) {
                logger.error(`[OFICIAL-ID] Não foi possível resolver/criar contato para messageId=${message.idMessage}`);
                return;
            }

            // ✅ Compatibilidade com contatos antigos criados com LID como number
            const contactUpdates: Record<string, any> = {};

            if (
                resolvedLid &&
                contact.lid !== resolvedLid
            ) {
                contactUpdates.lid = resolvedLid;
            }

            if (
                resolvedPhone &&
                normalizePhoneDigitsValue(contact.number) === normalizePhoneDigitsValue(fromNumber) &&
                normalizedPayloadPhoneDigits &&
                normalizedPayloadPhoneDigits !== normalizedFromNumberDigits
            ) {
                contactUpdates.number = normalizedPayloadPhoneDigits;
            }

            if (
                resolvedUsername &&
                normalizeUsernameValue(contact.whatsappUsername) !== normalizeUsernameValue(resolvedUsername)
            ) {
                contactUpdates.whatsappUsername = resolvedUsername;
            }

            if (
                contact &&
                nameContact &&
                contact.name !== nameContact
            ) {
                const newNameIsLid = /^\d{10,}$/.test(nameContact.trim());
                const currentNameLooksTemporary =
                    !contact.name ||
                    /^\d{10,}$/.test(String(contact.name).trim()) ||
                    contact.name === contact.number;

                if (!newNameIsLid && currentNameLooksTemporary) {
                    contactUpdates.name = nameContact;
                }
            }

            if (Object.keys(contactUpdates).length > 0) {
                await contact.update(contactUpdates);
                contact = await Contact.findByPk(contact.id) as Contact;

                if (contactUpdates.number) {
                    logger.info(
                        `[OFICIAL-ID] Número legado corrigido no contato ${contact.id}: ${contactUpdates.number}`
                    );
                }

                if (contactUpdates.whatsappUsername) {
                    logger.info(
                        `[OFICIAL-USERNAME] Username atualizado no contato ${contact.id}: @${contactUpdates.whatsappUsername}`
                    );
                }
            }

            let fileName = "";

            const { file, mimeType, idFile, type, quoteMessageId, fileUrl, fileSize } = message;

            // ✅ NOVO: Processar arquivo da URL da Meta (para vídeos e documentos grandes)
            if (!!fileUrl && !file) {
                logger.info(`[RECEIVED WHATSAPP] Arquivo recebido via URL da Meta - Tipo: ${type}, Tamanho: ${fileSize ? (fileSize / 1024 / 1024).toFixed(2) : '?'} MB`);

                try {
                    const downloadedBase64 = await downloadFileFromMetaUrl(fileUrl, conexao.send_token, fileSize);
                    const buffer = Buffer.from(downloadedBase64, "base64");

                    const extension = getExtensionFromMime(mimeType);
                    const generatedFileName = `${idFile}.${extension}`;

                    fileName = saveBufferToOfficialPublic(
                        buffer,
                        companyId,
                        whatsapp.id,
                        generatedFileName
                    );

                    logger.info(`[RECEIVED WHATSAPP] ✅ Arquivo salvo na mídia oficial: ${fileName}`);
                } catch (error: any) {
                    logger.error(`[RECEIVED WHATSAPP] ❌ Erro ao processar arquivo da URL: ${error.message}`);
                }
            }
            // ✅ ORIGINAL: Processar arquivo base64 (para imagens, áudios, stickers)
            else if (!!file) {
                logger.info(`[RECEIVED WHATSAPP] Arquivo recebido via Base64 - Tipo: ${type}`);

                const cleanBase64 = String(file).replace(/^data:.*;base64,/, "");
                const buffer = Buffer.from(cleanBase64, "base64");

                const extension = getExtensionFromMime(mimeType);
                const generatedFileName = `${idFile}.${extension}`;

                fileName = saveBufferToOfficialPublic(
                    buffer,
                    companyId,
                    whatsapp.id,
                    generatedFileName
                );

                logger.info(`[RECEIVED WHATSAPP] ✅ Arquivo salvo na mídia oficial: ${fileName}`);
            }

            // ✅ CRIAR VERSÃO PERSISTÍVEL DA MENSAGEM (após processamento de arquivo)
            const messageToPersist = normalizeOfficialMessageForPersistence({
                ...message,
                remoteIdentifierType: rawRemoteIdentifierType,
                remoteIdentifierValue: rawRemoteIdentifierValue,
                remoteUsername: resolvedUsername,
                remoteWaId: resolvedWaId,
                remotePhone: resolvedPhone,
                remoteUserId: resolvedBsuid,
                remoteBsuid: resolvedBsuid,
                rawMetaPayload: message.rawMetaPayload || null
            });

            // ============================================================
            // RETORNO DE PERMISSÃO PARA CHAMADAS DA API OFICIAL
            // Converte o JSON técnico em texto amigável para o atendente.
            // O JSON original permanece preservado em dataJson.
            // ============================================================
            const originalCallPermissionReplyText =
                typeof messageToPersist?.text === "string"
                    ? messageToPersist.text
                    : "";

            const callPermissionReplyText =
                buildCallPermissionReplyFriendlyText(
                    messageToPersist?.text || message?.text
                );

            if (callPermissionReplyText) {
                if (
                    !messageToPersist.dataJson &&
                    originalCallPermissionReplyText
                ) {
                    messageToPersist.dataJson =
                        originalCallPermissionReplyText;
                }

                messageToPersist.text = callPermissionReplyText;

                logger.info(
                    `[OFFICIAL CALL PERMISSION] Evento de permissão de chamada recebido. messageId=${messageToPersist.idMessage || "N/A"}`
                );
            }

            const dataToPersist = buildOfficialIncomingDataForPersistence(
                {
                    ...data,
                    fromWaId: resolvedWaId,
                    fromUserId: resolvedBsuid,
                    fromBsuid: resolvedBsuid,
                    fromUsername: resolvedUsername,
                    remoteIdentifierType: rawRemoteIdentifierType,
                    remoteIdentifierValue: rawRemoteIdentifierValue
                },
                messageToPersist
            );

            const settings = await CompaniesSettings.findOne({
                where: { companyId }
            });

            const ticket = await FindOrCreateTicketService(
                contact,
                whatsapp,
                0,
                companyId,
                null,
                null,
                null,
                'whatsapp_oficial',
                false,
                false,
                settings
            );

            const ticketTraking = await FindOrCreateATicketTrakingService({
                ticketId: ticket.id,
                companyId,
                userId: null,
                whatsappId: whatsapp.id
            });

            // ✅ Descrição amigável para mídias no card do atendimento
            const mediaDescriptions: Record<string, string> = {
                image: "📷 Imagem",
                video: "🎥 Vídeo",
                audio: "🎵 Áudio",
                document: "📄 Documento",
                sticker: "🏷️ Figurinha",
                location: "📍 Localização",
                contacts: "👤 Contato",
                order: "🛒 Pedido",
            };

            let lastMessageText =
                messageToPersist?.text ||
                message?.text ||
                '';
            if (!lastMessageText && message.type in mediaDescriptions) {
                lastMessageText = mediaDescriptions[message.type];
            }

            await ticket.update({
                lastMessage: lastMessageText,
                unreadMessages: isFromMe
                    ? ticket.unreadMessages
                    : ticket.unreadMessages + 1,
                fromMe: isFromMe
            });

            // Mensagens enviadas pelo celular em coexistência não representam
            // uma nova interação recebida do cliente.
            if (!isFromMe) {
                await contact.update({
                    lastInteractionClient: new Date()
                });
            }

            // Reload do ticket com associações necessárias
            await ticket.reload({
                include: [
                    { model: Contact, as: "contact" },
                    { model: Queue, as: "queue" }
                ]
            });

            /**
             * ✅ ECO DE MENSAGEM ENVIADA PELO WHATSAPP BUSINESS
             *
             * Persiste como mensagem enviada e encerra o processamento para
             * não acionar NPS, bots, filas, IA, campanhas ou FlowBuilder.
             */
            if (isFromMe) {
                await verifyMessageOficial(
                    messageToPersist,
                    ticket,
                    contact,
                    companyId,
                    fileName,
                    effectiveRemoteNumber,
                    dataToPersist,
                    quoteMessageId
                );

                logger.info(
                    `[COEXISTENCE ECHO] Mensagem salva como enviada e automações ignoradas. ticketId=${ticket.id} messageId=${messageToPersist.idMessage}`
                );

                return;
            }

            /**
             * ✅ EVENTO DE PERMISSÃO PARA CHAMADAS
             *
             * Esse retorno não é uma mensagem conversacional do cliente.
             * Salva a informação amigável no atendimento e encerra aqui,
             * impedindo que seja processada por NPS, bot, IA ou Flowbuilder.
             */
            if (callPermissionReplyText) {
                await verifyMessageOficial(
                    messageToPersist,
                    ticket,
                    contact,
                    companyId,
                    fileName,
                    effectiveRemoteNumber,
                    dataToPersist,
                    quoteMessageId
                );

                logger.info(
                    `[OFFICIAL CALL PERMISSION] Evento salvo e processamento conversacional ignorado. ticketId=${ticket.id}`
                );

                return;
            }

            /**
             * ✅ TRATAMENTO PARA AVALIAÇÃO DO ATENDENTE (NPS)
             * Deve vir ANTES de salvar a mensagem para evitar processar duas vezes
             */
            if (
                ticket.status === "nps" &&
                ticketTraking !== null &&
                verifyRating(ticketTraking)
            ) {
                // Salvar a mensagem do usuário (usando versão persistível)
                await verifyMessageOficial(messageToPersist, ticket, contact, companyId, fileName, effectiveRemoteNumber, dataToPersist, quoteMessageId);

                const bodyMessage = message.text || "";

                if (!isNaN(parseFloat(bodyMessage))) {
                    await handleRating(parseFloat(bodyMessage), ticket, ticketTraking);

                    await ticketTraking.update({
                        ratingAt: moment().toDate(),
                        finishedAt: moment().toDate(),
                        rated: true
                    });

                    return;
                } else {
                    if (ticket.amountUsedBotQueuesNPS < whatsapp.maxUseBotQueuesNPS) {
                        const bodyErrorRating = `\u200eOpção inválida, tente novamente.\n`;

                        await SendWhatsAppOficialMessage({
                            body: bodyErrorRating,
                            ticket: ticket,
                            quotedMsg: null,
                            type: 'text',
                            media: null,
                            vCard: null
                        });

                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const bodyRatingMessage = `\u200e${whatsapp.ratingMessage}\n`;

                        await SendWhatsAppOficialMessage({
                            body: bodyRatingMessage,
                            ticket: ticket,
                            quotedMsg: null,
                            type: 'text',
                            media: null,
                            vCard: null
                        });

                        await ticket.update({
                            amountUsedBotQueuesNPS: ticket.amountUsedBotQueuesNPS + 1
                        });
                    }

                    return;
                }
            }

            // ✅ SALVAR MENSAGEM NO FLUXO NORMAL (usando versão persistível)
            await verifyMessageOficial(messageToPersist, ticket, contact, companyId, fileName, effectiveRemoteNumber, dataToPersist, quoteMessageId);

            // ✅ VERIFICAÇÃO DE HORÁRIO DE ATENDIMENTO (mesma lógica do wbotMessageListener)
            let currentSchedule;

            if (settings.scheduleType === "company") {
                currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
            } else if (settings.scheduleType === "connection") {
                currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
            }

            try {
                if (
                    settings.scheduleType &&
                    (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
                    !["open", "group"].includes(ticket.status)
                ) {
                    /**
                     * Tratamento para envio de mensagem quando a empresa está fora do expediente
                     */
                    if (
                        (settings.scheduleType === "company" ||
                            settings.scheduleType === "connection") &&
                        !isNil(currentSchedule) &&
                        (!currentSchedule || currentSchedule.inActivity === false)
                    ) {
                        if (
                            whatsapp.maxUseBotQueues &&
                            whatsapp.maxUseBotQueues !== 0 &&
                            ticket.amountUsedBotQueues >= whatsapp.maxUseBotQueues
                        ) {
                            return;
                        }

                        if (whatsapp.timeUseBotQueues !== "0") {
                            if (
                                ticket.isOutOfHour === false &&
                                ticketTraking.chatbotAt !== null
                            ) {
                                await ticketTraking.update({
                                    chatbotAt: null
                                });
                                await ticket.update({
                                    amountUsedBotQueues: 0
                                });
                            }

                            //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
                            let dataLimite = new Date();
                            let Agora = new Date();

                            if (ticketTraking.chatbotAt !== null) {
                                dataLimite.setMinutes(
                                    ticketTraking.chatbotAt.getMinutes() +
                                    Number(whatsapp.timeUseBotQueues)
                                );
                                if (
                                    ticketTraking.chatbotAt !== null &&
                                    Agora < dataLimite &&
                                    whatsapp.timeUseBotQueues !== "0" &&
                                    ticket.amountUsedBotQueues !== 0
                                ) {
                                    return;
                                }
                            }

                            await ticketTraking.update({
                                chatbotAt: null
                            });
                        }

                        if (whatsapp.outOfHoursMessage !== "" && !ticket.imported) {
                            const body = whatsapp.outOfHoursMessage
                                .replace("{{nome}}", contact.name || "")
                                .replace("{{ticket}}", ticket.id.toString());

                            await SendWhatsAppOficialMessage({
                                body: body,
                                ticket: ticket,
                                quotedMsg: null,
                                type: 'text',
                                media: null,
                                vCard: null
                            });
                        }

                        //atualiza o contador de vezes que enviou o bot e que foi enviado fora de hora
                        await ticket.update({
                            isOutOfHour: true,
                            amountUsedBotQueues: ticket.amountUsedBotQueues + 1
                        });

                        return;
                    }
                }
            } catch (e) {
                logger.error(`[WHATSAPP OFICIAL] Erro ao verificar horário de atendimento: ${e}`);
                console.log(e);
            }

            // ✅ CONTINUAÇÃO DE FLUXO WEBHOOK EXISTENTE (precisa ter prioridade)
            const incomingMessageText = String(message.text || "").trim();
            const bypassFlowWebhookForIntegration = shouldBypassFlowWebhookForIntegration(
                ticket,
                message
            );

            if (bypassFlowWebhookForIntegration) {
                console.log(
                    `[FLOW WEBHOOK - OFICIAL] Bypass da continuação do flow para ticket ${ticket.id}. type=${message.type}. Mensagem seguirá para integração ${ticket.integrationId}.`
                );
            }

            if (
                !(ticket.status === "open" && !!ticket.userId) &&
                !bypassFlowWebhookForIntegration &&
                ticket.flowWebhook &&
                ticket.lastFlowId &&
                (ticket.hashFlowId || ticket.flowStopped)
            ) {
                console.log(`[FLOW WEBHOOK - OFICIAL] Processando fluxo webhook existente para ticket ${ticket.id}`);
                console.log(
                    `[FLOW WEBHOOK - OFICIAL] lastFlowId=${ticket.lastFlowId} | hashFlowId=${ticket.hashFlowId || "N/A"} | flowStopped=${ticket.flowStopped || "N/A"} | pressKey=${incomingMessageText || "N/A"} | type=${message.type}`
                );

                try {
                    let details: any = null;
                    let resolvedFlowId: number | null = null;
                    let resolvedHashFlowId = ticket.hashFlowId || `recovery-${ticket.id}`;

                    // 1) Tenta recuperar pelo hash salvo no ticket
                    if (ticket.hashFlowId) {
                        const webhook = await WebhookModel.findOne({
                            where: {
                                company_id: ticket.companyId,
                                hash_id: ticket.hashFlowId
                            }
                        });

                        if (webhook?.config?.["details"]?.idFlow) {
                            details = webhook.config["details"];
                            resolvedFlowId = Number(webhook.config["details"].idFlow);
                            console.log(`[FLOW WEBHOOK - OFICIAL] Fluxo recuperado via WebhookModel: ${resolvedFlowId}`);
                        } else {
                            console.warn(
                                `[FLOW WEBHOOK - OFICIAL] Webhook não encontrado para hash ${ticket.hashFlowId}. Usando flowStopped como fallback.`
                            );
                        }
                    }

                    // 2) Fallback real: usar flowStopped mesmo quando hashFlowId existir
                    if (!resolvedFlowId && ticket.flowStopped) {
                        const parsedFlowId = parseInt(String(ticket.flowStopped), 10);

                        if (!isNaN(parsedFlowId)) {
                            resolvedFlowId = parsedFlowId;
                            details = details || {
                                idFlow: parsedFlowId,
                                inputs: [],
                                keysFull: []
                            };
                            console.log(`[FLOW WEBHOOK - OFICIAL] Fluxo recuperado via flowStopped: ${resolvedFlowId}`);
                        }
                    }

                    if (!resolvedFlowId) {
                        console.error(
                            `[FLOW WEBHOOK - OFICIAL] ❌ Não foi possível resolver o flowId do ticket ${ticket.id}`
                        );
                        return;
                    }

                    const flow = await FlowBuilderModel.findOne({
                        where: {
                            id: resolvedFlowId,
                            company_id: companyId
                        }
                    });

                    if (!flow) {
                        console.error(
                            `[FLOW WEBHOOK - OFICIAL] ❌ Fluxo ${resolvedFlowId} não encontrado para ticket ${ticket.id}`
                        );
                        return;
                    }

                    const nodes: any[] = flow.flow["nodes"] || [];
                    const connections: any[] = flow.flow["connections"] || [];
                    const numberPhrase = {
                        number: contact.number,
                        name: contact.name,
                        email: contact.email || ""
                    };

                    await ActionsWebhookService(
                        whatsapp.id,
                        resolvedFlowId,
                        ticket.companyId,
                        nodes,
                        connections,
                        ticket.lastFlowId,
                        ticket.dataWebhook,
                        details,
                        resolvedHashFlowId,
                        incomingMessageText,
                        ticket.id,
                        numberPhrase
                    );

                    console.log(
                        `[FLOW WEBHOOK - OFICIAL] ✅ Fluxo ${resolvedFlowId} continuado com pressKey=${incomingMessageText}`
                    );
                    return;
                } catch (error) {
                    console.error("[FLOW WEBHOOK - OFICIAL] ❌ Erro ao continuar fluxo webhook:", error);
                    logger.error(`[FLOW WEBHOOK - OFICIAL] Erro ao continuar fluxo webhook: ${error}`);
                    return;
                }
            }

            if (
                !ticket.imported &&
                !ticket.queue &&
                (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
                !ticket.userId &&
                whatsapp?.queues?.length >= 1 &&
                !ticket.useIntegration
            ) {
                // console.log("antes do verifyqueue")
                await verifyQueueOficial(message, ticket, settings, ticketTraking);

                if (ticketTraking.chatbotAt === null) {
                    await ticketTraking.update({
                        chatbotAt: moment().toDate(),
                    })
                }
            }

            // ✅ IMPLEMENTAÇÃO DO SAYCHATBOT PARA API OFICIAL
            if (
                ticket.queue &&
                ticket.queueId &&
                !ticket.useIntegration &&
                !ticket.integrationId &&
                ticket.queue?.chatbots?.length > 0
            ) {
                // ✅ CORRIGIDO: Executar ChatBot apenas se ticket não estiver "open" (aceito por atendente)
                if (ticket.status !== "open") {
                    const simulatedMsg = buildSimulatedMsgOficial(messageToPersist, effectiveRemoteNumber, fileName);

                    try {
                        await sayChatbotOficial(
                            ticket.queueId,
                            ticket,
                            contact,
                            simulatedMsg,
                            ticketTraking
                        );
                    } catch (error) {
                        console.error("[WHATSAPP OFICIAL] Erro ao executar sayChatbotOficial:", error);
                        logger.error(`[WHATSAPP OFICIAL] Erro sayChatbotOficial: ${error}`);
                    }
                }

                // Atualiza mensagem para indicar que houve atividade e aí contar o tempo novamente para enviar mensagem de inatividade
                await ticket.update({
                    sendInactiveMessage: false
                });
            }

            // ✅ VERIFICAÇÃO DE PALAVRAS-CHAVE (CAMPANHAS DE FLUXO) - API Oficial
            // Verifica se a mensagem faz match com alguma campanha/palavra-chave configurada
            // Isso funciona independente do estado do ticket (sem integrationId)
            if (!ticket.imported && !ticket.isGroup && !ticket.userId && message.text) {
                try {
                    const activeCampaigns = await FlowCampaignModel.findAll({
                        where: {
                            companyId,
                            status: true
                        }
                    });

                    const campaignsForThisWhatsapp = activeCampaigns.filter(campaign => {
                        try {
                            const whatsappIds = campaign.whatsappIds || [];
                            return whatsappIds.includes(whatsapp.id);
                        } catch {
                            return false;
                        }
                    });

                    // Buscar tags do contato para filtragem
                    let contactTagIds: number[] = [];
                    try {
                        const contactTags = await ContactTag.findAll({
                            where: { contactId: contact.id }
                        });
                        contactTagIds = contactTags.map(ct => ct.tagId);
                    } catch (err) {
                        console.error("[PALAVRA-CHAVE OFICIAL] Erro ao buscar tags do contato:", err);
                    }

                    const matchingCampaign = campaignsForThisWhatsapp.find(campaign => {
                        try {
                            if (!campaign.status) return false;
                            // Verificar filtro de tags
                            if (!campaign.matchesContactTags(contactTagIds)) return false;
                            return campaign.matchesMessage(message.text, whatsapp.id);
                        } catch {
                            return false;
                        }
                    });

                    if (matchingCampaign) {
                        console.log(`[PALAVRA-CHAVE OFICIAL] 🚀 Match encontrado! Campanha: ${matchingCampaign.name} (ID: ${matchingCampaign.id}) | Fluxo: ${matchingCampaign.flowId} | Ticket: ${ticket.id}`);

                        const flow = await FlowBuilderModel.findOne({
                            where: {
                                id: matchingCampaign.flowId,
                                company_id: companyId
                            }
                        });

                        if (flow) {
                            const nodes: any[] = flow.flow["nodes"];
                            const connections: any[] = flow.flow["connections"];

                            // Resetar estado do fluxo anterior se existir
                            await ticket.update({
                                flowWebhook: true,
                                lastFlowId: null,
                                hashFlowId: `flow_campaign_${matchingCampaign.id}`,
                                flowStopped: matchingCampaign.flowId.toString(),
                                dataWebhook: null,
                                useIntegration: null,
                                integrationId: null,
                                amountUsedBotQueues: 0 // Reset para permitir execução
                            });

                            const numberPhrase = {
                                number: contact.number,
                                name: contact.name,
                                email: contact.email || ""
                            };

                            await ActionsWebhookService(
                                whatsapp.id,
                                matchingCampaign.flowId,
                                companyId,
                                nodes,
                                connections,
                                null,
                                `flow_campaign_${matchingCampaign.id}`,
                                undefined,
                                undefined,
                                undefined,
                                ticket.id,
                                numberPhrase
                            );

                            console.log(`[PALAVRA-CHAVE OFICIAL] ✅ Fluxo ${matchingCampaign.flowId} executado para ticket ${ticket.id}`);
                            return;
                        } else {
                            console.warn(`[PALAVRA-CHAVE OFICIAL] ⚠️ Fluxo ${matchingCampaign.flowId} não encontrado para campanha ${matchingCampaign.id}`);
                        }
                    }
                } catch (error) {
                    console.error("[PALAVRA-CHAVE OFICIAL] Erro ao verificar campanhas por palavra-chave:", error);
                }
            }

            // ✅ VERIFICAÇÃO DE CAMPANHAS E FLUXOS - executa se ticket tem integrationId ativa
            if (!ticket.imported && !ticket.isGroup && ticket.integrationId && ticket.useIntegration) {
                console.log("[WHATSAPP OFICIAL] Verificando campanhas de fluxo via integrationId do ticket...");

                let contactForCampaign = contact;

                if (
                    !contactForCampaign ||
                    contactForCampaign.id !== ticket.contactId ||
                    contactForCampaign.companyId !== ticket.companyId
                ) {
                    const safeContact = await Contact.findOne({
                        where: {
                            id: ticket.contactId,
                            companyId: ticket.companyId
                        }
                    });

                    if (safeContact) {
                        contactForCampaign = safeContact;
                    } else {
                        logger.warn(
                            `[WHATSAPP OFICIAL] Contato do ticket não encontrado com segurança. ` +
                            `ticketId=${ticket.id} ticketContactId=${ticket.contactId} ticketCompanyId=${ticket.companyId} ` +
                            `fallbackContactId=${contact?.id || "null"} fallbackCompanyId=${contact?.companyId || "null"}`
                        );

                        contactForCampaign = contact;
                    }
                }

                if (!contactForCampaign) {
                    logger.warn(
                        `[WHATSAPP OFICIAL] Nenhum contato válido para campanha/integration no ticket ${ticket.id}`
                    );
                    return;
                }

                try {
                    const queueIntegrations = await ShowQueueIntegrationService(
                        ticket.integrationId,
                        companyId
                    );

                    const simulatedMsgForFlow = {
                        key: {
                            fromMe: false,
                            remoteJid: `${effectiveRemoteNumber}@s.whatsapp.net`,
                            id: message.idMessage || `ofc-${Date.now()}`
                        },
                        message: {
                            conversation: message.text || ticket.lastMessage || "",
                            timestamp: message.timestamp || Math.floor(Date.now() / 1000)
                        }
                    } as any;

                    const campaignExecuted = await flowbuilderIntegration(
                        simulatedMsgForFlow,
                        null,
                        companyId,
                        queueIntegrations,
                        ticket,
                        contactForCampaign,
                        null,
                        null
                    );

                    if (campaignExecuted) {
                        console.log("[WHATSAPP OFICIAL] ✅ Campanha executada, parando outros fluxos");
                        return;
                    }
                } catch (error) {
                    console.error("[WHATSAPP OFICIAL] Erro ao verificar campanhas:", error);
                }
            }

            if (
                !ticket.imported &&
                !ticket.queue &&
                !ticket.isGroup &&
                !ticket.user &&
                !isNil(whatsapp.integrationId)
            ) {
                const integrations = await ShowQueueIntegrationService(
                    whatsapp.integrationId,
                    companyId
                );

                // Criar um objeto msg simulado para compatibilidade
                const simulatedMsg = buildSimulatedMsgOficial(messageToPersist, effectiveRemoteNumber, fileName);

                // ✅ VERIFICAR SE É TYPEBOT
                if (integrations.type === "typebot") {
                    console.log("[TYPEBOT OFICIAL] Enviando mensagem para Typebot");
                    await typebotListenerOficial({
                        ticket,
                        msg: simulatedMsg,
                        typebot: integrations
                    });

                    await ticket.update({
                        useIntegration: true,
                        integrationId: integrations.id,
                        typebotSessionTime: moment().toDate()
                    });
                } else {
                    // ✅ OUTRAS INTEGRAÇÕES (n8n, dialogflow, flowbuilder, webhook)
                    await handleMessageIntegration(
                        simulatedMsg as any,
                        null, // wbot é null
                        companyId,
                        integrations,
                        ticket
                    );

                    await ticket.update({
                        useIntegration: true,
                        integrationId: integrations.id
                    });
                }

                return;
            }

            // ✅ VERIFICAÇÃO DE INTEGRAÇÕES NO TICKET
            if (
                !ticket.imported &&
                !ticket.isGroup &&
                !ticket.userId &&
                ticket.integrationId &&
                ticket.useIntegration
            ) {
                const integrations = await ShowQueueIntegrationService(
                    ticket.integrationId,
                    companyId
                );

                // Criar um objeto msg simulado para compatibilidade
                const simulatedMsg = buildSimulatedMsgOficial(messageToPersist, effectiveRemoteNumber, fileName);

                // ✅ VERIFICAR SE É TYPEBOT
                if (integrations.type === "typebot") {
                    console.log("[TYPEBOT OFICIAL] Continuando conversa com Typebot");
                    await typebotListenerOficial({
                        ticket,
                        msg: simulatedMsg,
                        typebot: integrations
                    });
                } else {
                    // ✅ OUTRAS INTEGRAÇÕES (n8n, dialogflow, flowbuilder, webhook)
                    await handleMessageIntegration(
                        simulatedMsg as any,
                        null, // wbot é null
                        companyId,
                        integrations,
                        ticket
                    );
                }
            }

            // ✅ VERIFICAÇÃO: Iniciar FlowBuilder pela integração da conexão WhatsApp (sem fila)
            if (
                !ticket.imported &&
                !ticket.queue &&
                !ticket.isGroup &&
                !ticket.userId &&
                !ticket.useIntegration &&
                !ticket.integrationId &&
                !ticket.flowWebhook &&
                // ✅ CORREÇÃO ANTI-DUPLICAÇÃO: Só iniciar o fluxo se ainda não foi executado neste ticket
                // amountUsedBotQueues é incrementado ao finalizar o fluxo automaticamente
                (isNil(ticket.amountUsedBotQueues) || ticket.amountUsedBotQueues === 0) &&
                !isNil(whatsapp.integrationId)
            ) {
                try {
                    const queueIntegrations = await ShowQueueIntegrationService(
                        whatsapp.integrationId,
                        companyId
                    );

                    logger.info(`[WHATSAPP OFICIAL] Iniciando flowbuilder pela conexão para ticket ${ticket.id}, tipo: ${queueIntegrations?.type || 'indefinido'}`);

                    const simulatedMsgForFlow2 = {
                        key: {
                            fromMe: false,
                            remoteJid: `${effectiveRemoteNumber}@s.whatsapp.net`,
                            id: message.idMessage || `ofc-${Date.now()}`
                        },
                        message: {
                            conversation: message.text || ticket.lastMessage || "",
                            timestamp: message.timestamp || Math.floor(Date.now() / 1000)
                        }
                    } as any;

                    await flowbuilderIntegration(
                        simulatedMsgForFlow2,
                        null,
                        companyId,
                        queueIntegrations,
                        ticket,
                        contact,
                        null,
                        null
                    );

                    logger.info(`[WHATSAPP OFICIAL] flowbuilderIntegration executado para ticket ${ticket.id}`);
                } catch (error) {
                    console.error("[WHATSAPP OFICIAL] Erro ao iniciar flowbuilder pela conexão:", error);
                }
            }

        } catch (error) {
            console.error("[WHATSAPP OFICIAL] Erro em getMessage:", error);
            logger.error(`[WHATSAPP OFICIAL] Erro getMessage: ${error}`);
        }
    }

    async readMessage(data: IReceivedReadWhatsppOficialRead) {
        const { messageId, token, companyId } = data;

        try {
            console.log("data READ", data);

            const conexao = await Whatsapp.findOne({ where: { token, companyId } });

            if (!conexao) {
                logger.error("readMessage - Nenhum whatsApp encontrado");
                return;
            }

            const message = await Message.findOne({
                where: { wid: messageId, companyId }
            });

            if (!message) {
                logger.warn(
                    `readMessage - mensagem oficial não encontrada localmente, ignorando ack. messageId=${messageId}`
                );
                return;
            }

            await message.update({ read: true, ack: 2 });
        } catch (error) {
            logger.error(`Erro ao atualizar ack da mensagem ${messageId} - ${error}`);
        }
    }
}