import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      INSERT INTO "ContactIdentifiers" (
        "contactId",
        "companyId",
        "channel",
        "provider",
        "identifierType",
        "identifierValue",
        "isPrimary",
        "isReachable",
        "firstSeenAt",
        "lastSeenAt",
        "source",
        "metadata",
        "createdAt",
        "updatedAt"
      )
      SELECT
        c."id" AS "contactId",
        c."companyId" AS "companyId",
        CASE
          WHEN COALESCE(NULLIF(c."channel", ''), 'whatsapp') = 'whatsapp' THEN 'whatsapp_baileys'
          ELSE COALESCE(NULLIF(c."channel", ''), 'whatsapp')
        END AS "channel",
        CASE
          WHEN COALESCE(NULLIF(c."channel", ''), 'whatsapp') IN ('facebook', 'instagram', 'whatsapp_cloud') THEN 'meta'
          WHEN COALESCE(NULLIF(c."channel", ''), 'whatsapp') = 'whatsapp_baileys' THEN 'baileys'
          ELSE 'legacy'
        END AS "provider",
        'phone_e164' AS "identifierType",
        BTRIM(c."number") AS "identifierValue",
        true AS "isPrimary",
        true AS "isReachable",
        COALESCE(c."createdAt", NOW()) AS "firstSeenAt",
        COALESCE(c."updatedAt", NOW()) AS "lastSeenAt",
        'backfill' AS "source",
        jsonb_build_object(
          'origin', 'Contacts.number',
          'migration', '20260408000300-backfill-contact-identifiers-from-contacts'
        ) AS "metadata",
        COALESCE(c."createdAt", NOW()) AS "createdAt",
        COALESCE(c."updatedAt", NOW()) AS "updatedAt"
      FROM "Contacts" c
      WHERE c."number" IS NOT NULL
        AND BTRIM(c."number") <> ''
        AND COALESCE(c."isGroup", false) = false
      ON CONFLICT ("companyId", "channel", "identifierType", "identifierValue")
      DO NOTHING;
    `);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      DELETE FROM "ContactIdentifiers"
      WHERE "source" = 'backfill'
        AND "identifierType" = 'phone_e164'
        AND "metadata"->>'migration' = '20260408000300-backfill-contact-identifiers-from-contacts';
    `);
  }
};