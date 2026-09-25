import { QueryInterface } from "sequelize";

/**
 * Migration resiliente: cada índice é criado via SQL raw com IF NOT EXISTS
 * e envolvido em try/catch individual. Tabelas ou colunas inexistentes
 * são silenciosamente ignoradas em vez de abortar toda a migration.
 */

const INDEXES: Array<{ table: string; columns: string[]; name: string }> = [
  // Tickets
  { table: "Tickets", columns: ["companyId", "userId", "status"], name: "idx_tickets_company_user_status" },
  { table: "Tickets", columns: ["companyId", "queueId", "status", "userId"], name: "idx_tickets_company_queue_status_user" },
  { table: "Tickets", columns: ["companyId", "whatsappId", "status"], name: "idx_tickets_company_whatsapp_status" },
  { table: "Tickets", columns: ["companyId", "status", "updatedAt"], name: "idx_tickets_company_status_updated" },
  { table: "Tickets", columns: ["companyId", "isGroup"], name: "idx_tickets_company_is_group" },
  { table: "Tickets", columns: ["companyId", "status", "queueId", "isGroup"], name: "idx_tickets_company_status_queue_group" },
  { table: "Tickets", columns: ["companyId", "status", "unreadMessages"], name: "idx_tickets_company_status_unread" },
  { table: "Tickets", columns: ["companyId", "status", "userId", "queueId"], name: "idx_tickets_kanban_lookup" },
  // Messages
  { table: "Messages", columns: ["ticketId", "companyId"], name: "idx_messages_ticket_company" },
  { table: "Messages", columns: ["wid", "companyId"], name: "idx_messages_wid_company" },
  { table: "Messages", columns: ["companyId", "createdAt"], name: "idx_messages_company_created" },
  { table: "Messages", columns: ["ticketId", "fromMe", "isDeleted"], name: "idx_messages_ticket_from_deleted" },
  // Contacts
  { table: "Contacts", columns: ["number", "companyId"], name: "idx_contacts_number_company" },
  { table: "Contacts", columns: ["companyId", "name"], name: "idx_contacts_company_name" },
  { table: "Contacts", columns: ["companyId", "email"], name: "idx_contacts_company_email" },
  { table: "Contacts", columns: ["remoteJid", "companyId"], name: "idx_contacts_remotejid_company" },
  // TicketTraking
  { table: "TicketTraking", columns: ["ticketId"], name: "idx_ticket_traking_ticket_id" },
  { table: "TicketTraking", columns: ["companyId"], name: "idx_ticket_traking_company_id" },
  { table: "TicketTraking", columns: ["userId"], name: "idx_ticket_traking_user_id" },
  { table: "TicketTraking", columns: ["companyId", "finishedAt"], name: "idx_ticket_traking_company_finished" },
  { table: "TicketTraking", columns: ["companyId", "createdAt"], name: "idx_ticket_traking_company_created" },
  { table: "TicketTraking", columns: ["whatsappId"], name: "idx_ticket_traking_whatsapp_id" },
  // LogTickets
  { table: "LogTickets", columns: ["ticketId"], name: "idx_log_tickets_ticket_id" },
  { table: "LogTickets", columns: ["userId"], name: "idx_log_tickets_user_id" },
  // ContactTags
  { table: "ContactTags", columns: ["contactId"], name: "idx_contact_tags_contact_id" },
  { table: "ContactTags", columns: ["tagId"], name: "idx_contact_tags_tag_id" },
  { table: "ContactTags", columns: ["contactId", "tagId"], name: "idx_contact_tags_contact_tag" },
  // TicketTags
  { table: "TicketTags", columns: ["ticketId"], name: "idx_ticket_tags_ticket_id" },
  { table: "TicketTags", columns: ["tagId"], name: "idx_ticket_tags_tag_id" },
  { table: "TicketTags", columns: ["ticketId", "tagId"], name: "idx_ticket_tags_ticket_tag" },
  // UserRatings
  { table: "UserRatings", columns: ["ticketId"], name: "idx_user_ratings_ticket_id" },
  { table: "UserRatings", columns: ["companyId"], name: "idx_user_ratings_company_id" },
  { table: "UserRatings", columns: ["userId"], name: "idx_user_ratings_user_id" },
  // CompaniesSettings
  { table: "CompaniesSettings", columns: ["companyId"], name: "idx_companies_settings_company_id" },
  // Tags
  { table: "Tags", columns: ["companyId"], name: "idx_tags_company_id" },
  { table: "Tags", columns: ["companyId", "kanban"], name: "idx_tags_company_kanban" },
  // Queues
  { table: "Queues", columns: ["companyId"], name: "idx_queues_company_id" },
  // Users
  { table: "Users", columns: ["companyId"], name: "idx_users_company_id" },
  { table: "Users", columns: ["companyId", "profile"], name: "idx_users_company_profile" },
  { table: "Users", columns: ["email"], name: "idx_users_email" },
  { table: "Users", columns: ["whatsappId"], name: "idx_users_whatsapp_id" },
  // Whatsapps
  { table: "Whatsapps", columns: ["companyId"], name: "idx_whatsapps_company_id" },
  { table: "Whatsapps", columns: ["companyId", "status"], name: "idx_whatsapps_company_status" },
  { table: "Whatsapps", columns: ["companyId", "isDefault"], name: "idx_whatsapps_company_default" },
  { table: "Whatsapps", columns: ["channel"], name: "idx_whatsapps_channel" },
  // CampaignShipping
  { table: "CampaignShipping", columns: ["campaignId"], name: "idx_campaign_shipping_campaign_id" },
  { table: "CampaignShipping", columns: ["contactId"], name: "idx_campaign_shipping_contact_id" },
  { table: "CampaignShipping", columns: ["campaignId", "deliveredAt"], name: "idx_campaign_shipping_campaign_delivered" },
  { table: "CampaignShipping", columns: ["campaignId", "confirmationRequestedAt"], name: "idx_campaign_shipping_campaign_confirm" },
  // ContactCustomFields
  { table: "ContactCustomFields", columns: ["contactId"], name: "idx_contact_custom_fields_contact_id_v2" },
  { table: "ContactCustomFields", columns: ["name", "value"], name: "idx_contact_custom_fields_name_value" },
  // Floups
  { table: "Floups", columns: ["companyId"], name: "idx_floups_company_id" },
  { table: "FloupSchedules", columns: ["floupId"], name: "idx_floup_schedules_floup_id" },
  { table: "FloupSchedules", columns: ["status"], name: "idx_floup_schedules_status" },
  // InteractiveMessageTemplates
  { table: "InteractiveMessageTemplates", columns: ["companyId"], name: "idx_interactive_msg_templates_company_id" },
  // ScheduledMessages (colunas podem não existir em todos os ambientes)
  { table: "ScheduledMessages", columns: ["companyId"], name: "idx_scheduled_messages_company_id" },
  { table: "ScheduledMessagesEnvios", columns: ["companyId"], name: "idx_scheduled_messages_envios_company_id" },
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Iniciando criação de índices de performance v2...\n");

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const { table, columns, name } of INDEXES) {
      const cols = columns.map(c => `"${c}"`).join(", ");
      const sql = `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols})`;
      try {
        await (queryInterface as any).sequelize.query(sql);
        created++;
        console.log(`✓ ${name} ok em ${table}`);
      } catch (err: any) {
        failed++;
        console.log(`⚠ ${name} ignorado em ${table}: ${err.parent?.message || err.message}`);
      }
    }

    console.log(`\n🎯 Concluído! criados/existentes: ${created}, ignorados: ${failed}, total: ${INDEXES.length}`);
  },

  down: async (queryInterface: QueryInterface) => {
    for (const { table, name } of INDEXES) {
      try {
        await (queryInterface as any).sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
        console.log(`✓ ${name} removido`);
      } catch (e) {
        console.log(`- ${name} não encontrado`);
      }
    }
  }
};
