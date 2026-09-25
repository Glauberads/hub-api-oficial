module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Campaigns", "emailHtml2", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Campaigns", "emailHtml3", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Campaigns", "emailHtml4", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Campaigns", "emailHtml5", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Campaigns", "emailHtml2");
    await queryInterface.removeColumn("Campaigns", "emailHtml3");
    await queryInterface.removeColumn("Campaigns", "emailHtml4");
    await queryInterface.removeColumn("Campaigns", "emailHtml5");
  },
};