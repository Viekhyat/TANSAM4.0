import React, { useEffect, useRef, useState } from "react";

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
  const [connections, setConnections] = useState([]);
  const [formType, setFormType] = useState("mqtt");
  const [form, setForm] = useState({ name: "", config: {} });
  const [selectedId, setSelectedId] = useState(null);
  const [cached, setCached] = useState([]);
  const wsRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const BACKEND = "http://localhost:8085";
  const WS_URL = window.location.protocol === 'https:' ? 'wss://localhost:8085' : 'ws://localhost:8085';

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
    try {
      const res = await fetch(`${BACKEND}/api/data/${id}`);
      const j = await res.json();
      if (j.success && Array.isArray(j.data)) {
        setCached(j.data);
        lastUpdateRef.current = Date.now();
      } else if (manual) {
        alert("No data available for this connection.");
      }
    } catch (e) {
      console.error("❌ fetchDataFor:", e);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 10000) {
        fetchDataFor(selectedId);
      }
    }, 5000);
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
    // Compose broker URL if port provided for MQTT
    if (formType === "mqtt" && form.config.port) {
      if (!form.config.brokerUrl?.match(/:\d+$/)) {
        form.config.brokerUrl = (form.config.brokerUrl || "wss://localhost") + ":" + form.config.port;
      }
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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Broker URL</label>
              <input
                placeholder="Broker URL (ws://...)"
                value={form.config.brokerUrl || ""}
                onChange={(e) => setConfigField("brokerUrl", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Port</label>
              <input
                placeholder="Port (e.g. 8081)"
                value={form.config.port || ""}
                onChange={(e) => setConfigField("port", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Topic</label>
              <input
                placeholder="Topic"
                value={form.config.topic || ""}
                onChange={(e) => setConfigField("topic", e.target.value)}
                className={inputStyle}
              />
            </div>
          </>
        );
      case "http":
        return (
          <>
            <input
              placeholder="URL"
              value={form.config.url || ""}
              onChange={(e) => setConfigField("url", e.target.value)}
              className={inputStyle}
            />
            <input
              placeholder="Poll Interval (ms)"
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
                <option value="sql">SQL (MySQL)</option>
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
                    className={`border rounded-xl p-5 shadow-sm transition mb-2 ${selectedId === c.id ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200 dark:bg-slate-700"}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                          {c.config?.name || c.id}
                        </strong>
                        <span className="text-xs text-slate-500 dark:text-slate-300 block">Type: <em>{c.type}</em></span>
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
                          setFormType(c.type);
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
                <button
                  onClick={() => fetchDataFor(selectedId, true)}
                  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                > Refresh Data </button>
              )}
            </div>
            {formType === "sql" && selectedId && (
              <SqlTableSelector
                selectedId={selectedId}
                onTablesSelected={() => fetchDataFor(selectedId, true)}
              />
            )}
            <div className="flex-1 min-h-0 overflow-auto max-h-[500px]">
              {cached.length > 0 ? (
                cached.map((tableData, i) => (
                  <div key={i} className="mb-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                      <h5 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                        <span className="mr-2">📊</span>{tableData.table}
                      </h5>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">
                        {tableData.rows.length} rows
                      </span>
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
                              <tr key={j} className={`border-b border-slate-200 dark:border-slate-700 ${j % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/50"}`}>
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
    </div>
  );
}
