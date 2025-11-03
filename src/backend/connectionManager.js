import { createSqlConnection, getTables, previewTable } from "./modules/sql.js";
import { createMqttConnection } from "./modules/mqtt.js";
import { createSerialConnection } from "./modules/serial.js";
import { createHttpConnection } from "./modules/http.js";

class ConnectionManager {
  constructor() {
    this.connections = {};
    this.idCounter = 1;
    this.wss = null; // WebSocket server reference
  }
  
  // Attempt to coerce non-JSON serial lines into a flat object for charts
  parseNonJsonSerialLine(line) {
    const text = (typeof line === 'string' ? line : String(line)).trim();
    if (text.length === 0) return { raw: '' };
    
    // Single numeric value -> { value: number }
    if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
      const num = Number(text);
      return Number.isNaN(num) ? { raw: text } : { value: num };
    }
    
    // Key=value or key:value pairs (separated by comma/semicolon/space)
    if (/[=:]/.test(text)) {
      const result = {};
      const tokens = text.split(/[;,\s]+/).filter(Boolean);
      for (const token of tokens) {
        const sepIndexEq = token.indexOf('=');
        const sepIndexCol = token.indexOf(':');
        let sepIndex = -1;
        let sepChar = '';
        if (sepIndexEq !== -1 && (sepIndexCol === -1 || sepIndexEq < sepIndexCol)) { sepIndex = sepIndexEq; sepChar = '='; }
        else if (sepIndexCol !== -1) { sepIndex = sepIndexCol; sepChar = ':'; }
        if (sepIndex > 0) {
          const key = token.slice(0, sepIndex).trim().replace(/[^A-Za-z0-9_]/g, '_') || 'field';
          const valRaw = token.slice(sepIndex + 1).trim();
          const numVal = Number(valRaw);
          result[key] = Number.isNaN(numVal) ? valRaw : numVal;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    
    // CSV-like values -> { value1, value2, ... }
    if (text.includes(',')) {
      const parts = text.split(',').map(s => s.trim());
      const obj = {};
      parts.forEach((p, idx) => {
        const numVal = Number(p);
        obj[`value${idx + 1}`] = Number.isNaN(numVal) ? p : numVal;
      });
      return obj;
    }
    
    return { raw: text };
  }

  // Try to repair common malformed JSON fragments into valid JSON strings
  tryRepairJsonString(line) {
    let text = (typeof line === 'string' ? line : String(line)).trim();
    if (!text) return null;
    
    // If it looks like key":value} without opening brace or opening quote
    if (!text.startsWith('{')) {
      // Quote unquoted keys: batt:81 -> "batt":81
      text = text.replace(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '"$1":');
      // If it now starts with a quoted key, prepend '{'
      if (/^"[^"]+"\s*:/.test(text)) {
        text = `{${text}`;
      }
    }
    // Ensure closing brace
    if (!text.endsWith('}')) {
      text = `${text}}`;
    }
    // Remove trailing commas before closing brace: {"a":1,} -> {"a":1}
    text = text.replace(/,\s*}/g, '}');
    
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  
  // Normalize parsed serial payload to a readable, chart-friendly shape
  toReadableSerialRow(parsed) {
    // Handle null, undefined, or non-object inputs
    if (!parsed || typeof parsed !== 'object') {
      parsed = { raw: String(parsed) };
    }
    
    const base = { ...parsed };
    
    // Ensure all values are properly typed for visualization
    Object.keys(base).forEach(key => {
      const val = base[key];
      if (val === 'true' || val === 'false') {
        base[key] = val === 'true';
      } else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
        base[key] = Number(val);
      }
    });
    
    // Prefer provided timestamps if present (ts, time, timestamp)
    const candidateTs = base.timestamp || base.ts || base.time;
    if (candidateTs !== undefined && candidateTs !== null) {
      let tsIso;
      if (typeof candidateTs === 'number') {
        const ms = candidateTs > 1e12 ? candidateTs : candidateTs > 1e9 ? candidateTs * 1000 : candidateTs;
        tsIso = new Date(ms).toISOString();
      } else if (typeof candidateTs === 'string') {
        const n = Number(candidateTs.trim());
        if (Number.isFinite(n)) {
          const ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : n;
          tsIso = new Date(ms).toISOString();
        } else {
          const d = new Date(candidateTs);
          tsIso = isNaN(d.getTime()) ? undefined : d.toISOString();
        }
      }
      if (tsIso) {
        base.timestamp = tsIso;
      }
    }
    
    // Always ensure timestamp exists
    if (!base.timestamp) {
      base.timestamp = new Date().toISOString();
    }
    
    // Add metadata fields if not present
    if (!Object.prototype.hasOwnProperty.call(base, 'source')) {
      base.source = 'serial';
    }
    if (!Object.prototype.hasOwnProperty.call(base, 'status')) {
      base.status = 'ok';
    }
    
    // Ensure a 'value' field exists for charts that need a primary value
    const numericKeys = Object.keys(base).filter((k) => typeof base[k] === 'number');
    const preferred = ['value', 'val', 'reading', 'batt', 'battery', 'temp', 'temperature', 'hum', 'humid', 'humidity', 'press', 'pressure', 'co2', 'lux'];
    const preferredKey = preferred.find((k) => Object.prototype.hasOwnProperty.call(base, k) && typeof base[k] === 'number');
    const firstNumericKey = preferredKey || numericKeys.find((k) => k !== 'timestamp');
    if (firstNumericKey && !Object.prototype.hasOwnProperty.call(base, 'value')) {
      base.value = base[firstNumericKey];
    }
    
    // If no numeric values found, add a default value field
    if (numericKeys.length === 0 && !base.value) {
      base.value = 0;
    }
    
    return base;
  }
  
  setWebSocketServer(wss) {
    this.wss = wss;
  }
  
  // Ensure serial listener is attached for a given connection
  ensureSerialListener(connectionId, softLimit = 1000) {
    const c = this.connections[connectionId];
    if (!c || c.type !== "serial") return;
    if (!c.dataCache) c.dataCache = [];
    if (c.dataListenerSet) return;
    if (!c.parser) {
      console.error(`❌ No parser available for serial connection ${connectionId}`);
      return;
    }
    c.parser.on('data', (line) => {
      try {
        if (!line || (typeof line === 'string' && line.trim() === '')) {
          return;
        }
        console.log(`🔌 Serial line (${connectionId}):`, typeof line === 'string' ? line : JSON.stringify(line));
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          const repaired = this.tryRepairJsonString(line);
          parsed = repaired || this.parseNonJsonSerialLine(line);
        }
        const flatRow = { timestamp: new Date().toISOString(), ...this.toReadableSerialRow(parsed) };
        c.dataCache.push(flatRow);
        if (c.dataCache.length > softLimit) {
          c.dataCache = c.dataCache.slice(-softLimit);
        }
        if (this.wss) {
          this.broadcastUpdate(connectionId, "serial", flatRow);
        }
      } catch (err) {
        console.error(`Error processing serial data: ${err.message}`);
      }
    });
    c.dataListenerSet = true;
    console.log(`✅ Serial data listener set up for connection ${connectionId}`);
  }
  
  broadcastUpdate(connectionId, topic, newData) {
    if (!this.wss) return;
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: "update",
          id: connectionId,
          topic: topic,
          rows: [newData]
        }));
      }
    });
  }

  async addConnection(type, config) {
    const id = "conn" + (this.idCounter++);
    let entry;
    if (type === "sql") entry = await createSqlConnection(config);
    else if (type === "mqtt") {
      entry = { client: createMqttConnection(config) };
      // Initialize MQTT-specific properties
      entry.dataCache = {};
      entry.subscribedTopics = new Set();
      
      // Store connection FIRST before setting up handlers to avoid race conditions
      this.connections[id] = { id, type, dbType: undefined, config, ...entry };
      const conn = this.connections[id];
      
      // Set up global message handler for this MQTT connection
      conn.client.on('connect', () => {
        console.log(`✅ MQTT connected: ${id} to broker ${config.brokerUrl}`);
        // Subscribe to topic if provided in config
        if (config.topic) {
          console.log(`📡 Attempting to subscribe to topic: ${config.topic}`);
          conn.client.subscribe(config.topic, { qos: 0 }, (err) => {
            if (err) {
              console.error(`❌ MQTT subscription error for topic ${config.topic}:`, err);
            } else {
              console.log(`✅ Successfully subscribed to MQTT topic: ${config.topic}`);
              conn.subscribedTopics.add(config.topic);
              if (!conn.dataCache[config.topic]) {
                conn.dataCache[config.topic] = [];
              }
            }
          });
        } else {
          console.warn(`⚠️ No topic specified for MQTT connection ${id}`);
        }
      });
      
      // Also subscribe immediately if already connected
      const checkAndSubscribe = () => {
        if (conn.client && conn.client.connected && config.topic) {
          console.log(`📡 Client already connected, subscribing to topic: ${config.topic}`);
          conn.client.subscribe(config.topic, { qos: 0 }, (err) => {
            if (err) {
              console.error(`❌ Immediate subscription error:`, err);
            } else {
              console.log(`✅ Immediate subscription successful to: ${config.topic}`);
              conn.subscribedTopics.add(config.topic);
              if (!conn.dataCache[config.topic]) {
                conn.dataCache[config.topic] = [];
              }
            }
          });
        }
      };
      
      // Check immediately
      checkAndSubscribe();
      
      // Also check after a short delay in case connection happens async
      setTimeout(checkAndSubscribe, 100);
      
      // Set up message handler that works for all topics
      const connectionId = id;
      conn.client.on('message', (receivedTopic, message) => {
        console.log(`📨 MQTT message received on topic: ${receivedTopic}, length: ${message.length}`);
        try {
          // Get the connection from connections map
          const connection = this.connections[connectionId];
          if (!connection) {
            console.error(`❌ Connection ${connectionId} not found`);
            return;
          }
          if (!connection.dataCache) {
            console.error(`❌ Data cache not initialized for ${connectionId}`);
            return;
          }
          
          // Parse message as JSON
          let parsedData;
          const messageStr = message.toString();
          try {
            parsedData = JSON.parse(messageStr);
            console.log(`✅ Parsed JSON message with keys:`, Object.keys(parsedData));
          } catch (parseErr) {
            console.warn(`⚠️ Message is not valid JSON, storing as raw:`, parseErr.message);
            // If not JSON, store as plain text with raw field
            parsedData = { raw: messageStr };
          }
          
          // Initialize cache for this topic if needed
          if (!connection.dataCache[receivedTopic]) {
            console.log(`📁 Initializing cache for topic: ${receivedTopic}`);
            connection.dataCache[receivedTopic] = [];
          }
          
          // Flatten data for EDA: merge timestamp and data fields
          const flatData = {
            timestamp: new Date().toISOString(),
            topic: receivedTopic,
            ...parsedData
          };
          
          connection.dataCache[receivedTopic].push(flatData);
          console.log(`💾 Cached message. Cache size for ${receivedTopic}: ${connection.dataCache[receivedTopic].length}`);
          
          // Increase limit for real-time EDA - keep last 10,000 messages per topic for flowing data
          // This allows for longer analysis windows while still preventing memory issues
          const EDA_LIMIT = 10000; // Increased from 1000 to support real-time EDA
          if (connection.dataCache[receivedTopic].length > EDA_LIMIT) {
            connection.dataCache[receivedTopic] = connection.dataCache[receivedTopic].slice(-EDA_LIMIT);
          }
          
          // Emit WebSocket update if wss is available
          if (this.wss) {
            this.broadcastUpdate(connectionId, receivedTopic, flatData);
            console.log(`📤 WebSocket update broadcasted for ${connectionId}`);
          } else {
            console.warn(`⚠️ WebSocket server not available for broadcasting`);
          }
          
          console.log(`✅ Successfully processed message on ${receivedTopic} (${connectionId}), data keys:`, Object.keys(parsedData));
        } catch (err) {
          console.error(`❌ Error processing MQTT message on ${receivedTopic}:`, err.message, err.stack);
        }
      });
      
      conn.client.on('error', (err) => {
        console.error(`❌ MQTT error for ${id}:`, err);
      });
      
      return conn;
    }
    else if (type === "static") {
      // Static/snapshot connection - stores data directly
      entry = {
        dataCache: {},
        snapshotData: config.snapshotData || []
      };
      
      // Convert snapshot data to dataCache format for compatibility
      if (Array.isArray(entry.snapshotData)) {
        entry.snapshotData.forEach((tableData, idx) => {
          const tableName = tableData.table || `table_${idx}`;
          entry.dataCache[tableName] = tableData.rows || [];
        });
      }
    }
    else if (type === "serial") {
      entry = createSerialConnection(config);
      // Initialize serial-specific properties
      entry.dataCache = [];
      entry.dataListenerSet = false;
      // Store connection before setting listener
      this.connections[id] = { id, type, dbType: undefined, config, ...entry };
      // Immediately ensure listener is attached
      this.ensureSerialListener(id, 1000);
      return this.connections[id];
    }
    else if (type === "http") {
      entry = { client: createHttpConnection(config) };
      // Initialize HTTP-specific properties
      entry.dataCache = {};
      entry.pollInterval = null;
      
      // Store connection FIRST before setting up polling
      this.connections[id] = { id, type, dbType: undefined, config, ...entry };
      const conn = this.connections[id];
      
      // Set up automatic polling if endpoint and poll interval are configured
      if (config.endpoint && config.pollIntervalMs) {
        const pollIntervalMs = Number(config.pollIntervalMs) || 5000; // Default 5 seconds
        const endpoint = config.endpoint;
        
        // Initial fetch
        this.pollHttpEndpoint(id, endpoint);
        
        // Set up interval for continuous polling
        conn.pollInterval = setInterval(() => {
          this.pollHttpEndpoint(id, endpoint);
        }, pollIntervalMs);
        
        console.log(`🔄 HTTP polling started for ${id} at endpoint ${endpoint}, interval: ${pollIntervalMs}ms`);
      } else if (config.endpoint) {
        // If endpoint is provided but no interval, do initial fetch
        this.pollHttpEndpoint(id, config.endpoint);
      }
      
      return conn;
    }
    else throw new Error("Unsupported type");
    // Preserve protocol type (e.g., 'sql') and store DB subtype separately to avoid UI confusion
    let dbType;
    if (type === "sql") {
      dbType = entry && entry.type ? entry.type : undefined;
      if (entry && Object.prototype.hasOwnProperty.call(entry, "type")) {
        delete entry.type; // prevent overwriting protocol type
      }
    }
    this.connections[id] = { id, type, dbType, config, ...entry };
    return this.connections[id];
  }

  removeConnection(id) {
    const conn = this.connections[id];
    if (conn && conn.pollInterval) {
      clearInterval(conn.pollInterval);
      console.log(`🛑 Stopped HTTP polling for ${id}`);
    }
    delete this.connections[id];
  }

  listConnections() {
    return Object.values(this.connections);
  }

  getConnection(id) {
    return this.connections[id];
  }

  async getSqlTables(id) {
    const c = this.connections[id];
    if (!c || !c.type) throw new Error("Invalid connection or missing type");
    if (c.type !== "sql") throw new Error("Not SQL");
    return getTables(c);
  }

  async previewSqlTable(id, table, limit) {
    const c = this.connections[id];
    if (!c || !c.type) throw new Error("Invalid connection or missing type");
    if (c.type !== "sql") throw new Error("Not SQL");
    return previewTable(c, table, limit);
  }

  // MQTT, HTTP, Serial data preview methods
  async previewMqttData(id, topic, limit = 1000) {
    const c = this.connections[id];
    if (!c || c.type !== "mqtt") throw new Error("Not MQTT");
    
    // If there's no data cache yet, create one
    if (!c.dataCache) c.dataCache = {};
    if (!c.dataCache[topic]) c.dataCache[topic] = [];
    
    // Subscribe to the topic if not already subscribed
    if (!c.subscribedTopics) c.subscribedTopics = new Set();
    if (!c.subscribedTopics.has(topic)) {
      c.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ MQTT subscription error for topic ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to MQTT topic: ${topic}`);
          c.subscribedTopics.add(topic);
        }
      });
    }
    
    // Return cached data (message handler already set up in addConnection)
    return c.dataCache[topic] || [];
  }
  
  async pollHttpEndpoint(id, endpoint) {
    const c = this.connections[id];
    if (!c || c.type !== "http") {
      console.error(`❌ HTTP connection ${id} not found or not HTTP type`);
      return;
    }
    
    try {
      // Build endpoint URL with device ID support
      let endpointPath = endpoint || c.config?.endpoint || '';
      
      // If device ID is provided, append as query parameter or include in path
      if (c.config?.deviceId) {
        const deviceId = c.config.deviceId;
        // Check if endpoint already has query params
        if (endpointPath.includes('?')) {
          endpointPath += `&device_id=${encodeURIComponent(deviceId)}`;
        } else {
          endpointPath += `?device_id=${encodeURIComponent(deviceId)}`;
        }
      }
      
      console.log(`📡 HTTP polling: ${id} -> ${endpointPath}`);
      const response = await c.client.get(endpointPath);
      const responseData = response.data;
      
      // Use base endpoint (without query params) as cache key
      const cacheKey = endpoint || c.config?.endpoint || endpointPath.split('?')[0];
      
      // Initialize cache if needed
      if (!c.dataCache) c.dataCache = {};
      if (!c.dataCache[cacheKey]) c.dataCache[cacheKey] = [];
      
      // Flatten data similar to MQTT: handle both object and array responses
      let flatData;
      if (Array.isArray(responseData)) {
        // If response is an array, add each item with timestamp
        responseData.forEach(item => {
          flatData = {
            timestamp: new Date().toISOString(),
            endpoint: cacheKey,
            deviceId: c.config?.deviceId || null,
            ...(typeof item === 'object' ? item : { value: item })
          };
          c.dataCache[cacheKey].push(flatData);
        });
      } else if (typeof responseData === 'object' && responseData !== null) {
        // If response is an object, flatten it with timestamp
        flatData = {
          timestamp: new Date().toISOString(),
          endpoint: cacheKey,
          deviceId: c.config?.deviceId || null,
          ...responseData
        };
        c.dataCache[cacheKey].push(flatData);
      } else {
        // Primitive value, wrap it
        flatData = {
          timestamp: new Date().toISOString(),
          endpoint: cacheKey,
          deviceId: c.config?.deviceId || null,
          value: responseData
        };
        c.dataCache[cacheKey].push(flatData);
      }
      
      // Keep last 10,000 entries per endpoint (similar to MQTT limit for real-time EDA)
      const EDA_LIMIT = 10000;
      if (c.dataCache[cacheKey].length > EDA_LIMIT) {
        c.dataCache[cacheKey] = c.dataCache[cacheKey].slice(-EDA_LIMIT);
      }
      
      // Emit WebSocket update if available
      if (this.wss && flatData) {
        this.broadcastUpdate(id, cacheKey, flatData);
      }
      
      console.log(`✅ HTTP data cached for ${cacheKey}, cache size: ${c.dataCache[cacheKey].length}`);
    } catch (err) {
      console.error(`❌ HTTP polling error for ${id} (${endpoint}):`, err.message);
      // Don't throw, just log - polling should continue even if one request fails
    }
  }
  
  async previewHttpData(id, endpoint, limit = 5) {
    const c = this.connections[id];
    if (!c || c.type !== "http") throw new Error("Not HTTP");
    
    // If endpoint is provided, fetch it now (this also initializes polling if configured)
    if (endpoint) {
      await this.pollHttpEndpoint(id, endpoint);
    }
    
    // Return cached data
    if (!c.dataCache) c.dataCache = {};
    if (endpoint && c.dataCache[endpoint]) {
      // Return the requested endpoint's data
      const data = c.dataCache[endpoint];
      // If limit is specified, return only the latest entries
      return limit ? data.slice(-limit) : data;
    }
    
    // If no specific endpoint requested, return all cached endpoints' data
    return Object.values(c.dataCache).flat().slice(-limit);
  }
  
  async previewSerialData(id, limit = 20) {
    const c = this.connections[id];
    if (!c || c.type !== "serial") throw new Error("Not Serial");
    
    // Ensure data cache exists
    if (!c.dataCache) {
      c.dataCache = [];
    }

    // Always ensure the data listener is attached once the parser exists
    if (!c.dataListenerSet) {
      if (c.parser) {
        c.parser.on('data', (line) => {
          try {
            if (!line || (typeof line === 'string' && line.trim() === '')) {
              return; // ignore empty lines
            }
            // Log the incoming line once for visibility
            console.log(`🔌 Serial line (${id}):`, typeof line === 'string' ? line : JSON.stringify(line));
            let parsed;
            try {
              // Try to parse as JSON first
              parsed = JSON.parse(line);
            } catch {
              // Attempt to repair common malformed JSON fragments
              const repaired = this.tryRepairJsonString(line);
              if (repaired) {
                parsed = repaired;
              } else {
                // Fallback: coerce to an object for charts
                parsed = this.parseNonJsonSerialLine(line);
              }
            }

            // Normalize to flat row like MQTT/HTTP
            const flatRow = {
              timestamp: new Date().toISOString(),
              ...this.toReadableSerialRow(parsed)
            };

            c.dataCache.push(flatRow);

            // Keep only the latest 'limit' messages (soft cap)
            if (c.dataCache.length > limit) {
              c.dataCache = c.dataCache.slice(-limit);
            }

            // Emit WebSocket update if available
            if (this.wss) {
              this.broadcastUpdate(id, "serial", flatRow);
            }
          } catch (err) {
            console.error(`Error processing serial data: ${err.message}`);
          }
        });
        c.dataListenerSet = true;
        console.log(`✅ Serial data listener set up for connection ${id}`);
      } else {
        console.error(`❌ No parser available for serial connection ${id}`);
      }
    }
    
    return c.dataCache;
  }
}

export default new ConnectionManager();
