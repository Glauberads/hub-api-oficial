import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues"
      DROP CONSTRAINT IF EXISTS "Queues_color_key";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "Queues"
      DROP CONSTRAINT IF EXISTS "Queues_name_key";
    `);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addConstraint("Queues", ["color"], {
      name: "Queues_color_key",
      type: "unique"
    });

    await queryInterface.addConstraint("Queues", ["name"], {
      name: "Queues_name_key",
      type: "unique"
    });
  }
};