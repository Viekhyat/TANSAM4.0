import express from "express";
import connectionManager from "./connectionManager.js";
import chartsStorage from "./chartsStorage.js";
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
      console.log(`📊 Fetching MQTT data for connection: ${req.params.id}`);
      console.log(`  - Has dataCache: ${!!conn.dataCache}`);
      console.log(`  - Config topic: ${conn.config?.topic || 'none'}`);
      
      // For MQTT, get data from all topics in cache
      if (conn.dataCache) {
        const topics = Object.keys(conn.dataCache);
        console.log(`  - Cached topics: ${topics.length}`, topics);
        
        if (topics.length > 0) {
          // Return data from all topics, flattened for EDA
          data = topics.map(topic => {
            const rows = conn.dataCache[topic] || [];
            console.log(`  - Topic "${topic}": ${rows.length} rows`);
            return {
              table: topic,
              rows: rows
            };
          });
        } else {
          console.log(`  - No cached topics, attempting subscription`);
          // If no cache yet, try to subscribe to the configured topic
          if (conn.config && conn.config.topic) {
            // Trigger subscription by calling previewMqttData
            await connectionManager.previewMqttData(req.params.id, conn.config.topic, 1000);
            // Wait a moment for messages, then return cached data
            await new Promise(resolve => setTimeout(resolve, 1000));
            const topic = conn.config.topic;
            const updatedConn = connectionManager.getConnection(req.params.id);
            if (updatedConn && updatedConn.dataCache && updatedConn.dataCache[topic] && updatedConn.dataCache[topic].length > 0) {
              console.log(`  - Found ${updatedConn.dataCache[topic].length} rows after subscription`);
              data = [{ table: topic, rows: updatedConn.dataCache[topic] }];
            } else {
              console.log(`  - Still no data after subscription attempt`);
            }
          }
        }
      } else if (conn.config && conn.config.topic) {
        console.log(`  - Initializing cache and subscribing to: ${conn.config.topic}`);
        // Initialize cache and subscribe
        await connectionManager.previewMqttData(req.params.id, conn.config.topic, 1000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedConn = connectionManager.getConnection(req.params.id);
        if (updatedConn && updatedConn.dataCache && updatedConn.dataCache[conn.config.topic]) {
          const rows = updatedConn.dataCache[conn.config.topic];
          console.log(`  - Found ${rows.length} rows after initialization`);
          data = [{ table: conn.config.topic, rows: rows }];
        } else {
          console.log(`  - Still no data after initialization`);
        }
      }
      
      console.log(`  - Returning ${data.length} tables`);
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
    } else if (conn.type === "static") {
      // For Static/Snapshot connections, return the stored snapshot data
      if (conn.dataCache) {
        const tables = Object.keys(conn.dataCache);
        if (tables.length > 0) {
          data = tables.map(topic => ({
            table: topic,
            rows: conn.dataCache[topic] || []
          }));
        }
      } else if (conn.snapshotData && Array.isArray(conn.snapshotData)) {
        // Fallback to snapshotData if dataCache not initialized
        data = conn.snapshotData;
      }
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Chart endpoints for Dynamic Dashboard
router.get("/charts", (req, res) => {
  try {
    const charts = chartsStorage.getAll();
    res.json({ success: true, charts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/charts/:id", (req, res) => {
  try {
    const chartId = req.params.id;
    console.log(`📊 GET /api/charts/${chartId}`);
    const chart = chartsStorage.get(chartId);
    console.log(`Chart found:`, chart ? "yes" : "no");
    if (!chart) {
      console.log(`❌ Chart ${chartId} not found. Available charts:`, chartsStorage.getAll().map(c => c.id));
      return res.status(404).json({ success: false, error: `Chart with ID "${chartId}" not found` });
    }
    console.log(`✅ Returning chart:`, chart.title);
    res.json({ success: true, chart });
  } catch (err) {
    console.error(`❌ Error getting chart:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/charts", (req, res) => {
  try {
    const chart = chartsStorage.create(req.body);
    res.json({ success: true, chart, id: chart.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/charts/:id", (req, res) => {
  try {
    const chart = chartsStorage.update(req.params.id, req.body);
    res.json({ success: true, chart });
  } catch (err) {
    if (err.message === "Chart not found") {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/charts/:id", (req, res) => {
  try {
    const deleted = chartsStorage.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Chart not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
