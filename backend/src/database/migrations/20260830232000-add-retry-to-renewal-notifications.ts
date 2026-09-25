import {
  QueryInterface,
  DataTypes
} from "sequelize";

module.exports = {
  up: async (
    queryInterface: QueryInterface
  ): Promise<void> => {
    await queryInterface.addColumn(
      "RenewalNotifications",
      "attempts",
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    );

    await queryInterface.addColumn(
      "RenewalNotifications",
      "maxAttempts",
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3
      }
    );

    await queryInterface.addColumn(
      "RenewalNotifications",
      "lastAttemptAt",
      {
        type: DataTypes.DATE,
        allowNull: true
      }
    );

    await queryInterface.addColumn(
      "RenewalNotifications",
      "nextAttemptAt",
      {
        type: DataTypes.DATE,
        allowNull: true
      }
    );

    await queryInterface.addIndex(
      "RenewalNotifications",
      [
        "status",
        "scheduledAt",
        "nextAttemptAt"
      ],
      {
        name:
          "renewal_notifications_retry_idx"
      }
    );
  },

  down: async (
    queryInterface: QueryInterface
  ): Promise<void> => {
    await queryInterface.removeIndex(
      "RenewalNotifications",
      "renewal_notifications_retry_idx"
    );

    await queryInterface.removeColumn(
      "RenewalNotifications",
      "nextAttemptAt"
    );

    await queryInterface.removeColumn(
      "RenewalNotifications",
      "lastAttemptAt"
    );

    await queryInterface.removeColumn(
      "RenewalNotifications",
      "maxAttempts"
    );

    await queryInterface.removeColumn(
      "RenewalNotifications",
      "attempts"
    );
  }
};
