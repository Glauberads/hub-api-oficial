import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import ImportContactsService from "../services/WbotServices/ImportContactsService";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import { getWbot } from "../libs/wbot";
import Baileys from "../models/Baileys";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";

const countRealPhoneContacts = (contacts: any[]): number => {
  if (!Array.isArray(contacts)) return 0;

  return contacts.filter((contact: any) => {
    const rawId = String(contact?.id || "");

    if (
      !rawId ||
      rawId === "status@broadcast" ||
      rawId.includes("@lid") ||
      rawId.includes("g.us") ||
      rawId.includes("broadcast")
    ) {
      return false;
    }

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
  }).length;
};


export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.body;

  res.status(200).json({ message: "Importação iniciada", status: "started" });

  ImportContactsService(companyId, whatsappId ? Number(whatsappId) : undefined).catch(err => {
    if (err.message && err.message.includes("sincroniz")) {
      logger.warn(`ImportContacts background: Contatos não sincronizados para company ${companyId}`);
    } else {
      logger.error(`ImportContacts background: Erro para company ${companyId}: ${err.message}`);
    }
  });

  return res;
};

export const syncStatus = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  try {
    const contactsInDb = await Contact.count({ where: { companyId } });

    const companyWhatsapps = await Whatsapp.findAll({
      where: { companyId },
      order: [["id", "ASC"]]
    });

    const connectedBaileys = companyWhatsapps.find(
      (w: any) =>
        w.status === "CONNECTED" &&
        (!w.channel || w.channel === "whatsapp")
    );

    let selectedWhatsapp: any = null;

    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

      if (
        defaultWhatsapp &&
        defaultWhatsapp.status === "CONNECTED" &&
        (!defaultWhatsapp.channel || defaultWhatsapp.channel === "whatsapp")
      ) {
        selectedWhatsapp = defaultWhatsapp;
      } else if (connectedBaileys) {
        selectedWhatsapp = connectedBaileys;
      } else if (
        defaultWhatsapp &&
        defaultWhatsapp.channel &&
        defaultWhatsapp.channel !== "whatsapp"
      ) {
        return res.status(200).json({
          synced: false,
          status: "not_connected",
          message:
            "A conexão padrão está na API Oficial. Para importar contatos do telefone, conecte uma sessão WhatsApp Web/Baileys.",
          contactsInDb,
          contactsInSync: 0,
          source: "none"
        });
      }
    } catch {
      if (connectedBaileys) {
        selectedWhatsapp = connectedBaileys;
      }
    }

    if (!selectedWhatsapp) {
      return res.status(200).json({
        synced: false,
        status: "not_connected",
        message: "Nenhuma conexão WhatsApp Web/Baileys conectada encontrada.",
        contactsInDb,
        contactsInSync: 0,
        source: "none"
      });
    }

    let wbotConnected = false;
    try {
      getWbot(selectedWhatsapp.id);
      wbotConnected = true;
    } catch {
      wbotConnected = false;
    }

    const publicFolder = path.resolve(__dirname, "..", "..", "public");
    const companyFolder = path.join(publicFolder, `company${companyId}`);
    const scopedContactJsonPath = path.join(
      companyFolder,
      `contactJson-wpp${selectedWhatsapp.id}.txt`
    );

    let contactsInFile = 0;

    if (fs.existsSync(scopedContactJsonPath)) {
      try {
        const content = fs.readFileSync(scopedContactJsonPath, "utf-8").trim();
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) contactsInFile = countRealPhoneContacts(parsed);
      } catch {}
    }

    let contactsInBaileys = 0;
    let baileysSource = "none";

    try {
      const baileysData = await Baileys.findOne({
        where: { whatsappId: selectedWhatsapp.id }
      });

      if (baileysData) {
        const contacts = baileysData.contacts
          ? (typeof baileysData.contacts === "string"
              ? JSON.parse(baileysData.contacts)
              : baileysData.contacts)
          : [];

        const chats = baileysData.chats
          ? (typeof baileysData.chats === "string"
              ? JSON.parse(baileysData.chats)
              : baileysData.chats)
          : [];

        const contactsCount = countRealPhoneContacts(contacts);
        const chatsCount = countRealPhoneContacts(chats);

        contactsInBaileys = Math.max(
          contactsCount,
          chatsCount,
          Array.isArray(contacts) ? contacts.length : 0,
          Array.isArray(chats) ? chats.length : 0
        );
        baileysSource =
          contactsCount >= chatsCount && contactsCount > 0
            ? "baileys_contacts"
            : chatsCount > 0
              ? "baileys_chats"
              : "none";
      }
    } catch {}

    const contactsInSync = Math.max(contactsInFile, contactsInBaileys);
    const MIN_SYNC_CONTACTS = 2;
    const synced = contactsInSync >= MIN_SYNC_CONTACTS;

    if (!wbotConnected && selectedWhatsapp.status !== "CONNECTED" && contactsInSync === 0) {
      return res.status(200).json({
        synced: false,
        status: "not_connected",
        message: "A conexão WhatsApp Web/Baileys não está ativa no momento.",
        contactsInDb,
        contactsInSync: 0,
        source: "none"
      });
    }

    return res.status(200).json({
      synced,
      status: synced ? "ready" : "syncing",
      message: synced
        ? `Sincronização concluída. ${contactsInSync} contatos disponíveis para importação.`
        : `Aguardando sincronização dos contatos. Contatos sincronizados até agora: ${contactsInSync}.`,
      contactsInDb,
      contactsInSync,
      source: contactsInFile > 0 ? "file" : contactsInBaileys > 0 ? baileysSource : "none",
      whatsappId: selectedWhatsapp.id,
      whatsappName: selectedWhatsapp.name || null
    });
  } catch (err) {
    logger.error(`SyncStatus: Erro ao verificar status para company ${companyId}: ${err.message}`);
    return res.status(500).json({
      error: true,
      status: "not_connected",
      message: "Erro ao verificar status da sincronização."
    });
  }
};