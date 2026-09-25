import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    HasMany,
    AutoIncrement,
    BelongsTo,
    ForeignKey,
    Default
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class QueueIntegrations extends Model<QueueIntegrations> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column(DataType.TEXT)
    type: string;

    @Column(DataType.TEXT)
    name: string;
    
    @Column(DataType.TEXT)
    projectName: string;
    
    @Column(DataType.TEXT)
    jsonContent: string;

    @Column(DataType.TEXT)
    urlN8N: string;

    @Column(DataType.TEXT)
    language: string;

    @CreatedAt
    @Column(DataType.DATE(6))
    createdAt: Date;

    @UpdatedAt
    @Column(DataType.DATE(6))
    updatedAt: Date;

    @ForeignKey(() => Company)
    @Column
    companyId: number;
  
    @BelongsTo(() => Company)
    company: Company;
  
    @Column
    typebotSlug: string;

    @Default(0)
    @Column
    typebotExpires: number;

    @Column
    typebotKeywordFinish: string;

    @Column
    typebotUnknownMessage: string;

    @Default(1000)
    @Column
    typebotDelayMessage: number

    @Column
    typebotKeywordRestart: string;

    @Column
    typebotRestartMessage: string;

    // Transferência
    @Default(false)
    @Column
    enableTransfer: boolean;

    @ForeignKey(() => Queue)
    @Column
    transferQueueId: number;

    @ForeignKey(() => User)
    @Column
    transferUserId: number;

    // Fila
    @ForeignKey(() => Queue)
    @Column
    queueIdAssign: number;

    // Conexão
    @ForeignKey(() => Whatsapp)
    @Column
    whatsappId: number;

    @BelongsTo(() => Whatsapp)
    whatsapp: Whatsapp;

    // Usuário
    @ForeignKey(() => User)
    @Column
    userIdAssign: number;

    // Fechar ticket
    @Default(false)
    @Column
    enableCloseTicket: boolean;

    @Column(DataType.TEXT)
    closeTicketMessage: string;

    // Abrir ticket
    @Default(false)
    @Column
    enableOpenTicket: boolean;

    @ForeignKey(() => Queue)
    @Column
    openTicketQueueId: number;

    @ForeignKey(() => User)
    @Column
    openTicketUserId: number;

    @Column(DataType.TEXT)
    openTicketMessage: string;
}

export default QueueIntegrations;