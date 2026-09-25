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
  ForeignKey
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";
import RenewalSubscription from "./RenewalSubscription";
import RenewalCustomer from "./RenewalCustomer";
import RenewalProduct from "./RenewalProduct";

@Table({ tableName: "RenewalPayments" })
class RenewalPayment extends Model<RenewalPayment> {
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

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column(DataType.DECIMAL(12, 2))
  amount: number;

  @Column(DataType.DATE)
  paidAt: Date;

  @Column(DataType.DATEONLY)
  previousDueDate: string;

  @Column(DataType.DATEONLY)
  nextDueDate: string;

  @Column(DataType.TEXT)
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default RenewalPayment;
