import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AutoIncrement,
} from "sequelize-typescript";
import { DataTypes } from "sequelize";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "InteractiveMessageTemplates" })
class InteractiveMessageTemplate extends Model<InteractiveMessageTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  interactiveType: string;

  @Column({ type: DataTypes.TEXT })
  templateData: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User)
  user: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InteractiveMessageTemplate;
