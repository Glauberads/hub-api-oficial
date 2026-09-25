import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Messages", "remoteIdentifierType", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Messages", "remoteIdentifierValue", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Messages", "remoteUsername", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Messages", "remoteWaId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Messages", "remotePhone", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("Messages", "rawMetaPayload", {
      type: DataTypes.JSONB,
      allowNull: true
    });

    await queryInterface.addIndex(
      "Messages",
      ["remoteIdentifierType", "remoteIdentifierValue"],
      {
        name: "messages_remote_identifier_type_value_idx"
      }
    );

    await queryInterface.addIndex("Messages", ["remoteWaId"], {
      name: "messages_remote_wa_id_idx"
    });

    await queryInterface.addIndex("Messages", ["remotePhone"], {
      name: "messages_remote_phone_idx"
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeIndex(
      "Messages",
      "messages_remote_phone_idx"
    );

    await queryInterface.removeIndex(
      "Messages",
      "messages_remote_wa_id_idx"
    );

    await queryInterface.removeIndex(
      "Messages",
      "messages_remote_identifier_type_value_idx"
    );

    await queryInterface.removeColumn("Messages", "rawMetaPayload");
    await queryInterface.removeColumn("Messages", "remotePhone");
    await queryInterface.removeColumn("Messages", "remoteWaId");
    await queryInterface.removeColumn("Messages", "remoteUsername");
    await queryInterface.removeColumn("Messages", "remoteIdentifierValue");
    await queryInterface.removeColumn("Messages", "remoteIdentifierType");
  }
};