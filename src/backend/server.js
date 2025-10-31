import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import connectionManager from "./modules/connectionManager.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8085;

app.use(cors());
app.use(bodyParser.json());

app.get("/status", (req, res) => {
  res.json({ server: "Unified Multi-Protocol Server", status: "running" });
});

app.post("/api/add-connection", async (req, res) => {
  try {
    const { type, config } = req.body;
    if (!type || !config)
      return res.status(400).json({ success: false, error: "type and config required" });

    const conn = await connectionManager.addConnection(type, config);
    if (!conn || !conn.id) throw new Error("Connection could not be created");
    res.json({ success: true, id: conn.id, type: conn.type });
  } catch (err) {
    console.error("add-connection error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/remove-connection/:id", (req, res) => {
  connectionManager.removeConnection(req.params.id);
  res.json({ success: true });
});

app.get("/api/connections", (req, res) => {
  res.json({ success: true, connections: connectionManager.listConnections() });
});

app.get("/api/sql/tables/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const conn = connectionManager.getConnection(id);
    if (!conn) return res.json({ success: false, error: "Connection not found" });
    if (conn.type !== "sql") return res.json({ success: false, error: "Not an SQL connection" });
    const tables = await connectionManager.getSqlTables(id); // Call manager fix here
    res.json({ success: true, tables });
  } catch (err) {
    console.error("tables error:", err);
    res.json({ success: false, error: err.message });
  }
});

// Preview first N rows from single table
app.get("/api/sql/table-preview/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const table = req.query.table;
    const limit = Math.abs(Number(req.query.limit)) || 5;
    if (!table) return res.json({ success: false, error: "Missing table name" });

    const conn = connectionManager.getConnection(id);
    if (!conn) return res.json({ success: false, error: "Connection not found" });
    if (conn.type !== "sql") return res.json({ success: false, error: "Not an SQL connection" });
    if (!conn.pool) return res.json({ success: false, error: "No pool for SQL connection" });

    // Basic SQL injection protection: Only allow alphanumeric/underscore table names
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return res.json({ success: false, error: "Invalid table name" });

    // Query a few rows
    const [rows] = await conn.pool.query(`SELECT * FROM \`${table}\` LIMIT ?`, [limit]);
    return res.json({ success: true, rows });
  } catch (err) {
    console.error("table-preview error:", err);
    res.json({ success: false, error: err.message });
  }
});


app.post("/api/sql/select-tables/:id", async (req, res) => {
  try {
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables))
      return res.json({ success: false, error: "Invalid tables list" });
    const id = req.params.id;
    const conn = connectionManager.getConnection(id);
    if (!conn) return res.json({ success: false, error: "Connection not found" });
    if (conn.type === "sql") {
      connectionManager.selectSqlTables(id, tables);
      return res.json({ success: true });
    }
    return res.json({ success: false, error: "Not an SQL connection" });
  } catch (err) {
    console.error("select-tables error:", err);
    res.json({ success: false, error: err.message });
  }
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("close", () => console.log("WebSocket client disconnected"));
});
httpServer.listen(PORT, () => {
  console.log(`🚀 Unified Multi-Protocol Server running on port ${PORT}`);
});
