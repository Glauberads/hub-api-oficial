import {
  Table, Column, CreatedAt, UpdatedAt, Model, PrimaryKey, AutoIncrement,
  DataType, BelongsTo, ForeignKey, Default
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

export type TarefaPrioridade = "baixa" | "media" | "alta" | "urgente";
export type TarefaStatus = "aguardando" | "andamento" | "completa" | "recusada";

@Table({ tableName: "Tarefas" })
class Tarefa extends Model<Tarefa> {
  @PrimaryKey @AutoIncrement @Column id: number;

  @ForeignKey(() => Company) @Column companyId: number;
  @BelongsTo(() => Company) company: Company;

  @ForeignKey(() => User) @Column userId: number;
  @BelongsTo(() => User, "userId") user: User;

  @ForeignKey(() => User) @Column responsibleUserId: number;
  @BelongsTo(() => User, "responsibleUserId") responsibleUser: User;

  @Column(DataType.STRING(255)) nome: string;
  @Column(DataType.TEXT) descricao: string;
  @Column(DataType.DATEONLY) dataLimite: string;

  @Default("media")
  @Column(DataType.ENUM("baixa", "media", "alta", "urgente"))
  prioridade: TarefaPrioridade;

  @Default("aguardando")
  @Column(DataType.ENUM("aguardando", "andamento", "completa", "recusada"))
  status: TarefaStatus;

  @Column(DataType.TEXT) comentarios: string;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}

export default Tarefa;
