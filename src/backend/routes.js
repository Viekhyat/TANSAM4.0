import express from "express";
import connectionManager from "./connectionManager.js";
const router = express.Router();

router.post("/add-connection", async (req, res) => {
  try {
    const { type, config } = req.body;
    const conn = await connectionManager.addConnection(type, config);
    res.json({ success: true, id: conn.id, type: conn.type });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
router.delete("/remove-connection/:id", (req, res) => {
  connectionManager.removeConnection(req.params.id);
  res.json({ success: true });
});
router.get("/connections", (req, res) => {
  // Return only serializable, safe fields
  const safeConnections = connectionManager.listConnections().map((c) => ({
    id: c.id,
    type: c.type,
    dbType: c.dbType,
    config: { name: c.config?.name },
    count: c.count || 0,
    selectedTables: c.selectedTables || [],
  }));
  res.json({ success: true, connections: safeConnections });
});
// SQL endpoints
router.get("/sql/tables/:id", async (req, res) => {
  try { res.json({ success: true, tables: await connectionManager.getSqlTables(req.params.id) }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});
router.post("/sql/select-tables/:id", async (req, res) => {
  try {
    const { tables } = req.body || {};
    const conn = connectionManager.getConnection(req.params.id);
    if (!conn) return res.status(404).json({ success: false, error: "Connection not found" });
    if (conn.type !== "sql") return res.status(400).json({ success: false, error: "Not SQL" });
    if (!Array.isArray(tables)) return res.status(400).json({ success: false, error: "'tables' must be an array" });
    conn.selectedTables = tables;
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
router.get("/sql/preview/:id", async (req, res) => {
  try {
    const { table, limit } = req.query;
    res.json({ success: true, rows: await connectionManager.previewSqlTable(req.params.id, table, Number(limit || 5)) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// MQTT endpoints
router.get("/mqtt/preview/:id", async (req, res) => {
  try {
    const { topic, limit } = req.query;
    if (!topic) return res.status(400).json({ success: false, error: "Topic is required" });
    const data = await connectionManager.previewMqttData(req.params.id, topic, Number(limit || 10));
    res.json({ success: true, data });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// HTTP endpoints
router.get("/http/preview/:id", async (req, res) => {
  try {
    const { endpoint, limit } = req.query;
    if (!endpoint) return res.status(400).json({ success: false, error: "Endpoint is required" });
    const data = await connectionManager.previewHttpData(req.params.id, endpoint, Number(limit || 5));
    res.json({ success: true, data });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Serial endpoints
router.get("/serial/preview/:id", async (req, res) => {
  try {
    const { limit } = req.query;
    const data = await connectionManager.previewSerialData(req.params.id, Number(limit || 20));
    res.json({ success: true, data });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Generic data endpoint for DynamicData page
router.get("/data/:id", async (req, res) => {
  try {
    const conn = connectionManager.getConnection(req.params.id);
    if (!conn) {
      return res.json({ success: false, error: "Connection not found" });
    }
    
    let data = [];
    if (conn.type === "sql") {
      // For SQL, get selected tables if set, otherwise all tables
      let tables = Array.isArray(conn.selectedTables) && conn.selectedTables.length > 0
        ? conn.selectedTables
        : await connectionManager.getSqlTables(req.params.id);
      if (tables && tables.length > 0) {
        for (const table of tables) {
          const rows = await connectionManager.previewSqlTable(req.params.id, table, 20);
          data.push({ table, rows });
        }
      }
    } else if (conn.type === "mqtt") {
      // For MQTT, use the first topic in cache or return empty
      if (conn.dataCache) {
        const topics = Object.keys(conn.dataCache);
        if (topics.length > 0) {
          data = [{ table: topics[0], rows: conn.dataCache[topics[0]] }];
        }
      }
    } else if (conn.type === "http") {
      // For HTTP, use the first endpoint in cache or return empty
      if (conn.dataCache) {
        const endpoints = Object.keys(conn.dataCache);
        if (endpoints.length > 0) {
          data = [{ table: endpoints[0], rows: conn.dataCache[endpoints[0]] }];
        }
      }
    } else if (conn.type === "serial") {
      // For Serial, get the latest data
      const serialData = await connectionManager.previewSerialData(req.params.id, 20);
      data = [{ table: "Serial Data", rows: serialData }];
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

export default router;
