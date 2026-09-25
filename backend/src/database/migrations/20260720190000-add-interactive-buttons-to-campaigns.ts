import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Campaigns", "interactiveButtons", {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Campaigns", "interactiveButtons");
  }
};
