import { QueryInterface, DataTypes } from "sequelize";

const addColumnSafe = async (
  queryInterface: QueryInterface,
  table: any,
  column: string,
  definition: any
) => {
  if (!table[column]) {
    await queryInterface.addColumn("Whatsapps", column, definition);
  }
};

const removeColumnSafe = async (
  queryInterface: QueryInterface,
  table: any,
  column: string
) => {
  if (table[column]) {
    await queryInterface.removeColumn("Whatsapps", column);
  }
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Whatsapps");

    await addColumnSafe(queryInterface, table, "telegramConnectionType", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "bot"
    });

    await addColumnSafe(queryInterface, table, "telegramApiId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramApiHash", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramPhone", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramSession", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramCodeHash", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramPersonalUserId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramPersonalUsername", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnSafe(queryInterface, table, "telegramPersonalFirstName", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Whatsapps");

    await removeColumnSafe(queryInterface, table, "telegramPersonalFirstName");
    await removeColumnSafe(queryInterface, table, "telegramPersonalUsername");
    await removeColumnSafe(queryInterface, table, "telegramPersonalUserId");
    await removeColumnSafe(queryInterface, table, "telegramCodeHash");
    await removeColumnSafe(queryInterface, table, "telegramSession");
    await removeColumnSafe(queryInterface, table, "telegramPhone");
    await removeColumnSafe(queryInterface, table, "telegramApiHash");
    await removeColumnSafe(queryInterface, table, "telegramApiId");
    await removeColumnSafe(queryInterface, table, "telegramConnectionType");
  }
};
