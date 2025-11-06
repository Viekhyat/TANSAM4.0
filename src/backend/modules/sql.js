import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { open as sqliteOpen } from "sqlite";
import { Pool as PgPool } from "pg";

export async function createSqlConnection({ type, ...config }) {
  // Check if type is defined
  if (!type) {
    throw new Error("SQL type is required. Supported types are: mysql, sqlite, postgres/postgresql, and mariadb.");
  }
  
  // Convert type to lowercase for case-insensitive comparison
  const sqlType = type.toLowerCase();
  
  // Filter driver-specific configuration to avoid passing unsupported keys (e.g., name)
  if (sqlType === "mysql") {
    const { host, port, user, password, database, ssl } = config;
    return { type: sqlType, pool: await mysql.createPool({ host, port, user, password, database, ssl }) };
  }
  if (sqlType === "sqlite") {
    const { filename } = config;
    return { type: sqlType, db: await sqliteOpen({ filename, driver: sqlite3.Database }) };
  }
  if (sqlType === "postgres" || sqlType === "postgresql") {
    const { host, port, user, password, database, ssl, connectionString } = config;
    const pgConfig = connectionString ? { connectionString, ssl } : { host, port, user, password, database, ssl };
    return { type: "postgres", pool: new PgPool(pgConfig) };
  }
  if (sqlType === "mariadb") {
    const { host, port, user, password, database, ssl } = config;
    return { type: "mysql", pool: await mysql.createPool({ host, port, user, password, database, ssl }) }; // MariaDB uses MySQL driver
  }
  
  // Provide more detailed error message
  throw new Error(`Unsupported SQL type: ${type}. Supported types are: mysql, sqlite, postgres/postgresql, and mariadb.`);
}
export async function getTables(conn) {
  // Check if connection and type are defined
  if (!conn || !conn.type) {
    throw new Error("Invalid SQL connection object");
  }
  
  const type = ((conn.type === "sql" && conn.dbType) ? conn.dbType : conn.type).toLowerCase();
  
  if (type === "mysql")
    return (await conn.pool.query("SHOW TABLES"))[0].map(row => Object.values(row)[0]);
  if (type === "sqlite")
    return (await conn.db.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name);
  if (type === "postgres") {
    const result = await conn.pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    return result.rows.map(r => r.tablename);
  }
  
  throw new Error(`Getting tables for SQL type '${type}' is not implemented.`);
}

export async function previewTable(conn, table, limit = 5) {
  // Check if connection and type are defined
  if (!conn || !conn.type) {
    throw new Error("Invalid SQL connection object");
  }
  
  const type = ((conn.type === "sql" && conn.dbType) ? conn.dbType : conn.type).toLowerCase();
  
  if (type === "mysql")
    return (await conn.pool.query(`SELECT * FROM \`${table}\` LIMIT ?`, [limit]))[0];
  if (type === "sqlite")
    return await conn.db.all(`SELECT * FROM "${table}" LIMIT ?`, limit);
  if (type === "postgres") {
    const result = await conn.pool.query(`SELECT * FROM "${table}" LIMIT $1`, [limit]);
    return result.rows;
  }
  
  throw new Error(`Previewing tables for SQL type '${type}' is not implemented.`);
}
