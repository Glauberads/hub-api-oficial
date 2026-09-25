import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactIdentifier from "../../models/ContactIdentifier";
import UpsertContactIdentifierService, {
  UpsertManyContactIdentifiersService
} from "./UpsertContactIdentifierService";
import logger from "../../utils/logger";

interface MetadataMap {
  [key: string]: any;
}

interface Request {
  companyId: number;
  channel?: string;
  provider?: string;
  name?: string;
  number?: string | null;
  phone?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  username?: string | null;
  remoteJid?: string | null;
  lid?: string | null;
  email?: string;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  whatsappId?: number | null;
  source?: string;
  metadata?: MetadataMap;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

const normalizeChannel = (channel?: string): string => {
  const value = String(channel || "").trim();

  if (!value) {
    return "whatsapp_cloud";
  }

  if (value === "whatsapp") {
    return "whatsapp_baileys";
  }

  return value;
};

const normalizeContactChannel = (channel?: string): string => {
  const value = String(channel || "").trim();

  if (!value) {
    return "whatsapp";
  }

  if (value === "whatsapp_cloud" || value === "whatsapp_baileys") {
    return "whatsapp";
  }

  return value;
};

const normalizeProvider = (channel: string, provider?: string): string => {
  const explicitProvider = String(provider || "").trim();
  if (explicitProvider) {
    return explicitProvider;
  }

  if (channel === "whatsapp_baileys") {
    return "baileys";
  }

  if (
    channel === "whatsapp_cloud" ||
    channel === "facebook" ||
    channel === "instagram"
  ) {
    return "meta";
  }

  return "legacy";
};

const normalizeString = (value?: string | null): string => {
  return String(value || "").trim();
};

const normalizeUsername = (value?: string | null): string => {
  return normalizeString(value).replace(/^@+/, "").toLowerCase();
};

const normalizePhoneDigits = (value?: string | null): string => {
  const raw = normalizeString(value);
  if (!raw) {
    return "";
  }
  return raw.replace(/\D+/g, "");
};

const normalizePhoneE164 = (value?: string | null): string => {
  const raw = normalizeString(value);
  if (!raw) {
    return "";
  }

  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D+/g, "")}`;
  }

  return raw.replace(/\D+/g, "");
};

const normalizeWaId = (value?: string | null): string => {
  return normalizeString(value);
};

const normalizeBsuid = (value?: string | null): string => {
  return normalizeString(value);
};

const buildPhoneCandidates = (value?: string | null): string[] => {
  const raw = normalizeString(value);
  const e164 = normalizePhoneE164(value);
  const digits = normalizePhoneDigits(value);

  const values = [raw, e164, digits].filter(Boolean);

  return [...new Set(values)];
};

const buildIdentifierCandidates = ({
  phone,
  waId,
  bsuid,
  username
}: {
  phone?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  username?: string | null;
}): Array<{ type: string; value: string }> => {
  const candidates: Array<{ type: string; value: string }> = [];

  const normalizedBsuid = normalizeBsuid(bsuid);
  const normalizedUsername = normalizeUsername(username);
  const normalizedWaId = normalizeWaId(waId);
  const phoneCandidates = buildPhoneCandidates(phone);

  if (normalizedBsuid) {
    candidates.push({ type: "bsuid", value: normalizedBsuid });
  }

  if (normalizedUsername) {
    candidates.push({ type: "username", value: normalizedUsername });
  }

  for (const value of phoneCandidates) {
    candidates.push({ type: "phone_e164", value });
  }

  if (normalizedWaId) {
    candidates.push({ type: "wa_id", value: normalizedWaId });
  }

  return candidates;
};

const buildLegacyNumber = ({
  phone,
  waId,
  remoteJid,
  bsuid,
  username
}: {
  phone?: string | null;
  waId?: string | null;
  remoteJid?: string | null;
  bsuid?: string | null;
  username?: string | null;
}): string => {
  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits) {
    return phoneDigits;
  }

  const normalizedWaId = normalizeWaId(waId);
  if (normalizedWaId) {
    return normalizedWaId;
  }

  const normalizedRemoteJid = normalizeString(remoteJid);
  if (normalizedRemoteJid) {
    const jidBase = normalizedRemoteJid.split("@")[0]?.trim();
    if (jidBase) {
      return jidBase;
    }
  }

  const normalizedBsuid = normalizeBsuid(bsuid);
  if (normalizedBsuid) {
    return `bsuid:${normalizedBsuid}`;
  }

  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername) {
    return `username:${normalizedUsername}`;
  }

  return `contact:${Date.now()}`;
};

const findContactByIdentifier = async (
  companyId: number,
  identifierType: string,
  identifierValue: string
): Promise<Contact | null> => {
  const identifier = await ContactIdentifier.findOne({
    where: {
      companyId,
      identifierType,
      identifierValue
    }
  });

  if (!identifier?.contactId) {
    return null;
  }

  const contact = await Contact.findOne({
    where: {
      id: identifier.contactId,
      companyId
    }
  });

  return contact || null;
};

const findLegacyContact = async (
  companyId: number,
  phone?: string | null,
  waId?: string | null,
  lid?: string | null,
  remoteJid?: string | null
): Promise<Contact | null> => {
  const phoneDigits = normalizePhoneDigits(phone);
  const normalizedWaId = normalizeWaId(waId);
  const normalizedLid = normalizeString(lid);
  const normalizedRemoteJid = normalizeString(remoteJid);

  const orConditions: any[] = [];

  if (phoneDigits) {
    orConditions.push({ number: phoneDigits });
  }

  if (normalizedWaId) {
    orConditions.push({ number: normalizedWaId });
  }

  if (normalizedLid) {
    orConditions.push({ lid: normalizedLid });
  }

  if (normalizedRemoteJid) {
    orConditions.push({ remoteJid: normalizedRemoteJid });
  }

  if (!orConditions.length) {
    return null;
  }

  const contact = await Contact.findOne({
    where: {
      companyId,
      [Op.or]: orConditions
    }
  });

  return contact || null;
};

const buildIdentifiersToUpsert = ({
  phone,
  waId,
  bsuid,
  username,
  source,
  metadata,
  firstSeenAt,
  lastSeenAt
}: {
  phone?: string | null;
  waId?: string | null;
  bsuid?: string | null;
  username?: string | null;
  source: string;
  metadata?: MetadataMap;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}) => {
  const phoneE164 = normalizePhoneE164(phone);
  const phoneDigits = normalizePhoneDigits(phone);
  const normalizedWaId = normalizeWaId(waId);
  const normalizedBsuid = normalizeBsuid(bsuid);
  const normalizedUsername = normalizeUsername(username);

  const primaryType = phoneE164
    ? "phone_e164"
    : normalizedWaId
      ? "wa_id"
      : normalizedBsuid
        ? "bsuid"
        : normalizedUsername
          ? "username"
          : "";

  const identifiers = [
    {
      identifierType: "phone_e164",
      identifierValue: phoneE164 || phoneDigits || null,
      isPrimary: primaryType === "phone_e164",
      isReachable: true,
      source,
      metadata: {
        ...(metadata || {}),
        originField: "phone"
      },
      firstSeenAt,
      lastSeenAt
    },
    {
      identifierType: "wa_id",
      identifierValue: normalizedWaId || null,
      isPrimary: primaryType === "wa_id",
      isReachable: true,
      source,
      metadata: {
        ...(metadata || {}),
        originField: "waId"
      },
      firstSeenAt,
      lastSeenAt
    },
    {
      identifierType: "bsuid",
      identifierValue: normalizedBsuid || null,
      isPrimary: primaryType === "bsuid",
      isReachable: true,
      source,
      metadata: {
        ...(metadata || {}),
        originField: "bsuid"
      },
      firstSeenAt,
      lastSeenAt
    },
    {
      identifierType: "username",
      identifierValue: normalizedUsername || null,
      isPrimary: primaryType === "username",
      isReachable: true,
      source,
      metadata: {
        ...(metadata || {}),
        originField: "username"
      },
      firstSeenAt,
      lastSeenAt
    }
  ];

  return identifiers.filter(item => item.identifierValue);
};

const safelyUpdateContact = async (
  contact: Contact,
  {
    name,
    email,
    profilePicUrl,
    remoteJid,
    lid,
    whatsappId,
    channel,
    phone,
    waId,
    bsuid,
    username,
    isGroup
  }: {
    name?: string;
    email?: string;
    profilePicUrl?: string | null;
    remoteJid?: string | null;
    lid?: string | null;
    whatsappId?: number | null;
    channel?: string;
    phone?: string | null;
    waId?: string | null;
    bsuid?: string | null;
    username?: string | null;
    isGroup?: boolean;
  }
): Promise<Contact> => {
  const updateData: Partial<Contact> = {};

  const normalizedName = normalizeString(name);
  const normalizedEmail = normalizeString(email);
  const normalizedProfilePicUrl = normalizeString(profilePicUrl);
  const normalizedRemoteJid = normalizeString(remoteJid);
  const normalizedLid = normalizeString(lid);
  const normalizedChannel = normalizeContactChannel(channel);
  const legacyNumber = buildLegacyNumber({
    phone,
    waId,
    remoteJid,
    bsuid,
    username
  });

  if (normalizedName && (!contact.name || contact.name === contact.number)) {
    updateData.name = normalizedName;
  }

  if (normalizedEmail && !contact.email) {
    updateData.email = normalizedEmail;
  }

  if (normalizedProfilePicUrl && !contact.profilePicUrl) {
    updateData.profilePicUrl = normalizedProfilePicUrl;
  }

  if (normalizedRemoteJid && !contact.remoteJid) {
    updateData.remoteJid = normalizedRemoteJid;
  }

  if (normalizedLid && !contact.lid) {
    updateData.lid = normalizedLid;
  }

  if (whatsappId && !contact.whatsappId) {
    updateData.whatsappId = whatsappId;
  }

  if (normalizedChannel && !contact.channel) {
    updateData.channel = normalizedChannel;
  }

  if (typeof isGroup === "boolean" && contact.isGroup !== isGroup) {
    updateData.isGroup = isGroup;
  }

  if ((!contact.number || contact.number.startsWith("contact:")) && legacyNumber) {
    updateData.number = legacyNumber;
  }

  if (Object.keys(updateData).length) {
    await contact.update(updateData);
  }

  return contact;
};

const ResolveOrCreateContactByIdentifierService = async ({
  companyId,
  channel,
  provider,
  name,
  number,
  phone,
  waId,
  bsuid,
  username,
  remoteJid,
  lid,
  email = "",
  profilePicUrl,
  isGroup = false,
  whatsappId,
  source = "webhook",
  metadata,
  firstSeenAt,
  lastSeenAt
}: Request): Promise<Contact> => {
  const normalizedChannel = normalizeChannel(channel);
  const normalizedProvider = normalizeProvider(normalizedChannel, provider);
  const normalizedName = normalizeString(name);
  const normalizedPhone = normalizeString(phone || number);
  const normalizedWaId = normalizeWaId(waId);
  const normalizedBsuid = normalizeBsuid(bsuid);
  const normalizedUsername = normalizeUsername(username);
  const normalizedRemoteJid = normalizeString(remoteJid);
  const normalizedLid = normalizeString(lid);
  const now = new Date();

  const candidates = buildIdentifierCandidates({
    phone: normalizedPhone,
    waId: normalizedWaId,
    bsuid: normalizedBsuid,
    username: normalizedUsername
  });

  let contact: Contact | null = null;

  for (const candidate of candidates) {
    contact = await findContactByIdentifier(
      companyId,
      candidate.type,
      candidate.value
    );

    if (contact) {
      logger.info(
        `[ContactIdentifier] Contato resolvido por identificador. ` +
        `companyId=${companyId} type=${candidate.type} value=${candidate.value} contactId=${contact.id}`
      );
      break;
    }
  }

  if (!contact) {
    contact = await findLegacyContact(
      companyId,
      normalizedPhone,
      normalizedWaId,
      normalizedLid,
      normalizedRemoteJid
    );

    if (contact) {
      logger.info(
        `[ContactIdentifier] Contato legado resolvido. ` +
        `companyId=${companyId} contactId=${contact.id}`
      );
    }
  }

  if (!contact) {
    const legacyNumber = buildLegacyNumber({
      phone: normalizedPhone,
      waId: normalizedWaId,
      remoteJid: normalizedRemoteJid,
      bsuid: normalizedBsuid,
      username: normalizedUsername
    });

    if (
      legacyNumber.startsWith("bsuid:") ||
      legacyNumber.startsWith("username:")
    ) {
      logger.warn(
        `[ContactIdentifier] Criando contato sem telefone real. ` +
        `companyId=${companyId} number=${legacyNumber}`
      );
    }

    const existingByNumber = await Contact.findOne({
      where: {
        companyId,
        number: legacyNumber
      }
    });

    if (existingByNumber) {
      contact = existingByNumber;
    } else {
      contact = await Contact.create({
        name: normalizedName || legacyNumber,
        number: legacyNumber,
        email: normalizeString(email) || "",
        profilePicUrl: normalizeString(profilePicUrl) || "",
        isGroup,
        channel: normalizeContactChannel(normalizedChannel),
        companyId,
        remoteJid: normalizedRemoteJid || null,
        lid: normalizedLid || null,
        whatsappId: whatsappId || null
      } as any);

      logger.info(
        `[ContactIdentifier] Novo contato criado. companyId=${companyId} contactId=${contact.id}`
      );
    }
  }

  await safelyUpdateContact(contact, {
    name: normalizedName,
    email,
    profilePicUrl,
    remoteJid: normalizedRemoteJid,
    lid: normalizedLid,
    whatsappId,
    channel: normalizedChannel,
    phone: normalizedPhone,
    waId: normalizedWaId,
    bsuid: normalizedBsuid,
    username: normalizedUsername,
    isGroup
  });

  const identifiers = buildIdentifiersToUpsert({
    phone: normalizedPhone,
    waId: normalizedWaId,
    bsuid: normalizedBsuid,
    username: normalizedUsername,
    source,
    metadata: {
      ...(metadata || {}),
      resolvedBy: "ResolveOrCreateContactByIdentifierService"
    },
    firstSeenAt: firstSeenAt || now,
    lastSeenAt: lastSeenAt || now
  });

  if (identifiers.length) {
    await UpsertManyContactIdentifiersService({
      contactId: contact.id,
      companyId,
      channel: normalizedChannel,
      provider: normalizedProvider,
      identifiers
    });
  } else {
    const fallbackLegacyNumber = buildLegacyNumber({
      phone: normalizedPhone,
      waId: normalizedWaId,
      remoteJid: normalizedRemoteJid,
      bsuid: normalizedBsuid,
      username: normalizedUsername
    });

    await UpsertContactIdentifierService({
      contactId: contact.id,
      companyId,
      channel: normalizedChannel,
      provider: normalizedProvider,
      identifierType: "phone_e164",
      identifierValue: fallbackLegacyNumber,
      isPrimary: true,
      isReachable: true,
      source,
      metadata: {
        ...(metadata || {}),
        resolvedBy: "ResolveOrCreateContactByIdentifierService",
        fallback: true
      },
      firstSeenAt: firstSeenAt || now,
      lastSeenAt: lastSeenAt || now
    });
  }

  return contact;
};

export default ResolveOrCreateContactByIdentifierService;