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
import Whatsapp from "./Whatsapp";
import Queue from "./Queue";
import User from "./User";

@Table
class LandingWebhookConfig extends Model<LandingWebhookConfig> {
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
  @Column
  name: string;

  @AllowNull(false)
  @Column
  token: string;

  @ForeignKey(() => Whatsapp)
  @AllowNull(true)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @AllowNull(true)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(true)
  @Column
  flowId: number;

  @Default([])
  @AllowNull(true)
  @Column(DataType.JSONB)
  tags: any[];

  @AllowNull(true)
  @Column(DataType.TEXT)
  welcomeMessage: string;

  @Default(false)
  @AllowNull(false)
  @Column
  autoSendMessage: boolean;

  @Default(false)
  @AllowNull(false)
  @Column
  autoStartFlow: boolean;

  @Default(true)
  @AllowNull(false)
  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LandingWebhookConfig;