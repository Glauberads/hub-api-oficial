import {
  WASocket,
  BinaryNode,
  Contact as BContact,
  isJidBroadcast,
  isJidStatusBroadcast,
  proto,
  extractMessageContent,
  getContentType,
} from "@whiskeysockets/baileys";
import { handleLabelsEdit, handleLabelsAssociation } from "../TagServices/WhatsAppLabelSyncService";
import * as Sentry from "@sentry/node";
import fs from "fs";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import logger from "../../utils/logger";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import CompaniesSettings from "../../models/CompaniesSettings";
import path from "path";
import { verifyMessage, getBodyMessage, getTypeMessage } from "./wbotMessageListener";

// Rate limiter para callbacks de chamada
let callCounter = 0;
let callCounterResetTimer: ReturnType<typeof setInterval> | null = null;

const ensureCallCounterTimer = () => {
  if (!callCounterResetTimer) {
    callCounterResetTimer = setInterval(() => {
      callCounter = 0;
    }, 5000);
  }
};

// Limpar timer ao descarregar módulo
const cleanupCallTimer = () => {
  if (callCounterResetTimer) {
    clearInterval(callCounterResetTimer);
    callCounterResetTimer = null;
  }
};
process.once('SIGTERM', cleanupCallTimer);
process.once('SIGINT', cleanupCallTimer);

ensureCallCounterTimer();

type Session = WASocket & {
  id?: number;
};

interface IContact {
  contacts: BContact[];
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    wbot.ws.on("CB:call", async (node: BinaryNode) => {
      const content = node.content[0] as any;

      await new Promise(r => setTimeout(r, callCounter * 650));
      callCounter++;

      if (content.tag === "terminate" && !node.attrs.from.includes('@call')) {
        const settings = await CompaniesSettings.findOne({
          where: { companyId },
        });

        if (!settings) return;

        if (settings.acceptCallWhatsapp === "enabled") {
          const sentMessage = await wbot.sendMessage(node.attrs.from, {
            text:
              `\u200e ${settings.AcceptCallWhatsappMessage}`,
            // text:
            // "\u200e *Mensagem Automática:*\n\nAs chamadas de voz e vídeo estão desabilitadas para esse WhatsApp, favor enviar uma mensagem de texto. Obrigado",              
          });
          const number = node.attrs.from.split(":")[0].replace(/\D/g, "");

          const contact = await Contact.findOne({
            where: { companyId, number },
          });

          if (!contact)
            return

          const [ticket] = await Ticket.findOrCreate({
            where: {
              contactId: contact.id,
              whatsappId: wbot.id,
              status: ["open", "pending", "nps", "lgpd"],
              companyId
            },
            defaults: {
              companyId,
              contactId: contact.id,
              whatsappId: wbot.id,
              isGroup: contact.isGroup,
              status: "pending"
            }
          });

          //se não existir o ticket não faz nada.
          if (!ticket) return;

          await verifyMessage(sentMessage, ticket, contact);

          const date = new Date();
          const hours = date.getHours();
          const minutes = date.getMinutes();

          const body = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
          const messageData = {
            wid: content.attrs["call-id"],
            ticketId: ticket.id,
            contactId: contact.id,
            body,
            fromMe: false,
            mediaType: "call_log",
            read: true,
            quotedMsgId: null,
            ack: 1,
          };

          await ticket.update({
            lastMessage: body,
          });


          if (ticket.status === "closed") {
            await ticket.update({
              status: "pending",
            });
          }

          return CreateMessageService({ messageData, companyId: companyId });
        }
      }
    });

    // Flag para evitar escritas concorrentes no arquivo
    let isWritingContactFile = false;

    function cleanStringForJSON(str: string) {
      // Remove apenas caracteres de controle (preserva aspas pois JSON.stringify cuida do escape)
      return str.replace(/[\x00-\x1F\x7F]/g, "");
    }

    // Função auxiliar para salvar contatos no arquivo e Baileys DB
    const saveContactsToFileAndDB = async (filteredContacts: any[], source: string) => {
      if (filteredContacts.length === 0) return;

      // Salvar no arquivo
      const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
      const companyFolder = path.join(publicFolder, `company${companyId}`);
      if (!fs.existsSync(companyFolder)) {
        fs.mkdirSync(companyFolder, { recursive: true });
        fs.chmodSync(companyFolder, 0o777);
      }
      const contatcJson = path.join(companyFolder, `contactJson-wpp${whatsapp.id}.txt`);

      // Merge com existentes
      let existingContacts: any[] = [];
      if (fs.existsSync(contatcJson)) {
        try {
          const content = await fs.promises.readFile(contatcJson, 'utf-8');
          existingContacts = JSON.parse(content);
          if (!Array.isArray(existingContacts)) existingContacts = [];
        } catch { existingContacts = []; }
      }

      for (const newContact of filteredContacts) {
        const idx = existingContacts.findIndex(c => c.id === newContact.id);
        if (idx >= 0) existingContacts[idx] = newContact;
        else existingContacts.push(newContact);
      }

      const tempFile = `${contatcJson}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(existingContacts), 'utf-8');
      await fs.promises.rename(tempFile, contatcJson);
      logger.info(`[${source}] ✅ Arquivo salvo: ${existingContacts.length} contatos totais (${filteredContacts.length} novos/atualizados) para wpp ${whatsapp.id}`);

      // Salvar no Baileys DB
      try {
        await createOrUpdateBaileysService({
          whatsappId: whatsapp.id,
          contacts: filteredContacts,
        });
        logger.info(`[${source}] ✅ Baileys DB atualizado com ${filteredContacts.length} contatos`);
      } catch (err) {
        logger.error(`[${source}] Erro ao salvar no Baileys DB: ${err.message}`);
      }
    };

    // Função auxiliar para filtrar contatos válidos
    const filterValidContacts = (contacts: any[]): any[] => {
      const filtered: any[] = [];
      for (const contact of contacts) {
        const id = contact.id || "";
        if (!id || isJidBroadcast(id) || isJidStatusBroadcast(id) || id.includes("@g.us") || id.includes("@newsletter")) continue;
        filtered.push({
          id,
          name: contact.name ? cleanStringForJSON(contact.name) : id.split('@')[0].split(':')[0]
        });
      }
      return filtered;
    };

    const shouldImportAllWhatsappContacts =
      process.env.IMPORT_ALL_WHATSAPP_CONTACTS === "true";

    const shouldSaveSyncedContacts = (source: string, total = 0): boolean => {
      if (shouldImportAllWhatsappContacts) return true;

      logger.info(
        `[${source}] Ignorado sync automático de ${total} contatos para wpp ${whatsapp.id}. ` +
        `IMPORT_ALL_WHATSAPP_CONTACTS=false`
      );

      return false;
    };

    // ✅ Baileys v7: messaging-history.set é o evento PRINCIPAL para sync inicial
    // ✅ messaging-history.set: APENAS salvar contatos e chats (sem processar mensagens históricas)
    // O processamento de mensagens históricas foi REMOVIDO pois causava picos de CPU
    // com N+1 queries ao banco (Message.findOne + Contact.findOne + Ticket.findOne por msg)
    wbot.ev.on("messaging-history.set" as any, async (data: any) => {
      try {
        const contacts = data?.contacts || [];
        const chats = data?.chats || [];

        logger.info(
          `[HISTORY SET] Evento recebido para wpp ${whatsapp.id} — ` +
          `contatos: ${contacts.length}, chats: ${chats.length} (mensagens ignoradas para performance)`
        );

        // Salvar contatos somente se a importação completa da agenda estiver habilitada
        if (contacts.length > 0 && shouldSaveSyncedContacts("HISTORY SET", contacts.length)) {
          const filtered = filterValidContacts(contacts);
          if (filtered.length > 0) {
            await saveContactsToFileAndDB(filtered, "HISTORY SET");
          }
        }

        // Salvar chats no Baileys DB
        if (chats.length > 0) {
          try {
            await createOrUpdateBaileysService({
              whatsappId: whatsapp.id,
              chats: chats.map((c: any) => ({ id: c.id, name: c.name || c.id })),
            });
            logger.info(`[HISTORY SET] ✅ ${chats.length} chats salvos no Baileys DB`);
          } catch (chatErr) {
            logger.error(`[HISTORY SET] Erro ao salvar chats: ${chatErr.message}`);
          }
        }
      } catch (err) {
        logger.error(`[HISTORY SET] Erro: ${err.message}`);
        Sentry.captureException(err);
      }
    });

    // ✅ Baileys v7: contacts.set pode trazer snapshot inicial em alguns dispositivos
    wbot.ev.on("contacts.set" as any, async (payload: any) => {
      try {
        const contacts = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.contacts)
            ? payload.contacts
            : [];

        if (contacts.length === 0) {
          logger.info(`[CONTACTS SET] Evento recebido sem contatos para wpp ${whatsapp.id}`);
          return;
        }

        logger.info(`[CONTACTS SET] Recebidos ${contacts.length} contatos para wpp ${whatsapp.id}`);

        if (!shouldSaveSyncedContacts("CONTACTS SET", contacts.length)) {
          return;
        }

        const filtered = filterValidContacts(contacts);
        if (filtered.length > 0) {
          await saveContactsToFileAndDB(filtered, "CONTACTS SET");
        }
      } catch (err) {
        logger.error(`[CONTACTS SET] Erro: ${err.message}`);
        Sentry.captureException(err);
      }
    });

    // ✅ Baileys v7: contacts.upsert para contatos adicionados depois do sync inicial
    wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
      try {
        if (!shouldSaveSyncedContacts("CONTACTS UPSERT", contacts?.length || 0)) {
          return;
        }

        const filtered = filterValidContacts(contacts);
        if (filtered.length === 0) {
          logger.info(`[CONTACTS UPSERT] Nenhum contato válido para salvar`);
          return;
        }
        await saveContactsToFileAndDB(filtered, "CONTACTS UPSERT");
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`Erro contacts.upsert: ${err.message}`);
      }
    });

    // ✅ Baileys v7: contacts.update para alterações de contatos existentes
    wbot.ev.on("contacts.update" as any, async (updates: any[]) => {
      try {
        if (!updates || updates.length === 0) return;

        if (!shouldSaveSyncedContacts("CONTACTS UPDATE", updates.length)) {
          return;
        }

        const filtered = filterValidContacts(updates);
        if (filtered.length > 0) {
          await saveContactsToFileAndDB(filtered, "CONTACTS UPDATE");
        }
      } catch (err) {
        logger.error(`Erro contacts.update: ${err.message}`);
      }
    });

    // ========== LISTENERS DE LABELS DO WHATSAPP ==========

    // Evento: labels editadas (criadas, renomeadas, deletadas)
    wbot.ev.on("labels.edit" as any, async (labels: any) => {
      try {
        logger.info(`[LABEL SYNC] Evento labels.edit recebido (conexão ${whatsapp.id}): ${JSON.stringify(labels)}`);
        const labelsArray = Array.isArray(labels) ? labels : [labels];
        await handleLabelsEdit(companyId, labelsArray);
      } catch (err) {
        logger.error(`[LABEL SYNC] Erro no listener labels.edit: ${err.message}`);
      }
    });

    // Evento: labels associadas/desassociadas a chats
    wbot.ev.on("labels.association" as any, async (data: any) => {
      try {
        logger.info(`[LABEL SYNC] Evento labels.association recebido (conexão ${whatsapp.id}): ${JSON.stringify(data)}`);
        await handleLabelsAssociation(companyId, whatsapp.id, data);
      } catch (err) {
        logger.error(`[LABEL SYNC] Erro no listener labels.association: ${err.message}`);
      }
    });

    logger.info(`[LABEL SYNC] Listeners de labels registrados para conexão ${whatsapp.id}`);

  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};

export default wbotMonitor;