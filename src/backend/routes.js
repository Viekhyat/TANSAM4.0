import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import connectionManager from "./connectionManager.js";
import chartsStorage from "./chartsStorage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// HTTP POST endpoint to receive sensor data (alternative: /api/sensor-data or /api/data)
router.post("/sensor-data", async (req, res) => {
  try {
    const sensorData = req.body;
    const { device_id } = sensorData;
    
    if (!device_id) {
      return res.status(400).json({ success: false, error: "device_id is required" });
    }
    
    console.log(`📡 Received:`, sensorData);
    
    // Find HTTP connection(s) that match this device_id or have matching endpoint
    const connections = connectionManager.listConnections().filter(
      conn => conn.type === "http"
    );
    
    if (connections.length === 0) {
      console.warn(`⚠️ No HTTP connections found to store sensor data`);
      // Still respond with success to sensor, but don't store data
      return res.status(200).json({ success: true, message: "Data received but no HTTP connections configured" });
    }
    
    // Store data in all HTTP connections (or find matching one by device_id/config)
    let stored = false;
    for (const conn of connections) {
      if (!conn.dataCache) {
        conn.dataCache = {};
      }
      
      // Use endpoint or device_id as cache key
      const cacheKey = conn.config?.endpoint || `/sensor-data/${device_id}`;
      if (!conn.dataCache[cacheKey]) {
        conn.dataCache[cacheKey] = [];
      }
      
      // Flatten data with timestamp
      const flatData = {
        timestamp: sensorData.timestamp || new Date().toISOString(),
        endpoint: cacheKey,
        device_id: device_id,
        ...sensorData
      };
      
      conn.dataCache[cacheKey].push(flatData);
      
      // Keep last 10,000 entries
      const EDA_LIMIT = 10000;
      if (conn.dataCache[cacheKey].length > EDA_LIMIT) {
        conn.dataCache[cacheKey] = conn.dataCache[cacheKey].slice(-EDA_LIMIT);
      }
      
      // Broadcast WebSocket update
      connectionManager.broadcastUpdate(conn.id, cacheKey, flatData);
      
      stored = true;
      console.log(`✅ Stored sensor data in connection ${conn.id}, cache size: ${conn.dataCache[cacheKey].length}`);
    }
    
    if (stored) {
      console.log(`✅ Sent from ${device_id} | Status: 200`);
    }
    
    res.status(200).json({ success: true, message: `Data received from ${device_id}`, stored });
  } catch (err) {
    console.error(`❌ Error receiving sensor data:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
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
      console.log(`📊 Fetching HTTP data for connection: ${req.params.id}`);
      console.log(`  - Has dataCache: ${!!conn.dataCache}`);
      console.log(`  - Config endpoint: ${conn.config?.endpoint || 'none'}`);
      
      // For HTTP, get data from all endpoints in cache
      if (conn.dataCache) {
        const endpoints = Object.keys(conn.dataCache);
        console.log(`  - Cached endpoints: ${endpoints.length}`, endpoints);
        
        if (endpoints.length > 0) {
          // Return data from all endpoints, similar to MQTT topics
          data = endpoints.map(endpoint => {
            const rows = conn.dataCache[endpoint] || [];
            console.log(`  - Endpoint "${endpoint}": ${rows.length} rows`);
            return {
              table: endpoint,
              rows: rows
            };
          });
        } else {
          console.log(`  - No cached endpoints, attempting initial fetch`);
          // If no cache yet, try to fetch the configured endpoint
          if (conn.config && conn.config.endpoint) {
            await connectionManager.pollHttpEndpoint(req.params.id, conn.config.endpoint);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait a moment
            const updatedConn = connectionManager.getConnection(req.params.id);
            if (updatedConn && updatedConn.dataCache && updatedConn.dataCache[conn.config.endpoint]) {
              const rows = updatedConn.dataCache[conn.config.endpoint];
              console.log(`  - Found ${rows.length} rows after initial fetch`);
              data = [{ table: conn.config.endpoint, rows: rows }];
            }
          }
        }
      } else if (conn.config && conn.config.endpoint) {
        console.log(`  - Initializing cache and fetching: ${conn.config.endpoint}`);
        // Initialize cache and fetch
        await connectionManager.pollHttpEndpoint(req.params.id, conn.config.endpoint);
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedConn = connectionManager.getConnection(req.params.id);
        if (updatedConn && updatedConn.dataCache && updatedConn.dataCache[conn.config.endpoint]) {
          const rows = updatedConn.dataCache[conn.config.endpoint];
          console.log(`  - Found ${rows.length} rows after initialization`);
          data = [{ table: conn.config.endpoint, rows: rows }];
        }
      }
      
      console.log(`  - Returning ${data.length} tables`);
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

// Presentation endpoints
router.post("/launch-presentations", (req, res) => {
  console.log('📺 POST /api/launch-presentations called');
  try {
    const { presentations } = req.body;
    
    console.log('Presentations received:', presentations);
    
    if (!presentations || !Array.isArray(presentations)) {
      console.error('Invalid presentations format');
      return res.status(400).json({ 
        success: false, 
        error: "presentations array is required" 
      });
    }
    
    // Build config for Python script
    const config = {
      presentations: presentations.map(p => ({
        url: p.url,
        screen_id: p.screen_id || 0,
        browser: p.browser || 'chrome'
      }))
    };
    
    console.log('Config for Python:', JSON.stringify(config, null, 2));
    
    // Call Python script
    const pythonScript = path.join(__dirname, 'presentation_manager.py');
    console.log('Python script path:', pythonScript);
    
    const python = spawn('python', [pythonScript, JSON.stringify(config)]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
      console.error('Python stderr:', data.toString());
    });
    
    python.on('close', (code) => {
      console.log('Python process closed with code:', code);
      try {
        if (code !== 0) {
          console.error('Python script error:', error);
          return res.status(500).json({ 
            success: false, 
            error: `Python script failed: ${error}` 
          });
        }
        
        const result = JSON.parse(output);
        console.log('✅ Presentations launched successfully:', result);
        res.json(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', output, parseError);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to parse presentation manager response',
          output: output
        });
      }
    });
    
  } catch (err) {
    console.error('Error launching presentations:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get available screens
router.get("/screens", (req, res) => {
  try {
    const pythonScript = path.join(__dirname, 'presentation_manager.py');
    const python = spawn('python', [pythonScript]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      try {
        if (code !== 0) {
          console.error('Python script error:', error);
          return res.status(500).json({ 
            success: false, 
            error: `Failed to detect screens: ${error}` 
          });
        }
        
        const result = JSON.parse(output);
        res.json({ 
          success: true, 
          screens: result.screens,
          system: result.system
        });
      } catch (parseError) {
        console.error('Failed to parse screen detection output:', output, parseError);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to detect screens' 
        });
      }
    });
    
  } catch (err) {
    console.error('Error detecting screens:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
