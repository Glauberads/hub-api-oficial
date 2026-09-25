export interface IReceivedWhatsppOficial {
  token: string;
  fromNumber: string;
  nameContact: string;
  companyId: number;
  fromMe?: boolean;
  source?: string | null;
  user_id?: number | null;
  userId?: number | null;
  attendantId?: number | null;
  attendant_id?: number | null;
  message: IMessageReceived;
}

export interface IReceivedWhatsppOficialRead {
  messageId: string;
  companyId: number;
  token: string;
}

export interface IMessageLocationReceived {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
  url?: string | null;
}

export interface IMessageReceived {
  type:
    | "text"
    | "image"
    | "audio"
    | "document"
    | "video"
    | "location"
    | "contacts"
    | "order"
    | "interactive"
    | "referral"
    | "sticker";
  timestamp: number;
  idMessage: string;
  text?: string;
  file?: string;
  mimeType?: string;
  idFile?: string;
  quoteMessageId?: string;
  fileUrl?: string;
  fileSize?: number;
  location?: IMessageLocationReceived;
  fileName?: string | null;
  filePath?: string | null;
  fileExtension?: string | null;
  isAnimatedSticker?: boolean;
  mediaType?: string | null;
  referral?: {
    sourceId: string | null;
    sourceUrl: string | null;
    sourceType: string | null;
    headline: string | null;
    body: string | null;
    imageUrl: string | null;
    mediaType: string | null;
    ctwaClid: string | null;
  } | null;
}

export interface IOfficialCallWhatsAppOficial {
  token?: string;
  companyId: number;
  conexaoId: number;
  whatsappOficialId?: number | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  field?: string;
  calls: Array<{
    id?: string | null;
    call_id?: string | null;
    user_id?: number | null;
    userId?: number | null;
    attendantId?: number | null;
    attendant_id?: number | null;
    event?: string | null;
    status?: string | null;
    direction?: string | null;
    from?: string | null;
    to?: string | null;
    timestamp?: string | number | null;
    session?: any;
    connection?: any;
    raw?: any;
  }>;
  raw?: any;
}

