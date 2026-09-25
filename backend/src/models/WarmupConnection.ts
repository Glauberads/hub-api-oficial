import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table
class WarmupConnection extends Model<WarmupConnection> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  name: string;

  @Column
  number: string;

  @Column
  session: string;

  @Column
  status: string;

  @Column
  warmupGroup: string;

  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WarmupConnection;