import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("PasswordResets", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      tokenHash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true
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

    await queryInterface.addIndex("PasswordResets", ["userId"]);
    await queryInterface.addIndex("PasswordResets", ["tokenHash"]);
    await queryInterface.addIndex("PasswordResets", ["expiresAt"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PasswordResets");
  }
};