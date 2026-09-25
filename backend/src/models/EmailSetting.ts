import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

@Table({ tableName: "EmailSettings" })
class EmailSetting extends Model<EmailSetting> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "sendgrid" })
  provider: string; // sendgrid | smtp

  @Column
  sendgridApiKey: string;

  @Column
  fromAddress: string;

  @Column
  fromName: string;

  @Column({ defaultValue: 200 })
  dailyLimit: number;

  @Column({ defaultValue: 5 })
  ratePerMinute: number;

  @Column({ defaultValue: "08:00" })
  continueHour: string;

  @Column({ defaultValue: false })
  isActive: boolean;

  @Column
  smtpHost: string;

  @Column
  smtpPort: number;

  @Column
  smtpUser: string;

  @Column
  smtpPass: string;

  @Column({ defaultValue: false })
  smtpSecure: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default EmailSetting;