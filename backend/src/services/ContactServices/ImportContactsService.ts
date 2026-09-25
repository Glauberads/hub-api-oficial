import { head, has } from "lodash";
import XLSX from "xlsx";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";

const normalizeWhatsappUsername = (value?: string): string => {
  return String(value || "").replace(/^@+/, "").trim().toLowerCase();
};

const getUsernameFromRow = (row: any): string => {
  return normalizeWhatsappUsername(
    row["whatsappUsername"] ||
    row["whatsappusername"] ||
    row["username"] ||
    row["Username"] ||
    row["usuario"] ||
    row["usuário"] ||
    row["Usuario"] ||
    row["Usuário"] ||
    row["Username do WhatsApp"] ||
    row["username do whatsapp"] ||
    ""
  );
};

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let email = "";
    let birthDate = null;
    let whatsappUsername = "";

    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
      number = `${number}`.replace(/\D/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    whatsappUsername = getUsernameFromRow(row);

    // Processar data de nascimento - Suporta múltiplos formatos de cabeçalho
    if (
      has(row, "birthdate") ||
      has(row, "birthDate") ||
      has(row, "data_nascimento") ||
      has(row, "data_nasc") ||
      has(row, "nascimento") ||
      has(row, "Dt Nasc") ||
      has(row, "Data de Nascimento") ||
      has(row, "Data Nascimento")
    ) {
      const birthDateStr = row["birthdate"] || row["birthDate"] ||
        row["data_nascimento"] || row["data_nasc"] ||
        row["nascimento"] || row["Dt Nasc"] ||
        row["Data de Nascimento"] || row["Data Nascimento"];

      if (birthDateStr) {
        try {
          const parsedDate = new Date(birthDateStr);

          // Validar que é data válida e não futura
          if (!isNaN(parsedDate.getTime()) && parsedDate <= new Date()) {
            birthDate = parsedDate.toISOString().split("T")[0]; // YYYY-MM-DD
          } else {
            logger.warn(`Data de nascimento inválida ou futura: ${birthDateStr}`);
          }
        } catch (error) {
          logger.warn(`Erro ao processar data de nascimento: ${birthDateStr}`, error);
        }
      }
    }

    return { name, number, email, birthDate, whatsappUsername, companyId };
  });

  const contactList: Contact[] = [];

  for (const contact of contacts) {
    const [newContact, created] = await Contact.findOrCreate({
      where: {
        number: `${contact.number}`,
        companyId: contact.companyId
      },
      defaults: contact
    });

    if (!created) {
      const updateData: any = {};

      if (contact.name && (!newContact.name || newContact.name === newContact.number)) {
        updateData.name = contact.name;
      }

      if (contact.email && !newContact.email) {
        updateData.email = contact.email;
      }

      if (contact.birthDate && !newContact.birthDate) {
        updateData.birthDate = contact.birthDate;
      }

      if (
        contact.whatsappUsername &&
        normalizeWhatsappUsername(newContact.whatsappUsername) !== contact.whatsappUsername
      ) {
        updateData.whatsappUsername = contact.whatsappUsername;
      }

      if (Object.keys(updateData).length > 0) {
        await newContact.update(updateData);
      }
    }

    contactList.push(newContact);
  }

  return contactList;
}