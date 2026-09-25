import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Campaigns", "emailContinueHour", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "08:00"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "emailContinueHour");
  }
};