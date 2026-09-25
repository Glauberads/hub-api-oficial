import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Plans", "currency", {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL"
    });

    await queryInterface.addColumn("Invoices", "currency", {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL"
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Invoices", "currency");
    await queryInterface.removeColumn("Plans", "currency");
  }
};
