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
import Whatsapp from "./Whatsapp";
import RenewalCustomer from "./RenewalCustomer";
import RenewalProduct from "./RenewalProduct";
import RenewalPayment from "./RenewalPayment";
import RenewalNotification from "./RenewalNotification";

export type RenewalSubscriptionStatus =
  | "active"
  | "overdue"
  | "paused"
  | "canceled";

@Table({ tableName: "RenewalSubscriptions" })
class RenewalSubscription extends Model<RenewalSubscription> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => RenewalCustomer)
  @Column
  customerId: number;

  @BelongsTo(() => RenewalCustomer)
  customer: RenewalCustomer;

  @ForeignKey(() => RenewalProduct)
  @Column
  productId: number;

  @BelongsTo(() => RenewalProduct)
  product: RenewalProduct;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Column(DataType.DATEONLY)
  dueDate: string;

  @Column(DataType.DATE)
  lastPaymentAt: Date;

  @Default("active")
  @Column(
    DataType.ENUM(
      "active",
      "overdue",
      "paused",
      "canceled"
    )
  )
  status: RenewalSubscriptionStatus;

  @Default(true)
  @Column
  active: boolean;

  @HasMany(() => RenewalPayment)
  payments: RenewalPayment[];

  @HasMany(() => RenewalNotification)
  notifications: RenewalNotification[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RenewalSubscription;
