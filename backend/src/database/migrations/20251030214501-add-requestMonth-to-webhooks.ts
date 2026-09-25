import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Webhooks");
    
    if (!("requestMonth" in table)) {
      await queryInterface.addColumn("Webhooks", "requestMonth", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Webhooks");
    
    if ("requestMonth" in table) {
      await queryInterface.removeColumn("Webhooks", "requestMonth");
    }
  }
};

