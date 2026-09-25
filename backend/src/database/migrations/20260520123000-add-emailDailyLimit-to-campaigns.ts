"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Campaigns", "emailDailyLimit", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 99
    });
  },

  down: async queryInterface => {
    await queryInterface.removeColumn("Campaigns", "emailDailyLimit");
  }
};