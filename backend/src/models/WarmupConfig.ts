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
class WarmupConfig extends Model<WarmupConfig> {
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
  minDelay: number;

  @Column
  maxDelay: number;

  @Column
  messagesPerCycle: number;

  @Column
  prompt: string;

  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WarmupConfig;