import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  CreatedAt,
  Default,
  BelongsTo,
  DataType
} from "sequelize-typescript";

import User from "./User";
import Whatsapp from "./Whatsapp";
import Contact from "./Contact";
import Company from "./Company";

@Table({
  tableName: "CallHistory",
  timestamps: false
})
class CallHistory extends Model<CallHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @Column
  user_id: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Company)
  @Column
  company_id: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token_wavoip: string;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsapp_id: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Contact)
  @Column
  contact_id: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @Column
  phone_to: string;

  @Column
  name: string;

  @Column
  url: string;

  @Column(DataType.STRING)
  direction: string;

  @Column(DataType.STRING)
  status: string;

  @Column(DataType.STRING)
  source: string;

  @Column(DataType.INTEGER)
  duration: number;

  @Column(DataType.STRING)
  call_id: string;

  @Column(DataType.DATE)
  started_at: Date;

  @Column(DataType.DATE)
  ended_at: Date;

  @CreatedAt
  @Default(new Date())
  @Column
  createdAt: Date;

  @CreatedAt
  @Default(new Date())
  @Column
  updatedAt: Date;
}

export default CallHistory;