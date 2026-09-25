import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import FloupSchedule from "./FloupSchedule";

@Table
class Floup extends Model<Floup> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Column
  companyId!: number;

  @BelongsTo(() => Company)
  company!: Company;

  @Column
  name!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description!: string;

  @Default(true)
  @Column
  isActive!: boolean;

  @Column(DataType.JSON)
  steps!: any[];

  @Column(DataType.JSON)
  stopConditions!: any[];

  @Column(DataType.JSON)
  pauseConditions!: any[];

  @AllowNull(true)
  @Column
  templateType!: string;

  @AllowNull(true)
  @Column({ allowNull: true, defaultValue: null })
  condition?: string | null;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, allowNull: true, defaultValue: null })
  conditionValue?: string | null;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @HasMany(() => FloupSchedule)
  schedules!: FloupSchedule[];
}

export default Floup;


