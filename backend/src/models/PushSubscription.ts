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
  DataType
} from "sequelize-typescript";
import User from "./User";
import Company from "./Company";

@Table({ tableName: "PushSubscriptions" })
class PushSubscription extends Model<PushSubscription> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column(DataType.TEXT)
  endpoint: string;

  @Column(DataType.TEXT)
  p256dh: string;

  @Column(DataType.TEXT)
  auth: string;

  @Column
  userAgent: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;
}

export default PushSubscription;
