import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("OfficialOnboardingLogs", {
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

      step: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "start"
      },

      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "info"
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      },

      error: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      },

      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null
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
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("OfficialOnboardingLogs");
  }
};