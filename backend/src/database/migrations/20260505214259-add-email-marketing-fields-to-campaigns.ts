"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Campaigns", "campaignType", {
      type: Sequelize.STRING,
      defaultValue: "whatsapp",
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailSubject", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailHtml", {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailFromName", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailFromAddress", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailTotal", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailSent", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailFailed", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailOpened", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailClicked", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailBounced", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailUnsubscribed", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailRatePerMinute", {
      type: Sequelize.INTEGER,
      defaultValue: 5,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "emailProvider", {
      type: Sequelize.STRING,
      defaultValue: "sendgrid",
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "email", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailStatus", {
      type: Sequelize.STRING,
      defaultValue: "pending",
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailMessageId", {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailError", {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailSentAt", {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailOpenedAt", {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailClickedAt", {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailBouncedAt", {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("CampaignShipping", "emailUnsubscribedAt", {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async queryInterface => {
    await queryInterface.removeColumn("CampaignShipping", "emailUnsubscribedAt");
    await queryInterface.removeColumn("CampaignShipping", "emailBouncedAt");
    await queryInterface.removeColumn("CampaignShipping", "emailClickedAt");
    await queryInterface.removeColumn("CampaignShipping", "emailOpenedAt");
    await queryInterface.removeColumn("CampaignShipping", "emailSentAt");
    await queryInterface.removeColumn("CampaignShipping", "emailError");
    await queryInterface.removeColumn("CampaignShipping", "emailMessageId");
    await queryInterface.removeColumn("CampaignShipping", "emailStatus");
    await queryInterface.removeColumn("CampaignShipping", "email");

    await queryInterface.removeColumn("Campaigns", "emailProvider");
    await queryInterface.removeColumn("Campaigns", "emailRatePerMinute");
    await queryInterface.removeColumn("Campaigns", "emailUnsubscribed");
    await queryInterface.removeColumn("Campaigns", "emailBounced");
    await queryInterface.removeColumn("Campaigns", "emailClicked");
    await queryInterface.removeColumn("Campaigns", "emailOpened");
    await queryInterface.removeColumn("Campaigns", "emailFailed");
    await queryInterface.removeColumn("Campaigns", "emailSent");
    await queryInterface.removeColumn("Campaigns", "emailTotal");
    await queryInterface.removeColumn("Campaigns", "emailFromAddress");
    await queryInterface.removeColumn("Campaigns", "emailFromName");
    await queryInterface.removeColumn("Campaigns", "emailHtml");
    await queryInterface.removeColumn("Campaigns", "emailSubject");
    await queryInterface.removeColumn("Campaigns", "campaignType");
  }
};