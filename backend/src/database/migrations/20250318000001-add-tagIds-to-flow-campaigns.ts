import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("FlowCampaigns", "tagIds", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: "JSON array of tag IDs that filter which contacts this campaign applies to"
    });
    console.log("✅ Coluna tagIds adicionada à tabela FlowCampaigns");
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FlowCampaigns", "tagIds");
    console.log("✅ Coluna tagIds removida da tabela FlowCampaigns");
  }
};
