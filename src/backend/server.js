import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import routes from "./routes.js";
import connectionManager from "./connectionManager.js";
const app = express();
const PORT = process.env.PORT || 8085;
app.use(cors());
app.use(bodyParser.json());
app.use("/api", routes);
app.get("/status", (req, res) =>
  res.json({ server: "Unified Multi-Protocol Server", status: "running" }));
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Set WebSocket server reference in connection manager
connectionManager.setWebSocketServer(wss);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("close", () => {});
});
httpServer.listen(PORT, () => {
  console.log(`🚀 Unified Multi-Protocol Server running on port ${PORT}`);
});
