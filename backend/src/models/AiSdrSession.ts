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
import Ticket from "./Ticket";
import Contact from "./Contact";
import Whatsapp from "./Whatsapp";
import AiSdrConfig from "./AiSdrConfig";

@Table
class AiSdrSession extends Model<AiSdrSession> {
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

  @ForeignKey(() => AiSdrConfig)
  @AllowNull(false)
  @Column
  configId: number;

  @BelongsTo(() => AiSdrConfig)
  config: AiSdrConfig;

  @ForeignKey(() => Ticket)
  @AllowNull(false)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Default("active")
  @Column
  status: string;

  @AllowNull(false)
  @Default(0)
  @Column
  currentStep: number;

  @AllowNull(false)
  @Default(0)
  @Column
  interactions: number;

  @Column
  leadName: string;

  @Column
  leadInterest: string;

  @Column
  leadCity: string;

  @Column
  leadBudget: string;

  @Column
  leadTemperature: string;

  @AllowNull(false)
  @Default(0)
  @Column
  leadScore: number;

  @Default({})
  @Column(DataType.JSONB)
  leadData: any;

  @Column(DataType.TEXT)
  summary: string;

  @Column(DataType.TEXT)
  nextAction: string;

  @Column(DataType.TEXT)
  lastQuestion: string;

  @Column(DataType.TEXT)
  lastAiResponse: string;

  @Column
  finishedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiSdrSession;
