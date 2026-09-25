import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  commandBot?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  companyId: number;
  whatsappId?: number;
  birthDate?: Date | string;
  whatsappUsername?: string;
}

const normalizeWhatsappUsername = (value?: string): string => {
  return String(value || "").replace(/^@+/, "").trim().toLowerCase();
};

const CreateOrUpdateContactServiceForImport = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  commandBot = "",
  extraInfo = [],
  companyId,
  whatsappId,
  birthDate,
  whatsappUsername
}: Request): Promise<Contact> => {
  // Normalizar número de telefone para evitar duplicações com formatos diferentes
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  const normalizedWhatsappUsername = normalizeWhatsappUsername(whatsappUsername);

  const io = getIO();
  let contact: Contact | null;

  try {
    // Buscar contato existente
    contact = await Contact.findOne({ where: { number, companyId } });

    if (contact) {
      const updateData: any = {
        name,
        profilePicUrl,
        email: email || contact.email,
        whatsappId: whatsappId || contact.whatsappId,
        birthDate
      };

      if (contact.companyId === null) {
        updateData.companyId = companyId;
      }

      if (normalizedWhatsappUsername) {
        updateData.whatsappUsername = normalizedWhatsappUsername;
      }

      await contact.update(updateData);

      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
    } else {
      // Criar novo contato
      contact = await Contact.create({
        name,
        companyId,
        number,
        profilePicUrl,
        email,
        commandBot,
        isGroup,
        extraInfo,
        whatsappId,
        birthDate,
        whatsappUsername: normalizedWhatsappUsername
      });

      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "create",
          contact
        });
    }

    return contact;
  } catch (error) {
    throw new Error(`Erro ao criar/atualizar contato: ${error.message}`);
  }
};

export default CreateOrUpdateContactServiceForImport;