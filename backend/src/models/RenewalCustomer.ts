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

@Table({ tableName: "RenewalCustomers" })
class RenewalCustomer extends Model<RenewalCustomer> {
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

  @Column(DataType.STRING(50))
  phone: string;

  @Column(DataType.TEXT)
  notes: string;

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

export default RenewalCustomer;
