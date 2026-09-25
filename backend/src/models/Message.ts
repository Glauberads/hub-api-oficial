import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey,
  AutoIncrement
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Company from "./Company";
import Queue from "./Queue";
import TicketTraking from "./TicketTraking";

const buildBaseUrl = (baseUrl?: string): string => {
  const rawBase = String(baseUrl || "").trim();
  if (!rawBase) {
    return "";
  }

  const hasPortInBase = /:\d+$/.test(rawBase);
  const proxyPort = String(process.env.PROXY_PORT || "").trim();

  if (proxyPort && !hasPortInBase) {
    return `${rawBase.replace(/\/+$/, "")}:${proxyPort}`;
  }

  return rawBase.replace(/\/+$/, "");
};

@Table
class Message extends Model<Message> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING)
  remoteJid: string;

  @Column(DataType.STRING)
  participant: string;

  @Column(DataType.STRING)
  dataJson: string;

  @Column(DataType.STRING)
  remoteIdentifierType: string;

  @Column(DataType.STRING)
  remoteIdentifierValue: string;

  @Column(DataType.STRING)
  remoteUsername: string;

  @Column(DataType.STRING)
  remoteWaId: string;

  @Column(DataType.STRING)
  remotePhone: string;

  @Column(DataType.JSONB)
  rawMetaPayload: Record<string, any>;

  @Default(0)
  @Column
  ack: number;

  @Default(false)
  @Column
  read: boolean;

  @Default(false)
  @Column
  fromMe: boolean;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    const rawMediaUrl = this.getDataValue("mediaUrl");

    if (!rawMediaUrl) {
      return null;
    }

    const raw = String(rawMediaUrl).trim();

    if (!raw) {
      return null;
    }

    // Já é uma URL completa
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const backendBaseUrl = buildBaseUrl(process.env.BACKEND_URL);
    const officialBaseUrl = buildBaseUrl(
      process.env.OFFICIAL_MEDIA_URL ||
      process.env.OFFICIAL_API_URL ||
      process.env.API_OFICIAL_URL ||
      process.env.BACKEND_URL
    );

    const cleanRaw = raw.replace(/^\/+/, "");

    // Mídia salva pela API oficial
    // Exemplo salvo no banco:
    // official-public/2026-03-7/1/1/343-movie.mp4
    if (cleanRaw.startsWith("official-public/")) {
      return `${officialBaseUrl}/${cleanRaw}`;
    }

    // Quando já vier com /public/ pronto
    if (cleanRaw.startsWith("public/")) {
      return `${backendBaseUrl}/${cleanRaw}`;
    }

    // Quando já vier como company1/arquivo.ext
    if (cleanRaw.startsWith(`company${this.companyId}/`)) {
      return `${backendBaseUrl}/public/${cleanRaw}`;
    }

    // Padrão antigo do sistema
    return `${backendBaseUrl}/public/company${this.companyId}/${cleanRaw}`;
  }

  @Column
  mediaType: string;

  @Default(false)
  @Column
  isDeleted: boolean;

  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Message)
  @Column
  quotedMsgId: string;

  @BelongsTo(() => Message, "quotedMsgId")
  quotedMsg: Message;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => TicketTraking)
  @Column
  ticketTrakingId: number;

  @BelongsTo(() => TicketTraking, "ticketTrakingId")
  ticketTraking: TicketTraking;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;
  
  @Column
  wid: string;

  @Default(false)
  @Column
  isPrivate: boolean;

  @Default(false)
  @Column
  isEdited: boolean;

  @Default(false)
  @Column
  isForwarded: boolean;

  @Default(false)
  @Column
  transcrito: boolean;
}

export default Message;