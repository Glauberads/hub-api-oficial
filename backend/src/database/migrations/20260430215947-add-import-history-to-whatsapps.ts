import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Whatsapps", "importHistory", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Whatsapps", "importDays", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Whatsapps", "importHistory");
    await queryInterface.removeColumn("Whatsapps", "importDays");
  }
};