export interface IWebhookWhatsApp {
  object: string;
  entry: Array<IWebhookWhatsAppEntry>;
}

export interface IWebhookWhatsAppEntry {
  id: string;
  changes: Array<IWebhookWhatsAppEntryChanges>;
}

export interface IWebhookWhatsAppEntryChanges {
  value: IWebhookWhatsAppEntryChangesValue;
  field: string;
}

export interface IWebhookWhatsAppEntryChangesValue {
  messaging_product: string;
  metadata?: IWebhookWhatsAppEntryChangesValueMetaData;
  contacts?: Array<IWebhookWhatsAppEntryChangesValueContacts>;
  messages?: Array<IWebhookWhatsAppEntryChangesValueMessages>;
  statuses?: Array<IWebhookWhatsAppEntryChangesValueStatuses>;
  calls?: Array<IWebhookWhatsAppEntryChangesValueCalls>;
}

export interface IWebhookWhatsAppEntryChangesValueCalls {
  id?: string;
  call_id?: string;
  from?: string;
  to?: string;
  event?: string;
  status?: string;
  direction?: string;
  timestamp?: string;
  session?: {
    sdp?: string;
    sdp_type?: string;
  };
  connection?: any;
  [key: string]: any;
}

export interface IWebhookWhatsAppEntryChangesValueStatuses {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  pricing?: any;
}

export interface IWebhookWhatsAppEntryChangesValueMetaData {
  display_phone_number: string;
  phone_number_id: string;
}

export class IWebhookWhatsAppEntryChangesValueContacts {
  profile: IWebhookWhatsAppEntryChangesValueContactsProfile;
  wa_id: string;
  user_id?: string;
  username?: string;
  phone_number?: string;
  name?: string;
}

export interface IWebhookWhatsAppEntryChangesValueContactsProfile {
  name: string;
  username?: string;
  user_id?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessages {
  from: string;
  id: string;
  timestamp: string;
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
    | "sticker"
    | "unsupported"
    | "button";

  text?: IWebhookWhatsAppEntryChangesValueMessagesText;
  image?: IWebhookWhatsAppEntryChangesValueMessagesImage;
  audio?: IWebhookWhatsAppEntryChangesValueMessagesAudio;
  document?: IWebhookWhatsAppEntryChangesValueMessagesDocument;
  video?: IWebhookWhatsAppEntryChangesValueMessagesVideo;
  location?: IWebhookWhatsAppEntryChangesValueMessagesLocation;
  contacts?: Array<IWebhookWhatsAppEntryChangesValueMessagesContacts>;
  context?: IWebhookWhatsAppEntryChangesValueMessagesContext;
  sticker?: IWebhookWhatsAppEntryChangesValueMessagesSticker;
  order?: IWebhookWhatsAppEntryChangesValueMessagesOrder;
  interactive?: IWebhookWhatsAppEntryChangesValueMessagesInteractive;
  referral?: IWebhookWhatsAppEntryChangesValueMessagesReferral;
  unsupported?: IWebhookWhatsAppEntryChangesValueMessagesUnsupported;
  errors?: Array<IWebhookWhatsAppEntryChangesValueMessagesError>;

  button?: IWebhookWhatsAppEntryChangesValueMessagesButton;

  from_user_id?: string;
  user_id?: string;
  username?: string;
  profile?: IWebhookWhatsAppEntryChangesValueMessagesProfile;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesProfile {
  name?: string;
  username?: string;
  user_id?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesButton {
  text?: string;
  payload?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesError {
  code?: number;
  title?: string;
  message?: string;
  error_data?: {
    details?: string;
  };
}

export interface IWebhookWhatsAppEntryChangesValueMessagesUnsupported {
  type?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesReferral {
  source_url?: string;
  source_type?: string;
  source_id?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  ctwa_clid?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesSticker {
  mime_type: string;
  sha256: string;
  id: string;
  animated: boolean;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesInteractive {
  type?: "button_reply" | "list_reply" | "nfm_reply" | string;
  button_reply?: IWebhookWhatsAppEntryChangesValueMessagesInteractiveButtonReply;
  list_reply?: IWebhookWhatsAppEntryChangesValueMessagesInteractiveListReply;
  nfm_reply?: IWebhookWhatsAppEntryChangesValueMessagesInteractiveNfmReply;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesInteractiveButtonReply {
  id: string;
  title: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesInteractiveListReply {
  id: string;
  title: string;
  description?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesInteractiveNfmReply {
  name?: string;
  body?: string;
  response_json?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesOrder {
  catalog_id: string;
  text?: string;
  product_items: Array<IWebhookWhatsAppEntryChangesValueMessagesOrderProductItem>;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesOrderProductItem {
  product_retailer_id: string;
  quantity: string;
  item_price: string;
  currency: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContext {
  from?: string;
  id?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesText {
  body: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesImage {
  mime_type: string;
  sha256: string;
  id: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesAudio {
  mime_type: string;
  sha256: string;
  id: string;
  voice: boolean;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesDocument {
  filename?: string;
  mime_type: string;
  sha256: string;
  id: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesVideo {
  mime_type: string;
  sha256: string;
  id: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesLocation {
  latitude: number;
  longitude: number;
  name?: string;
  url?: string;
  address?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContacts {
  emails?: Array<IWebhookWhatsAppEntryChangesValueMessagesContactsEmails>;
  name?: IWebhookWhatsAppEntryChangesValueMessagesContactsName;
  org?: IWebhookWhatsAppEntryChangesValueMessagesContactsOrg;
  phones?: Array<IWebhookWhatsAppEntryChangesValueMessagesContactsPhones>;
  urls?: Array<IWebhookWhatsAppEntryChangesValueMessagesContactsUrls>;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContactsEmails {
  email: string;
  type?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContactsName {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  formatted_name?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContactsOrg {
  company?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContactsPhones {
  phone?: string;
  wa_id?: string;
  type?: string;
}

export interface IWebhookWhatsAppEntryChangesValueMessagesContactsUrls {
  url?: string;
  type?: string;
}