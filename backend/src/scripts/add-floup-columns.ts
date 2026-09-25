/**
 * Script para adicionar as colunas condition e conditionValue à tabela Floups
 * Execute: npx ts-node src/scripts/add-floup-columns.ts
 */

import { QueryInterface, DataTypes } from 'sequelize';
import db from '../database';

async function addFloupColumns() {
  const sequelize = db;
  const queryInterface: QueryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  console.log('🔍 Verificando tabela Floups...');

  let tableExists = false;
  let actualTableName: string | null = null;

  try {
    if (dialect === 'postgres') {
      const [results]: any = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND LOWER(table_name) = LOWER('Floups')
        LIMIT 1;
      `);

      if (results && results.length > 0) {
        tableExists = true;
        actualTableName = results[0].table_name;
        console.log(`✅ Tabela encontrada: ${actualTableName}`);
      }
    } else {
      try {
        await queryInterface.describeTable('Floups');
        tableExists = true;
        actualTableName = 'Floups';
      } catch {
        try {
          await queryInterface.describeTable('floups');
          tableExists = true;
          actualTableName = 'floups';
        } catch {
          tableExists = false;
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ Erro ao verificar tabela: ${error.message}`);
    process.exit(1);
  }

  if (!tableExists || !actualTableName) {
    console.log('❌ Tabela Floups não encontrada.');
    process.exit(1);
  }

  // Verificar se as colunas já existem
  let conditionExists = false;
  let conditionValueExists = false;

  try {
    if (dialect === 'postgres') {
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
    console.error(`❌ Erro ao verificar colunas: ${error.message}`);
    process.exit(1);
  }

  // Adicionar coluna condition se não existir
  if (!conditionExists) {
    try {
      await queryInterface.addColumn(actualTableName, 'condition', {
        allowNull: true,
        type: DataTypes.STRING,
        defaultValue: 'queue'
      });
      console.log(`✅ Coluna 'condition' adicionada à tabela ${actualTableName}`);
    } catch (error: any) {
      console.error(`❌ Erro ao adicionar coluna 'condition': ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️  Coluna 'condition' já existe.`);
  }

  // Adicionar coluna conditionValue se não existir
  if (!conditionValueExists) {
    try {
      await queryInterface.addColumn(actualTableName, 'conditionValue', {
        allowNull: true,
        type: DataTypes.TEXT,
        defaultValue: ''
      });
      console.log(`✅ Coluna 'conditionValue' adicionada à tabela ${actualTableName}`);
    } catch (error: any) {
      console.error(`❌ Erro ao adicionar coluna 'conditionValue': ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️  Coluna 'conditionValue' já existe.`);
  }

  console.log('✅ Processo concluído com sucesso!');
  await sequelize.close();
  process.exit(0);
}

addFloupColumns().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

