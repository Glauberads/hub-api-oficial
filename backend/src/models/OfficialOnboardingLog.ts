import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Default,
  AllowNull
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

@Table
class OfficialOnboardingLog extends Model<OfficialOnboardingLog> {
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

  @ForeignKey(() => Whatsapp)
  @AllowNull(true)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Default("start")
  @Column(DataType.STRING)
  step: string;

  @AllowNull(false)
  @Default("info")
  @Column(DataType.STRING)
  status: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  message: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  error: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default OfficialOnboardingLog;