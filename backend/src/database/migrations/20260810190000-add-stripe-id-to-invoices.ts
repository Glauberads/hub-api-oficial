import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const invoicesTable = (await queryInterface.describeTable("Invoices")) as Record<string, any>;

    if (!invoicesTable.stripe_id) {
      await queryInterface.addColumn("Invoices", "stripe_id", {
        type: DataTypes.STRING(255),
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "invoices_stripe_id_idx"
      ON "Invoices" (stripe_id);
    `);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "invoices_stripe_id_idx";
    `);

    const invoicesTable = (await queryInterface.describeTable("Invoices")) as Record<string, any>;

    if (invoicesTable.stripe_id) {
      await queryInterface.removeColumn("Invoices", "stripe_id");
    }
  }
};
