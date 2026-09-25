import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Contacts");
    
    if (!("lastInteractionClient" in table)) {
      await queryInterface.addColumn("Contacts", "lastInteractionClient", {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Última interação do cliente - para janela de 24h WhatsApp Oficial"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Contacts");
    
    if ("lastInteractionClient" in table) {
      await queryInterface.removeColumn("Contacts", "lastInteractionClient");
    }
  }
};

