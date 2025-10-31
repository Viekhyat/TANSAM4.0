import { createSqlConnection, getTables, previewTable } from "./modules/sql.js";
import { createMqttConnection } from "./modules/mqtt.js";
import { createSerialConnection } from "./modules/serial.js";
import { createHttpConnection } from "./modules/http.js";

class ConnectionManager {
  constructor() {
    this.connections = {};
    this.idCounter = 1;
  }

  async addConnection(type, config) {
    const id = "conn" + (this.idCounter++);
    let entry;
    if (type === "sql") entry = await createSqlConnection(config);
    else if (type === "mqtt") entry = { client: createMqttConnection(config) };
    else if (type === "serial") entry = createSerialConnection(config);
    else if (type === "http") entry = { client: createHttpConnection(config) };
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
  async previewMqttData(id, topic, limit = 10) {
    const c = this.connections[id];
    if (!c || c.type !== "mqtt") throw new Error("Not MQTT");
    
    // If there's no data cache yet, create one
    if (!c.dataCache) c.dataCache = {};
    if (!c.dataCache[topic]) c.dataCache[topic] = [];
    
    // Subscribe to the topic if not already subscribed
    if (!c.subscribedTopics) c.subscribedTopics = new Set();
    if (!c.subscribedTopics.has(topic)) {
      c.client.subscribe(topic);
      c.client.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic) {
          try {
            const data = JSON.parse(message.toString());
            c.dataCache[topic].push({
              timestamp: new Date().toISOString(),
              data
            });
            // Keep only the latest 'limit' messages
            if (c.dataCache[topic].length > limit) {
              c.dataCache[topic] = c.dataCache[topic].slice(-limit);
            }
          } catch (err) {
            console.error(`Error parsing MQTT message: ${err.message}`);
          }
        }
      });
      c.subscribedTopics.add(topic);
    }
    
    return c.dataCache[topic];
  }
  
  async previewHttpData(id, endpoint, limit = 5) {
    const c = this.connections[id];
    if (!c || c.type !== "http") throw new Error("Not HTTP");
    
    try {
      const response = await c.client.get(endpoint);
      const data = response.data;
      
      // Store the data in cache
      if (!c.dataCache) c.dataCache = {};
      if (!c.dataCache[endpoint]) c.dataCache[endpoint] = [];
      
      c.dataCache[endpoint].push({
        timestamp: new Date().toISOString(),
        data
      });
      
      // Keep only the latest 'limit' responses
      if (c.dataCache[endpoint].length > limit) {
        c.dataCache[endpoint] = c.dataCache[endpoint].slice(-limit);
      }
      
      return c.dataCache[endpoint];
    } catch (err) {
      console.error(`HTTP request error: ${err.message}`);
      throw new Error(`HTTP request failed: ${err.message}`);
    }
  }
  
  async previewSerialData(id, limit = 20) {
    const c = this.connections[id];
    if (!c || c.type !== "serial") throw new Error("Not Serial");
    
    // Initialize data cache if it doesn't exist
    if (!c.dataCache) {
      c.dataCache = [];
      
      // Set up the data listener if not already set
      if (!c.dataListenerSet) {
        c.parser.on('data', (line) => {
          try {
            let data;
            try {
              // Try to parse as JSON first
              data = JSON.parse(line);
            } catch {
              // If not JSON, store as plain text
              data = { raw: line };
            }
            
            c.dataCache.push({
              timestamp: new Date().toISOString(),
              data
            });
            
            // Keep only the latest 'limit' messages
            if (c.dataCache.length > limit) {
              c.dataCache = c.dataCache.slice(-limit);
            }
          } catch (err) {
            console.error(`Error processing serial data: ${err.message}`);
          }
        });
        c.dataListenerSet = true;
      }
    }
    
    return c.dataCache;
  }
}

export default new ConnectionManager();
