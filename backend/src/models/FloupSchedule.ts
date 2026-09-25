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
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import Floup from "./Floup";
import Ticket from "./Ticket";
import Contact from "./Contact";

@Table
class FloupSchedule extends Model<FloupSchedule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => Company)
  @Column
  companyId!: number;

  @BelongsTo(() => Company)
  company!: Company;

  @ForeignKey(() => Floup)
  @Column
  floupId!: number;

  @BelongsTo(() => Floup)
  floup!: Floup;

  @ForeignKey(() => Ticket)
  @AllowNull(true)
  @Column
  ticketId!: number;

  @BelongsTo(() => Ticket)
  ticket!: Ticket;

  @ForeignKey(() => Contact)
  @AllowNull(true)
  @Column
  contactId!: number;

  @BelongsTo(() => Contact)
  contact!: Contact;

  @Default(0)
  @Column
  currentStepIndex!: number;

  @Column
  nextRunAt!: Date;

  @Default("PENDING")
  @Column
  status!: string;

  @AllowNull(true)
  @Column
  stepOrder!: number;

  @AllowNull(true)
  @Column(DataType.JSON)
  stepData!: any;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}

export default FloupSchedule;


