import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("CompaniesSettings");
    
    if (!("transferredTicketStatus" in table)) {
      await queryInterface.addColumn("CompaniesSettings", "transferredTicketStatus", {
        type: DataTypes.STRING,
        defaultValue: "open",
        allowNull: false,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("CompaniesSettings");
    
    if ("transferredTicketStatus" in table) {
      await queryInterface.removeColumn("CompaniesSettings", "transferredTicketStatus");
    }
  }
};

