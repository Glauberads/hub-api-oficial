import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("LandingWebhookLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      configId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "LandingWebhookConfigs",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Contacts",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Tickets",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      payload: {
        type: DataTypes.JSONB,
        allowNull: true
      },

      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },

      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("LandingWebhookLogs", ["companyId"]);
    await queryInterface.addIndex("LandingWebhookLogs", ["configId"]);
    await queryInterface.addIndex("LandingWebhookLogs", ["contactId"]);
    await queryInterface.addIndex("LandingWebhookLogs", ["ticketId"]);
    await queryInterface.addIndex("LandingWebhookLogs", ["status"]);
    await queryInterface.addIndex("LandingWebhookLogs", ["createdAt"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("LandingWebhookLogs");
  }
};