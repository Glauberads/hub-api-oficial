import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("LandingWebhookConfigs", {
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

      name: {
        type: DataTypes.STRING,
        allowNull: false
      },

      token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },

      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Whatsapps",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      queueId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Queues",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      flowId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },

      welcomeMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      autoSendMessage: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      autoStartFlow: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex("LandingWebhookConfigs", ["companyId"]);
    await queryInterface.addIndex("LandingWebhookConfigs", ["token"]);
    await queryInterface.addIndex("LandingWebhookConfigs", ["companyId", "isActive"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("LandingWebhookConfigs");
  }
};