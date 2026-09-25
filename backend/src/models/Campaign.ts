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
  HasMany,
  DataType
} from "sequelize-typescript";
import CampaignShipping from "./CampaignShipping";
import Company from "./Company";
import ContactList from "./ContactList";
import Whatsapp from "./Whatsapp";
import User from "./User";
import Queue from "./Queue";

export type CampaignInteractiveButton = {
  type: "quick_reply" | "cta_url" | "cta_copy" | "cta_call";
  text: string;
  id?: string;
  url?: string;
  copyCode?: string;
  phoneNumber?: string;
};

@Table({ tableName: "Campaigns" })
class Campaign extends Model<Campaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column({ defaultValue: "" })
  message1: string;

  @Column({ defaultValue: "" })
  message2: string;

  @Column({ defaultValue: "" })
  message3: string;

  @Column({ defaultValue: "" })
  message4: string;

  @Column({ defaultValue: "" })
  message5: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: []
  })
  interactiveButtons: CampaignInteractiveButton[];

  @Column({ defaultValue: "" })
  confirmationMessage1: string;

  @Column({ defaultValue: "" })
  confirmationMessage2: string;

  @Column({ defaultValue: "" })
  confirmationMessage3: string;

  @Column({ defaultValue: "" })
  confirmationMessage4: string;

  @Column({ defaultValue: "" })
  confirmationMessage5: string;

  @Column({ defaultValue: "INATIVA" })
  status: string; // INATIVA, PROGRAMADA, EM_ANDAMENTO, CANCELADA, FINALIZADA

  @Column
  confirmation: boolean;

  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @Column
  scheduledAt: Date;

  @Column
  completedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => ContactList)
  @Column
  contactListId: number;

  @BelongsTo(() => ContactList)
  contactList: ContactList;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @HasMany(() => CampaignShipping)
  shipping: CampaignShipping[];

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Column({ defaultValue: "closed" })
  statusTicket: string;

  @Column({ defaultValue: "disabled" })
  openTicket: string;

  @Column({ defaultValue: false })
  isRecurring: boolean;

  @Column
  recurrenceType: string; // 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'

  @Column
  recurrenceInterval: number; // Intervalo personalizado (ex: a cada 2 semanas)

  @Column
  recurrenceDaysOfWeek: string; // JSON array para dias da semana [0,1,2,3,4,5,6]

  @Column
  recurrenceDayOfMonth: number; // Dia específico do mês (1-31)

  @Column
  recurrenceEndDate: Date; // Data limite para recorrência

  @Column
  maxExecutions: number; // Número máximo de execuções

  @Column({ defaultValue: 0 })
  executionCount: number; // Contador de execuções

  @Column
  nextScheduledAt: Date; // Próxima execução programada

  @Column
  lastExecutedAt: Date; // Última execução realizada

  @Column
  tagListId: string; // ID da tag para seleção de contatos

  @Column
  templateId: number; // ID do template para campanhas via API Oficial

  @Column(DataType.TEXT)
  templateVariables: string; // JSON com variáveis preenchidas do template

  @Column({ defaultValue: "whatsapp" })
  campaignType: string; // whatsapp | email

  @Column
  emailSubject: string;

  @Column(DataType.TEXT)
  emailHtml: string;

  @Column(DataType.TEXT)
  emailHtml2: string;

  @Column(DataType.TEXT)
  emailHtml3: string;

  @Column(DataType.TEXT)
  emailHtml4: string;

  @Column(DataType.TEXT)
  emailHtml5: string;

  @Column
  emailFromName: string;

  @Column
  emailFromAddress: string;

  @Column({ defaultValue: 0 })
  emailTotal: number;

  @Column({ defaultValue: 0 })
  emailSent: number;

  @Column({ defaultValue: 0 })
  emailFailed: number;

  @Column({ defaultValue: 0 })
  emailOpened: number;

  @Column({ defaultValue: 0 })
  emailClicked: number;

  @Column({ defaultValue: 0 })
  emailBounced: number;

  @Column({ defaultValue: 0 })
  emailUnsubscribed: number;

  @Column({ defaultValue: 5 })
  emailRatePerMinute: number;

  @Column({ defaultValue: "08:00" })
  emailContinueHour: string;

  @Column({ defaultValue: 99 })
  emailDailyLimit: number;

  @Column({ defaultValue: "sendgrid" })
  emailProvider: string; // sendgrid | ses | smtp
}

export default Campaign;
