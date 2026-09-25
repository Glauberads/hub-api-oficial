import { QueryInterface, DataTypes, Sequelize } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("ContactIdentifiers", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      channel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "whatsapp_cloud"
      },

      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "meta"
      },

      identifierType: {
        type: DataTypes.STRING,
        allowNull: false
      },

      identifierValue: {
        type: DataTypes.STRING,
        allowNull: false
      },

      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      isReachable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: true
      },

      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true
      },

      source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "webhook"
      },

      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    await queryInterface.addIndex("ContactIdentifiers", ["contactId"], {
      name: "contact_identifiers_contact_id_idx"
    });

    await queryInterface.addIndex("ContactIdentifiers", ["companyId"], {
      name: "contact_identifiers_company_id_idx"
    });

    await queryInterface.addIndex(
      "ContactIdentifiers",
      ["companyId", "channel", "identifierType", "identifierValue"],
      {
        name: "contact_identifiers_company_channel_type_value_unique",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "ContactIdentifiers",
      ["contactId", "identifierType"],
      {
        name: "contact_identifiers_contact_type_idx"
      }
    );

    await queryInterface.addIndex(
      "ContactIdentifiers",
      ["identifierType", "identifierValue"],
      {
        name: "contact_identifiers_type_value_idx"
      }
    );
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("ContactIdentifiers");
  }
};