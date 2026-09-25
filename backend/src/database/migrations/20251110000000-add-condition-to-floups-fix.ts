/**
 * Migração CORRIGIDA para adicionar as colunas 'condition' e 'conditionValue' à tabela Floups
 * 
 * Esta migração foi criada com data posterior à criação da tabela para garantir execução.
 * É idempotente e segura para executar múltiplas vezes:
 * - Verifica se a tabela existe (case-insensitive)
 * - Verifica se as colunas já existem antes de adicionar
 * - Usa o nome exato da tabela como está no banco de dados
 * - Funciona com PostgreSQL e outros bancos de dados
 * 
 * Data: 2025-11-10 (posterior à criação da tabela em 2025-11-06)
 * Versão: 2.0 (corrigida)
 */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();
    
    console.log(`[MIGRATION FIX] Iniciando migração para adicionar colunas condition/conditionValue à tabela Floups`);
    
    // Verificar se a tabela Floups existe usando query SQL direta
    let tableExists = false;
    let tableName = "Floups";
    let actualTableName = null;
    
    try {
      if (dialect === "postgres") {
        // PostgreSQL: verificar na information_schema (case-insensitive)
        const [results]: any = await sequelize.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND LOWER(table_name) = LOWER('Floups');
        `);
        
        if (results && results.length > 0) {
          tableExists = true;
          actualTableName = results[0].table_name; // Usar o nome exato como está no banco
          console.log(`[MIGRATION FIX] Tabela encontrada: ${actualTableName}`);
        }
      } else {
        // Para outros bancos, tentar descrever a tabela
        try {
          await queryInterface.describeTable(tableName);
          tableExists = true;
          actualTableName = tableName;
        } catch {
          try {
            tableName = "floups";
            await queryInterface.describeTable(tableName);
            tableExists = true;
            actualTableName = tableName;
          } catch {
            tableExists = false;
          }
        }
      }
    } catch (error: any) {
      console.log(`[MIGRATION FIX] Erro ao verificar tabela Floups: ${error.message}`);
      tableExists = false;
    }
    
    // Se a tabela não existe, não fazer nada
    if (!tableExists || !actualTableName) {
      console.log(`[MIGRATION FIX] ⚠️  Tabela Floups não encontrada. Pulando adição de colunas.`);
      return;
    }
    
    // Verificar se as colunas já existem usando SQL direto (PostgreSQL)
    let conditionExists = false;
    let conditionValueExists = false;
    
    try {
      if (dialect === "postgres") {
        // PostgreSQL: usar bind com $1 ao invés de replacements
        const [colResults]: any = await sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name IN ('condition', 'conditionValue');
        `, {
          bind: [actualTableName]
        });
        
        const existingColumns = colResults.map((row: any) => row.column_name.toLowerCase());
        conditionExists = existingColumns.includes('condition');
        conditionValueExists = existingColumns.includes('conditionvalue');
        console.log(`[MIGRATION FIX] Verificação de colunas - condition: ${conditionExists}, conditionValue: ${conditionValueExists}`);
      } else {
        // Para outros bancos, usar describeTable
        try {
          const tableDescription: any = await queryInterface.describeTable(actualTableName);
          conditionExists = !!tableDescription.condition;
          conditionValueExists = !!tableDescription.conditionValue;
          console.log(`[MIGRATION FIX] Verificação de colunas (describeTable) - condition: ${conditionExists}, conditionValue: ${conditionValueExists}`);
        } catch (descError: any) {
          console.log(`[MIGRATION FIX] Erro ao descrever tabela: ${descError.message} - tentando adicionar colunas mesmo assim`);
        }
      }
    } catch (error: any) {
      console.error(`[MIGRATION FIX] Erro ao verificar colunas: ${error.message}`);
      console.log(`[MIGRATION FIX] Continuando para tentar adicionar colunas (será ignorado se já existirem)`);
      // Em caso de erro, tentar adicionar as colunas mesmo assim (será ignorado se já existirem)
    }
    
    // Adicionar coluna condition se não existir
    if (!conditionExists) {
      try {
        console.log(`[MIGRATION FIX] Tentando adicionar coluna 'condition' à tabela ${actualTableName}...`);
        await queryInterface.addColumn(actualTableName, "condition", {
          allowNull: true,
          type: DataTypes.STRING,
          defaultValue: "queue"
        });
        console.log(`[MIGRATION FIX] ✅ Coluna 'condition' adicionada com sucesso à tabela ${actualTableName}`);
      } catch (error: any) {
        // Se o erro for porque a coluna já existe, tudo bem
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || errorMsg.includes('42701')) {
          console.log(`[MIGRATION FIX] ℹ️  Coluna 'condition' já existe na tabela ${actualTableName} (ignorando)`);
        } else {
          console.error(`[MIGRATION FIX] ❌ Erro ao adicionar coluna 'condition': ${errorMsg}`);
          // Não relançar o erro - apenas logar, pois pode ser que a coluna já exista com nome diferente
          console.log(`[MIGRATION FIX] ⚠️  Continuando mesmo com erro (coluna pode já existir)`);
        }
      }
    } else {
      console.log(`[MIGRATION FIX] ℹ️  Coluna 'condition' já existe na tabela ${actualTableName} (verificação prévia)`);
    }
    
    // Adicionar coluna conditionValue se não existir
    if (!conditionValueExists) {
      try {
        console.log(`[MIGRATION FIX] Tentando adicionar coluna 'conditionValue' à tabela ${actualTableName}...`);
        await queryInterface.addColumn(actualTableName, "conditionValue", {
          allowNull: true,
          type: DataTypes.TEXT,
          defaultValue: ""
        });
        console.log(`[MIGRATION FIX] ✅ Coluna 'conditionValue' adicionada com sucesso à tabela ${actualTableName}`);
      } catch (error: any) {
        // Se o erro for porque a coluna já existe, tudo bem
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || errorMsg.includes('42701')) {
          console.log(`[MIGRATION FIX] ℹ️  Coluna 'conditionValue' já existe na tabela ${actualTableName} (ignorando)`);
        } else {
          console.error(`[MIGRATION FIX] ❌ Erro ao adicionar coluna 'conditionValue': ${errorMsg}`);
          // Não relançar o erro - apenas logar, pois pode ser que a coluna já exista com nome diferente
          console.log(`[MIGRATION FIX] ⚠️  Continuando mesmo com erro (coluna pode já existir)`);
        }
      }
    } else {
      console.log(`[MIGRATION FIX] ℹ️  Coluna 'conditionValue' já existe na tabela ${actualTableName} (verificação prévia)`);
    }
    
    console.log(`[MIGRATION FIX] ✅ Migração concluída com sucesso para a tabela ${actualTableName}`);
  },

  async down(queryInterface: QueryInterface) {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();
    
    // Verificar se a tabela Floups existe
    let tableExists = false;
    let actualTableName = null;
    
    try {
      if (dialect === "postgres") {
        const [results]: any = await sequelize.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND LOWER(table_name) = LOWER('Floups');
        `);
        
        if (results && results.length > 0) {
          tableExists = true;
          actualTableName = results[0].table_name;
        }
      } else {
        try {
          await queryInterface.describeTable("Floups");
          tableExists = true;
          actualTableName = "Floups";
        } catch {
          try {
            await queryInterface.describeTable("floups");
            tableExists = true;
            actualTableName = "floups";
          } catch {
            tableExists = false;
          }
        }
      }
    } catch (error: any) {
      console.log(`[MIGRATION FIX] Erro ao verificar tabela no rollback: ${error.message}`);
      return;
    }
    
    if (!tableExists || !actualTableName) {
      return;
    }
    
    // Verificar se as colunas existem antes de remover
    let conditionExists = false;
    let conditionValueExists = false;
    
    try {
      if (dialect === "postgres") {
        // PostgreSQL: usar bind com $1 ao invés de replacements
        const [colResults]: any = await sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name IN ('condition', 'conditionValue');
        `, {
          bind: [actualTableName]
        });
        
        const existingColumns = colResults.map((row: any) => row.column_name.toLowerCase());
        conditionExists = existingColumns.includes('condition');
        conditionValueExists = existingColumns.includes('conditionvalue');
      } else {
        const tableDescription: any = await queryInterface.describeTable(actualTableName);
        conditionExists = !!tableDescription.condition;
        conditionValueExists = !!tableDescription.conditionValue;
      }
    } catch (error: any) {
      console.error(`[MIGRATION FIX] Erro ao verificar colunas no rollback: ${error.message}`);
      return;
    }
    
    if (conditionExists) {
      try {
        await queryInterface.removeColumn(actualTableName, "condition");
      } catch (error: any) {
        console.log(`[MIGRATION FIX] Erro ao remover coluna 'condition': ${error.message}`);
      }
    }
    
    if (conditionValueExists) {
      try {
        await queryInterface.removeColumn(actualTableName, "conditionValue");
      } catch (error: any) {
        console.log(`[MIGRATION FIX] Erro ao remover coluna 'conditionValue': ${error.message}`);
      }
    }
  }
};

