import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "allowAiSuggestions", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "disabled"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "allowAiSuggestions");
  }
};