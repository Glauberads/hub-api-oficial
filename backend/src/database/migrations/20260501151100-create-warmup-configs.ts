import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("WarmupConfigs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      minDelay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30000
      },
      maxDelay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 120000
      },
      messagesPerCycle: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      prompt: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

    await queryInterface.bulkInsert("WarmupConfigs", [
      {
        minDelay: 30000,
        maxDelay: 120000,
        messagesPerCycle: 1,
        prompt: "",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("WarmupConfigs");
  }
};