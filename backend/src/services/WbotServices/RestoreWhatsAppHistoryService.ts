import { jidNormalizedUser, proto, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import * as fs from "fs/promises";
import * as path from "path";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { subDays } from "date-fns";

type RestorePayload = {
    chats?: any[];
    contacts?: any[];
    messages?: proto.IWebMessageInfo[];
    isLatest?: boolean;
    importDays?: number;
};

// ⚙️ CONFIGURAÇÕES
const DEFAULT_RESTORE_DAYS = 30;
const MAX_RESTORE_DAYS = 30;
const MAX_PHONE_LENGTH = 13;
const MIN_PHONE_LENGTH = 8;
const DOWNLOAD_MEDIA = true;
const DOWNLOAD_PROFILE_PICS = true;
const MEDIA_BASE_PATH = path.resolve(__dirname, "..", "..", "..", "public");

const normalizeJid = (jid: string): string => {
    if (!jid) return jid;
    try {
        return jidNormalizedUser(jid);
    } catch (error) {
        return jid;
    }
};

const getNumberFromJid = (jid: string): string => {
    const normalized = normalizeJid(jid);
    return String(normalized || "").split("@")[0].replace(/\D/g, "");
};

const isGroupJid = (jid: string): boolean => {
    return String(jid || "").endsWith("@g.us");
};

const isBroadcastJid = (jid: string): boolean => {
    return String(jid || "").endsWith("@broadcast");
};

const isLidJid = (jid: string): boolean => {
    if (!jid) return true;
    const jidStr = String(jid);
    if (jidStr.includes("lid:")) return true;
    if (jidStr.endsWith("@broadcast")) return true;
    if (jidStr.includes("status@")) return true;
    const number = getNumberFromJid(jidStr);
    if (!number) return true;
    if (number.length < MIN_PHONE_LENGTH || number.length > MAX_PHONE_LENGTH) return true;
    return false;
};

const getName = (data: any, jid?: string): string => {
    return (
        data?.name ||
        data?.notify ||
        data?.verifiedName ||
        data?.pushName ||
        data?.subject ||
        data?.shortName ||
        data?.title ||
        getNumberFromJid(data?.id || jid || "")
    );
};

const extractBody = (msg: proto.IWebMessageInfo): string => {
    const message: any = msg.message;
    if (!message) return "";
    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedDisplayText ||
        message.listResponseMessage?.title ||
        message.templateButtonReplyMessage?.selectedDisplayText ||
        message.reactionMessage?.text ||
        ""
    );
};

const getMediaType = (msg: proto.IWebMessageInfo): string => {
    const message: any = msg.message;
    if (!message) return "chat";
    if (message.imageMessage) return "image";
    if (message.videoMessage) return "video";
    if (message.audioMessage) return "audio";
    if (message.documentMessage) return "document";
    if (message.stickerMessage) return "sticker";
    if (message.contactMessage || message.contactsArrayMessage) return "contactMessage";
    if (message.locationMessage || message.liveLocationMessage) return "locationMessage";
    return "chat";
};

const normalizeImportDays = (days?: number): number => {
    const parsed = Number(days || DEFAULT_RESTORE_DAYS);

    if (!Number.isFinite(parsed)) return DEFAULT_RESTORE_DAYS;
    if (parsed <= 0) return 1;
    if (parsed > MAX_RESTORE_DAYS) return MAX_RESTORE_DAYS;

    return Math.floor(parsed);
};

const isWithinPeriod = (timestamp: number | undefined, maxDays?: number): boolean => {
    const restoreDays = normalizeImportDays(maxDays);

    if (!timestamp) return false;

    const messageDate = new Date(Number(timestamp) * 1000);
    const cutoffDate = subDays(new Date(), restoreDays);

    return messageDate >= cutoffDate;
};

const downloadMessageMedia = async (
    msg: proto.IWebMessageInfo,
    whatsapp: Whatsapp,
    companyId: number
): Promise<string | null> => {
    if (!DOWNLOAD_MEDIA) return null;
    const messageType = getMediaType(msg);
    if (messageType === "chat" || messageType === "contactMessage" || messageType === "locationMessage") {
        return null;
    }
    try {
        const { getWbot } = await import("../../libs/wbot");
        const wbot = getWbot(whatsapp.id);
        const buffer = await downloadMediaMessage(msg as any, "buffer", {}, {
            logger: undefined as any,
            reuploadRequest: wbot.requestPairingCode
        });
        if (!buffer) return null;
        const companyFolder = path.join(MEDIA_BASE_PATH, `company${companyId}`);
        await fs.mkdir(companyFolder, { recursive: true });
        const message: any = msg.message || {};
        const mimeType =
            message.imageMessage?.mimetype ||
            message.videoMessage?.mimetype ||
            message.audioMessage?.mimetype ||
            message.documentMessage?.mimetype ||
            message.stickerMessage?.mimetype ||
            "";

        let extension = "bin";

        if (message.videoMessage?.gifPlayback || mimeType === "image/gif") {
            extension = "gif";
        } else if (messageType === "image") {
            extension = mimeType.includes("png") ? "png" : "jpg";
        } else if (messageType === "video") {
            extension = "mp4";
        } else if (messageType === "audio") {
            extension = mimeType.includes("mpeg") ? "mp3" : "ogg";
        } else if (messageType === "document") {
            extension =
                message.documentMessage?.fileName?.split(".").pop()?.toLowerCase() ||
                mimeType.split("/").pop()?.toLowerCase() ||
                "pdf";
        } else if (messageType === "sticker") {
            extension = "webp";
        }
        const fileName = `${msg.key.id}.${extension}`;
        const filePath = path.join(companyFolder, fileName);
        await fs.writeFile(filePath, buffer);
        return `company${companyId}/${fileName}`;
    } catch (err: any) {
        logger.warn(`[RESTORE] ⚠️ Falha ao baixar mídia ${msg.key.id}: ${err?.message || err}`);
        return null;
    }
};

const downloadProfilePic = async (
    jid: string,
    whatsapp: Whatsapp,
    companyId: number
): Promise<string | null> => {
    if (!DOWNLOAD_PROFILE_PICS || isGroupJid(jid)) return null;
    try {
        const { getWbot } = await import("../../libs/wbot");
        const wbot = getWbot(whatsapp.id);
        let profilePicUrl: string | null = null;
        try {
            profilePicUrl = await wbot.profilePictureUrl(jid, "image") || null;
        } catch (err: any) {
            return null;
        }
        if (!profilePicUrl) return null;
        const response = await fetch(profilePicUrl);
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        const contactsFolder = path.join(MEDIA_BASE_PATH, `company${companyId}`, "contacts");
        await fs.mkdir(contactsFolder, { recursive: true });
        const number = getNumberFromJid(jid);
        const fileName = `${number}.jpg`;
        await fs.writeFile(path.join(contactsFolder, fileName), buffer);
        return fileName;
    } catch (err: any) {
        return null;
    }
};

const findOrCreateContact = async (
    jid: string,
    companyId: number,
    contactData?: any,
    whatsapp?: Whatsapp
): Promise<Contact | null> => {
    if (!jid) return null;
    if (isLidJid(jid) || isBroadcastJid(jid)) return null;
    const normalizedJid = normalizeJid(jid);
    const number = getNumberFromJid(normalizedJid);
    if (!number || number.length < MIN_PHONE_LENGTH || number.length > MAX_PHONE_LENGTH) return null;
    const name = getName(contactData || {}, normalizedJid);
    const isGroup = isGroupJid(normalizedJid);
    let contact = await Contact.findOne({ where: { number, companyId } as any });
    let profilePicFileName: string | null = null;
    if (whatsapp && !isGroup && DOWNLOAD_PROFILE_PICS) {
        profilePicFileName = await downloadProfilePic(jid, whatsapp, companyId);
    }
    if (!contact) {
        try {
            const createData: any = { name: name || number, number, companyId, isGroup };
            if (profilePicFileName) createData.urlPicture = profilePicFileName;
            contact = await Contact.create(createData);
        } catch (createError: any) {
            logger.error(`[RESTORE] ❌ Erro ao criar contato ${number}: ${createError?.message || createError}`);
            return null;
        }
        return contact;
    }
    const currentName = String((contact as any).name || "");
    const shouldUpdateName = name && name !== number && name !== currentName && (!currentName || currentName === number || /^\d+$/.test(currentName));
    const currentPicture = (contact as any).urlPicture;
    const shouldUpdatePicture = profilePicFileName && (!currentPicture || currentPicture === "nopicture.png");
    if (shouldUpdatePicture || shouldUpdateName) {
        try {
            const updateData: any = { isGroup };
            if (shouldUpdateName) updateData.name = name;
            if (shouldUpdatePicture) updateData.urlPicture = profilePicFileName;
            await contact.update(updateData);
        } catch (updateError: any) {
            logger.error(`[RESTORE] ❌ Erro ao atualizar contato ${number}: ${updateError?.message || updateError}`);
        }
    }
    return contact;
};

const findOrCreateTicket = async (contact: Contact, whatsapp: Whatsapp): Promise<Ticket | null> => {
    if (!contact?.id) return null;
    let ticket = await Ticket.findOne({
        where: { contactId: contact.id, whatsappId: whatsapp.id, companyId: whatsapp.companyId, status: { [Op.in]: ["open", "pending", "closed"] } } as any,
        order: [["updatedAt", "DESC"]]
    });
    if (ticket) return ticket;
    try {
        ticket = await Ticket.create({
            contactId: contact.id, whatsappId: whatsapp.id, companyId: whatsapp.companyId,
            status: "closed", unreadMessages: 0, isGroup: (contact as any).isGroup || false
        } as any);
    } catch (createError: any) {
        logger.error(`[RESTORE] ❌ Erro ao criar ticket: ${createError?.message || createError}`);
        return null;
    }
    return ticket;
};

const saveRestoredMessage = async (
    msg: proto.IWebMessageInfo, whatsapp: Whatsapp, contact: Contact, ticket: Ticket
): Promise<boolean> => {
    const wid = msg?.key?.id;
    if (!wid || !ticket?.id) return false;
    if (!isWithinPeriod(msg.messageTimestamp as any, (whatsapp as any).importDays)) return false;
    const exists = await Message.findOne({ where: { wid, companyId: whatsapp.companyId } as any });
    if (exists) return false;
    try {
        const mediaUrl = await downloadMessageMedia(msg, whatsapp, whatsapp.companyId);
        await Message.create({
            wid, body: extractBody(msg), dataJson: JSON.stringify(msg),
            fromMe: !!msg.key.fromMe, read: !!msg.key.fromMe,
            mediaType: getMediaType(msg), mediaUrl: mediaUrl || null, ack: 2,
            ticketId: ticket.id, contactId: contact.id, companyId: whatsapp.companyId,
            createdAt: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date(),
            updatedAt: new Date()
        } as any);
        return true;
    } catch (createError: any) {
        logger.error(`[RESTORE] ❌ Erro ao salvar mensagem ${wid}: ${createError?.message || createError}`);
        return false;
    }
};

export const RestoreWhatsAppHistoryService = async (
    whatsapp: Whatsapp,
    payload: RestorePayload
): Promise<void> => {
    if (!(whatsapp as any).importHistory) {
        return;
    }

    const { chats = [], contacts = [], messages = [], isLatest } = payload;
    const importDays = normalizeImportDays((payload as any).importDays || (whatsapp as any).importDays);

    // ⚠️ Se não tem nada relevante, sai silenciosamente
    if (messages.length === 0 && contacts.length === 0 && chats.length === 0) {
        return;
    }

    // Log apenas se tiver mensagens (evento importante)
    if (messages.length > 0) {
        logger.info(
            `[RESTORE] 📥 whatsappId=${whatsapp.id} messages=${messages.length} `
            + `contatos=${contacts.length} chats=${chats.length} `
            + `período=${importDays} dias`
        );
    }

    const activeJids = new Set<string>();
    let saved = 0, ignored = 0, outOfPeriod = 0, lidIgnored = 0, ticketsCreated = 0, mediaDownloaded = 0;

    // PASSO 1: Mensagens (filtradas por período)
    for (const msg of messages) {
        try {
            if (!msg?.key?.id) { ignored++; continue; }
            const rawJid = msg.key.remoteJid;
            if (!rawJid) { ignored++; continue; }
            const jid = normalizeJid(rawJid);
            if (isLidJid(jid) || isBroadcastJid(jid)) { lidIgnored++; continue; }
            if (!isWithinPeriod(msg.messageTimestamp as any, importDays)) {
                outOfPeriod++;
                continue;
            }
            activeJids.add(jid);
            const contact = await findOrCreateContact(jid, whatsapp.companyId, { id: jid, pushName: (msg as any).pushName }, whatsapp);
            if (!contact) { ignored++; continue; }
            const ticket = await findOrCreateTicket(contact, whatsapp);
            if (!ticket?.id) { ignored++; continue; }
            const success = await saveRestoredMessage(msg, whatsapp, contact, ticket);
            if (success) { saved++; if (getMediaType(msg) !== "chat") mediaDownloaded++; }
            else { ignored++; }
        } catch (err: any) {
            logger.error(`[RESTORE] ❌ Erro msg ${msg?.key?.id}: ${err?.message || err}`);
        }
    }

    if (messages.length > 0) {
        logger.info(`[RESTORE] 📨 salvas=${saved} mídias=${mediaDownloaded} ignoradas=${ignored} foraPeríodo=${outOfPeriod} LIDs=${lidIgnored} JIDs=${activeJids.size}`);
    }

    // PASSO 2: Contatos (só se JID ativo)
    for (const contactData of contacts) {
        try {
            if (!contactData?.id) continue;
            const normalizedId = normalizeJid(contactData.id);
            if (isLidJid(normalizedId) || isBroadcastJid(normalizedId)) continue;
            if (activeJids.size > 0 && !activeJids.has(normalizedId)) continue;
            await findOrCreateContact(normalizedId, whatsapp.companyId, contactData, whatsapp);
        } catch (err: any) { }
    }

    // PASSO 3: Chats (só se JID ativo)
    for (const chat of chats) {
        try {
            if (!chat?.id) continue;
            const normalizedId = normalizeJid(chat.id);
            if (isLidJid(normalizedId) || isBroadcastJid(normalizedId)) continue;
            if (activeJids.size > 0 && !activeJids.has(normalizedId)) continue;
            await findOrCreateContact(normalizedId, whatsapp.companyId, chat, whatsapp);
        } catch (err: any) { }
    }
};

export default RestoreWhatsAppHistoryService;