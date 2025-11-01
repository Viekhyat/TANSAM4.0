import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../providers/StoreContext.jsx";
import { inferTypes, coerceRows } from "../utils/parseData.js";

// --- SQL Table Selector Component ---
function SqlTableSelector({ selectedId, onTablesSelected }) {
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const BACKEND = "http://localhost:8085";

  useEffect(() => {
    if (selectedId) fetchAvailableTables();
    // eslint-disable-next-line
  }, [selectedId]);

  const fetchAvailableTables = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${BACKEND}/api/sql/tables/${selectedId}`);
      const data = await res.json();
      if (data.success) setAvailableTables(data.tables);
      else setFetchError(data.error || "Unable to fetch tables");
    } catch (error) {
      setFetchError(error.message);
      console.error("Failed to fetch tables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTableSelection = (table) => {
    setSelectedTables((prev) =>
      prev.includes(table)
        ? prev.filter((t) => t !== table)
        : [...prev, table]
    );
  };

  const saveSelectedTables = async () => {
    if (selectedTables.length === 0) {
      alert("Please select at least one table");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/sql/select-tables/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: selectedTables }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Selected tables updated successfully!");
        if (onTablesSelected) onTablesSelected();
      } else {
        alert("❌ Failed to update selected tables: " + data.error);
      }
    } catch (error) {
      alert("❌ Error saving selected tables: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-3">
      <h4 className="font-semibold text-slate-800 dark:text-slate-100">Select Tables to Display</h4>
      {isLoading ? (
        <div className="py-3 text-center text-sm text-slate-500">Loading tables...</div>
      ) : fetchError ? (
        <div className="py-3 text-center text-sm text-red-500">{fetchError}</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 p-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800/50 max-h-36 overflow-y-auto">
            {availableTables.length > 0 ? (
              availableTables.map((table) => (
                <label
                  key={table}
                  className={`flex items-center px-3 py-2 rounded-lg border cursor-pointer bg-white dark:bg-slate-700
                    transition ${selectedTables.includes(table) ? "bg-blue-50 border-blue-300" : "border-slate-200"}`}>
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(table)}
                    onChange={() => toggleTableSelection(table)}
                    className="mr-2 accent-blue-500"
                  />
                  {table}
                </label>
              ))
            ) : (
              <div className="w-full text-center text-slate-400">No tables available</div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveSelectedTables}
              disabled={isLoading || selectedTables.length === 0}
              className={`rounded-xl px-4 py-2 text-sm font-medium bg-blue-500 text-white shadow hover:bg-blue-600 transition ${selectedTables.length === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {isLoading ? "Saving..." : "Save Selected Tables"}
            </button>
            <button
              onClick={fetchAvailableTables}
              disabled={isLoading}
              className="rounded-xl px-4 py-2 text-sm font-medium bg-slate-100 text-slate-800 border border-slate-300 shadow hover:bg-slate-200 transition"
            >
              Refresh Tables
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Dashboard Split Layout ---
export default function DynamicData() {
  const { saveDataset, generateId } = useStore();
  const [connections, setConnections] = useState([]);
  const [formType, setFormType] = useState("mqtt");
  const [form, setForm] = useState({ name: "", config: {} });
  const [selectedId, setSelectedId] = useState(null);
  const [cached, setCached] = useState([]);
  const [rawOpen, setRawOpen] = useState(false);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawJson, setRawJson] = useState(null);
  const wsRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const BACKEND = "http://localhost:8085";
  const WS_URL = window.location.protocol === 'https:' ? 'wss://localhost:8085' : 'ws://localhost:8085';

  const nowIso = () => new Date().toISOString();

  const saveTableData = (tableData, format = 'json') => {
    try {
      let blob, filename;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const tableName = tableData.table || 'table';
      
      if (format === 'csv') {
        // Convert to CSV
        if (tableData.rows.length === 0) {
          alert('No data to save');
          return;
        }
        const headers = Object.keys(tableData.rows[0]);
        const csvRows = [
          headers.join(','),
          ...tableData.rows.map(row => 
            headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              // Escape commas and quotes in CSV
              const stringValue = String(value).replace(/"/g, '""');
              return `"${stringValue}"`;
            }).join(',')
          )
        ];
        const csvContent = csvRows.join('\n');
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = `${tableName}-${ts}.csv`;
      } else {
        // Save as JSON
        blob = new Blob([JSON.stringify(tableData, null, 2)], { type: 'application/json' });
        filename = `${tableName}-${ts}.json`;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Failed to save table data: ${e.message}`);
    }
  };

  const saveSelectedTables = async () => {
    try {
      if (!selectedId) {
        alert('No connection selected');
        return;
      }
      const selectedConn = connections.find(c => c.id === selectedId);
      const isSqlSubtype = selectedConn ? ["mysql","sqlite","postgres","postgresql","mariadb"].includes((selectedConn.type||"").toLowerCase()) : false;
      const isSqlSelected = !!(selectedConn && (selectedConn.type === "sql" || selectedConn.dbType || isSqlSubtype));
      
      if (!isSqlSelected) {
        alert('Selected tables can only be saved for SQL connections');
        return;
      }
      
      // First try to get selected tables from connection object
      let selectedTables = Array.isArray(selectedConn.selectedTables) && selectedConn.selectedTables.length > 0
        ? selectedConn.selectedTables
        : null;
      
      // If no selected tables, get from currently displayed tables (cached data)
      if (!selectedTables && cached.length > 0) {
        selectedTables = cached.map(t => t.table);
      }
      
      // If still no tables, fetch all available tables
      if (!selectedTables || selectedTables.length === 0) {
        const res = await fetch(`${BACKEND}/api/sql/tables/${selectedId}`);
        const data = await res.json();
        if (!data.success) {
          alert('Failed to fetch tables: ' + (data.error || 'Unknown error'));
          return;
        }
        selectedTables = data.tables || [];
      }
      
      const tablesData = {
        connectionId: selectedId,
        connectionName: selectedConn.config?.name || selectedId,
        tables: selectedTables,
        savedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(tablesData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `selected-tables-${selectedId}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Failed to save selected tables: ${e.message}`);
    }
  };

  async function fetchConnections() {
    try {
      const res = await fetch(`${BACKEND}/api/connections`);
      const j = await res.json();
      if (j.success) setConnections(j.connections);
    } catch (e) {
      console.error("❌ fetchConnections:", e);
    }
  }

  const fetchDataFor = async (id, manual = false) => {
    if (!id) return;
    console.log(`🔄 Fetching data for connection: ${id}`);
    try {
      const res = await fetch(`${BACKEND}/api/data/${id}`);
      const j = await res.json();
      console.log(`📥 Data fetch response for ${id}:`, j);
      if (j.success && Array.isArray(j.data)) {
        console.log(`✅ Received ${j.data.length} tables with data`);
        j.data.forEach((table, idx) => {
          console.log(`  Table ${idx}: "${table.table}" with ${table.rows?.length || 0} rows`);
        });
        setCached(j.data);
        lastUpdateRef.current = Date.now();
      } else {
        console.warn(`⚠️ No data or invalid response for ${id}:`, j);
        if (manual) {
          alert(`No data available for this connection. ${j.error ? `Error: ${j.error}` : 'Make sure data is being published to the MQTT topic.'}`);
        }
      }
    } catch (e) {
      console.error("❌ fetchDataFor error:", e);
      if (manual) {
        alert(`Failed to fetch data: ${e.message}`);
      }
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    // Poll every 2 seconds for real-time updates - always fetch to get flowing data
    const interval = setInterval(() => {
      fetchDataFor(selectedId);
    }, 2000); // Poll every 2 seconds for real-time EDA
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    fetchConnections();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => console.log("🟢 WebSocket connected to backend");
    ws.onclose = () => console.log("🔴 WebSocket disconnected");
    ws.onerror = (err) => console.error("⚠️ WebSocket error:", err);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "update") {
          lastUpdateRef.current = Date.now();
          setConnections((prev) =>
            prev.map((c) =>
              c.id === msg.id
                ? { ...c, count: (c.count || 0) + (msg.rows?.length || 1) }
                : c
            )
          );
          if (msg.id === selectedId) fetchDataFor(msg.id);
        } else if (msg.type === "removed") {
          fetchConnections();
          if (msg.id === selectedId) {
            setSelectedId(null);
            setCached([]);
          }
        }
      } catch (e) {
        console.error("❌ WS parse error:", e);
      }
    };
    return () => ws.close();
    // eslint-disable-next-line
  }, [selectedId]);

  const handleAdd = async () => {
    if (!form.name.trim()) return alert("Please provide a connection name");
    
    // Compose broker URL for MQTT
    if (formType === "mqtt") {
      let brokerUrl = (form.config.brokerUrl || "").trim();
      
      // If brokerUrl doesn't include protocol, add mqtt:// by default
      if (brokerUrl && !brokerUrl.match(/^(mqtt|ws|wss|tcp):\/\//)) {
        // Default to mqtt:// protocol
        brokerUrl = "mqtt://" + brokerUrl.replace(/^\/\//, "");
      }
      
      // Default to localhost if nothing provided
      if (!brokerUrl || brokerUrl === "mqtt://") {
        brokerUrl = "mqtt://localhost:1883";
      }
      
      // Ensure URL has a port if missing
      if (brokerUrl && brokerUrl.startsWith("mqtt://")) {
        // Check if URL has a port (pattern: mqtt://host:port or mqtt://host/path)
        const urlMatch = brokerUrl.match(/^mqtt:\/\/([^\/:]+)(?::(\d+))?(?:\/.*)?$/);
        if (urlMatch) {
          const host = urlMatch[1];
          const port = urlMatch[2];
          
          // If no port specified, add default port 1883
          if (!port) {
            brokerUrl = `mqtt://${host}:1883`;
          }
        }
      }
      
      form.config.brokerUrl = brokerUrl;
      console.log("🔌 Final MQTT broker URL:", brokerUrl);
      console.log("🔌 Topic:", form.config.topic);
      
      if (!form.config.topic) {
        alert("⚠️ Please specify an MQTT topic to subscribe to");
        return;
      }
    }
    
    // Ensure SQL type default is set if user didn't change the dropdown
    if (formType === "sql" && !form.config.type) {
      form.config.type = "mysql";
    }
    
    const payload = { type: formType, config: { ...form.config, name: form.name } };
    // DEBUG: Show values sent
    console.log("Add Connection payload:", payload);
    try {
      const res = await fetch(`${BACKEND}/api/add-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        alert(`✅ Connection added: ${j.id}`);
        setForm({ name: "", config: {} });
        fetchConnections();
      } else {
        alert(`❌ Add failed: ${j.error || "Unknown error"}`);
      }
    } catch (e) {
      alert(`Add error: ${e.message}`);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm(`Remove connection ${id}?`)) return;
    try {
      await fetch(`${BACKEND}/api/remove-connection/${id}`, { method: "DELETE" });
      fetchConnections();
      if (selectedId === id) {
        setSelectedId(null);
        setCached([]);
      }
    } catch (e) {
      console.error("❌ Remove error:", e);
    }
  };

  const inputStyle =
    "rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full";

  /* --- FIXED: Always use value and onChange, including for port --- */
  const renderConfigInputs = () => {
    const setConfigField = (k, v) =>
      setForm((s) => ({ ...s, config: { ...s.config, [k]: v } }));

    switch (formType) {
      case "sql":
        return (
          <>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">SQL Type</label>
              <select
                value={form.config.type || "mysql"}
                onChange={(e) => setConfigField("type", e.target.value)}
                className={inputStyle}
              >
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mariadb">MariaDB</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Host</label>
              <input
                placeholder="Host"
                value={form.config.host || ""}
                onChange={(e) => setConfigField("host", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Port</label>
              <input
                placeholder="Port (default 3306)"
                value={form.config.port || ""}
                onChange={(e) => setConfigField("port", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">User</label>
              <input
                placeholder="User"
                value={form.config.user || ""}
                onChange={(e) => setConfigField("user", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Password</label>
              <input
                placeholder="Password"
                type="password"
                value={form.config.password || ""}
                onChange={(e) => setConfigField("password", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Database</label>
              <input
                placeholder="Database"
                value={form.config.database || ""}
                onChange={(e) => setConfigField("database", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Poll Interval (ms)</label>
              <input
                placeholder="Poll Interval (ms, e.g. 5000)"
                type="number"
                value={form.config.pollIntervalMs || ""}
                onChange={(e) => setConfigField("pollIntervalMs", e.target.value)}
                className={inputStyle}
              />
            </div>
          </>
        );
      case "mqtt":
        return (
          <>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Broker URL
              </label>
              <input
                placeholder="mqtt://test.mosquitto.org:1883"
                value={form.config.brokerUrl || ""}
                onChange={(e) => setConfigField("brokerUrl", e.target.value)}
                className={inputStyle}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Format: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mqtt://broker-host:port</code>
                <br />
                Example: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mqtt://test.mosquitto.org:1883</code>
              </p>
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Topic</label>
              <input
                placeholder=""
                value={form.config.topic || ""}
                onChange={(e) => setConfigField("topic", e.target.value)}
                className={inputStyle}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The MQTT topic to subscribe to (must match exactly, case-sensitive)
                <br />
                Example: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Name/machine/sensors</code>
              </p>
            </div>
          </>
        );
      case "http":
        return (
          <>
            <input
              placeholder="Base URL (e.g., http://127.0.0.1:8080)"
              value={form.config.url || ""}
              onChange={(e) => setConfigField("url", e.target.value)}
              className={inputStyle}
            />
            <input
              placeholder="Endpoint (e.g., /api/iot or api/iot)"
              value={form.config.endpoint || ""}
              onChange={(e) => setConfigField("endpoint", e.target.value)}
              className={inputStyle}
            />
            <input
              placeholder="Device ID (optional, e.g., sensor-001)"
              value={form.config.deviceId || ""}
              onChange={(e) => setConfigField("deviceId", e.target.value)}
              className={inputStyle}
            />
            <input
              placeholder="Poll Interval (ms, e.g., 2000)"
              type="number"
              value={form.config.pollIntervalMs || ""}
              onChange={(e) => setConfigField("pollIntervalMs", e.target.value)}
              className={inputStyle}
            />
          </>
        );
      case "serial":
        return (
          <>
            <input
              placeholder="Port (COM3, /dev/ttyUSB0)"
              value={form.config.port || ""}
              onChange={(e) => setConfigField("port", e.target.value)}
              className={inputStyle}
            />
            <input
              placeholder="Baud Rate (9600)"
              type="number"
              value={form.config.baudRate || ""}
              onChange={(e) => setConfigField("baudRate", e.target.value)}
              className={inputStyle}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-100 dark:bg-slate-900 px-2 py-2">
      <div className="max-w-screen-2xl mx-auto flex flex-row w-full gap-6">
        {/* Left: Data Entry and Connection Management */}
        <div className="flex-1 flex flex-col gap-6 w-1/2 min-w-[360px]">
          <section className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm w-full">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">🌐 Add/Edit Connection</h2>
            <input
              placeholder="Connection Name"
              className={inputStyle + " mb-4"}
              value={form.name || ""}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Connection Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className={inputStyle}
              >
                <option value="mqtt">MQTT</option>
                <option value="sql">SQL</option>
                <option value="http">HTTP API</option>
                <option value="serial">Serial</option>
              </select>
            </div>
            <div className="mb-5 flex flex-col gap-3">{renderConfigInputs()}</div>
            <div className="flex gap-4 mt-2">
              <button
                onClick={handleAdd}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 transition"
              > Add Connection </button>
              <button
                onClick={fetchConnections}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition"
              > Refresh List </button>
            </div>
          </section>
          <section className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Active Connections</h3>
            {connections.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No connections yet. Add a connection above to get started.
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1">
                {connections.map((c) => (
                  <div
                    key={c.id}
                    className={`border rounded-xl p-5 shadow-sm transition mb-2 ${selectedId === c.id ? "bg-blue-50 border-blue-200 dark:bg-slate-800 dark:border-blue-400/40" : "bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600"}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                          {c.config?.name || c.id}
                        </strong>
                        <span className="text-xs text-slate-500 dark:text-slate-300 block">Type: <em>{(() => {
                          const isSqlSubtype = ["mysql","sqlite","postgres","postgresql","mariadb"].includes((c.type||"").toLowerCase());
                          if (c.type === "sql" || c.dbType || isSqlSubtype) {
                            const subtype = (c.dbType || (isSqlSubtype ? c.type : "")).toString();
                            return `sql${subtype ? ` (${subtype})` : ""}`;
                          }
                          return c.type;
                        })()}</em></span>
                      </div>
                      {c.count && (
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">
                          {c.count} updates
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(c.id);
                          fetchDataFor(c.id);
                          const isSqlSubtype = ["mysql","sqlite","postgres","postgresql","mariadb"].includes((c.type||"").toLowerCase());
                          setFormType((c.type === "sql" || c.dbType || isSqlSubtype) ? "sql" : c.type);
                        }}
                        className="flex-1 rounded-xl bg-blue-500 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600"
                      > View Data </button>
                      <button
                        onClick={() => handleRemove(c.id)}
                        className="rounded-xl bg-red-100 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-200"
                      > Remove </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Data Display */}
        <div className="flex-1 w-1/2 min-w-[400px] flex flex-col gap-6">
          <section className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm h-fit mb-6 sticky top-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                📊 Data {selectedId ? `for ${selectedId}` : ""}
              </h3>
              {selectedId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchDataFor(selectedId, true)}
                    className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                  > Refresh Data </button>
                  <button
                    onClick={async () => {
                      try {
                        setRawLoading(true);
                        setRawJson(null);
                        const res = await fetch(`${BACKEND}/api/data/${selectedId}`);
                        const j = await res.json();
                        setRawJson(j);
                        setRawOpen(true);
                      } catch (e) {
                        alert(`Failed to fetch raw data: ${e.message}`);
                      } finally {
                        setRawLoading(false);
                      }
                    }}
                    className="rounded-xl bg-slate-800 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-900"
                  > {rawLoading ? "Loading..." : "View Raw Data"} </button>
                </div>
              )}
            </div>
            {(() => {
              const selectedConn = connections.find(c => c.id === selectedId);
              const isSqlSubtype = selectedConn ? ["mysql","sqlite","postgres","postgresql","mariadb"].includes((selectedConn.type||"").toLowerCase()) : false;
              const isSqlSelected = !!(selectedConn && (selectedConn.type === "sql" || selectedConn.dbType || isSqlSubtype || formType === "sql"));
              return isSqlSelected && selectedId;
            })() && (
              <div>
                <SqlTableSelector
                  selectedId={selectedId}
                  onTablesSelected={() => fetchDataFor(selectedId, true)}
                />
                <button
                  onClick={saveSelectedTables}
                  className="rounded-xl bg-purple-500 text-white px-4 py-2 text-sm font-semibold hover:bg-purple-600 transition mb-3"
                  title="Save selected tables list"
                >
                  💾 Save Selected Tables List
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto max-h-[500px]">
              {cached.length > 0 ? (
                cached.map((tableData, i) => (
                  <div key={i} className="mb-5 bg-slate-100 dark:bg-slate-800/70 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 flex justify-between items-center">
                      <h5 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                        <span className="mr-2">📊</span>{tableData.table}
                      </h5>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">
                          {tableData.rows.length} rows
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveTableData(tableData, 'json')}
                            className="rounded-lg bg-green-500 text-white px-2 py-1 text-xs font-medium hover:bg-green-600 transition"
                            title="Save as JSON"
                          >
                            💾 JSON
                          </button>
                          <button
                            onClick={() => saveTableData(tableData, 'csv')}
                            className="rounded-lg bg-blue-500 text-white px-2 py-1 text-xs font-medium hover:bg-blue-600 transition"
                            title="Save as CSV"
                          >
                            📄 CSV
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      {tableData.rows.length > 0 ? (
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                              {Object.keys(tableData.rows[0]).map(key => (
                                <th key={key} className="p-3 text-left font-semibold text-slate-800 dark:text-slate-100">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.rows.map((row, j) => (
                              <tr key={j} className={`border-b border-slate-200 dark:border-slate-700 ${j % 2 === 0 ? "bg-slate-100 dark:bg-slate-800/60" : "bg-slate-50 dark:bg-slate-800/40"}`}>
                                {Object.entries(row).map(([key, value]) => (
                                  <td key={key} className="p-3 text-slate-700 dark:text-slate-300 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                                    {value !== null && value !== undefined ? (typeof value === "object" ? JSON.stringify(value) : String(value)) : <span className="text-slate-400 dark:text-slate-500 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-5 text-center text-slate-500 dark:text-slate-400 italic">No rows available in this table</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-300">
                  <div className="text-2xl mb-2 text-slate-400 dark:text-slate-500">{selectedId ? "📊" : "🔍"}</div>
                  <p>{selectedId ? "No data available yet." : "Select a connection to view data."}</p>
                  {selectedId && (
                    <button
                      onClick={() => fetchDataFor(selectedId, true)}
                      className="mt-3 rounded-xl bg-slate-200 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                    > Refresh Data </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {/* Raw Data Modal */}
      {rawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 w-[90vw] max-w-4xl max-h-[80vh] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Raw Data Preview</h4>
              <button
                onClick={() => setRawOpen(false)}
                className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
              > Close </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh] text-xs">
              <pre className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">
{JSON.stringify(rawJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
