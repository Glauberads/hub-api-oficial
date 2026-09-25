import ContactIdentifier from "../../models/ContactIdentifier";
import logger from "../../utils/logger";

interface MetadataMap {
  [key: string]: any;
}

interface Request {
  contactId: number;
  companyId: number;
  channel?: string;
  provider?: string;
  identifierType: string;
  identifierValue?: string | null;
  isPrimary?: boolean;
  isReachable?: boolean;
  source?: string;
  metadata?: MetadataMap;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

interface BulkIdentifierItem {
  identifierType: string;
  identifierValue?: string | null;
  isPrimary?: boolean;
  isReachable?: boolean;
  source?: string;
  metadata?: MetadataMap;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

interface BulkRequest {
  contactId: number;
  companyId: number;
  channel?: string;
  provider?: string;
  identifiers: BulkIdentifierItem[];
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

const resolveProvider = (channel: string, provider?: string): string => {
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

const normalizeIdentifierType = (identifierType: string): string => {
  return String(identifierType || "").trim().toLowerCase();
};

const normalizePhoneValue = (value: string): string => {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D+/g, "")}`;
  }

  return raw.replace(/\D+/g, "");
};

const normalizeIdentifierValue = (
  identifierType: string,
  identifierValue?: string | null
): string => {
  const raw = String(identifierValue || "").trim();

  if (!raw) {
    return "";
  }

  switch (identifierType) {
    case "username":
      return raw.replace(/^@+/, "").toLowerCase();

    case "phone_e164":
      return normalizePhoneValue(raw);

    case "wa_id":
    case "bsuid":
    default:
      return raw;
  }
};

const mergeMetadata = (
  currentMetadata?: MetadataMap | null,
  newMetadata?: MetadataMap | null
): MetadataMap | null => {
  const current =
    currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {};
  const incoming =
    newMetadata && typeof newMetadata === "object" ? newMetadata : {};

  const merged = {
    ...current,
    ...incoming
  };

  return Object.keys(merged).length ? merged : null;
};

const UpsertContactIdentifierService = async ({
  contactId,
  companyId,
  channel,
  provider,
  identifierType,
  identifierValue,
  isPrimary = false,
  isReachable = true,
  source = "webhook",
  metadata,
  firstSeenAt,
  lastSeenAt
}: Request): Promise<ContactIdentifier | null> => {
  const normalizedChannel = normalizeChannel(channel);
  const normalizedProvider = resolveProvider(normalizedChannel, provider);
  const normalizedType = normalizeIdentifierType(identifierType);
  const normalizedValue = normalizeIdentifierValue(
    normalizedType,
    identifierValue
  );
  const now = new Date();

  if (!contactId || !companyId || !normalizedType || !normalizedValue) {
    return null;
  }

  const existing = await ContactIdentifier.findOne({
    where: {
      companyId,
      channel: normalizedChannel,
      identifierType: normalizedType,
      identifierValue: normalizedValue
    }
  });

  if (existing) {
    const updateData: Partial<ContactIdentifier> = {
      provider: normalizedProvider,
      isReachable,
      source,
      metadata: mergeMetadata(existing.metadata, metadata),
      lastSeenAt: lastSeenAt || now
    };

    if (!existing.firstSeenAt) {
      updateData.firstSeenAt = firstSeenAt || now;
    }

    if (existing.contactId !== contactId) {
      logger.warn(
        `[ContactIdentifier] Identificador já vinculado a outro contato. ` +
          `companyId=${companyId} channel=${normalizedChannel} type=${normalizedType} ` +
          `value=${normalizedValue} existingContactId=${existing.contactId} newContactId=${contactId}`
      );

      await existing.update(updateData);

      return existing;
    }

    if (isPrimary && !existing.isPrimary) {
      await ContactIdentifier.update(
        { isPrimary: false },
        {
          where: {
            contactId,
            companyId,
            channel: normalizedChannel,
            identifierType: normalizedType
          }
        }
      );

      updateData.isPrimary = true;
    }

    await existing.update(updateData);

    return existing;
  }

  if (isPrimary) {
    await ContactIdentifier.update(
      { isPrimary: false },
      {
        where: {
          contactId,
          companyId,
          channel: normalizedChannel,
          identifierType: normalizedType
        }
      }
    );
  }

  const created = await ContactIdentifier.create({
    contactId,
    companyId,
    channel: normalizedChannel,
    provider: normalizedProvider,
    identifierType: normalizedType,
    identifierValue: normalizedValue,
    isPrimary,
    isReachable,
    firstSeenAt: firstSeenAt || now,
    lastSeenAt: lastSeenAt || now,
    source,
    metadata: mergeMetadata(null, metadata)
  });

  return created;
};

export const UpsertManyContactIdentifiersService = async ({
  contactId,
  companyId,
  channel,
  provider,
  identifiers
}: BulkRequest): Promise<ContactIdentifier[]> => {
  const results: ContactIdentifier[] = [];

  for (const item of identifiers || []) {
    const saved = await UpsertContactIdentifierService({
      contactId,
      companyId,
      channel,
      provider,
      identifierType: item.identifierType,
      identifierValue: item.identifierValue,
      isPrimary: item.isPrimary,
      isReachable: item.isReachable,
      source: item.source,
      metadata: item.metadata,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt
    });

    if (saved) {
      results.push(saved);
    }
  }

  return results;
};

export default UpsertContactIdentifierService;