import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Step 1: Add temporary columns with VARCHAR type
    await queryInterface.addColumn("Users", "showReturnQueueButton_temp", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "enabled"
    });

    await queryInterface.addColumn("Users", "showTransferTicketButton_temp", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "enabled"
    });

    // Step 2: Migrate data from boolean to string
    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "showReturnQueueButton_temp" = CASE 
        WHEN "showReturnQueueButton" = true THEN 'enabled'
        WHEN "showReturnQueueButton" = false THEN 'disabled'
        ELSE 'enabled'
      END
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "showTransferTicketButton_temp" = CASE 
        WHEN "showTransferTicketButton" = true THEN 'enabled'
        WHEN "showTransferTicketButton" = false THEN 'disabled'
        ELSE 'enabled'
      END
    `);

    // Step 3: Drop old boolean columns
    await queryInterface.removeColumn("Users", "showReturnQueueButton");
    await queryInterface.removeColumn("Users", "showTransferTicketButton");

    // Step 4: Rename temp columns to final names
    await queryInterface.renameColumn("Users", "showReturnQueueButton_temp", "showReturnQueueButton");
    await queryInterface.renameColumn("Users", "showTransferTicketButton_temp", "showTransferTicketButton");
  },

  down: async (queryInterface: QueryInterface) => {
    // Rollback: Convert back to boolean

    // Step 1: Add temporary boolean columns
    await queryInterface.addColumn("Users", "showReturnQueueButton_temp", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn("Users", "showTransferTicketButton_temp", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    // Step 2: Migrate data from string to boolean
    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "showReturnQueueButton_temp" = CASE 
        WHEN "showReturnQueueButton" = 'enabled' THEN true
        WHEN "showReturnQueueButton" = 'disabled' THEN false
        ELSE true
      END
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "showTransferTicketButton_temp" = CASE 
        WHEN "showTransferTicketButton" = 'enabled' THEN true
        WHEN "showTransferTicketButton" = 'disabled' THEN false
        ELSE true
      END
    `);

    // Step 3: Drop string columns
    await queryInterface.removeColumn("Users", "showReturnQueueButton");
    await queryInterface.removeColumn("Users", "showTransferTicketButton");

    // Step 4: Rename temp columns to final names
    await queryInterface.renameColumn("Users", "showReturnQueueButton_temp", "showReturnQueueButton");
    await queryInterface.renameColumn("Users", "showTransferTicketButton_temp", "showTransferTicketButton");
  }
};
