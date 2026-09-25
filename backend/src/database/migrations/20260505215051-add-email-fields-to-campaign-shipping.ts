import { QueryInterface, DataTypes } from "sequelize";

const tableName = "CampaignShipping";

const addColumnIfNotExists = async (
  queryInterface: QueryInterface,
  columnName: string,
  definition: any
) => {
  const table: any = await queryInterface.describeTable(tableName);

  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await addColumnIfNotExists(queryInterface, "email", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailStatus", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "pending"
    });

    await addColumnIfNotExists(queryInterface, "emailMessageId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailError", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailSentAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailOpenedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailClickedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailBouncedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailUnsubscribedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
  const table: any = await queryInterface.describeTable(tableName);

  if (table.emailUnsubscribedAt) await queryInterface.removeColumn(tableName, "emailUnsubscribedAt");
  if (table.emailBouncedAt) await queryInterface.removeColumn(tableName, "emailBouncedAt");
  if (table.emailClickedAt) await queryInterface.removeColumn(tableName, "emailClickedAt");
  if (table.emailOpenedAt) await queryInterface.removeColumn(tableName, "emailOpenedAt");
  if (table.emailSentAt) await queryInterface.removeColumn(tableName, "emailSentAt");
  if (table.emailError) await queryInterface.removeColumn(tableName, "emailError");
  if (table.emailMessageId) await queryInterface.removeColumn(tableName, "emailMessageId");
  if (table.emailStatus) await queryInterface.removeColumn(tableName, "emailStatus");
  if (table.email) await queryInterface.removeColumn(tableName, "email");
}
};