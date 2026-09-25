import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("EmailSettings", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "sendgrid"
      },

      sendgridApiKey: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      fromAddress: {
        type: DataTypes.STRING,
        allowNull: true
      },

      fromName: {
        type: DataTypes.STRING,
        allowNull: true
      },

      dailyLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 200
      },

      ratePerMinute: {
        type: DataTypes.INTEGER,
        defaultValue: 5
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("EmailSettings");
  }
};