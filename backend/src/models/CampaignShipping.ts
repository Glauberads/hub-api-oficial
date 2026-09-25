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
import Campaign from "./Campaign";
import ContactListItem from "./ContactListItem";

@Table({ tableName: "CampaignShipping" })
class CampaignShipping extends Model<CampaignShipping> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  jobId: string;

  @Column
  number: string;

  @Column(DataType.TEXT)
  message: string;

  @Column(DataType.TEXT)
  confirmationMessage: string;

  @Column
  confirmation: boolean;

  @ForeignKey(() => ContactListItem)
  @Column
  contactId: number;

  @ForeignKey(() => Campaign)
  @Column
  campaignId: number;

  @Column
  confirmationRequestedAt: Date;

  @Column
  confirmedAt: Date;

  @Column
  deliveredAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => ContactListItem)
  contact: ContactListItem;

  @BelongsTo(() => Campaign)
  campaign: Campaign;

  // =========================
  // EMAIL FIELDS
  // =========================

  @Column
  email: string;

  @Column({
    defaultValue: "pending"
  })
  emailStatus: string; // pending | sent | failed | opened | clicked | bounced | unsubscribed

  @Column
  emailMessageId: string; // id do provedor (SendGrid / SES)

  @Column(DataType.TEXT)
  emailError: string;

  @Column
  emailSentAt: Date;

  @Column
  emailOpenedAt: Date;

  @Column
  emailClickedAt: Date;

  @Column
  emailBouncedAt: Date;

  @Column
  emailUnsubscribedAt: Date;
}

export default CampaignShipping;