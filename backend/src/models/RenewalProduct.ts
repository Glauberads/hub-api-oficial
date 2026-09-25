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
  Default,
  HasMany
} from "sequelize-typescript";

import Company from "./Company";
import RenewalSubscription from "./RenewalSubscription";

export type RenewalDueRule = "running_days" | "fixed_day";
export type RenewalFrom = "due_date" | "payment_date";

@Table({ tableName: "RenewalProducts" })
class RenewalProduct extends Model<RenewalProduct> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(255))
  name: string;

  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.DECIMAL(12, 2))
  amount: number;

  @Default("running_days")
  @Column(DataType.ENUM("running_days", "fixed_day"))
  dueRule: RenewalDueRule;

  @Column(DataType.INTEGER)
  runningDays: number;

  @Column(DataType.INTEGER)
  fixedDay: number;

  @Default("due_date")
  @Column(DataType.ENUM("due_date", "payment_date"))
  renewFrom: RenewalFrom;

  @Default("09:00")
  @Column(DataType.STRING)
  reminderTime: string;

  @Default([3, 2, 1, 0, -1])
  @Column(DataType.JSONB)
  reminderDays: number[];

  @Column(DataType.JSONB)
  messageTemplates: Record<string, string>;

  @Default(true)
  @Column
  active: boolean;

  @HasMany(() => RenewalSubscription)
  subscriptions: RenewalSubscription[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RenewalProduct;
