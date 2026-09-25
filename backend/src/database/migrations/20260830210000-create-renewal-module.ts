import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {

    // ========================================================
    // PRODUTOS / PLANOS
    // ========================================================

    await queryInterface.createTable("RenewalProducts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },

      dueRule: {
        type: DataTypes.ENUM("running_days", "fixed_day"),
        allowNull: false,
        defaultValue: "running_days"
      },

      runningDays: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      fixedDay: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      renewFrom: {
        type: DataTypes.ENUM("due_date", "payment_date"),
        allowNull: false,
        defaultValue: "due_date"
      },

      reminderDays: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [3, 2, 1, 0, -1]
      },

      messageTemplates: {
        type: DataTypes.JSONB,
        allowNull: true
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // ========================================================
    // CLIENTES DE RENOVAÇÃO
    // ========================================================

    await queryInterface.createTable("RenewalCustomers", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },

      phone: {
        type: DataTypes.STRING(50),
        allowNull: false
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // ========================================================
    // ASSINATURAS
    // ========================================================

    await queryInterface.createTable("RenewalSubscriptions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalCustomers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },

      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },

      lastPaymentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },

      status: {
        type: DataTypes.ENUM(
          "active",
          "overdue",
          "paused",
          "canceled"
        ),
        allowNull: false,
        defaultValue: "active"
      },

      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // ========================================================
    // HISTÓRICO DE PAGAMENTOS / BAIXAS
    // ========================================================

    await queryInterface.createTable("RenewalPayments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      subscriptionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalSubscriptions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalCustomers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },

      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },

      paidAt: {
        type: DataTypes.DATE,
        allowNull: false
      },

      previousDueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },

      nextDueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },

      notes: {
        type: DataTypes.TEXT,
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

    // ========================================================
    // FILA / HISTÓRICO DOS AVISOS
    // ========================================================

    await queryInterface.createTable("RenewalNotifications", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      subscriptionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "RenewalSubscriptions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },

      cycleDueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },

      offsetDays: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false
      },

      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },

      canceledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },

      status: {
        type: DataTypes.ENUM(
          "pending",
          "processing",
          "sent",
          "canceled",
          "failed"
        ),
        allowNull: false,
        defaultValue: "pending"
      },

      body: {
        type: DataTypes.TEXT,
        allowNull: false
      },

      errorMessage: {
        type: DataTypes.TEXT,
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

    // ========================================================
    // ÍNDICES
    // ========================================================

    await queryInterface.addIndex(
      "RenewalProducts",
      ["companyId", "active"],
      { name: "idx_renewal_products_company_active" }
    );

    await queryInterface.addIndex(
      "RenewalCustomers",
      ["companyId", "phone"],
      {
        name: "idx_renewal_customers_company_phone",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "RenewalSubscriptions",
      ["companyId", "dueDate"],
      { name: "idx_renewal_subscriptions_company_due_date" }
    );

    await queryInterface.addIndex(
      "RenewalSubscriptions",
      ["companyId", "status"],
      { name: "idx_renewal_subscriptions_company_status" }
    );

    await queryInterface.addIndex(
      "RenewalSubscriptions",
      ["customerId", "productId"],
      { name: "idx_renewal_subscriptions_customer_product" }
    );

    await queryInterface.addIndex(
      "RenewalPayments",
      ["companyId", "paidAt"],
      { name: "idx_renewal_payments_company_paid_at" }
    );

    await queryInterface.addIndex(
      "RenewalNotifications",
      ["status", "scheduledAt"],
      { name: "idx_renewal_notifications_status_scheduled" }
    );

    await queryInterface.addIndex(
      "RenewalNotifications",
      ["companyId", "status", "scheduledAt"],
      { name: "idx_renewal_notifications_company_status_scheduled" }
    );

    await queryInterface.addIndex(
      "RenewalNotifications",
      ["subscriptionId", "cycleDueDate", "offsetDays"],
      {
        name: "uq_renewal_notification_cycle",
        unique: true
      }
    );
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("RenewalNotifications");
    await queryInterface.dropTable("RenewalPayments");
    await queryInterface.dropTable("RenewalSubscriptions");
    await queryInterface.dropTable("RenewalCustomers");
    await queryInterface.dropTable("RenewalProducts");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RenewalNotifications_status";'
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RenewalSubscriptions_status";'
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RenewalProducts_renewFrom";'
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RenewalProducts_dueRule";'
    );
  }
};
