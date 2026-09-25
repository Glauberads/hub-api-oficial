import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = (await queryInterface.describeTable("Whatsapps")) as Record<string, any>;

    if (!table["telegramBotId"]) {
      await queryInterface.addColumn("Whatsapps", "telegramBotId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!table["telegramBotUsername"]) {
      await queryInterface.addColumn("Whatsapps", "telegramBotUsername", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!table["telegramBotFirstName"]) {
      await queryInterface.addColumn("Whatsapps", "telegramBotFirstName", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!table["telegramWebhookSecret"]) {
      await queryInterface.addColumn("Whatsapps", "telegramWebhookSecret", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!table["telegramWebhookUrl"]) {
      await queryInterface.addColumn("Whatsapps", "telegramWebhookUrl", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!table["telegramLastError"]) {
      await queryInterface.addColumn("Whatsapps", "telegramLastError", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = (await queryInterface.describeTable("Whatsapps")) as Record<string, any>;

    if (table["telegramLastError"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramLastError");
    }

    if (table["telegramWebhookUrl"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramWebhookUrl");
    }

    if (table["telegramWebhookSecret"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramWebhookSecret");
    }

    if (table["telegramBotFirstName"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramBotFirstName");
    }

    if (table["telegramBotUsername"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramBotUsername");
    }

    if (table["telegramBotId"]) {
      await queryInterface.removeColumn("Whatsapps", "telegramBotId");
    }
  }
};
