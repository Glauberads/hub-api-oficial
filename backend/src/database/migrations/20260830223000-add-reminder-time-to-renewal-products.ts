import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (
    queryInterface: QueryInterface
  ): Promise<void> => {
    await queryInterface.addColumn(
      "RenewalProducts",
      "reminderTime",
      {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "09:00"
      }
    );
  },

  down: async (
    queryInterface: QueryInterface
  ): Promise<void> => {
    await queryInterface.removeColumn(
      "RenewalProducts",
      "reminderTime"
    );
  }
};
