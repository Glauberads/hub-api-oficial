import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.createTable("Floups", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      companyId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING(150)
      },
      description: {
        allowNull: true,
        type: DataTypes.TEXT
      },
      isActive: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      templateType: {
        allowNull: true,
        type: DataTypes.STRING
      },
      steps: {
        allowNull: true,
        type: DataTypes.JSONB
      },
      stopConditions: {
        allowNull: true,
        type: DataTypes.JSONB
      },
      pauseConditions: {
        allowNull: true,
        type: DataTypes.JSONB
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });

    await queryInterface.addIndex("Floups", ["companyId"], { name: "idx_floups_company" });

    await queryInterface.createTable("FloupSchedules", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      companyId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: {
        allowNull: true,
        type: DataTypes.INTEGER,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      contactId: {
        allowNull: true,
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      floupId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: "Floups", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      currentStepIndex: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      nextRunAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING(20),
        defaultValue: "PENDING"
      },
      stepOrder: {
        allowNull: true,
        type: DataTypes.INTEGER
      },
      stepData: {
        allowNull: true,
        type: DataTypes.JSONB
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });

    await queryInterface.addIndex("FloupSchedules", ["companyId"], { name: "idx_floupschedule_company" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeIndex("FloupSchedules", "idx_floupschedule_company");
    await queryInterface.dropTable("FloupSchedules");
    await queryInterface.removeIndex("Floups", "idx_floups_company");
    await queryInterface.dropTable("Floups");
  }
};


