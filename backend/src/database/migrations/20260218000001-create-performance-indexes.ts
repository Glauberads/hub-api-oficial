import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const addIndexSafe = async (table: string, fields: string[], options: { name: string }) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch (e: any) {
        // Ignora erro se índice já existir
        if (!e.message?.includes("already exists")) {
          throw e;
        }
      }
    };

    // ====================================
    // TICKETS (tabela mais acessada)
    // ====================================
    await addIndexSafe("Tickets", ["companyId", "status"], {
      name: "idx_tick_company_status"
    });

    await addIndexSafe("Tickets", ["companyId", "queueId"], {
      name: "idx_tick_company_queue"
    });

    await addIndexSafe("Tickets", ["companyId", "userId"], {
      name: "idx_tick_company_user"
    });

    await addIndexSafe("Tickets", ["companyId", "whatsappId"], {
      name: "idx_tick_company_whatsapp"
    });

    await addIndexSafe("Tickets", ["whatsappId", "status"], {
      name: "idx_tick_whatsapp_status"
    });

    await addIndexSafe("Tickets", ["updatedAt"], {
      name: "idx_tick_updated_at"
    });

    await addIndexSafe("Tickets", ["status", "companyId", "updatedAt"], {
      name: "idx_tick_status_company_updated"
    });

    // ====================================
    // MESSAGES (maior volume de dados)
    // ====================================
    await addIndexSafe("Messages", ["ticketId", "createdAt"], {
      name: "idx_msg_ticket_created"
    });

    await addIndexSafe("Messages", ["companyId", "createdAt"], {
      name: "idx_msg_company_created"
    });

    await addIndexSafe("Messages", ["fromMe", "ticketId"], {
      name: "idx_msg_fromme_ticket"
    });

    // ====================================
    // CONTACTS
    // ====================================
    await addIndexSafe("Contacts", ["number", "companyId"], {
      name: "idx_cont_number_company"
    });

    await addIndexSafe("Contacts", ["companyId", "active"], {
      name: "idx_cont_company_active"
    });

    await addIndexSafe("Contacts", ["companyId", "isGroup"], {
      name: "idx_cont_company_isgroup"
    });

    // ====================================
    // CONTACT TAGS / TICKET TAGS
    // ====================================
    await addIndexSafe("ContactTags", ["contactId"], {
      name: "idx_contag_contact"
    });

    await addIndexSafe("ContactTags", ["tagId"], {
      name: "idx_contag_tag"
    });

    await addIndexSafe("TicketTags", ["ticketId"], {
      name: "idx_tictag_ticket"
    });

    await addIndexSafe("TicketTags", ["tagId"], {
      name: "idx_tictag_tag"
    });

    // ====================================
    // CAMPAIGNS
    // ====================================
    await addIndexSafe("Campaigns", ["companyId", "status"], {
      name: "idx_camp_company_status"
    });

    await addIndexSafe("Campaigns", ["companyId", "scheduledAt"], {
      name: "idx_camp_company_scheduled"
    });

    await addIndexSafe("CampaignShipping", ["contactId"], {
      name: "idx_campship_contact"
    });

    await addIndexSafe("CampaignShipping", ["jobId"], {
      name: "idx_campship_job"
    });

    // ====================================
    // CONTACT LISTS / ITEMS
    // ====================================
    await addIndexSafe("ContactLists", ["companyId"], {
      name: "idx_contlist_company"
    });

    await addIndexSafe("ContactListItems", ["companyId", "contactListId"], {
      name: "idx_contlisti_company_list"
    });

    // ====================================
    // CONTACT WALLETS
    // ====================================
    await addIndexSafe("ContactWallets", ["walletId", "companyId"], {
      name: "idx_contwallet_wallet_company"
    });

    await addIndexSafe("ContactWallets", ["contactId"], {
      name: "idx_contwallet_contact"
    });

    // ====================================
    // TICKET TRACKING
    // ====================================
    await addIndexSafe("TicketTraking", ["ticketId"], {
      name: "idx_ticktrack_ticket"
    });

    await addIndexSafe("TicketTraking", ["companyId", "createdAt"], {
      name: "idx_ticktrack_company_created"
    });

    // ====================================
    // QUEUES / USERS
    // ====================================
    await addIndexSafe("UserQueues", ["userId"], {
      name: "idx_userqueue_user"
    });

    await addIndexSafe("UserQueues", ["queueId"], {
      name: "idx_userqueue_queue"
    });

    await addIndexSafe("Users", ["companyId", "profile"], {
      name: "idx_user_company_profile"
    });

    // ====================================
    // SCHEDULES
    // ====================================
    await addIndexSafe("Schedules", ["companyId", "status"], {
      name: "idx_sched_company_status"
    });

    await addIndexSafe("Schedules", ["sendAt"], {
      name: "idx_sched_send_at"
    });

    // ====================================
    // WHATSAPPS
    // ====================================
    await addIndexSafe("Whatsapps", ["companyId", "status"], {
      name: "idx_whats_company_status"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const removeIndexSafe = async (table: string, name: string) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (e) {
        // ignora se não existir
      }
    };

    await removeIndexSafe("Tickets", "idx_tick_company_status");
    await removeIndexSafe("Tickets", "idx_tick_company_queue");
    await removeIndexSafe("Tickets", "idx_tick_company_user");
    await removeIndexSafe("Tickets", "idx_tick_company_whatsapp");
    await removeIndexSafe("Tickets", "idx_tick_whatsapp_status");
    await removeIndexSafe("Tickets", "idx_tick_updated_at");
    await removeIndexSafe("Tickets", "idx_tick_status_company_updated");

    await removeIndexSafe("Messages", "idx_msg_ticket_created");
    await removeIndexSafe("Messages", "idx_msg_company_created");
    await removeIndexSafe("Messages", "idx_msg_fromme_ticket");

    await removeIndexSafe("Contacts", "idx_cont_number_company");
    await removeIndexSafe("Contacts", "idx_cont_company_active");
    await removeIndexSafe("Contacts", "idx_cont_company_isgroup");

    await removeIndexSafe("ContactTags", "idx_contag_contact");
    await removeIndexSafe("ContactTags", "idx_contag_tag");

    await removeIndexSafe("TicketTags", "idx_tictag_ticket");
    await removeIndexSafe("TicketTags", "idx_tictag_tag");

    await removeIndexSafe("Campaigns", "idx_camp_company_status");
    await removeIndexSafe("Campaigns", "idx_camp_company_scheduled");

    await removeIndexSafe("CampaignShipping", "idx_campship_contact");
    await removeIndexSafe("CampaignShipping", "idx_campship_job");

    await removeIndexSafe("ContactLists", "idx_contlist_company");
    await removeIndexSafe("ContactListItems", "idx_contlisti_company_list");

    await removeIndexSafe("ContactWallets", "idx_contwallet_wallet_company");
    await removeIndexSafe("ContactWallets", "idx_contwallet_contact");

    await removeIndexSafe("TicketTraking", "idx_ticktrack_ticket");
    await removeIndexSafe("TicketTraking", "idx_ticktrack_company_created");

    await removeIndexSafe("UserQueues", "idx_userqueue_user");
    await removeIndexSafe("UserQueues", "idx_userqueue_queue");

    await removeIndexSafe("Users", "idx_user_company_profile");

    await removeIndexSafe("Schedules", "idx_sched_company_status");
    await removeIndexSafe("Schedules", "idx_sched_send_at");

    await removeIndexSafe("Whatsapps", "idx_whats_company_status");
  }
};
