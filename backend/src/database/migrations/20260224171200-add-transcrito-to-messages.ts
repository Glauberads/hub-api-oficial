import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Messages", "transcrito", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Messages", "transcrito");
  }
};
