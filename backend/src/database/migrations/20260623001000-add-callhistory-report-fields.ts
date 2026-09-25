import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "CallHistory"
      ADD COLUMN IF NOT EXISTS "direction" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "source" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "duration" INTEGER,
      ADD COLUMN IF NOT EXISTS "call_id" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "CallHistory"
      ALTER COLUMN "direction" SET DEFAULT 'outgoing',
      ALTER COLUMN "status" SET DEFAULT 'created',
      ALTER COLUMN "source" SET DEFAULT 'wavoip-widget',
      ALTER COLUMN "duration" SET DEFAULT 0;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "CallHistory"
      SET
        "direction" = COALESCE("direction", 'outgoing'),
        "status" = COALESCE("status", 'opened'),
        "source" = COALESCE("source", 'legacy_wavoip_url'),
        "duration" = COALESCE("duration", 0),
        "started_at" = COALESCE("started_at", "createdAt")
      WHERE "direction" IS NULL
         OR "status" IS NULL
         OR "source" IS NULL
         OR "duration" IS NULL
         OR "started_at" IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_callhistory_company_createdat"
      ON "CallHistory" ("company_id", "createdAt");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_callhistory_direction"
      ON "CallHistory" ("direction");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_callhistory_status"
      ON "CallHistory" ("status");
    `);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "idx_callhistory_status";
      DROP INDEX IF EXISTS "idx_callhistory_direction";
      DROP INDEX IF EXISTS "idx_callhistory_company_createdat";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "CallHistory"
      DROP COLUMN IF EXISTS "ended_at",
      DROP COLUMN IF EXISTS "started_at",
      DROP COLUMN IF EXISTS "call_id",
      DROP COLUMN IF EXISTS "duration",
      DROP COLUMN IF EXISTS "source",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "direction";
    `);
  }
};