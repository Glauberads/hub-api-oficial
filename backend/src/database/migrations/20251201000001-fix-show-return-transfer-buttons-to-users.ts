import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Remover o campo antigo
    await queryInterface.removeColumn("Users", "showReturnAndTransferButtons");
    
    // Adicionar os dois novos campos
    await queryInterface.addColumn("Users", "showReturnQueueButton", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    
    await queryInterface.addColumn("Users", "showTransferTicketButton", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Remover os novos campos
    await queryInterface.removeColumn("Users", "showReturnQueueButton");
    await queryInterface.removeColumn("Users", "showTransferTicketButton");
    
    // Restaurar o campo antigo
    await queryInterface.addColumn("Users", "showReturnAndTransferButtons", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  }
};

