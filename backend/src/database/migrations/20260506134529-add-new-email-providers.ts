import { QueryInterface, DataTypes } from "sequelize";

const tableName = "EmailSettings";

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
    await addColumnIfNotExists(queryInterface, "smtpHost", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "smtpPort", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "smtpUser", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "smtpPass", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "smtpSecure", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await addColumnIfNotExists(queryInterface, "sesAccessKey", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "sesSecretKey", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "sesRegion", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable(tableName);

    if (table.sesRegion) await queryInterface.removeColumn(tableName, "sesRegion");
    if (table.sesSecretKey) await queryInterface.removeColumn(tableName, "sesSecretKey");
    if (table.sesAccessKey) await queryInterface.removeColumn(tableName, "sesAccessKey");
    if (table.smtpSecure) await queryInterface.removeColumn(tableName, "smtpSecure");
    if (table.smtpPass) await queryInterface.removeColumn(tableName, "smtpPass");
    if (table.smtpUser) await queryInterface.removeColumn(tableName, "smtpUser");
    if (table.smtpPort) await queryInterface.removeColumn(tableName, "smtpPort");
    if (table.smtpHost) await queryInterface.removeColumn(tableName, "smtpHost");
  }
};