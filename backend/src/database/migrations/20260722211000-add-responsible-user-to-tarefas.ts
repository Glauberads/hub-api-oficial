import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Tarefas", "responsibleUserId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.sequelize.query(
      'UPDATE "Tarefas" SET "responsibleUserId" = "userId" WHERE "responsibleUserId" IS NULL;'
    );
    await queryInterface.addIndex("Tarefas", ["companyId", "responsibleUserId"], {
      name: "idx_tarefas_company_responsible_user"
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeIndex("Tarefas", "idx_tarefas_company_responsible_user");
    await queryInterface.removeColumn("Tarefas", "responsibleUserId");
  }
};
