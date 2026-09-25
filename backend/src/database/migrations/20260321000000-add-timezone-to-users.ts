import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "timezone", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "America/Sao_Paulo"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "timezone");
  }
};