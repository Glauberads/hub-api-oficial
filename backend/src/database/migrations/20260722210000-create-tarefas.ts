import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("Tarefas", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      nome: { type: DataTypes.STRING(255), allowNull: false },
      descricao: { type: DataTypes.TEXT, allowNull: true },
      dataLimite: { type: DataTypes.DATEONLY, allowNull: true },
      prioridade: {
        type: DataTypes.ENUM("baixa", "media", "alta", "urgente"),
        allowNull: false,
        defaultValue: "media"
      },
      status: {
        type: DataTypes.ENUM("aguardando", "andamento", "completa", "recusada"),
        allowNull: false,
        defaultValue: "aguardando"
      },
      comentarios: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("Tarefas", ["companyId"], { name: "idx_tarefas_company_id" });
    await queryInterface.addIndex("Tarefas", ["status"], { name: "idx_tarefas_status" });
    await queryInterface.addIndex("Tarefas", ["companyId", "status"], { name: "idx_tarefas_company_status" });
    await queryInterface.addIndex("Tarefas", ["companyId", "dataLimite"], { name: "idx_tarefas_company_data_limite" });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("Tarefas");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tarefas_prioridade";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tarefas_status";');
  }
};
