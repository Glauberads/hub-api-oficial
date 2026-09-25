import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Company from "./Company";
import QueueIntegrations from "./QueueIntegrations";
import Prompt from "./Prompt";
import { FlowBuilderModel } from "./FlowBuilder";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  session: string;

  @Column(DataType.TEXT)
  qrcode: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Column
  number: string;

  @Default("")
  @Column(DataType.TEXT)
  greetingMessage: string;

  @Column
  greetingMediaAttachment: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  complationMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  outOfHoursMessage: string;

  @Column({ defaultValue: "stable" })
  provider: string;

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  @Default(false)
  @AllowNull
  @Column
  allowGroup: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token: string;

  @Column(DataType.TEXT)
  facebookUserId: string;

  @Column(DataType.TEXT)
  facebookUserToken: string;

  @Column(DataType.TEXT)
  facebookPageUserId: string;

  @Column(DataType.TEXT)
  tokenMeta: string;

  @Column(DataType.TEXT)
  channel: string;

  @Default(3)
  @Column
  maxUseBotQueues: number;

  @Default(0)
  @Column
  timeUseBotQueues: string;

  @AllowNull(true)
  @Default(0)
  @Column
  expiresTicket: string;

  @Default(0)
  @Column
  timeSendQueue: number;

  @ForeignKey(() => Queue)
  @Column
  sendIdQueue: number;

  @BelongsTo(() => Queue)
  queueSend: Queue;

  @Column
  timeInactiveMessage: string;

  @Column
  inactiveMessage: string;

  @Column
  ratingMessage: string;

  @Column
  maxUseBotQueuesNPS: number;

  @Column
  expiresTicketNPS: number;

  @Column
  whenExpiresTicket: string;

  @Column
  expiresInactiveMessage: string;

  @Default("disabled")
  @Column
  groupAsTicket: string;

  @Column
  importOldMessages: Date;

  @Column
  importRecentMessages: Date;

  @Column
  statusImportMessages: string;

  @Column
  closedTicketsPostImported: boolean;

  @Column
  importOldMessagesGroups: boolean;

  @Column
  timeCreateNewTicket: number;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationTypeId: number;

  @BelongsTo(() => QueueIntegrations)
  integrationType: QueueIntegrations;

  @Column({
    type: DataType.JSONB
  })
  schedules: [];

  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @Column
  collectiveVacationMessage: string;

  @Column
  collectiveVacationStart: string;

  @Column
  collectiveVacationEnd: string;

  @ForeignKey(() => Queue)
  @Column
  queueIdImportMessages: number;

  @BelongsTo(() => Queue)
  queueImport: Queue;

  @Column
  phone_number_id: string;

  @Column
  waba_id: string;

  @Column(DataType.TEXT)
  send_token: string;

  @Column
  business_id: string;

  @Default("")
  @Column(DataType.TEXT)
  meta_app_id: string;

  @Column
  phone_number: string;

  @Column
  waba_webhook: string;

  @Column(DataType.TEXT)
  telegramBotId: string;

  @Column(DataType.TEXT)
  telegramBotUsername: string;

  @Column(DataType.TEXT)
  telegramBotFirstName: string;

  @Column(DataType.TEXT)
  telegramWebhookSecret: string;

  @Column(DataType.TEXT)
  telegramWebhookUrl: string;

  @Column(DataType.TEXT)
  telegramLastError: string;

  @Column
  waba_webhook_id: number;

  @Default("manual")
  @Column
  officialOnboardingMode: string;

  @Default("none")
  @Column
  embeddedSignupStatus: string;

  @Column
  embeddedSignupFinishedAt: Date;

  @Default(false)
  @Column
  webhookSubscribed: boolean;

  @Column
  webhookSubscribedAt: Date;

  @Column
  webhookLastCheckAt: Date;

  @Default("unknown")
  @Column
  officialHealthStatus: string;

  @Default("")
  @Column(DataType.TEXT)
  officialHealthDetails: string;

  @Default("manual")
  @Column
  tokenOrigin: string;

  @Default("")
  @Column(DataType.TEXT)
  verified_name: string;

  @Column({
    type: DataType.JSONB
  })
  metaScopeSnapshot: [];

  @Default("")
  @Column(DataType.TEXT)
  officialLastError: string;

  @Default("")
  @Column
  color: string;

  @Column
  flowInactiveTime: number;

  @Default(1)
  @Column
  maxUseInactiveTime: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdNotPhrase: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdWelcome: number;

  @BelongsTo(() => FlowBuilderModel)
  flowBuilder: FlowBuilderModel;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdInactiveTime: number;

  @Column
  timeToReturnQueue: number;

  @Column
  triggerIntegrationOnClose: boolean;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  timeAwaitActiveFlowId: number;

  @Column
  timeAwaitActiveFlow: number;

  @Column
  wavoip: string;

  @Default(true)
  @Column
  receiveComments: boolean;

  @Default(0)
  @Column
  sentMessages: number;

  @Default(0)
  @Column
  receivedMessages: number;

  @Default(0)
  @Column
  activeTickets: number;

  @Default(0)
  @Column
  dailyLimit: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  importHistory: boolean;

  @Default(30)
  @Column(DataType.INTEGER)
  importDays: number;

  @Default("bot")
  @AllowNull(true)
  @Column(DataType.STRING)
  telegramConnectionType: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  telegramApiId: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  telegramApiHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  telegramPhone: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  telegramSession: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  telegramCodeHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  telegramPersonalUserId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  telegramPersonalUsername: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  telegramPersonalFirstName: string;

}

export default Whatsapp;