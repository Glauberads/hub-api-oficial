import { Request, Response } from "express";
import { exec, execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { Sequelize } from "sequelize";
import database from "../database";

const safeUnlink = (filePath: string): void => {
  fs.unlink(filePath, error => {
    if (error && error.code !== "ENOENT") {
      console.error(`Erro ao remover arquivo temporário ${filePath}:`, error.message);
    }
  });
};

const quoteIdentifier = (identifier: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error("Identificador SQL inválido");
  }
  return `"${identifier}"`;
};

const getDbConfig = () => ({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || "5432",
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS
});

export const backupSQL = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const config = getDbConfig();

  if (!config.database || !config.username) {
    return res.status(500).json({ error: "Configuração do banco incompleta." });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup_${config.database}_${timestamp}.sql`;
  const filePath = path.join(os.tmpdir(), filename);

  const env = { ...process.env, PGPASSWORD: config.password };

  const args = [
    "-h", String(config.host),
    "-p", String(config.port),
    "-U", String(config.username),
    "-d", String(config.database),
    "-F", "p",
    "--no-owner",
    "--no-acl",
    "-f", filePath
  ];

  return new Promise((resolve) => {
    execFile("pg_dump", args, { env }, (error) => {
      if (error) {
        console.error("Backup SQL error:", error.message);
        res.status(500).json({ error: "Falha ao gerar backup SQL." });
        return resolve(undefined);
      }

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/sql");

      const stream = fs.createReadStream(filePath);

      stream.pipe(res);

      stream.on("end", () => {
        safeUnlink(filePath);
      });

      stream.on("error", () => {
        safeUnlink(filePath);
        res.status(500).json({ error: "Erro ao enviar arquivo." });
      });

      resolve(undefined);
    });
  });
};

type ForeignKeyRelation = {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
};

type CompanyBackup = {
  companyId: number;
  generatedAt: string;
  tables: Record<string, any[]>;
};

const getCompanyBackup = async (companyId: number): Promise<CompanyBackup | null> => {
  const sequelize = database as unknown as Sequelize;
  const [companyRows]: any = await sequelize.query(
    `SELECT * FROM "Companies" WHERE id = :companyId`,
    { replacements: { companyId } }
  );

  if (!companyRows.length) return null;

  const [companyTables]: any = await sequelize.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'companyId'
    ORDER BY table_name
  `);

  const [relations]: any = await sequelize.query(`
    SELECT
      tc.table_name AS "childTable",
      kcu.column_name AS "childColumn",
      ccu.table_name AS "parentTable",
      ccu.column_name AS "parentColumn"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  const [primaryKeys]: any = await sequelize.query(`
    SELECT tc.table_name AS "tableName", kcu.column_name AS "columnName"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY kcu.ordinal_position
  `);

  const tenantTableNames = new Set<string>(
    companyTables.map((row: any) => String(row.table_name))
  );
  const tables: Record<string, any[]> = { Companies: companyRows };

  for (const { table_name: tableName } of companyTables) {
    if (tableName === "Companies") continue;
    const safeTable = quoteIdentifier(tableName);
    const [rows]: any = await sequelize.query(
      `SELECT * FROM ${safeTable} WHERE "companyId" = :companyId`,
      { replacements: { companyId } }
    );
    tables[tableName] = rows;
  }

  const keysByTable = new Map<string, string[]>();
  for (const key of primaryKeys) {
    const list = keysByTable.get(key.tableName) || [];
    list.push(key.columnName);
    keysByTable.set(key.tableName, list);
  }

  const mergeRows = (tableName: string, rows: any[]): boolean => {
    if (!rows.length) return false;
    const current = tables[tableName] || [];
    const keys = keysByTable.get(tableName) || [];
    const rowKey = (row: any) => keys.length
      ? keys.map(key => JSON.stringify(row[key])).join("|")
      : JSON.stringify(row);
    const existing = new Set(current.map(rowKey));
    const additions = rows.filter(row => !existing.has(rowKey(row)));
    if (!additions.length) return false;
    tables[tableName] = current.concat(additions);
    return true;
  };

  // Inclui tabelas relacionais sem companyId (ex.: UserQueues, TicketTags)
  // somente quando apontam para registros já pertencentes à empresa.
  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of relations as ForeignKeyRelation[]) {
      if (tenantTableNames.has(relation.childTable)) continue;
      const parentRows = tables[relation.parentTable];
      if (!parentRows?.length) continue;

      const parentValues = Array.from(new Set(
        parentRows
          .map(row => row[relation.parentColumn])
          .filter(value => value !== null && value !== undefined)
      ));
      if (!parentValues.length) continue;

      const childTable = quoteIdentifier(relation.childTable);
      const childColumn = quoteIdentifier(relation.childColumn);
      const [childRows]: any = await sequelize.query(
        `SELECT * FROM ${childTable} WHERE ${childColumn} IN (:parentValues)`,
        { replacements: { parentValues } }
      );
      if (mergeRows(relation.childTable, childRows)) changed = true;
    }
  }

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    tables
  };
};

const getCompanyFilename = (company: any, companyId: number, extension: string): string => {
  const safeName = String(company?.name || `company${companyId}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .substring(0, 40);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup_${safeName}_${companyId}_${timestamp}.${extension}`;
};

export const backupCompanyJSON = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(400).json({ error: "companyId inválido." });
  }

  try {
    const backup = await getCompanyBackup(companyId);
    if (!backup) return res.status(404).json({ error: "Empresa não encontrada." });
    const filename = getCompanyFilename(backup.tables.Companies[0], companyId, "json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(backup);
  } catch (error: any) {
    console.error("Backup company JSON error:", error.message);
    return res.status(500).json({ error: "Falha ao gerar backup da empresa." });
  }
};

export const backupCompanySQL = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.params.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(400).json({ error: "companyId inválido." });
  }

  try {
    const backup = await getCompanyBackup(companyId);
    if (!backup) return res.status(404).json({ error: "Empresa não encontrada." });

    const statements: string[] = [
      `-- Backup relacional da empresa #${companyId}`,
      `-- Gerado em ${backup.generatedAt}`,
      "-- Requer o mesmo schema/versão da aplicação no destino.",
      "BEGIN;",
      "SET session_replication_role = replica;"
    ];

    for (const [tableName, rows] of Object.entries(backup.tables)) {
      const safeTable = quoteIdentifier(tableName);
      statements.push(`\n-- ${tableName}: ${rows.length} registro(s)`);
      for (const row of rows) {
        const json = JSON.stringify(row).replace(/'/g, "''");
        statements.push(
          `INSERT INTO ${safeTable} SELECT * FROM json_populate_record(NULL::${safeTable}, '${json}'::json) ON CONFLICT DO NOTHING;`
        );
      }
    }

    statements.push("SET session_replication_role = DEFAULT;", "COMMIT;");
    const filename = getCompanyFilename(backup.tables.Companies[0], companyId, "sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/sql");
    return res.status(200).send(statements.join("\n"));
  } catch (error: any) {
    console.error("Backup company SQL error:", error.message);
    return res.status(500).json({ error: "Falha ao gerar backup da empresa." });
  }
};

export const backupJSON = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const sequelize = database as unknown as Sequelize;

    const [tables]: any = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );

    const backup: Record<string, any[]> = {};

    for (const { tablename } of tables) {
      const [rows]: any = await sequelize.query(
        `SELECT * FROM "${tablename}"`
      );

      backup[tablename] = rows;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${process.env.DB_NAME}_${timestamp}.json`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");

    return res.status(200).json(backup);
  } catch (error: any) {
    console.error("Backup JSON error:", error.message);
    return res.status(500).json({ error: "Falha ao gerar backup JSON." });
  }
};

export const restoreSQL = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = req.file as Express.Multer.File;

  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  const config = getDbConfig();

  if (!config.database || !config.username) {
    fs.unlink(file.path, () => {});
    return res.status(500).json({ error: "Configuração do banco incompleta." });
  }

  const env = { ...process.env, PGPASSWORD: config.password };

  const cleanCmd = `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;

  const restoreCmd = `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -v ON_ERROR_STOP=1 -f "${file.path}"`;

  return new Promise((resolve) => {
    exec(cleanCmd, { env }, (cleanError, cleanStdout, cleanStderr) => {
      if (cleanError) {
        fs.unlink(file.path, () => {});

        console.error("Restore SQL clean error:", cleanError.message);

        return resolve(
          res.status(500).json({
            error: "Falha ao limpar o banco antes da restauração.",
            details: cleanStderr || cleanError.message
          })
        );
      }

      exec(restoreCmd, { env }, (restoreError, restoreStdout, restoreStderr) => {
        fs.unlink(file.path, () => {});

        if (restoreError) {
          console.error("Restore SQL error:", restoreError.message);

          return resolve(
            res.status(500).json({
              error: "Falha ao restaurar backup.",
              details: restoreStderr || restoreError.message
            })
          );
        }

        return resolve(
          res.status(200).json({
            message:
              "Banco restaurado com sucesso. Reinicie o backend para aplicar os dados restaurados.",
            details: {
              clean: cleanStdout,
              restore: restoreStdout
            }
          })
        );
      });
    });
  });
};
