import express from "express";
import fs from "fs";
import mqtt from "mqtt";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8085;
app.use(express.json());

const DATA_FILE = path.join(__dirname, "iot_messages.json");

// --- Load existing data ---
let allData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    const content = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (content && typeof content === "object") allData = content;
  } catch {
    console.warn("⚠️ Corrupted file — starting fresh");
  }
}

// --- Normalize keys ---
function normalizeKeys(data) {
  const keyMap = {
    Vibratioon_Level_mms: "Vibration_Level_mms",
    Vibration_Level_mmms: "Vibration_Level_mms",
  };
  for (const wrong in keyMap) {
    if (data[wrong]) {
      data[keyMap[wrong]] = data[wrong];
      delete data[wrong];
    }
  }
  return data;
}

// --- Save all data safely ---
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
}

// --- Manage active MQTT clients ---
const clients = {}; // key: broker_url:port:topic → client

// --- Connect to new broker ---
function connectToBroker(brokerUrl, port, topic) {
  const key = `${brokerUrl}:${port}:${topic}`;

  if (clients[key]) {
    console.log(`⚠️ Already connected to ${key}`);
    return clients[key];
  }

  const client = mqtt.connect(`mqtt://${brokerUrl}:${port}`);

  client.on("connect", () => {
    console.log(`✅ Connected → ${key}`);
    client.subscribe(topic, (err) => {
      if (err) console.error(`❌ Failed to subscribe: ${key}`);
      else console.log(`📡 Subscribed → ${topic}`);
    });
  });

  client.on("error", (err) => {
    console.error(`❌ Error with ${key}:`, err.message);
  });

  client.on("message", (receivedTopic, message) => {
    try {
      const parsed = JSON.parse(message.toString());
      const normalized = normalizeKeys(parsed);
      normalized.timestamp = new Date().toISOString();

      if (!allData[key]) allData[key] = [];

      allData[key].push(normalized);

      // maintain max 700, delete oldest 100
      if (allData[key].length > 700) {
        allData[key].splice(0, 100);
      }

      saveData();

      console.log(`📩 Message from ${key}`);
    } catch {
      console.warn(`⚠️ Invalid JSON on ${key}: ${message.toString()}`);
    }
  });

  clients[key] = client;
  return client;
}

// --- Disconnect broker ---
function disconnectBroker(brokerUrl, port, topic) {
  const key = `${brokerUrl}:${port}:${topic}`;
  const client = clients[key];
  if (client) {
    client.end(true);
    delete clients[key];
    console.log(`🔌 Disconnected from ${key}`);
  }
}

// --- Express Endpoints ---
// ✅ Add a new broker
app.post("/api/add-broker", (req, res) => {
  const { url, port, topic } = req.body;
  if (!url || !port || !topic)
    return res.status(400).json({ error: "Missing broker details" });

  connectToBroker(url, port, topic);
  res.json({ message: `Broker ${url}:${port} subscribed to ${topic}` });
});

// 🔌 Disconnect a broker
app.post("/api/remove-broker", (req, res) => {
  const { url, port, topic } = req.body;
  if (!url || !port || !topic)
    return res.status(400).json({ error: "Missing broker details" });

  disconnectBroker(url, port, topic);
  res.json({ message: `Disconnected from ${url}:${port}/${topic}` });
});

// 📊 Fetch messages (latest 100 per source)
app.get("/api/messages", (req, res) => {
  const result = {};
  for (const [key, msgs] of Object.entries(allData)) {
    result[key] = msgs.slice(-100);
  }
  res.json(result);
});

// 🧠 Get connection status
app.get("/api/status", (req, res) => {
  const status = {};
  for (const key of Object.keys(clients)) {
    status[key] = clients[key].connected ? "connected" : "disconnected";
  }
  res.json(status);
});

// 🏠 Root endpoint
app.get("/", (_, res) => {
  res.send("✅ Dynamic Multi-Broker MQTT Receiver is running");
});

// 🚀 Start server
app.listen(PORT, () =>
  console.log(`🚀 Server live → http://127.0.0.1:${PORT}`)
);
