import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
import { buildChartData } from "../utils/chartData.js";
import ChartRenderer from "./ChartRenderer.jsx";

const CLIENT_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const MODELS = { chat: "gpt-3.5-turbo" };
const KNOWN_CHARTS = ["line", "bar", "area", "scatter", "pie", "donut", "radar"];

/* --- Type helpers (unchanged from prior) --- */
const isNumericValue = (v) => {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
};
const isDateValue = (v) => {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

/* --- Lightweight type inference --- */
const inferTypesFromSamples = (headers = [], rows = []) => {
  const sampleCount = Math.min(rows.length, 100);
  const counts = headers.reduce((acc, h) => ({ ...acc, [h]: { num: 0, date: 0, str: 0, distinct: new Set() } }), {});
  for (let i = 0; i < sampleCount; i += 1) {
    const r = rows[i] || {};
    headers.forEach((h) => {
      const v = r[h];
      counts[h].distinct.add(String(v));
      if (isNumericValue(v)) counts[h].num += 1;
      else if (isDateValue(v)) counts[h].date += 1;
      else counts[h].str += 1;
    });
  }
  const typeMap = {};
  headers.forEach((h) => {
    const c = counts[h];
    const distinctCount = c.distinct.size;
    if (c.num > 0 && c.str === 0 && c.date === 0) typeMap[h] = "number";
    else if (c.date > 0 && c.num === 0) typeMap[h] = "date";
    else if (distinctCount <= Math.max(10, Math.ceil(sampleCount * 0.2))) typeMap[h] = "category";
    else typeMap[h] = "string";
  });
  return typeMap;
};

const buildTypeMap = (dataset) => {
  const headers = dataset?.schema?.headers || [];
  const schemaTypes = dataset?.schema?.types || [];
  if (!headers.length) return {};
  const hasSchemaTypes = Array.isArray(schemaTypes) && schemaTypes.length >= headers.length;
  if (hasSchemaTypes) {
    const tm = {};
    headers.forEach((h, idx) => {
      const t = schemaTypes[idx] || "string";
      if (t === "number") tm[h] = "number";
      else if (t === "date") tm[h] = "date";
      else tm[h] = "string";
    });
    return tm;
  }
  const rows = dataset?.data || dataset?.rowsPreview || [];
  return inferTypesFromSamples(headers, rows);
};

/* --- Field pickers --- */
const pickNumeric = (headers, typeMap) => headers.filter((h) => typeMap[h] === "number");
const pickCategory = (headers, typeMap) => headers.filter((h) => typeMap[h] === "category" || typeMap[h] === "string");
const pickDate = (headers, typeMap) => headers.filter((h) => typeMap[h] === "date");

/* --- Chart validation (keeps previous robust logic) --- */
const validateAndFixChart = (chart, dataset, buildChartDataFn = buildChartData) => {
  const headers = dataset?.schema?.headers || [];
  const rows = dataset?.data || dataset?.rowsPreview || [];
  const typeMap = buildTypeMap(dataset);
  const numeric = pickNumeric(headers, typeMap);
  const category = pickCategory(headers, typeMap);
  const dates = pickDate(headers, typeMap);

  const tryBuild = (candidate) => {
    const data = buildChartDataFn(rows, candidate.chartType, candidate.mappings || {}, candidate.options || {});
    return Array.isArray(data) && data.length > 0 ? { chart: candidate, data } : null;
  };

  // try as-is
  let result = tryBuild(chart);
  if (result) return result;

  const candidate = JSON.parse(JSON.stringify(chart));

  // type-specific fallbacks (same approach as before)
  if (["pie", "donut"].includes(candidate.chartType)) {
    if (!candidate.mappings.categoryField) candidate.mappings.categoryField = category[0] || headers[0] || "";
    if (!candidate.mappings.valueField) candidate.mappings.valueField = numeric[0] || headers.find((h) => h !== candidate.mappings.categoryField) || headers[0] || "";
    const valueCandidates = [candidate.mappings.valueField, ...numeric.filter((n) => n !== candidate.mappings.valueField)];
    for (const val of valueCandidates) {
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.valueField = val;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
    for (const cat of category) {
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.categoryField = cat;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
  } else if (["line", "bar", "area"].includes(candidate.chartType)) {
    if (!candidate.mappings.xField) candidate.mappings.xField = dates[0] || headers[0] || "";
    if (!candidate.mappings.yFields || candidate.mappings.yFields.length === 0) candidate.mappings.yFields = numeric.length ? [numeric[0]] : [headers[1] || headers[0]];
    const yCandidates = candidate.mappings.yFields.length ? candidate.mappings.yFields : numeric.slice(0, 3);
    for (let i = 0; i < Math.max(1, yCandidates.length); i += 1) {
      const tryFields = yCandidates.slice(0, i + 1);
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.yFields = tryFields;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
    const xCandidates = [candidate.mappings.xField, ...dates, ...category.filter((h) => h !== candidate.mappings.xField)];
    for (const xf of xCandidates) {
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.xField = xf;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
  } else if (candidate.chartType === "scatter") {
    if (!candidate.mappings.xField) candidate.mappings.xField = numeric[0] || headers[0] || "";
    if (!candidate.mappings.yField) candidate.mappings.yField = numeric[1] || numeric[0] || headers[1] || headers[0] || "";
    const candidatesPairs = [];
    for (let i = 0; i < numeric.length; i += 1) {
      for (let j = 0; j < numeric.length; j += 1) {
        if (i === j) continue;
        candidatesPairs.push([numeric[i], numeric[j]]);
      }
    }
    if (candidatesPairs.length === 0) candidatesPairs.push([candidate.mappings.xField, candidate.mappings.yField]);
    for (const [x, y] of candidatesPairs) {
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.xField = x;
      c.mappings.yField = y;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
  } else if (candidate.chartType === "radar") {
    if (!candidate.mappings.angleField) candidate.mappings.angleField = category[0] || headers[0] || "";
    if (!candidate.mappings.radiusField) candidate.mappings.radiusField = numeric[0] || headers[1] || headers[0] || "";
    for (const r of numeric) {
      const c = JSON.parse(JSON.stringify(candidate));
      c.mappings.radiusField = r;
      const ok = tryBuild(c);
      if (ok) return ok;
    }
  }

  // last resort defaults
  const fallback = { chart: { ...chart, mappings: chart.mappings || {} }, data: [] };
  if (!fallback.chart.mappings || Object.keys(fallback.chart.mappings).length === 0) {
    const defaultMap = {};
    if (["line", "bar", "area"].includes(chart.chartType)) {
      defaultMap.xField = headers[0] || "";
      defaultMap.yFields = [numeric[0] || headers[1] || headers[0]];
    } else if (chart.chartType === "scatter") {
      defaultMap.xField = numeric[0] || headers[0];
      defaultMap.yField = numeric[1] || numeric[0] || headers[1] || headers[0];
    } else if (["pie", "donut"].includes(chart.chartType)) {
      defaultMap.categoryField = category[0] || headers[0];
      defaultMap.valueField = numeric[0] || headers[1] || headers[0];
    } else if (chart.chartType === "radar") {
      defaultMap.angleField = category[0] || headers[0];
      defaultMap.radiusField = numeric[0] || headers[1] || headers[0];
    }
    fallback.chart.mappings = defaultMap;
    const ok = tryBuild(fallback.chart);
    if (ok) return ok;
  }

  return null;
};

/* --- Utility functions for generic data tasks --- */
const summarizeDataset = (dataset) => {
  if (!dataset) return "No dataset selected.";
  const headers = dataset.schema?.headers || [];
  const types = dataset.schema?.types || [];
  const rowCount = dataset.originalRowCount ?? (dataset.data ? dataset.data.length : dataset.rowsPreview?.length ?? 0);
  return {
    rows: rowCount,
    columns: headers.length,
    headers: headers.map((h, i) => ({ name: h, type: types[i] || "inferred" }))
  };
};

const describeColumn = (dataset, column) => {
  if (!dataset || !column) return null;
  const rows = dataset.data || dataset.rowsPreview || [];
  const values = rows.map((r) => r[column]).filter((v) => v !== null && v !== undefined && v !== "");
  const unique = Array.from(new Set(values.map((v) => String(v))));
  const numericVals = values.filter((v) => isNumericValue(v)).map(Number);
  const stats = {};
  if (numericVals.length) {
    const sum = numericVals.reduce((a, b) => a + b, 0);
    stats.count = numericVals.length;
    stats.sum = sum;
    stats.mean = sum / numericVals.length;
    stats.min = Math.min(...numericVals);
    stats.max = Math.max(...numericVals);
  }
  return {
    sampleValues: values.slice(0, 6),
    uniqueCount: unique.length,
    ...stats
  };
};

const aggregateByCategory = (dataset, categoryField, valueField, method = "sum") => {
  const rows = dataset.data || dataset.rowsPreview || [];
  const map = new Map();
  rows.forEach((r) => {
    const key = r[categoryField];
    const val = Number(r[valueField]);
    if (key === undefined || key === null || Number.isNaN(val)) return;
    const bucket = map.get(key) || [];
    bucket.push(val);
    map.set(key, bucket);
  });
  const result = Array.from(map.entries()).map(([k, vals]) => {
    if (method === "sum") return { [categoryField]: k, [valueField]: vals.reduce((s, v) => s + v, 0) };
    if (method === "avg") return { [categoryField]: k, [valueField]: vals.reduce((s, v) => s + v, 0) / vals.length };
    if (method === "min") return { [categoryField]: k, [valueField]: Math.min(...vals) };
    if (method === "max") return { [categoryField]: k, [valueField]: Math.max(...vals) };
    return { [categoryField]: k, [valueField]: vals[vals.length - 1] };
  });
  return result;
};

const simpleFilterRows = (dataset, expr) => {
  // expr example: "Units > 100" or "Region = Alpha" or "Revenue >= 10000"
  if (!dataset || !expr) return [];
  const rows = dataset.data || dataset.rowsPreview || [];
  const m = expr.match(/^\s*([\w\s\-]+)\s*(>=|<=|=|!=|>|<|contains)\s*(.+)\s*$/i);
  if (!m) return [];
  const [, rawField, op, rawVal] = m;
  const field = rawField.trim();
  let value = rawVal.trim();
  if (/^['"].*['"]$/.test(value)) value = value.slice(1, -1);
  return rows.filter((r) => {
    const v = r[field];
    if (v === undefined) return false;
    if (op === "contains") return String(v).toLowerCase().includes(String(value).toLowerCase());
    const numV = Number(v);
    const numVal = Number(value);
    if (!Number.isNaN(numV) && !Number.isNaN(numVal)) {
      if (op === ">") return numV > numVal;
      if (op === "<") return numV < numVal;
      if (op === ">=") return numV >= numVal;
      if (op === "<=") return numV <= numVal;
      if (op === "=") return numV === numVal;
      if (op === "!=") return numV !== numVal;
    }
    if (op === "=") return String(v) === String(value);
    if (op === "!=") return String(v) !== String(value);
    return false;
  });
};

const exportCsvBlob = (rows, filename = "export.csv") => {
  if (!rows || !rows.length) return null;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")].concat(rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
};

/* --- Main Chatbot component (UI + command dispatch) --- */
export default function Chatbot() {
  const { datasets, saveChart, generateId } = useStore();
  const navigate = useNavigate();
  const datasetList = Object.values(datasets || []);
  const [open, setOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasetList[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!selectedDatasetId && datasetList.length) setSelectedDatasetId(datasetList[0].id);
  }, [datasetList, selectedDatasetId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const pushMessage = (m) => setMessages((prev) => [...prev, m]);

  const persistChartAndNavigate = (chart, datasetId) => {
    const id = generateId();
    const payload = {
      id,
      title: chart.title || `Chart ${new Date().toLocaleString()}`,
      datasetId: datasetId || selectedDatasetId || chart.datasetId,
      chartType: chart.chartType,
      mappings: chart.mappings || {},
      options: chart.options || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveChart(payload);
    pushMessage({ role: "assistant", text: `Saved chart "${payload.title}" to Dashboard.` });
    navigate("/dashboard");
  };

  /* server/client LLM helpers kept (unchanged behavior) */
  const callServerProxy = async (payload) => {
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("server-proxy-unavailable");
      return await resp.json();
    } catch (err) {
      return { error: err.message };
    }
  };

  const callClientOpenAI = async (prompt, headers) => {
    const systemContext = `You are Datanaut assistant. The user may ask for charts and data operations. Available headers: ${headers.join(
      ", "
    )}. If the user asks to produce a chart, respond with a JSON object inside triple-backticks with keys: action: "chart", chartType, mappings, options (optional). For other commands return plain text or structured JSON as appropriate.`;
    const body = {
      model: MODELS.chat,
      messages: [{ role: "system", content: systemContext }, { role: "user", content: prompt }],
      max_tokens: 800
    };
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLIENT_OPENAI_KEY}`
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    return { assistantText: data?.choices?.[0]?.message?.content || "" };
  };

  /* local intent (conservative) reused for chart creation */
  const localIntent = (prompt, headers = []) => {
    const lc = (prompt || "").toLowerCase();
    const chartType = KNOWN_CHARTS.find((t) => lc.includes(t)) || (lc.includes("chart") ? "bar" : null);
    if (!chartType) return null;
    const matched = headers.filter((h) => lc.includes(h.toLowerCase()));
    const mappings = {};
    if (["line", "bar", "area"].includes(chartType)) {
      mappings.xField = matched[0] || headers[0] || "";
      mappings.yFields = matched.length > 1 ? [matched[1]] : [headers[1] || headers[0] || ""];
    } else if (chartType === "scatter") {
      mappings.xField = matched[0] || headers[0] || "";
      mappings.yField = matched[1] || headers[1] || "";
    } else if (["pie", "donut"].includes(chartType)) {
      mappings.categoryField = matched[0] || headers[0] || "";
      mappings.valueField = matched[1] || headers[1] || headers[0] || "";
      mappings.donut = chartType === "donut";
    } else if (chartType === "radar") {
      mappings.angleField = matched[0] || headers[0] || "";
      mappings.radiusField = matched[1] || headers[1] || headers[0] || "";
    }
    return { chartType, mappings };
  };

  // Allowed actions the chatbot may perform (app boundaries)
  const ALLOWED_ACTIONS = ["chart", "summary", "describe", "topn", "filter", "export"];

  // Sanitize assistant text / JSON instructions from LLMs
  const sanitizeAssistantText = (text) => {
    if (!text || typeof text !== "string") {
      return { allowed: false, message: "Empty response" };
    }

    // If there is a JSON block, parse it and validate action
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[1]);
        if (!payload || typeof payload !== "object") {
          return { allowed: false, message: "Malformed JSON instruction; ignored." };
        }
        if (!payload.action || !ALLOWED_ACTIONS.includes(String(payload.action))) {
          return { allowed: false, message: "LLM suggested an action that is outside app boundaries. I can only create charts and operate on datasets." };
        }
        // strip JSON block and return the rest of text (if present)
        const stripped = text.replace(jsonMatch[0], "").trim();
        return { allowed: true, payload, strippedText: stripped };
      } catch (err) {
        return { allowed: false, message: "Malformed JSON instruction; ignored." };
      }
    }

    // Plain text: ensure message refers only to allowed topics (conservative)
    const lowered = text.toLowerCase();
    const allowedTokens = ["chart", "summarize", "summary", "describe", "column", "top", "filter", "export", "csv", "dataset", "rows", "columns", "pie", "bar", "line", "scatter", "radar", "donut", "area", "save", "dashboard"];
    const disallowedTokens = ["http", "https", "www", "openai", "api", "email", "gmail", "twitter", "facebook", "login", "signup", "server", "backend", "install", "download", "ssh"];

    const hasAllowed = allowedTokens.some((t) => lowered.includes(t));
    const hasDisallowed = disallowedTokens.some((t) => lowered.includes(t));

    if (hasDisallowed || !hasAllowed) {
      return { allowed: false, message: "I must stay within the app: summarizing datasets, describing columns, filtering rows, exporting CSV, or creating charts. Please ask one of those." };
    }

    return { allowed: true, text };
  };

  /* --- New: Command dispatcher for many tasks --- */
  const handleCommand = async (prompt) => {
    const lower = prompt.trim().toLowerCase();
    const ds = datasets[selectedDatasetId];
    const headers = ds?.schema?.headers || [];

    // Summarize dataset
    if (lower.startsWith("summarize") || lower.includes("summary of") || lower.includes("describe dataset")) {
      const s = summarizeDataset(ds);
      pushMessage({ role: "assistant", text: `Dataset: ${ds?.name || "selected"} — ${s.rows} rows, ${s.columns} columns.` });
      pushMessage({ role: "assistant", text: `Columns: ${s.headers.map((h) => `${h.name} (${h.type})`).join(", ")}` });
      return;
    }

    // Describe column
    if (lower.startsWith("describe ") || lower.startsWith("describe column") || lower.startsWith("column info")) {
      const parts = prompt.split(/\s+/);
      const col = parts.slice(1).join(" ").trim();
      const bestCol = headers.find((h) => h.toLowerCase() === col.toLowerCase()) || headers.find((h) => col.toLowerCase().includes(h.toLowerCase())) || headers[0];
      const info = describeColumn(ds, bestCol);
      if (!info) {
        pushMessage({ role: "assistant", text: `No data for column ${bestCol}` });
      } else {
        pushMessage({ role: "assistant", text: `Column ${bestCol}: sample ${JSON.stringify(info.sampleValues)}, unique ${info.uniqueCount}` });
        if (info.mean !== undefined) pushMessage({ role: "assistant", text: `Stats: min ${info.min}, max ${info.max}, mean ${Number(info.mean).toFixed(2)}` });
      }
      return;
    }

    // Top N aggregation: "top 5 categories by revenue" or "top categories by value"
    if (lower.startsWith("top") && lower.includes(" by ")) {
      const m = prompt.match(/top\s+(\d+)?\s*(.+?)\s+by\s+(.+)/i);
      if (m) {
        const n = Number(m[1]) || 5;
        const categoryPart = m[2].trim();
        const valuePart = m[3].trim();
        const catField = headers.find((h) => h.toLowerCase().includes(categoryPart.toLowerCase())) || headers[0];
        const valField = headers.find((h) => h.toLowerCase().includes(valuePart.toLowerCase())) || headers.find((h) => h !== catField) || headers[1] || headers[0];
        const agg = aggregateByCategory(ds, catField, valField, "sum")
          .sort((a, b) => (b[valField] || 0) - (a[valField] || 0))
          .slice(0, n);
        pushMessage({ role: "assistant", text: `Top ${n} ${catField} by ${valField}: ${agg.map((r) => `${r[catField]} (${r[valField]})`).join(", ")}` });
        // also offer a quick pie chart preview in chat and option to save
        const chart = { id: `chat-${Date.now()}`, title: `Top ${n} ${catField}`, chartType: "donut", mappings: { categoryField: catField, valueField: valField, donut: true }, options: { aggregation: "sum", topN: n } };
        const data = buildChartData(ds.data || ds.rowsPreview || [], "donut", chart.mappings, chart.options);
        pushMessage({ role: "assistant", text: `Preview of Top ${n}`, chart, chartData: data });
      } else {
        pushMessage({ role: "assistant", text: "Could not parse top-N request. Try: 'Top 5 Region by Revenue'." });
      }
      return;
    }

    // Filter rows: "filter Region = Alpha" or "show rows where Units > 200"
    if (lower.startsWith("filter") || lower.includes("show rows") || lower.includes("where")) {
      const exprMatch = prompt.match(/where\s+(.+)/i) || prompt.match(/filter\s+(.+)/i);
      const expr = exprMatch ? exprMatch[1] : null;
      if (expr) {
        const rows = simpleFilterRows(ds, expr);
        if (!rows.length) pushMessage({ role: "assistant", text: "No rows matched the filter." });
        else {
          pushMessage({ role: "assistant", text: `Found ${rows.length} matching rows (showing up to 10).` });
          pushMessage({ role: "assistant", text: JSON.stringify(rows.slice(0, 10).map((r) => r)) });
          pushMessage({ role: "assistant", text: "You can export these rows as CSV." });
          // keep latest rows in assistant state for export action
          pushMessage({ role: "assistant", text: "export-csv", rowsForExport: rows.slice(0, 1000) });
        }
      } else {
        pushMessage({ role: "assistant", text: "Specify a filter, e.g. 'show rows where Units > 200'." });
      }
      return;
    }

    // Export CSV
    if (lower.startsWith("export") && lower.includes("csv")) {
      // last message with rowsForExport
      const last = messages.slice().reverse().find((m) => m.rowsForExport);
      const rows = last?.rowsForExport || ds?.data || ds?.rowsPreview || [];
      if (!rows || rows.length === 0) {
        pushMessage({ role: "assistant", text: "No rows available to export." });
      } else {
        exportCsvBlob(rows, `${ds?.name || "export"}.csv`);
        pushMessage({ role: "assistant", text: `CSV exported (${rows.length} rows).` });
      }
      return;
    }

    // Create chart command - delegated to chart creation flow
    if (lower.includes("make") || lower.includes("create") || lower.includes("plot") || lower.includes("chart")) {
      // try server/LMM first (kept in main handleSend), but here we do local chart creation
      const intent = localIntent(prompt, headers);
      if (!intent) {
        pushMessage({ role: "assistant", text: "I couldn't detect a chart type; try 'Make a pie chart of value by category'." });
        return;
      }
      const chart = { id: `chat-${Date.now()}`, title: `Assistant ${intent.chartType} chart`, chartType: intent.chartType, mappings: intent.mappings || {}, options: { aggregation: "none", topN: 0, seriesColors: {} } };
      const validated = validateAndFixChart(chart, ds);
      if (validated) {
        // show preview in chat
        pushMessage({ role: "assistant", text: `Previewing ${validated.chart.chartType}` , chart: validated.chart, chartData: validated.data });
        // save and navigate
        persistChartAndNavigate(validated.chart, selectedDatasetId);
      } else {
        pushMessage({ role: "assistant", text: "I couldn't build a valid chart from this dataset. Try naming fields explicitly." });
      }
      return;
    }

    // fallback general help or LLM assistance
    pushMessage({ role: "assistant", text: "I can summarize datasets, describe columns, compute top-N, filter rows, export CSV, and create charts. Try: 'Summarize dataset', 'Describe Revenue', 'Top 5 Region by Revenue', 'Filter Units > 200', 'Export CSV', or 'Make a pie chart of value by category'." });
  };

  /* Replace LLM handling points to use sanitizer: */
  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt) return;
    pushMessage({ role: "user", text: prompt });
    setInput("");
    setLoading(true);

    const dataset = datasets[selectedDatasetId];
    const headers = dataset?.schema?.headers || [];

    try {
      // prefer server proxy
      const serverResp = await callServerProxy({ prompt, headers });
      if (!serverResp.error && serverResp.assistantText) {
        const assistantText = serverResp.assistantText;
        const sanitized = sanitizeAssistantText(assistantText);

        if (!sanitized.allowed) {
          // LLM reply outside boundaries -> respond with boundary message only
          pushMessage({ role: "assistant", text: sanitized.message || "Response outside boundaries." });
          setLoading(false);
          return;
        }

        if (sanitized.payload) {
          // JSON instruction validated (action allowed)
          const payload = sanitized.payload;
          if (payload.action === "chart") {
            const chart = {
              id: `chat-${Date.now()}`,
              title: payload.title || "Assistant chart",
              chartType: payload.chartType,
              mappings: payload.mappings || {},
              options: payload.options || {}
            };
            const validated = validateAndFixChart(chart, dataset);
            if (validated) {
              pushMessage({
                role: "assistant",
                text: sanitized.strippedText || `Created chart (${validated.chart.chartType})`,
                chart: validated.chart,
                chartData: validated.data
              });
              persistChartAndNavigate(validated.chart, selectedDatasetId);
            } else {
              pushMessage({ role: "assistant", text: "LLM suggested a chart but it couldn't be constructed from the dataset. Please specify fields explicitly." });
            }
          } else {
            // For other allowed actions we prefer local handlers; present brief confirmation
            pushMessage({ role: "assistant", text: "LLM suggested a dataset operation — executing using app capabilities." });
            // fall back to local command handler for robustness
            await handleCommand(prompt);
          }
        } else {
          // Plain text sanitized and allowed
          pushMessage({ role: "assistant", text: sanitized.text || assistantText });
        }

        setLoading(false);
        return;
      }

      // fallback to client OpenAI key if present
      if (CLIENT_OPENAI_KEY) {
        const clientResp = await callClientOpenAI(prompt, headers);
        const assistantText = clientResp.assistantText || "No response.";
        const sanitized = sanitizeAssistantText(assistantText);

        if (!sanitized.allowed) {
          pushMessage({ role: "assistant", text: sanitized.message || "Response outside boundaries." });
          setLoading(false);
          return;
        }

        if (sanitized.payload) {
          const payload = sanitized.payload;
          if (payload.action === "chart") {
            const chart = {
              id: `chat-${Date.now()}`,
              title: payload.title || "Assistant chart",
              chartType: payload.chartType,
              mappings: payload.mappings || {},
              options: payload.options || {}
            };
            const validated = validateAndFixChart(chart, dataset);
            if (validated) {
              pushMessage({
                role: "assistant",
                text: sanitized.strippedText || `Created chart (${validated.chart.chartType})`,
                chart: validated.chart,
                chartData: validated.data
              });
              persistChartAndNavigate(validated.chart, selectedDatasetId);
            } else {
              pushMessage({ role: "assistant", text: "LLM suggested a chart but it couldn't be constructed from the dataset. Please specify fields explicitly." });
            }
          } else {
            pushMessage({ role: "assistant", text: "LLM suggested a dataset operation — executing using app capabilities." });
            await handleCommand(prompt);
          }
        } else {
          pushMessage({ role: "assistant", text: sanitized.text || assistantText });
        }

        setLoading(false);
        return;
      }

      // no LLM available: use local command dispatcher
      await handleCommand(prompt);
    } catch (err) {
      console.error(err);
      pushMessage({ role: "assistant", text: "Error: failed to process your request." });
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  };

  // Enter to send, Shift+Enter newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        className="chatbot-button"
        aria-label="Open Datanaut Assistant"
        onClick={() => {
          setOpen((s) => !s);
          setTimeout(() => textareaRef.current?.focus(), 120);
        }}
        title="Open Datanaut Assistant"
      >
        <svg className="chatbot-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#06b6d4" />
              <stop offset="1" stopColor="#1da0ff" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#g1)" />
          <path d="M7 9h10M7 13h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="chatbot-modal" role="dialog" aria-modal="true">
          <div className="chatbot-panel">
            <div className="chatbot-header">
              <div>
                <strong>Datanaut Assistant</strong>
                <div className="text-xs text-slate-500">Ask to analyze data, export, filter, or create charts</div>
              </div>
              <div>
                <select value={selectedDatasetId || ""} onChange={(e) => setSelectedDatasetId(e.target.value)} className="chatbot-dataset-select">
                  <option value="">Select dataset</option>
                  {datasetList.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.originalRowCount ?? ds.rowsPreview?.length ?? 0} rows)
                    </option>
                  ))}
                </select>
                <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>

            <div className="chatbot-body" ref={listRef}>
              {messages.map((m, idx) => (
                <div key={idx} className={`chatbot-message ${m.role === "user" ? "chatbot-user" : "chatbot-assistant"}`}>
                  <div className="chatbot-message-text">{m.text}</div>
                  {m.chart && m.chartData ? (
                    <div className="mt-3">
                      <ChartRenderer chart={m.chart} data={m.chartData} compact />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="chatbot-input">
              <textarea
                ref={textareaRef}
                placeholder="Try: 'Summarize dataset', 'Describe Revenue', 'Top 5 Region by Revenue', 'Filter Units > 200', 'Export CSV', 'Make a pie chart of Revenue by Region'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="chatbot-textarea"
                aria-label="Chat input"
              />
              <div className="chatbot-actions">
                <button className="chatbot-send" onClick={handleSend} disabled={loading}>
                  {loading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
