const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = require("node-fetch");

dotenv.config();

const OPENAI_KEY = process.env.SERVER_OPENAI_KEY || process.env.OPENAI_API_KEY || "";

if (!OPENAI_KEY) {
  console.warn("No server-side OpenAI key detected. Set SERVER_OPENAI_KEY in server/.env to enable proxy.");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { prompt, messages, model = "gpt-3.5-turbo" } = req.body || {};
  if (!OPENAI_KEY) {
    return res.status(503).json({ error: "Server side OpenAI key not configured." });
  }

  const payload = messages && Array.isArray(messages) && messages.length > 0
    ? { model, messages }
    : { model, messages: [{ role: "system", content: "You are Datanaut assistant. Help create charts." }, { role: "user", content: String(prompt || "") }] };

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...payload, max_tokens: 800 })
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(502).json({ error: "OpenAI error", detail: errText });
    }
    const data = await r.json();
    const assistantText = data?.choices?.[0]?.message?.content || "";
    return res.json({ assistantText });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failed", detail: String(err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Datanaut server proxy listening on port ${PORT}`);
});
