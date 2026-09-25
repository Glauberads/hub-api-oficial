import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getWbot } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import Contact from "../../models/Contact";

const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let username = "";
    let email = "";

    if (has(row, "nome") || has(row, "Nome") || has(row, "name") || has(row, "Name")) {
      name = row["nome"] || row["Nome"] || row["name"] || row["Name"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número") ||
      has(row, "telefone") ||
      has(row, "Telefone") ||
      has(row, "phone") ||
      has(row, "Phone") ||
      has(row, "celular") ||
      has(row, "Celular")
    ) {
      number =
        row["numero"] ||
        row["número"] ||
        row["Numero"] ||
        row["Número"] ||
        row["telefone"] ||
        row["Telefone"] ||
        row["phone"] ||
        row["Phone"] ||
        row["celular"] ||
        row["Celular"];

      number = `${number}`.replace(/\D/g, "");
    }

    if (
      has(row, "username") ||
      has(row, "Username") ||
      has(row, "userName") ||
      has(row, "user_name") ||
      has(row, "usuario") ||
      has(row, "Usuario") ||
      has(row, "usuário") ||
      has(row, "Usuário") ||
      has(row, "instagram") ||
      has(row, "Instagram")
    ) {
      username =
        row["username"] ||
        row["Username"] ||
        row["userName"] ||
        row["user_name"] ||
        row["usuario"] ||
        row["Usuario"] ||
        row["usuário"] ||
        row["Usuário"] ||
        row["instagram"] ||
        row["Instagram"] ||
        "";
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail") ||
      has(row, "E-Mail") ||
      has(row, "mail") ||
      has(row, "Mail")
    ) {
      email =
        row["email"] ||
        row["e-mail"] ||
        row["Email"] ||
        row["E-mail"] ||
        row["E-Mail"] ||
        row["mail"] ||
        row["Mail"] ||
        "";
    }

    return {
      name: `${name || ""}`.trim(),
      number: `${number || ""}`.trim(),
      username: `${username || ""}`.trim(),
      email: `${email || ""}`.trim().toLowerCase(),
      contactListId,
      companyId
    };
  });

  const contactList: ContactListItem[] = [];

  for (const contact of contacts) {
    const hasNumber = !!contact.number;
    const hasEmail = isValidEmail(contact.email);

    if (!contact.name || (!hasNumber && !hasEmail)) {
      continue;
    }

    const whereCondition = hasNumber
      ? {
          number: `${contact.number}`,
          contactListId: contact.contactListId,
          companyId: contact.companyId
        }
      : {
          email: `${contact.email}`,
          contactListId: contact.contactListId,
          companyId: contact.companyId
        };

    const [newContact, created] = await ContactListItem.findOrCreate({
      where: whereCondition,
      defaults: {
        ...contact,
        number: hasNumber ? contact.number : "",
        email: hasEmail ? contact.email : ""
      }
    });

    if (!created) {
      let changed = false;

      if (contact.name && newContact.name !== contact.name) {
        newContact.name = contact.name;
        changed = true;
      }

      if ((contact.number || "") !== (newContact.number || "")) {
        newContact.number = contact.number || "";
        changed = true;
      }

      if ((contact.username || "") !== (newContact.username || "")) {
        newContact.username = contact.username || "";
        changed = true;
      }

      if ((contact.email || "") !== (newContact.email || "")) {
        newContact.email = contact.email || "";
        changed = true;
      }

      if (changed) {
        await newContact.save();
      }
    }

    contactList.push(newContact);
  }

  if (contactList) {
    for (let newContact of contactList) {
      if (!newContact.number) {
        const io = getIO();

        io.of(String(companyId)).emit(
          `company-${companyId}-ContactListItem-${+contactListId}`,
          {
            action: "reload",
            records: [newContact]
          }
        );

        continue;
      }

      try {
        const existingContact = await Contact.findOne({
          where: { number: newContact.number, companyId }
        });

        if (existingContact) {
          const localMap = await WhatsappLidMap.findOne({
            where: { companyId, contactId: existingContact.id }
          });

          if (localMap) {
            newContact.isWhatsappValid = true;
            await newContact.save();
            logger.debug(
              `[ImportContacts] Contato ${newContact.number} validado localmente via WhatsappLidMap`
            );

            const io = getIO();
            io.of(String(companyId)).emit(
              `company-${companyId}-ContactListItem-${+contactListId}`,
              {
                action: "reload",
                records: [newContact]
              }
            );
            continue;
          }
        }

        const whatsapp = await Whatsapp.findOne({
          where: {
            companyId,
            status: "CONNECTED",
            channel: "whatsapp"
          },
          limit: 1
        });

        if (!whatsapp) {
          logger.warn(
            `[ImportContacts] Nenhum WhatsApp conectado para empresa ${companyId}. Pulando validação do contato ${newContact.number}`
          );
          continue;
        }

        const wbot = await getWbot(whatsapp.id);
        const response = await wbot.onWhatsApp(
          `${newContact.number}@s.whatsapp.net`
        );

        newContact.isWhatsappValid = response[0]?.exists ? true : false;
        newContact.number = response[0]?.exists
          ? response[0]?.jid.split("@")[0]
          : newContact.number;

        await newContact.save();
      } catch (e: any) {
        logger.error(
          `[ImportContacts] Número de contato inválido: ${newContact.number} - ${e.message}`
        );
      }

      const io = getIO();

      io.of(String(companyId)).emit(
        `company-${companyId}-ContactListItem-${+contactListId}`,
        {
          action: "reload",
          records: [newContact]
        }
      );
    }
  }

  return contactList;
}