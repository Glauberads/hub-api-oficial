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
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import Contact from "./Contact";
import Company from "./Company";

@Table
class ContactIdentifier extends Model<ContactIdentifier> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @AllowNull(false)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Default("whatsapp_cloud")
  @Column
  channel: string;

  @AllowNull(false)
  @Default("meta")
  @Column
  provider: string;

  @AllowNull(false)
  @Column
  identifierType: string;

  @AllowNull(false)
  @Column
  identifierValue: string;

  @Default(false)
  @Column
  isPrimary: boolean;

  @Default(true)
  @Column
  isReachable: boolean;

  @Column
  firstSeenAt: Date;

  @Column
  lastSeenAt: Date;

  @Default("webhook")
  @Column
  source: string;

  @Column(DataType.JSONB)
  metadata: Record<string, any>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactIdentifier;