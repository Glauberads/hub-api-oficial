// src/services/ContactServices/CreateOrUpdateContactService.ts - CORRIGIDO
import { getIO } from "../../libs/socket";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import fs from "fs";
import path, { join } from "path";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import WhatsappLidMap from "../../models/WhatsapplidMap";
const axios = require("axios");

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name?: string;
  number: string;
  isGroup: boolean;
  email?: string;
  birthDate?: Date | string;
  profilePicUrl?: string;
  companyId: number;
  channel?: string;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  lid?: string;
  whatsappId?: number;
  wbot?: any;
  fromMe?: boolean;
}

interface ContactData {
  name?: string;
  number?: string;
  isGroup?: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId?: number;
  extraInfo?: ExtraInfo[];
  channel?: string;
  disableBot?: boolean;
  language?: string;
  lid?: string;
}

const normalizeNameValue = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
};

const isNumericLikeName = (value?: string | null): boolean => {
  const normalized = normalizeNameValue(value);
  return !!normalized && /^\d{10,}$/.test(normalized);
};

const buildFallbackContactName = (
  cleanNumber: string,
  channel: string,
  isGroup: boolean
): string => {
  if (isGroup) {
    return "Grupo sem nome";
  }

  // ALTERAÇÃO: Retornar o número do WhatsApp em vez de "Sem nome"
  return cleanNumber || "Sem nome";
};

const getStoredWhatsappContactName = (
  wbot?: any,
  remoteJid?: string,
  lid?: string
): string => {
  try {
    const byRemoteJid = remoteJid ? wbot?.store?.contacts?.[remoteJid] : null;
    const byLid = lid ? wbot?.store?.contacts?.[lid] : null;

    const candidate = normalizeNameValue(
      byRemoteJid?.notify ||
      byRemoteJid?.verifiedName ||
      byRemoteJid?.name ||
      byLid?.notify ||
      byLid?.verifiedName ||
      byLid?.name
    );

    if (!candidate) {
      return "";
    }

    if (isNumericLikeName(candidate)) {
      return "";
    }

    return candidate;
  } catch (error) {
    return "";
  }
};

export const updateContact = async (
  contact: Contact,
  contactData: ContactData
) => {
  await contact.update(contactData);

  const io = getIO();
  io.to(`company-${contact.companyId}-mainchannel`).emit(
    `company-${contact.companyId}-contact`,
    {
      action: "update",
      contact
    }
  );
  return contact;
};

const CreateOrUpdateContactService = async ({
  name,
  number,
  profilePicUrl,
  isGroup,
  email = "",
  birthDate = null,
  channel = "whatsapp",
  companyId,
  extraInfo = [],
  remoteJid = "",
  lid = "",
  whatsappId,
  wbot,
  fromMe = false
}: Request): Promise<Contact> => {

  try {
    let cleanNumber = number || "";
    if (!isGroup && cleanNumber.includes("@")) {
      cleanNumber = cleanNumber.substring(0, cleanNumber.indexOf("@"));
      logger.info(`[RDS-LID] Número com formato incorreto corrigido: ${number} -> ${cleanNumber}`);
    }

    const comparableNumber = (cleanNumber || "").replace(/\D/g, "");
    const normalizedIncomingName = normalizeNameValue(name);

    const fallbackRemoteJid = normalizeJid(
      remoteJid || (isGroup ? `${cleanNumber}@g.us` : `${cleanNumber}@s.whatsapp.net`)
    );

    const nameIsNumericOrLid =
      !normalizedIncomingName || isNumericLikeName(normalizedIncomingName);

    const nameEqualsNumber =
      normalizedIncomingName === cleanNumber ||
      normalizedIncomingName === comparableNumber ||
      normalizedIncomingName === (number || "") ||
      normalizedIncomingName === (number || "").replace(/\D/g, "");

    const sanitizedIncomingName =
      nameIsNumericOrLid || nameEqualsNumber ? "" : normalizedIncomingName;

    const storedWhatsappName =
      channel === "whatsapp"
        ? getStoredWhatsappContactName(wbot, fallbackRemoteJid, lid)
        : "";

    const sanitizedName = normalizeNameValue(
      sanitizedIncomingName || storedWhatsappName
    );

    const fallbackContactName = buildFallbackContactName(
      cleanNumber,
      channel,
      isGroup
    );

    const safeNameForCreate = sanitizedName || fallbackContactName;

    let createContact = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

    const io = getIO();
    let contact: Contact | null = null;

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] Buscando contato: number=${cleanNumber}, companyId=${companyId}, lid=${lid}`
      );
    }
    if (lid) {
      contact = await Contact.findOne({ where: { lid, companyId } });
    }
    if (!contact) {
      contact = await Contact.findOne({ where: { number: cleanNumber, companyId } });
    }

    let updateImage =
      ((!contact ||
        (contact?.profilePicUrl !== profilePicUrl && profilePicUrl !== "")) &&
        (wbot || ["instagram", "facebook"].includes(channel))) ||
      false;

    if (contact) {
      contact.remoteJid = fallbackRemoteJid;

      // Quando o contato foi criado inicialmente apenas com um LID e o
      // Baileys posteriormente resolveu o telefone real, promover o PN
      // para o campo number sem perder o vínculo com o LID.
      const lidNumber = String(lid || "").split("@")[0];
      const contactHasTemporaryLidNumber =
        !!lidNumber && String(contact.number || "") === lidNumber;

      if (
        contactHasTemporaryLidNumber &&
        cleanNumber &&
        cleanNumber !== lidNumber
      ) {
        const duplicatePhoneContact = await Contact.findOne({
          where: {
            companyId,
            number: cleanNumber,
            id: { [Op.ne]: contact.id }
          }
        });

        if (!duplicatePhoneContact) {
          logger.info(
            `[RDS-LID] Promovendo LID provisório ${contact.number} para telefone ${cleanNumber} no contato ${contact.id}`
          );

          contact.number = cleanNumber;
        } else {
          logger.warn(
            `[RDS-LID] Telefone ${cleanNumber} já pertence ao contato ${duplicatePhoneContact.id}; promoção do contato ${contact.id} ignorada para evitar duplicidade`
          );
        }
      }

      if (!contact.lid) {
        contact.lid = lid;
      }
      if (ENABLE_LID_DEBUG) {
        logger.info(`[RDS-LID] fromMe recebido: ${fromMe}`);
      }

      if (lid && lid !== "") {
        if (contact.lid !== lid) {
          if (ENABLE_LID_DEBUG) {
            logger.info(
              `[RDS-LID] Atualizando lid do contato: de='${contact.lid}' para='${lid}'`
            );
          }
          contact.lid = lid;
        }
      } else if (fromMe === false && contact.lid && fallbackRemoteJid) {
        const localMap = await WhatsappLidMap.findOne({
          where: { companyId, contactId: contact.id }
        });

        if (localMap) {
          if (localMap.lid !== contact.lid) {
            if (ENABLE_LID_DEBUG) {
              logger.info(
                `[RDS-LID] LID resolvido localmente: de='${contact.lid}' para='${localMap.lid}'`
              );
            }
            contact.lid = localMap.lid;
          }
        } else if (wbot) {
          try {
            const ow = await wbot.onWhatsApp(fallbackRemoteJid);
            if (ow?.[0]?.exists && ow?.[0]?.lid) {
              const lidFromLookup = ow[0].lid as string;
              if (lidFromLookup && lidFromLookup !== contact.lid) {
                if (ENABLE_LID_DEBUG) {
                  logger.info(
                    `[RDS-LID] Atualizando lid obtido via onWhatsApp fallback: de='${contact.lid}' para='${lidFromLookup}'`
                  );
                }
                contact.lid = lidFromLookup;

                await WhatsappLidMap.findOrCreate({
                  where: { companyId, lid: lidFromLookup, contactId: contact.id },
                  defaults: { companyId, lid: lidFromLookup, contactId: contact.id }
                });
              }
            }
          } catch (error) {
            if (ENABLE_LID_DEBUG) {
              logger.error(`[RDS-LID] Erro ao consultar LID via onWhatsApp fallback: ${error.message}`);
            }
          }
        }
      }
      // Nunca apagar uma foto válida quando o webhook social não
      // disponibilizar avatar ou enviar a imagem padrão.
      const hasUsableIncomingProfilePic =
        typeof profilePicUrl === "string" &&
        profilePicUrl.trim() !== "" &&
        !profilePicUrl.includes("nopicture");

      if (hasUsableIncomingProfilePic) {
        contact.profilePicUrl = profilePicUrl;
      } else if (!contact.profilePicUrl) {
        contact.profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      contact.isGroup = isGroup;

      if (birthDate !== null && birthDate !== undefined) {
        let processedBirthDate: Date | null = null;
        if (typeof birthDate === "string") {
          processedBirthDate = new Date(birthDate);
          if (!isNaN(processedBirthDate.getTime())) {
            contact.birthDate = processedBirthDate;
          }
        } else {
          contact.birthDate = birthDate;
        }
      }

      if (isNil(contact.whatsappId) && !isNil(whatsappId)) {
        const whatsapp = await Whatsapp.findOne({
          where: { id: whatsappId, companyId }
        });

        if (whatsapp) {
          contact.whatsappId = whatsappId;
        }
      }

      const folder = path.resolve(
        publicFolder,
        `company${companyId}`,
        "contacts"
      );

      let fileName,
        oldPath = "";
      if (contact.urlPicture) {
        oldPath = path.resolve(contact.urlPicture.replace(/\\/g, "/"));
        fileName = path.join(folder, oldPath.split("\\").pop());
      }

      const currentPicIsEmpty = !contact.profilePicUrl || contact.profilePicUrl === "" || contact.profilePicUrl.includes("nopicture");
      const needsImageUpdate =
        currentPicIsEmpty ||
        !fileName ||
        !fs.existsSync(fileName) ||
        (profilePicUrl && profilePicUrl !== "" && contact.profilePicUrl !== profilePicUrl && !profilePicUrl.includes("nopicture"));

      if (needsImageUpdate && wbot) {
        try {
          const targetJid = contact.remoteJid || fallbackRemoteJid;
          const fetchedPic = await wbot.profilePictureUrl(targetJid, "image");
          if (fetchedPic) {
            profilePicUrl = fetchedPic;
          }
        } catch (e) {
          if (!currentPicIsEmpty) {
            profilePicUrl = contact.profilePicUrl;
          } else {
            profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
          }
        }
        contact.profilePicUrl = profilePicUrl;
        updateImage = true;
      } else if (needsImageUpdate && profilePicUrl && profilePicUrl !== "" && !profilePicUrl.includes("nopicture")) {
        contact.profilePicUrl = profilePicUrl;
        updateImage = true;
      }

      const currentContactName = normalizeNameValue(contact.name);
      const currentNameIsNumericLid = isNumericLikeName(currentContactName);
      const currentNameIsNumber =
        currentContactName === number ||
        currentContactName === cleanNumber ||
        currentContactName === comparableNumber;
      const currentNameIsPlaceholder =
        !currentContactName ||
        currentContactName === "Sem nome" ||
        currentContactName === "Contato compartilhado" ||
        currentContactName.startsWith("Contato ") ||
        currentContactName.startsWith("Grupo ");

      const newNameIsReal = !!sanitizedName;

      if ((currentNameIsNumber || currentNameIsNumericLid || currentNameIsPlaceholder) && newNameIsReal) {
        contact.name = sanitizedName;
      } else if (!currentContactName) {
        contact.name = safeNameForCreate;
      }

      await contact.save();
      await contact.reload();
    } else if (["whatsapp"].includes(channel)) {
      const settings = await CompaniesSettings.findOne({
        where: { companyId }
      });
      const acceptAudioMessageContact = settings?.acceptAudioMessageContact;
      const newRemoteJid = fallbackRemoteJid;

      if (ENABLE_LID_DEBUG) {
        logger.info(
          `[RDS-LID] Criando novo contato: number=${number}, jid=${newRemoteJid}, lid=${lid}`
        );
      }
      if (wbot) {
        try {
          profilePicUrl = await wbot.profilePictureUrl(newRemoteJid, "image");
        } catch (e) {
          profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
        }
      } else {
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      let processedBirthDate: Date | null = null;
      if (birthDate) {
        if (typeof birthDate === "string") {
          processedBirthDate = new Date(birthDate);
          if (isNaN(processedBirthDate.getTime())) {
            processedBirthDate = null;
          }
        } else {
          processedBirthDate = birthDate;
        }
      }

      try {
        let lidToUse = lid || null;

        if (!lidToUse) {
          const localMap = await WhatsappLidMap.findOne({
            where: { companyId },
            include: [{
              model: Contact,
              as: "contact",
              where: { number: cleanNumber }
            }]
          });

          if (localMap) {
            lidToUse = localMap.lid;
            if (ENABLE_LID_DEBUG) {
              logger.info(
                `[RDS-LID] LID resolvido localmente para novo contato: ${lidToUse}`
              );
            }
          }
        }

        if (!lidToUse && wbot && newRemoteJid) {
          try {
            const ow = await wbot.onWhatsApp(newRemoteJid);
            if (ow?.[0]?.exists && ow?.[0]?.lid) {
              lidToUse = ow[0].lid as string;
              if (ENABLE_LID_DEBUG) {
                logger.info(
                  `[RDS-LID] LID obtido via onWhatsApp fallback para novo contato: ${lidToUse}`
                );
              }
            }
          } catch (error) {
            if (ENABLE_LID_DEBUG) {
              logger.error(`[RDS-LID] Erro ao consultar LID via onWhatsApp para novo contato: ${error.message}`);
            }
          }
        }

        contact = await Contact.create({
          name: safeNameForCreate,
          number: cleanNumber,
          email,
          birthDate: processedBirthDate,
          isGroup,
          companyId,
          channel,
          acceptAudioMessage:
            acceptAudioMessageContact === "enabled" ? true : false,
          remoteJid: normalizeJid(newRemoteJid),
          lid: lidToUse,
          profilePicUrl,
          urlPicture: "",
          whatsappId
        });
        if (ENABLE_LID_DEBUG) {
          logger.info(
            `[RDS-LID] Novo contato criado: id=${contact.id}, number=${contact.number}, jid=${contact.remoteJid}, lid=${contact.lid}`
          );
        }
        createContact = true;
      } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
          logger.info(`[RDS-CONTACT] Contato já existe, buscando e reativando: number=${number}, companyId=${companyId}`);

          contact = await Contact.findOne({
            where: {
              number: cleanNumber,
              companyId
            }
          });

          if (contact) {
            const currentContactName = normalizeNameValue(contact.name);
            const currentNameIsPlaceholder =
              !currentContactName ||
              currentContactName === "Sem nome" ||
              currentContactName === "Contato compartilhado" ||
              currentContactName.startsWith("Contato ") ||
              currentContactName.startsWith("Grupo ");
            const currentNameIsNumericLid = isNumericLikeName(currentContactName);
            const currentNameIsNumber =
              currentContactName === number ||
              currentContactName === cleanNumber ||
              currentContactName === comparableNumber;

            const updateData: any = {
              active: true,
              profilePicUrl,
              remoteJid: normalizeJid(newRemoteJid),
              lid: lid || null
            };

            if ((currentNameIsPlaceholder || currentNameIsNumericLid || currentNameIsNumber) && sanitizedName) {
              updateData.name = sanitizedName;
            } else if (!currentContactName) {
              updateData.name = safeNameForCreate;
            }

            await contact.update(updateData);

            logger.info(`[RDS-CONTACT] Contato reativado: id=${contact.id}, number=${contact.number}`);
          } else {
            logger.error(`[RDS-CONTACT] Erro de unicidade, mas contato não encontrado: ${err.message}`);
            throw err;
          }
        } else {
          logger.error(`[RDS-CONTACT] Erro ao criar contato: ${err.message}`);
          throw err;
        }
      }
    } else if (["facebook", "instagram"].includes(channel)) {
      let processedBirthDate: Date | null = null;
      if (birthDate) {
        if (typeof birthDate === "string") {
          const dateOnly = birthDate.split("T")[0];
          const [year, month, day] = dateOnly.split("-").map(Number);
          processedBirthDate = new Date(year, month - 1, day, 12, 0, 0);
        } else if (birthDate instanceof Date) {
          const year = birthDate.getFullYear();
          const month = birthDate.getMonth();
          const day = birthDate.getDate();
          processedBirthDate = new Date(year, month, day, 12, 0, 0);
        }
      }

      try {
        contact = await Contact.create({
          name: safeNameForCreate,
          number: cleanNumber,
          email,
          birthDate: processedBirthDate,
          isGroup,
          companyId,
          channel,
          profilePicUrl,
          urlPicture: "",
          whatsappId
        });
        createContact = true;
      } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
          logger.info(`[RDS-CONTACT] Contato social já existe, buscando e reativando: number=${number}, companyId=${companyId}, canal=${channel}`);

          contact = await Contact.findOne({
            where: {
              number: cleanNumber,
              companyId,
              channel
            }
          });

          if (contact) {
            const currentContactName = normalizeNameValue(contact.name);
            const currentNameIsPlaceholder =
              !currentContactName ||
              currentContactName === "Sem nome" ||
              currentContactName === "Contato compartilhado" ||
              currentContactName.startsWith("Contato ") ||
              currentContactName.startsWith("Grupo ");
            const currentNameIsNumericLid = isNumericLikeName(currentContactName);
            const currentNameIsNumber =
              currentContactName === number ||
              currentContactName === cleanNumber ||
              currentContactName === comparableNumber;

            const updateData: any = {
              active: true,
              profilePicUrl
            };

            if ((currentNameIsPlaceholder || currentNameIsNumericLid || currentNameIsNumber) && sanitizedName) {
              updateData.name = sanitizedName;
            } else if (!currentContactName) {
              updateData.name = safeNameForCreate;
            }

            await contact.update(updateData);

            logger.info(`[RDS-CONTACT] Contato social reativado: id=${contact.id}, number=${contact.number}, canal=${channel}`);
          } else {
            logger.error(`[RDS-CONTACT] Erro de unicidade no contato social, mas contato não encontrado: ${err.message}`);
            throw err;
          }
        } else {
          logger.error(`[RDS-CONTACT] Erro ao criar contato social: ${err.message}`);
          throw err;
        }
      }
    }

    if (!contact) {
      throw new Error(
        "Não foi possível criar ou localizar o contato. Informe o número/canal corretamente."
      );
    }

    if (updateImage) {
      const folder = path.resolve(
        publicFolder,
        `company${companyId}`,
        "contacts"
      );

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }

      let filename;
      if (isNil(profilePicUrl) || profilePicUrl.includes("nopicture")) {
        filename = "nopicture.png";
      } else {
        filename = `${contact.id}.jpeg`;
        const filePath = join(folder, filename);

        if (fs.existsSync(filePath) && contact.urlPicture === filename) {
          updateImage = false;
        } else {
          if (!isNil(contact.urlPicture) && contact.urlPicture !== filename) {
            const oldPath = path.resolve(
              contact.urlPicture.replace(/\\/g, "/")
            );
            const oldFileName = path.join(folder, oldPath.split("\\").pop());

            if (fs.existsSync(oldFileName)) {
              fs.unlinkSync(oldFileName);
            }
          }

          const response = await axios.get(profilePicUrl, {
            responseType: "arraybuffer"
          });

          fs.writeFileSync(filePath, response.data);
        }
      }

      if (updateImage || isNil(contact.urlPicture)) {
        await contact.update({
          urlPicture: filename,
          pictureUpdated: true
        });

        await contact.reload();
      }
    }

    if (createContact) {
      io.of(String(companyId)).emit(`company-${companyId}-contact`, {
        action: "create",
        contact
      });
    } else {
      io.of(String(companyId)).emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });
    }

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] Retornando contato: { jid: '${contact.remoteJid}', exists: true, lid: '${contact.lid}' }`
      );
    }
    return contact;
  } catch (err) {
    logger.error("Error to find or create a contact:", err);
    throw err;
  }
};

export default CreateOrUpdateContactService;