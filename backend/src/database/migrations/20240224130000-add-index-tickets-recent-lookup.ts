import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addIndex("Tickets", ["contactId", "companyId", "updatedAt"], {
      name: "tickets_contact_company_updatedat_idx"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeIndex("Tickets", "tickets_contact_company_updatedat_idx");
  }
};
