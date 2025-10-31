import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";

const sqlConnections = new Map();

/** Create a new SQL connection */
export async function startSqlConnection(config, onData, forcedId = null) {
  /**
   * For SQL table access:
   * - The user, host, and password must exactly match the privileges granted in MySQL ("GRANT ... TO 'user'@'host'").
   * - The same credentials are used for every query, including for SHOW TABLES.
   * - If any of these is wrong, you'll get an authentication error.
   */
  const id = forcedId || uuidv4();

  // Validation
  if (!config.user || !config.password || !config.host) {
    throw new Error("Missing user, password, or host for SQL connection (these must match MySQL grants).");
  }

  try {
    console.log(`[SQL] Creating pool for ${config.user}@${config.host}:${config.port} (Database: ${config.database}).`);
    const pool = await mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    sqlConnections.set(id, { pool, config, selectedTables: [], cache: {} });
    return id;
  } catch (e) {
    console.error("❌ SQL POOL CREATION FAILED:", e);
    throw new Error("Failed to connect to database: " + e.message);
  }
}

/** Get all tables from the database */
export async function getSqlTables(id) {
  // Credentials used here are from connection creation; must match MySQL GRANTS
  const conn = sqlConnections.get(id);
  if (!conn) throw new Error("Connection not found: " + id);
  // Debug log
  console.log(`[SQL] Fetching tables for ${conn.config.user}@${conn.config.host} (DB: ${conn.config.database})`);
  const [tables] = await conn.pool.query("SHOW TABLES;");
  if (!tables.length) throw new Error("No tables found or database is empty.");
  const key = Object.keys(tables[0])[0];
  return tables.map((t) => t[key]);
}

// (rest unchanged)
export function selectSqlTables(id, tables, onData) { /* ... */ }
function startPolling(id, onData) { /* ... */ }
export function stopSqlConnection(id) { /* ... */ }

async function connect(config, onData, forcedId = null) {
  const id = await startSqlConnection(config, onData, forcedId);
  return {
    id,
    getTables: () => getSqlTables(id),
    selectTables: (tables) => selectSqlTables(id, tables, onData),
    stop: () => stopSqlConnection(id),
  };
}

export default { connect, getSqlTables, selectSqlTables };
