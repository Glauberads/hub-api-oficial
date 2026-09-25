import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addIndex("Tickets", ["contactId", "companyId", "status"], {
        name: "tickets_contact_company_status_idx"
      }),
      queryInterface.addIndex("Tickets", ["contactId", "companyId", "whatsappId", "status"], {
        name: "tickets_contact_company_whatsapp_status_idx"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeIndex("Tickets", "tickets_contact_company_status_idx"),
      queryInterface.removeIndex("Tickets", "tickets_contact_company_whatsapp_status_idx")
    ]);
  }
};
