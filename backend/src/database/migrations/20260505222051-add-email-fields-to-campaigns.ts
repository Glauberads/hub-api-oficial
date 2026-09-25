import { QueryInterface, DataTypes } from "sequelize";

const tableName = "Campaigns";

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
    await addColumnIfNotExists(queryInterface, "campaignType", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "whatsapp"
    });

    await addColumnIfNotExists(queryInterface, "emailSubject", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailHtml", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailFromName", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailFromAddress", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await addColumnIfNotExists(queryInterface, "emailTotal", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailSent", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailFailed", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailOpened", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailClicked", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailBounced", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailUnsubscribed", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    await addColumnIfNotExists(queryInterface, "emailRatePerMinute", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5
    });

    await addColumnIfNotExists(queryInterface, "emailProvider", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "sendgrid"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable(tableName);

    if (table.emailProvider) await queryInterface.removeColumn(tableName, "emailProvider");
    if (table.emailRatePerMinute) await queryInterface.removeColumn(tableName, "emailRatePerMinute");
    if (table.emailUnsubscribed) await queryInterface.removeColumn(tableName, "emailUnsubscribed");
    if (table.emailBounced) await queryInterface.removeColumn(tableName, "emailBounced");
    if (table.emailClicked) await queryInterface.removeColumn(tableName, "emailClicked");
    if (table.emailOpened) await queryInterface.removeColumn(tableName, "emailOpened");
    if (table.emailFailed) await queryInterface.removeColumn(tableName, "emailFailed");
    if (table.emailSent) await queryInterface.removeColumn(tableName, "emailSent");
    if (table.emailTotal) await queryInterface.removeColumn(tableName, "emailTotal");
    if (table.emailFromAddress) await queryInterface.removeColumn(tableName, "emailFromAddress");
    if (table.emailFromName) await queryInterface.removeColumn(tableName, "emailFromName");
    if (table.emailHtml) await queryInterface.removeColumn(tableName, "emailHtml");
    if (table.emailSubject) await queryInterface.removeColumn(tableName, "emailSubject");
    if (table.campaignType) await queryInterface.removeColumn(tableName, "campaignType");
  }
};