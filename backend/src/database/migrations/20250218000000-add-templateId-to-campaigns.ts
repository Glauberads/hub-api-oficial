import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Campaigns", "templateId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "QuickMessages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "templateId");
  }
};
