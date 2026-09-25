import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Whatsapps", "officialOnboardingMode", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "manual"
    });

    await queryInterface.addColumn("Whatsapps", "embeddedSignupStatus", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "none"
    });

    await queryInterface.addColumn("Whatsapps", "embeddedSignupFinishedAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Whatsapps", "webhookSubscribed", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Whatsapps", "webhookSubscribedAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Whatsapps", "webhookLastCheckAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Whatsapps", "officialHealthStatus", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "unknown"
    });

    await queryInterface.addColumn("Whatsapps", "officialHealthDetails", {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ""
    });

    await queryInterface.addColumn("Whatsapps", "tokenOrigin", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "manual"
    });

    await queryInterface.addColumn("Whatsapps", "verified_name", {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ""
    });

    await queryInterface.addColumn("Whatsapps", "metaScopeSnapshot", {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    });

    await queryInterface.addColumn("Whatsapps", "officialLastError", {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ""
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Whatsapps", "officialLastError");
    await queryInterface.removeColumn("Whatsapps", "metaScopeSnapshot");
    await queryInterface.removeColumn("Whatsapps", "verified_name");
    await queryInterface.removeColumn("Whatsapps", "tokenOrigin");
    await queryInterface.removeColumn("Whatsapps", "officialHealthDetails");
    await queryInterface.removeColumn("Whatsapps", "officialHealthStatus");
    await queryInterface.removeColumn("Whatsapps", "webhookLastCheckAt");
    await queryInterface.removeColumn("Whatsapps", "webhookSubscribedAt");
    await queryInterface.removeColumn("Whatsapps", "webhookSubscribed");
    await queryInterface.removeColumn("Whatsapps", "embeddedSignupFinishedAt");
    await queryInterface.removeColumn("Whatsapps", "embeddedSignupStatus");
    await queryInterface.removeColumn("Whatsapps", "officialOnboardingMode");
  }
};