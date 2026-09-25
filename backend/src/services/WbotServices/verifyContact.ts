import fs from "fs";
import path from "path";
import { Mutex } from "async-mutex";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import CreateOrUpdateContactService, {
  updateContact
} from "../ContactServices/CreateOrUpdateContactService";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import WhatsappLidMap from "../../models/WhatsapplidMap";
// Importar o módulo inteiro para acessar a fila
import * as queues from "../../queues";
import logger from "../../utils/logger";
import { IMe } from "./wbotMessageListener";
import { Session } from "../../libs/wbot";
import { SimpleObjectCache } from "../../utils/SimpleObjectCache";

const lidUpdateMutex = new Mutex();

// ✅ Cache de profile picture URLs (TTL 30 min) — evita chamada de rede ao WhatsApp a cada mensagem
const profilePicCache = new SimpleObjectCache<string>(1800);

const inferImageExtension = (
  contentType?: string | null,
  imageUrl?: string | null
): string => {
  const normalizedType = String(contentType || "").toLowerCase();

  if (normalizedType.includes("image/jpeg") || normalizedType.includes("image/jpg")) {
    return "jpeg";
  }

  if (normalizedType.includes("image/png")) {
    return "png";
  }

  if (normalizedType.includes("image/webp")) {
    return "webp";
  }

  if (normalizedType.includes("image/gif")) {
    return "gif";
  }

  try {
    const pathname = new URL(String(imageUrl || "")).pathname || "";
    const ext = pathname.split(".").pop()?.toLowerCase();

    if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext === "jpg" ? "jpeg" : ext;
    }
  } catch (error) {
    // ignora
  }

  return "jpeg";
};

const resolveProfilePicUrl = async (
  remoteJid: string,
  wbot: Session,
  fallbackProfilePicUrl?: string
): Promise<string> => {
  const picCacheKey = `pic:${remoteJid}`;
  const cachedPic = profilePicCache.get(picCacheKey);

  if (cachedPic) {
    return cachedPic;
  }

  let resolvedUrl = "";

  try {
    resolvedUrl = await wbot.profilePictureUrl(remoteJid, "image");
  } catch (e) {
    resolvedUrl = fallbackProfilePicUrl || "";
  }

  if (resolvedUrl) {
    profilePicCache.set(picCacheKey, resolvedUrl);
  }

  return resolvedUrl;
};

const syncContactPicture = async ({
  contact,
  remoteJid,
  companyId,
  wbot,
  fallbackProfilePicUrl
}: {
  contact: Contact;
  remoteJid: string;
  companyId: number;
  wbot: Session;
  fallbackProfilePicUrl?: string;
}): Promise<void> => {
  try {
    if (!contact || !wbot) {
      return;
    }

    const isGroup = String(remoteJid || "").includes("@g.us");
    if (isGroup) {
      return;
    }

    const normalizedRemoteJid =
      String(remoteJid || "").includes("@s.whatsapp.net")
        ? String(remoteJid).replace(/:\d+@/, "@")
        : "";

    if (!normalizedRemoteJid || normalizedRemoteJid === "@s.whatsapp.net") {
      return;
    }

    const profilePicUrl = await resolveProfilePicUrl(
      normalizedRemoteJid,
      wbot,
      fallbackProfilePicUrl
    );

    if (!profilePicUrl || profilePicUrl.includes("nopicture.png")) {
      return;
    }

    const folder = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      `company${companyId}`,
      "contacts"
    );

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const response = await fetch(profilePicUrl);

    if (!response.ok) {
      logger.warn(
        `[CONTACT PHOTO] Falha ao baixar foto ${profilePicUrl} para contato ${contact.id}. Status: ${response.status}`
      );
      return;
    }

    const contentType = response.headers.get("content-type");
    const ext = inferImageExtension(contentType, profilePicUrl);
    const fileName = `${contact.id}.${ext}`;
    const filePath = path.join(folder, fileName);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    if (contact.urlPicture && contact.urlPicture !== fileName) {
      try {
        const oldPath = path.join(folder, String(contact.urlPicture));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (removeError) {
        logger.warn(
          `[CONTACT PHOTO] Não foi possível remover foto antiga do contato ${contact.id}: ${removeError.message}`
        );
      }
    }

    if (
      contact.profilePicUrl !== profilePicUrl ||
      contact.urlPicture !== fileName
    ) {
      await contact.update({
        profilePicUrl,
        urlPicture: fileName
      });

      logger.info(
        `[CONTACT PHOTO] Foto sincronizada para contato ${contact.id}: ${fileName}`
      );
    }
  } catch (error) {
    logger.warn(
      `[CONTACT PHOTO] Falha ao sincronizar foto do contato ${contact?.id}: ${error.message}`
    );
  }
};

const persistContactAndSyncPicture = async (
  contactData: any,
  remoteJid: string,
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  const persistedContact = await CreateOrUpdateContactService(contactData);

  await syncContactPicture({
    contact: persistedContact,
    remoteJid,
    companyId,
    wbot,
    fallbackProfilePicUrl: contactData?.profilePicUrl
  });

  return persistedContact;
};

export async function checkAndDedup(
  contact: Contact,
  lid: string
): Promise<void> {
  const lidContact = await Contact.findOne({
    where: {
      companyId: contact.companyId,
      number: {
        [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
      }
    }
  });

  if (!lidContact) {
    return;
  }

  await Message.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  const allTickets = await Ticket.findAll({
    where: {
      contactId: lidContact.id,
      companyId: contact.companyId
    }
  });

  // Transfer all tickets to main contact instead of closing them
  await Ticket.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  if (allTickets.length > 0) {
    console.log(
      `[RDS CONTATO] Transferidos ${allTickets.length} tickets do contato ${lidContact.id} para ${contact.id}`
    );
  }

  // Delete the duplicate contact after transferring all data
  await lidContact.destroy();
}

export async function verifyContact(
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> {
  let profilePicUrl: string;

  // ✅ Cache de foto de perfil — evita chamada de rede ao WhatsApp a cada mensagem
  const isLidPre = msgContact.id.includes("@lid") || false;
  const isGroupPre = msgContact.id.includes("@g.us");

  if (!isLidPre && !isGroupPre && wbot) {
    profilePicUrl = await resolveProfilePicUrl(
      msgContact.id,
      wbot,
      `${process.env.FRONTEND_URL}/nopicture.png`
    );
  }

  const isLid = msgContact.id.includes("@lid") || false;
  const isGroup = msgContact.id.includes("@g.us");
  const isWhatsappNet = msgContact.id.includes("@s.whatsapp.net");

  // Extrair o número do ID
  const idParts = msgContact.id.split("@");
  const extractedId = idParts[0];

  // Extrair qualquer número de telefone adicional que possa estar presente
  const extractedPhone = extractedId.split(":")[0]; // Remove parte após ":" se existir

  // Determinar número e LID adequadamente
  let number = extractedPhone;
  let originalLid = msgContact.lid || null;

  // Se o ID estiver no formato telefone:XX@s.whatsapp.net, extraia apenas o telefone
  if (isWhatsappNet && extractedId.includes(":")) {
    logger.info(
      `[RDS-LID-FIX] ID contém separador ':' - extraindo apenas o telefone: ${extractedPhone}`
    );
  }

  // Verificar se o "número" parece ser um LID (muito longo para ser telefone)
  const isNumberLikelyLid = !isLid && number && number.length > 15 && !isGroup;
  if (isNumberLikelyLid) {
    logger.info(
      `[RDS-LID-FIX] Número extraído parece ser um LID (muito longo): ${number}`
    );
  }

  logger.info(
    `[RDS-LID-FIX] Processando contato - ID original: ${msgContact.id}, número extraído: ${number}, LID detectado: ${originalLid || "não"}`
  );

  // ✅ FIX NOME: Nunca salvar número como nome do contato.
  // Prioridade: pushName real > notify > verifiedName > manter nome existente
  const rawName =
    msgContact?.name || msgContact?.notify || msgContact?.verifiedName || "";
  const nameIsNumericOrLid = !rawName || /^\d{10,}$/.test(rawName.trim());
  // Se o nome é numérico/vazio, passar string vazia — CreateOrUpdateContactService vai manter o nome existente
  const contactName = nameIsNumericOrLid ? "" : rawName;

  const contactData = {
    name: contactName,
    number,
    profilePicUrl,
    isGroup,
    companyId,
    lid: originalLid,
    remoteJid: msgContact.id,
    whatsappId: wbot?.id,
    wbot
  };

  if (isGroup) {
    return CreateOrUpdateContactService(contactData);
  }

  return lidUpdateMutex.runExclusive(async () => {
    let foundContact: Contact | null = null;

    /*
     * O número informado pelo usuário e o PN/JID utilizado
     * internamente pelo WhatsApp podem ser diferentes.
     *
     * Exemplo Brasil:
     *
     * cadastro:   5532999561699
     * WhatsApp:   553299561699@s.whatsapp.net
     *
     * Renovações já grava o JID canônico em remoteJid.
     * Portanto uma resposta deve procurar também por remoteJid,
     * evitando criar um segundo Contact/Ticket.
     */
    const normalizedRemoteJid =
      String(msgContact.id || "")
        .replace(/:\d+@/, "@");

    if (isLid) {
      foundContact = await Contact.findOne({
        where: {
          companyId,
          [Op.or]: [
            {
              lid:
                originalLid
                  ? originalLid
                  : msgContact.id
            },
            {
              number
            },
            {
              remoteJid:
                originalLid
                  ? originalLid
                  : msgContact.id
            },
            {
              remoteJid:
                msgContact.id
            },
            {
              remoteJid:
                normalizedRemoteJid
            }
          ]
        },
        include: [
          "tags",
          "extraInfo",
          "whatsappLidMap"
        ]
      });
    } else {
      foundContact = await Contact.findOne({
        where: {
          companyId,
          [Op.or]: [
            {
              number
            },
            {
              remoteJid:
                msgContact.id
            },
            {
              remoteJid:
                normalizedRemoteJid
            }
          ]
        },
        include: [
          "tags",
          "extraInfo",
          "whatsappLidMap"
        ]
      });
    }

    if (foundContact) {
      logger.info(
        `[RDS-LID-FIX] Contato existente localizado: ` +
        `id=${foundContact.id}, ` +
        `number=${foundContact.number}, ` +
        `remoteJid=${foundContact.remoteJid || "null"}, ` +
        `lid=${foundContact.lid || "null"}, ` +
        `entrada=${msgContact.id}`
      );
    }

    if (isLid) {
      if (foundContact) {
        /*
         * Muito importante:
         *
         * Se encontramos o contato pelo remoteJid/LID,
         * preservamos o NUMBER original dele.
         *
         * Caso contrário o persist poderia tentar recriar
         * o contato usando o PN normalizado recebido.
         */
        return persistContactAndSyncPicture(
          {
            ...contactData,

            number:
              foundContact.number ||
              contactData.number,

            lid:
              foundContact.lid ||
              originalLid ||
              contactData.lid,

            remoteJid:
              foundContact.remoteJid ||
              normalizedRemoteJid ||
              contactData.remoteJid
          },
          msgContact.id,
          wbot,
          companyId
        );
      }

      const foundMappedContact = await WhatsappLidMap.findOne({
        where: {
          companyId,
          lid: number
        },
        include: [
          {
            model: Contact,
            as: "contact",
            include: ["tags", "extraInfo"]
          }
        ]
      });

      if (foundMappedContact) {
        return persistContactAndSyncPicture(
          {
            ...contactData,
            number: foundMappedContact.contact.number || contactData.number,
            lid: foundMappedContact.lid || contactData.lid
          },
          msgContact.id,
          wbot,
          companyId
        );
      }

      const partialLidNumber = number.includes("@")
        ? number.substring(0, number.indexOf("@"))
        : number;

      const partialLidContact = await Contact.findOne({
        where: {
          companyId,
          number: partialLidNumber
        },
        include: ["tags", "extraInfo"]
      });

      if (partialLidContact) {
        return persistContactAndSyncPicture(
          {
            ...contactData,
            number: partialLidContact.number || contactData.number,
            lid: partialLidContact.lid || contactData.lid
          },
          msgContact.id,
          wbot,
          companyId
        );
      }
    } else if (foundContact) {
      if (!(foundContact as any).whatsappLidMap) {
        try {
          // ✅ v7: Tentar resolver LID localmente via WhatsappLidMap antes de chamar onWhatsApp
          let lid: string | null = null;
          const localMapping = await WhatsappLidMap.findOne({
            where: { companyId, contactId: foundContact.id }
          });

          if (localMapping) {
            lid = localMapping.lid;
            logger.info(
              `[RDS CONTATO] LID resolvido localmente para contato ${foundContact.id}: ${lid}`
            );
          } else {
            // Fallback: chamar onWhatsApp (pode não retornar lid no v7, mas valida existência)
            const ow = await wbot.onWhatsApp(msgContact.id);

            if (ow?.[0]?.exists) {
              lid = ((ow?.[0] as any)?.lid as string) || null;

              if (lid) {
                await checkAndDedup(foundContact, lid);

                await WhatsappLidMap.findOrCreate({
                  where: { companyId, lid, contactId: foundContact.id },
                  defaults: { companyId, lid, contactId: foundContact.id }
                });

                logger.info(
                  `[RDS CONTATO] LID obtido via onWhatsApp para contato ${foundContact.id}: ${lid}`
                );
              }
            } else {
              logger.warn(
                `[RDS CONTATO] Contato ${msgContact.id} não encontrado no WhatsApp, mas continuando processamento`
              );
            }
          }
        } catch (error) {
          logger.error(
            `[RDS CONTATO] Erro ao verificar contato ${msgContact.id} no WhatsApp: ${error.message}`
          );

          try {
            await queues["lidRetryQueue"].add(
              "RetryLidLookup",
              {
                contactId: foundContact.id,
                whatsappId: wbot.id || null,
                companyId,
                number: msgContact.id,
                retryCount: 1,
                maxRetries: 5
              },
              {
                delay: 60 * 1000,
                attempts: 1,
                removeOnComplete: true
              }
            );
            logger.info(
              `[RDS CONTATO] Agendada retentativa de obtenção de LID para contato ${foundContact.id} (${msgContact.id})`
            );
          } catch (queueError) {
            logger.error(
              `[RDS CONTATO] Erro ao adicionar contato ${foundContact.id} à fila de retentativa: ${queueError.message}`
            );
          }
        }
      }

      return persistContactAndSyncPicture(
        {
          ...contactData,
          number: foundContact.number || contactData.number,
          lid: foundContact.lid || contactData.lid
        },
        msgContact.id,
        wbot,
        companyId
      );
    } else if (!isGroup && !foundContact) {
      let newContact: Contact | null = null;

      try {
        // ✅ v7: Tentar resolver LID localmente primeiro via WhatsappLidMap (por número)
        let lid: string | null = originalLid || null;
        const localLidMap = await WhatsappLidMap.findOne({
          where: { companyId },
          include: [
            {
              model: Contact,
              as: "contact",
              where: { number }
            }
          ]
        });

        if (localLidMap) {
          lid = localLidMap.lid;
          logger.info(
            `[RDS CONTATO] LID resolvido localmente para novo contato com número ${number}: ${lid}`
          );
        }

        // Fallback: chamar onWhatsApp para validar existência e tentar obter LID
        if (!lid) {
          const ow = await wbot.onWhatsApp(msgContact.id);

          if (!ow?.[0]?.exists) {
            if (originalLid && !contactData.lid) {
              contactData.lid = originalLid;
            }

            return persistContactAndSyncPicture(
              contactData,
              msgContact.id,
              wbot,
              companyId
            );
          }

          lid = ((ow?.[0] as any)?.lid as string) || originalLid || null;

          // Extrair número normalizado da resposta onWhatsApp
          try {
            const firstItem = ow?.[0] as any;
            if (firstItem?.jid) {
              const owNumber = String(firstItem.jid).split("@")[0];
              if (owNumber && owNumber !== number) {
                logger.debug(
                  `[RDS-LID-FIX] Número normalizado por onWhatsApp: ${owNumber}`
                );
              }
            }
          } catch (e) {
            logger.error(
              `[RDS-LID-FIX] Erro ao extrair número da resposta onWhatsApp: ${e.message}`
            );
          }
        }

        if (lid) {
          const lidContact = await Contact.findOne({
            where: {
              companyId,
              number: {
                [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
              }
            },
            include: ["tags", "extraInfo"]
          });

          if (lidContact) {
            await lidContact.update({ lid });

            await WhatsappLidMap.findOrCreate({
              where: { companyId, lid, contactId: lidContact.id },
              defaults: { companyId, lid, contactId: lidContact.id }
            });

            return persistContactAndSyncPicture(
              {
                ...contactData,
                number: lidContact.number || contactData.number,
                lid: lidContact.lid || lid || contactData.lid
              },
              msgContact.id,
              wbot,
              companyId
            );
          } else {
            const contactDataWithLid = { ...contactData, lid };
            newContact = await persistContactAndSyncPicture(
              contactDataWithLid,
              msgContact.id,
              wbot,
              companyId
            );

            if (newContact.lid !== lid) {
              await newContact.update({ lid });
            }

            await WhatsappLidMap.findOrCreate({
              where: { companyId, lid, contactId: newContact.id },
              defaults: { companyId, lid, contactId: newContact.id }
            });

            return newContact;
          }
        }
      } catch (error) {
        logger.error(
          `[RDS CONTATO] Erro ao verificar contato ${msgContact.id} no WhatsApp: ${error.message}`
        );

        newContact = await persistContactAndSyncPicture(
          contactData,
          msgContact.id,
          wbot,
          companyId
        );
        logger.info(
          `[RDS CONTATO] Contato criado sem LID devido a erro: ${newContact.id}`
        );

        try {
          await queues["lidRetryQueue"].add(
            "RetryLidLookup",
            {
              contactId: newContact.id,
              whatsappId: wbot.id || null,
              companyId,
              number: msgContact.id,
              lid: originalLid ? originalLid : msgContact.id,
              retryCount: 1,
              maxRetries: 5
            },
            {
              delay: 60 * 1000,
              attempts: 1,
              removeOnComplete: true
            }
          );
          logger.info(
            `[RDS CONTATO] Agendada retentativa de obtenção de LID para novo contato ${newContact.id} (${msgContact.id})`
          );
        } catch (queueError) {
          logger.error(
            `[RDS CONTATO] Erro ao adicionar contato ${newContact.id} à fila de retentativa: ${queueError.message}`
          );
        }

        return newContact;
      }
    }

    return persistContactAndSyncPicture(
      contactData,
      msgContact.id,
      wbot,
      companyId
    );
  });
}
