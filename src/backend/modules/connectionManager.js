import { v4 as uuidv4 } from "uuid";
import path from "path";
import url from "url";
import sqlHandler from "./sqlHandler.js"; // Import SQL handler directly

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const connections = {}; // { id: { id, type, config, client, cache, listeners } }
const websockets = new Set();

function broadcastToWs(messageObj) {
  const s = JSON.stringify(messageObj);
  for (const ws of websockets) {
    try {
      if (ws.readyState === 1) ws.send(s);
    } catch (e) {}
  }
}

const manager = {
  async addConnection(type, config) {
    const id = `conn_${uuidv4()}`;
    let client = null;
    try {
      let handler;
      if (type === "sql") {
        handler = sqlHandler;
        client = await handler.connect(config, (data) => {
          const existing = connections[id]?.cache || [];
          const rows = Array.isArray(data) ? data : [data];
          const merged = [...existing, ...rows].slice(-200);
          if (connections[id]) connections[id].cache = merged;
          for (const fn of connections[id].listeners) {
            try { fn(rows); } catch (e) { }
          }
          broadcastToWs({ type: "update", id, rows });
        }, id); // Pass id
      } else {
        const handlerPath = path.join(__dirname, `${type}Handler.js`);
        const module = await import(url.pathToFileURL(handlerPath).href);
        handler = module.default;
        if (!handler || typeof handler.connect !== "function") {
          throw new Error("Handler module must export default with connect(config, onData)");
        }
        client = await handler.connect(config, (data) => {
          const existing = connections[id]?.cache || [];
          const rows = Array.isArray(data) ? data : [data];
          const merged = [...existing, ...rows].slice(-200);
          if (connections[id]) connections[id].cache = merged;
          for (const fn of connections[id].listeners) {
            try { fn(rows); } catch (e) { }
          }
          broadcastToWs({ type: "update", id, rows });
        });
      }
      connections[id] = { id, type, config, client, cache: [], listeners: new Set() };
      console.log(`✅ Connection ${id} (${type}) created`);
      return { id, type, config };
    } catch (err) {
      if (connections[id]) delete connections[id];
      console.error("addConnection error:", err);
      throw err;
    }
  },

  removeConnection(id) {
    const c = connections[id];
    if (!c) return false;
    try {
      if (c.client) {
        if (typeof c.client.close === "function") c.client.close();
        if (typeof c.client.end === "function") c.client.end();
        if (typeof c.client.destroy === "function") c.client.destroy();
        if (typeof c.client.stop === "function") { try { c.client.stop(); } catch (e) {} }
      }
    } catch (e) {
      console.error("error shutting down client", e);
    }
    delete connections[id];
    broadcastToWs({ type: "removed", id });
    return true;
  },

  getConnection(id) {
    return connections[id] || null;
  },

  getSqlTables(id) {
    // Use direct handler, always pass id
    return sqlHandler.getSqlTables(id);
  },

  selectSqlTables(id, tables) {
    return sqlHandler.selectSqlTables(id, tables, (rows) => {
      broadcastToWs({ type: "update", id, rows });
    });
  },

  getData(id) {
    if (!connections[id]) return undefined;
    return connections[id].cache || [];
  },

  listConnections() {
    return Object.values(connections).map((c) => ({
      id: c.id,
      type: c.type,
      config: c.config,
      count: (c.cache || []).length
    }));
  },

  pushManual(id, payload) {
    if (!connections[id]) return false;
    const rows = Array.isArray(payload) ? payload : [payload];
    const existing = connections[id].cache || [];
    connections[id].cache = [...existing, ...rows].slice(-200);
    broadcastToWs({ type: "manual", id, rows });
    return true;
  },

  addListener(id, fn) {
    if (!connections[id]) return false;
    connections[id].listeners.add(fn);
    return true;
  },
  removeListener(id, fn) {
    if (!connections[id]) return false;
    connections[id].listeners.delete(fn);
    return true;
  },

  registerWebSocket(ws) {
    websockets.add(ws);
    ws.on("close", () => websockets.delete(ws));
  }
};

export default manager;
