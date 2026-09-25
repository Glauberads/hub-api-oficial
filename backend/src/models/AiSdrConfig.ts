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
  AllowNull,
  HasMany
} from "sequelize-typescript";

import Company from "./Company";
import Whatsapp from "./Whatsapp";
import Queue from "./Queue";
import User from "./User";
import AiSdrSession from "./AiSdrSession";

@Table
class AiSdrConfig extends Model<AiSdrConfig> {
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

  @AllowNull(false)
  @Default("Agente IA Comercial")
  @Column
  name: string;

  @AllowNull(false)
  @Default(false)
  @Column
  enabled: boolean;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(false)
  @Default("gpt-4o-mini")
  @Column
  model: string;

  @AllowNull(false)
  @Default(0.3)
  @Column(DataType.FLOAT)
  temperature: number;

  @Column(DataType.TEXT)
  systemPrompt: string;

  @Column(DataType.TEXT)
  welcomeMessage: string;

  @Default([])
  @Column(DataType.JSONB)
  qualificationQuestions: any[];

  @Default({})
  @Column(DataType.JSONB)
  handoffRules: any;

  @Default([])
  @Column(DataType.JSONB)
  tags: any[];

  @AllowNull(false)
  @Default(true)
  @Column
  autoCreateOpportunity: boolean;

  @AllowNull(false)
  @Default(true)
  @Column
  autoTransferQueue: boolean;

  @AllowNull(false)
  @Default(true)
  @Column
  onlyPendingTickets: boolean;

  @AllowNull(false)
  @Default(8)
  @Column
  maxInteractions: number;

  @AllowNull(false)
  @Default(true)
  @Column
  isActive: boolean;

  @HasMany(() => AiSdrSession)
  sessions: AiSdrSession[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiSdrConfig;
