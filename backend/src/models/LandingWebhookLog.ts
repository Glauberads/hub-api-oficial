import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  AllowNull
} from "sequelize-typescript";

import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import LandingWebhookConfig from "./LandingWebhookConfig";

@Table
class LandingWebhookLog extends Model<LandingWebhookLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => LandingWebhookConfig)
  @AllowNull(false)
  @Column
  configId: number;

  @BelongsTo(() => LandingWebhookConfig)
  config: LandingWebhookConfig;

  @ForeignKey(() => Contact)
  @AllowNull(true)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Ticket)
  @AllowNull(true)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload: any;

  @Default("pending")
  @AllowNull(false)
  @Column
  status: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LandingWebhookLog;