import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("EmailSettings", "continueHour", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "08:00"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("EmailSettings", "continueHour");
  }
};