import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("AiSdrSessions", {
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
          model: "AiSdrConfigs",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tickets",
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

      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active"
      },

      currentStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      interactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      leadName: {
        type: DataTypes.STRING,
        allowNull: true
      },

      leadInterest: {
        type: DataTypes.STRING,
        allowNull: true
      },

      leadCity: {
        type: DataTypes.STRING,
        allowNull: true
      },

      leadBudget: {
        type: DataTypes.STRING,
        allowNull: true
      },

      leadTemperature: {
        type: DataTypes.STRING,
        allowNull: true
      },

      leadScore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      leadData: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },

      summary: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      nextAction: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      lastQuestion: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      lastAiResponse: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      finishedAt: {
        type: DataTypes.DATE,
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

    await queryInterface.addIndex("AiSdrSessions", ["companyId"]);
    await queryInterface.addIndex("AiSdrSessions", ["configId"]);
    await queryInterface.addIndex("AiSdrSessions", ["ticketId"]);
    await queryInterface.addIndex("AiSdrSessions", ["contactId"]);
    await queryInterface.addIndex("AiSdrSessions", ["status"]);
    await queryInterface.addIndex("AiSdrSessions", ["companyId", "ticketId"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("AiSdrSessions");
  }
};
