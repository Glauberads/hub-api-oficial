import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey,
  Default
} from "sequelize-typescript";

import Company from "./Company";
import Whatsapp from "./Whatsapp";
import RenewalSubscription from "./RenewalSubscription";

export type RenewalNotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "canceled"
  | "failed";

@Table({ tableName: "RenewalNotifications" })
class RenewalNotification extends Model<RenewalNotification> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => RenewalSubscription)
  @Column
  subscriptionId: number;

  @BelongsTo(() => RenewalSubscription)
  subscription: RenewalSubscription;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column(DataType.DATEONLY)
  cycleDueDate: string;

  @Column(DataType.INTEGER)
  offsetDays: number;

  @Column(DataType.DATE)
  scheduledAt: Date;

  @Column(DataType.DATE)
  sentAt: Date;

  @Column(DataType.DATE)
  canceledAt: Date;

  @Default(0)
  @Column(DataType.INTEGER)
  attempts: number;

  @Default(3)
  @Column(DataType.INTEGER)
  maxAttempts: number;

  @Column(DataType.DATE)
  lastAttemptAt: Date;

  @Column(DataType.DATE)
  nextAttemptAt: Date;

  @Default("pending")
  @Column(
    DataType.ENUM(
      "pending",
      "processing",
      "sent",
      "canceled",
      "failed"
    )
  )
  status: RenewalNotificationStatus;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.TEXT)
  errorMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RenewalNotification;
