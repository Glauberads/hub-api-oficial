import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ContactListItems", "username", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ""
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("ContactListItems", "username");
  }
};