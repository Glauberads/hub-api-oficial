import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserWhatsapps", {
      userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: "Whatsapps",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Migrar dados existentes: copiar whatsappId de Users para a tabela pivô
    await queryInterface.sequelize.query(`
      INSERT INTO "UserWhatsapps" ("userId", "whatsappId", "createdAt", "updatedAt")
      SELECT "id", "whatsappId", NOW(), NOW()
      FROM "Users"
      WHERE "whatsappId" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Migração concluída: UserWhatsapps criada e dados migrados');
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("UserWhatsapps");
  }
};
