import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("AiSdrConfigs", {
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
        allowNull: false,
        defaultValue: "Agente IA Comercial"
      },

      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

      model: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "gpt-4o-mini"
      },

      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.3
      },

      systemPrompt: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      welcomeMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      qualificationQuestions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },

      handoffRules: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },

      tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },

      autoCreateOpportunity: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      autoTransferQueue: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      onlyPendingTickets: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      maxInteractions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 8
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

    await queryInterface.addIndex("AiSdrConfigs", ["companyId"]);
    await queryInterface.addIndex("AiSdrConfigs", ["companyId", "enabled"]);
    await queryInterface.addIndex("AiSdrConfigs", ["companyId", "isActive"]);
    await queryInterface.addIndex("AiSdrConfigs", ["whatsappId"]);
    await queryInterface.addIndex("AiSdrConfigs", ["queueId"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("AiSdrConfigs");
  }
};
