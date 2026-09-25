import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot, getInMemoryStore } from "../../libs/wbot";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import { isString, isArray } from "lodash";
import { getIO } from "../../libs/socket";

const BATCH_SIZE = 500;
const MIN_SYNC_CONTACTS = 2;

const pickBestImportedContactName = (contact: any, rawId: string, number: string): string => {
  const candidates = [
    contact?.name,
    contact?.notify,
    contact?.pushName,
    contact?.verifiedName,
    contact?.displayName,
    contact?.shortName,
    contact?.vname,
    contact?.username
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const digits = candidate.replace(/\D/g, "");

    if (
      lower.includes("@s.whatsapp.net") ||
      lower.includes("@lid") ||
      lower.includes("@c.us") ||
      lower === rawId.toLowerCase() ||
      digits === number
    ) {
      continue;
    }

    return candidate;
  }

  return number;
};


const isIgnorableContactId = (rawId: string): boolean => {
  return (
    !rawId ||
    rawId === "status@broadcast" ||
    rawId.includes("g.us") ||
    rawId.includes("broadcast")
  );
};

const isRealPhoneContactId = (rawId: string): boolean => {
  if (isIgnorableContactId(rawId)) return false;

  // Nunca importar LID como telefone.
  // LID é identificador interno do WhatsApp, não é número real.
  if (rawId.includes("@lid")) return false;

  // Se vier com domínio, aceitar somente JID de telefone real.
  if (
    rawId.includes("@") &&
    !rawId.includes("@s.whatsapp.net") &&
    !rawId.includes("@c.us")
  ) {
    return false;
  }

  const number = rawId.includes("@")
    ? rawId.split("@")[0].replace(/\D/g, "")
    : rawId.replace(/\D/g, "");

  return /^\d{8,15}$/.test(number);
};


const sanitizeImportedContactName = (name: any, notify: any, rawId: string, number: string): string => {
  const candidates = [name, notify]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();

    if (
      lower.includes("@s.whatsapp.net") ||
      lower.includes("@lid") ||
      lower.includes("@c.us") ||
      lower === rawId.toLowerCase() ||
      candidate.replace(/\D/g, "") === number
    ) {
      continue;
    }

    return candidate;
  }

  return number;
};

const extractValidPhoneContacts = (contacts: any[]): any[] => {
  return (contacts || []).filter((contact: any) => {
    const rawId = String(contact?.id || "");
    return isRealPhoneContactId(rawId);
  });
};


const ImportContactsService = async (companyId: number, whatsappId?: number): Promise<void> => {
  const io = getIO();

  const emitProgress = (status: string, message: string, progress?: number) => {
    io.of(String(companyId)).emit(`company-${companyId}-importContacts`, {
      status,
      message,
      progress: progress || 0
    });
  };

  let defaultWhatsapp;
  
  try {
    if (whatsappId) {
      // Buscar a conexão específica selecionada pelo usuário
      const Whatsapp = (await import("../../models/Whatsapp")).default;
      defaultWhatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
      if (!defaultWhatsapp) {
        throw new Error(`Conexão WhatsApp ${whatsappId} não encontrada para esta empresa.`);
      }
    } else {
      defaultWhatsapp = await GetDefaultWhatsApp(companyId);
    }
  } catch (err) {
    logger.error(`ImportContacts: Erro ao obter WhatsApp padrão para company ${companyId}: ${err.message}`);
    emitProgress("error", "Nenhuma conexão WhatsApp padrão encontrada.");
    throw new Error("Não foi possível encontrar uma conexão WhatsApp padrão. Verifique suas conexões.");
  }

  let wbot;
  try {
    wbot = getWbot(defaultWhatsapp.id);
  } catch (err) {
    logger.error(`ImportContacts: Erro ao obter instância do bot para WhatsApp ${defaultWhatsapp.id}: ${err.message}`);
    emitProgress("error", "WhatsApp não está conectado. Reconecte e tente novamente.");
    throw new Error("A conexão WhatsApp não está ativa. Reconecte e tente novamente.");
  }

  emitProgress("started", "Buscando contatos...", 5);

  let phoneContacts;

  try {
    // ===== PRIORIDADE 1: inMemoryStore (contatos frescos da sessão ativa) =====
    logger.info(`ImportContacts: Tentando inMemoryStore para wpp ${defaultWhatsapp.id}`);
    const memStore = getInMemoryStore(defaultWhatsapp.id);
    if (memStore?.contacts) {
      const storeContacts = Object.values(memStore.contacts);
      if (storeContacts.length > 0) {
        const normalized = storeContacts.map((c: any) => ({
          id: c.id,
          name: c.name || "",
          notify: c.notify || "",
          pushName: c.pushName || "",
          verifiedName: c.verifiedName || "",
          displayName: c.displayName || "",
          shortName: c.shortName || "",
          vname: c.vname || "",
          username: c.username || ""
        }));
        const validCount = extractValidPhoneContacts(normalized).length;

        if (validCount >= MIN_SYNC_CONTACTS) {
          phoneContacts = normalized;
          logger.info(`ImportContacts: ${validCount} contatos válidos obtidos do inMemoryStore`);
        } else {
          logger.warn(`ImportContacts: inMemoryStore retornou apenas ${validCount} contato(s) válido(s), aguardando sync completo...`);
        }
      }
    }

    // ===== PRIORIDADE 2: Baileys DB (contacts salvos no banco) =====
    if (!phoneContacts || !isArray(phoneContacts) || phoneContacts.length === 0) {
      logger.info(`ImportContacts: inMemoryStore vazio/parcial, tentando Baileys DB para wpp ${defaultWhatsapp.id}`);

      const MAX_RETRIES = 5;
      const RETRY_DELAY_MS = 5_000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let contactsData = null;
        try {
          contactsData = await ShowBaileysService(defaultWhatsapp.id);
        } catch {
          contactsData = null;
        }

        if (contactsData && (contactsData.contacts || contactsData.chats)) {
          const parsedContacts = contactsData.contacts
            ? (typeof contactsData.contacts === 'string'
                ? JSON.parse(contactsData.contacts)
                : contactsData.contacts)
            : [];

          const parsedChats = contactsData.chats
            ? (typeof contactsData.chats === 'string'
                ? JSON.parse(contactsData.chats)
                : contactsData.chats)
            : [];

          const contactsCount = isArray(parsedContacts) ? extractValidPhoneContacts(parsedContacts).length : 0;
          const chatsCount = isArray(parsedChats) ? extractValidPhoneContacts(parsedChats).length : 0;

          const parsed = contactsCount >= MIN_SYNC_CONTACTS ? parsedContacts : parsedChats;
          const validCount = Math.max(contactsCount, chatsCount);
          const sourceName = contactsCount >= MIN_SYNC_CONTACTS ? "contacts" : "chats";

          if (isArray(parsed) && validCount >= MIN_SYNC_CONTACTS) {
            phoneContacts = parsed;
            logger.info(`ImportContacts: ${validCount} contato(s) importáveis obtidos do Baileys DB/${sourceName} na tentativa ${attempt}`);
            break;
          }

          logger.warn(`ImportContacts: Baileys DB retornou ${validCount} contato(s) importáveis na tentativa ${attempt}, aguardando sync completo...`);
        }

        if (attempt < MAX_RETRIES) {
          logger.warn(`ImportContacts: Tentativa ${attempt}/${MAX_RETRIES} — Baileys DB sem contatos suficientes. Aguardando ${RETRY_DELAY_MS / 1000}s...`);
          emitProgress("syncing", `Aguardando sincronização... tentativa ${attempt}/${MAX_RETRIES}`, 10);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    // ===== PRIORIDADE 3: Arquivo JSON local (último recurso) =====
    if (!phoneContacts || !isArray(phoneContacts) || phoneContacts.length === 0) {
      const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
      const companyFolder = path.join(publicFolder, `company${companyId}`);
      const scopedContactJsonPath = path.join(
        companyFolder,
        `contactJson-wpp${defaultWhatsapp.id}.txt`
      );

      if (fs.existsSync(scopedContactJsonPath)) {
        try {
          const fileContent = fs.readFileSync(scopedContactJsonPath, "utf-8").trim();
          let parsedContacts: any[] = null;
          try {
            parsedContacts = JSON.parse(fileContent);
          } catch {
            logger.warn(`ImportContacts: Arquivo ${path.basename(scopedContactJsonPath)} corrompido, removendo`);
            try { fs.unlinkSync(scopedContactJsonPath); } catch (_) {}
            parsedContacts = null;
          }

          const validCount = isArray(parsedContacts) ? extractValidPhoneContacts(parsedContacts).length : 0;
          if (isArray(parsedContacts) && validCount >= MIN_SYNC_CONTACTS) {
            phoneContacts = parsedContacts;
            logger.info(`ImportContacts: ${validCount} contatos válidos lidos do arquivo ${path.basename(scopedContactJsonPath)} (fallback)`);
          } else {
            logger.warn(`ImportContacts: Arquivo tem apenas ${validCount} contato(s) válido(s), ignorando como fonte obsoleta`);
          }
        } catch (fileErr) {
          logger.warn(`ImportContacts: Erro ao ler arquivo: ${fileErr.message}`);
        }
      }
    }

    // ===== PRIORIDADE 4: Forçar sync via wbot =====
    if (!phoneContacts || !isArray(phoneContacts) || phoneContacts.length === 0) {
      logger.info(`ImportContacts: Nenhuma fonte encontrou contatos suficientes. Tentando forçar sync...`);
      emitProgress("syncing", "Forçando sincronização de contatos...", 15);

      try {
        if (typeof (wbot as any).requestSync === 'function') {
          await (wbot as any).requestSync();
          logger.info(`ImportContacts: requestSync chamado, aguardando 10s para sync completar...`);
          await new Promise(resolve => setTimeout(resolve, 10_000));

          const memStore2 = getInMemoryStore(defaultWhatsapp.id);
          if (memStore2?.contacts) {
            const storeContacts2 = Object.values(memStore2.contacts).map((c: any) => ({
              id: c.id,
              name: c.name || "",
              notify: c.notify || "",
              pushName: c.pushName || "",
              verifiedName: c.verifiedName || "",
              displayName: c.displayName || "",
              shortName: c.shortName || "",
              vname: c.vname || "",
              username: c.username || ""
            }));
            const validCount = extractValidPhoneContacts(storeContacts2).length;
            if (validCount >= MIN_SYNC_CONTACTS) {
              phoneContacts = storeContacts2;
              logger.info(`ImportContacts: ${validCount} contatos válidos obtidos após requestSync`);
            }
          }
        }
      } catch (syncErr) {
        logger.warn(`ImportContacts: requestSync falhou: ${syncErr.message}`);
      }
    }

    if (!phoneContacts || !isArray(phoneContacts) || extractValidPhoneContacts(phoneContacts).length < MIN_SYNC_CONTACTS) {
      emitProgress("warning", "Contatos ainda não sincronizados. Reconecte o WhatsApp e aguarde alguns minutos antes de importar novamente.");
      logger.warn(`ImportContacts: Contatos ainda não sincronizados para company ${companyId}, wpp ${defaultWhatsapp.id}. Nenhuma fonte disponível.`);
      return;
    }
  } catch (err) {
    if (err.message && err.message.includes("sincroniz")) {
      throw err;
    }
    Sentry.captureException(err);
    logger.error(`ImportContacts: Erro ao obter contatos. Err: ${err.message}`);
    emitProgress("error", "Erro ao obter contatos.");
    throw err;
  }

  const phoneContactsList = isString(phoneContacts)
    ? JSON.parse(phoneContacts)
    : phoneContacts;

  if (!isArray(phoneContactsList)) {
    logger.warn(`ImportContacts: Lista de contatos não é um array para company ${companyId}`);
    emitProgress("error", "Formato de contatos inválido.");
    throw new Error("Formato de contatos inválido. Tente reconectar o WhatsApp.");
  }

  emitProgress("processing", `Processando ${phoneContactsList.length} contatos...`, 20);
  logger.info(`ImportContacts: Iniciando importação de ${phoneContactsList.length} contatos para company ${companyId}`);

  // ========== OTIMIZAÇÃO: buscar todos os contatos existentes de uma vez ==========
  const existingContacts = await Contact.findAll({
    where: { companyId },
    attributes: ["id", "number", "name"],
    raw: true
  });

  const existingMap = new Map<string, { id: number; name: string }>();
  for (const c of existingContacts) {
    existingMap.set(c.number, { id: c.id, name: c.name });
  }


  const profilePicCache = new Map<string, string>();

  const fetchImportedProfilePicUrl = async (rawId: string, number: string): Promise<string> => {
    const jid = rawId.includes("@") ? rawId : `${number}@s.whatsapp.net`;

    if (!jid || jid.includes("@lid") || jid.includes("g.us") || jid.includes("broadcast")) {
      return "";
    }

    if (profilePicCache.has(jid)) {
      return profilePicCache.get(jid) || "";
    }

    try {
      if (typeof (wbot as any).profilePictureUrl !== "function") {
        profilePicCache.set(jid, "");
        return "";
      }

      const url = await (wbot as any).profilePictureUrl(jid, "image");
      profilePicCache.set(jid, url || "");
      return url || "";
    } catch {
      profilePicCache.set(jid, "");
      return "";
    }
  };

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  // ========== Preparar contatos para bulk operations ==========
  const toCreate: any[] = [];
  const toUpdate: { id: number; name: string }[] = [];

  for (const contact of phoneContactsList) {
    const { id, name, notify, lid } = contact;
    const rawId = String(id || "");

    if (!isRealPhoneContactId(rawId)) {
      skipped++;
      continue;
    }

    const number = rawId.includes("@")
      ? rawId.split("@")[0].replace(/\D/g, "")
      : rawId.replace(/\D/g, "");

    const remoteJid = rawId.includes("@") ? rawId : `${number}@s.whatsapp.net`;
    const lidValue = lid || null;

    const contactName = pickBestImportedContactName(contact, rawId, number);
    const existing = existingMap.get(number);

    if (existing) {
      if (contactName && contactName !== number && contactName !== existing.name) {
        toUpdate.push({ id: existing.id, name: contactName });
        updated++;
        logger.info(`ImportContacts: [UPDATE] ${number} nome "${existing.name}" → "${contactName}"`);
      } else {
        skipped++;
        logger.info(`ImportContacts: [SKIP] ${number} já existe como "${existing.name}"`);
      }
    } else {
      const profilePicUrl = await fetchImportedProfilePicUrl(rawId, number);

      toCreate.push({
        name: contactName,
        number,
        companyId,
        remoteJid: rawId.includes("@") ? rawId : `${number}@s.whatsapp.net`,
        whatsappId: defaultWhatsapp.id,
        channel: "whatsapp",
        profilePicUrl: profilePicUrl || undefined,
        urlPicture: profilePicUrl || undefined,
        pictureUpdated: !!profilePicUrl
      });
      existingMap.set(number, { id: 0, name: contactName });
    }
  }

  emitProgress("importing", `Importando ${toCreate.length} novos contatos...`, 50);

  // ========== Bulk Create em lotes ==========
  const totalBatches = Math.ceil(toCreate.length / BATCH_SIZE) + Math.ceil(toUpdate.length / BATCH_SIZE);
  let completedBatches = 0;

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    try {
      await Contact.bulkCreate(batch, {
        ignoreDuplicates: true
      });
      imported += batch.length;
    } catch (err) {
      logger.error(`ImportContacts: Erro no bulkCreate lote ${i}-${i + batch.length}: ${err.message}`);
      Sentry.captureException(err);
    }
    completedBatches++;
    const progress = 50 + Math.round((completedBatches / Math.max(totalBatches, 1)) * 45);
    emitProgress("importing", `Importando... ${imported} criados, ${updated} atualizados`, progress);
  }

  // ========== Bulk Update em lotes (nome) ==========
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const updatePromises = batch.map(c =>
      Contact.update({ name: c.name }, { where: { id: c.id } })
    );
    try {
      await Promise.all(updatePromises);
    } catch (err) {
      logger.error(`ImportContacts: Erro no batch update lote ${i}: ${err.message}`);
      Sentry.captureException(err);
    }
    completedBatches++;
    const progress = 50 + Math.round((completedBatches / Math.max(totalBatches, 1)) * 45);
    emitProgress("importing", `Importando... ${imported} criados, ${updated} atualizados`, progress);
  }

  emitProgress("done", `Concluído! ${imported} importados, ${updated} atualizados, ${skipped} ignorados.`, 100);
  logger.info(`ImportContacts: Concluído para company ${companyId} - Importados: ${imported}, Atualizados: ${updated}, Ignorados: ${skipped}`);
};

export default ImportContactsService;
