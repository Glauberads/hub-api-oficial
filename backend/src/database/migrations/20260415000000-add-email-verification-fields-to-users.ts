import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Users", "emailVerified", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Users", "emailVerificationCode", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Users", "emailVerificationExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn("Users", "emailVerificationSentAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Users", "emailVerificationSentAt");
    await queryInterface.removeColumn("Users", "emailVerificationExpiresAt");
    await queryInterface.removeColumn("Users", "emailVerificationCode");
    await queryInterface.removeColumn("Users", "emailVerified");
  }
};