import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Campos para transferência
    await queryInterface.addColumn("QueueIntegrations", "enableTransfer", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "transferQueueId", {
      type: DataTypes.INTEGER,
      references: { model: "Queues", key: "id" },
      defaultValue: null,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "transferUserId", {
      type: DataTypes.INTEGER,
      references: { model: "Users", key: "id" },
      defaultValue: null,
      allowNull: true,
    });

    // Campos para fila
    await queryInterface.addColumn("QueueIntegrations", "queueIdAssign", {
      type: DataTypes.INTEGER,
      references: { model: "Queues", key: "id" },
      defaultValue: null,
      allowNull: true,
    });

    // Campos para conexão
    await queryInterface.addColumn("QueueIntegrations", "whatsappId", {
      type: DataTypes.INTEGER,
      references: { model: "Whatsapps", key: "id" },
      defaultValue: null,
      allowNull: true,
    });

    // Campos para usuário
    await queryInterface.addColumn("QueueIntegrations", "userIdAssign", {
      type: DataTypes.INTEGER,
      references: { model: "Users", key: "id" },
      defaultValue: null,
      allowNull: true,
    });

    // Campos para fechar ticket
    await queryInterface.addColumn("QueueIntegrations", "enableCloseTicket", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "closeTicketMessage", {
      type: DataTypes.TEXT,
      defaultValue: null,
      allowNull: true,
    });

    // Campos para abrir ticket
    await queryInterface.addColumn("QueueIntegrations", "enableOpenTicket", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "openTicketQueueId", {
      type: DataTypes.INTEGER,
      references: { model: "Queues", key: "id" },
      defaultValue: null,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "openTicketUserId", {
      type: DataTypes.INTEGER,
      references: { model: "Users", key: "id" },
      defaultValue: null,
      allowNull: true,
    });
    await queryInterface.addColumn("QueueIntegrations", "openTicketMessage", {
      type: DataTypes.TEXT,
      defaultValue: null,
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("QueueIntegrations", "enableTransfer");
    await queryInterface.removeColumn("QueueIntegrations", "transferQueueId");
    await queryInterface.removeColumn("QueueIntegrations", "transferUserId");
    await queryInterface.removeColumn("QueueIntegrations", "queueIdAssign");
    await queryInterface.removeColumn("QueueIntegrations", "whatsappId");
    await queryInterface.removeColumn("QueueIntegrations", "userIdAssign");
    await queryInterface.removeColumn("QueueIntegrations", "enableCloseTicket");
    await queryInterface.removeColumn("QueueIntegrations", "closeTicketMessage");
    await queryInterface.removeColumn("QueueIntegrations", "enableOpenTicket");
    await queryInterface.removeColumn("QueueIntegrations", "openTicketQueueId");
    await queryInterface.removeColumn("QueueIntegrations", "openTicketUserId");
    await queryInterface.removeColumn("QueueIntegrations", "openTicketMessage");
  },
};
