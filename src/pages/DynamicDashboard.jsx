import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../ui/GlassCard.jsx";
import ChartWithRealTimeData from "../ui/ChartWithRealTimeData.jsx";
import {
  classifyDynamicCharts,
  normalizeDynamicCharts,
  saveDynamicDashboardCache,
  loadDynamicDashboardCache
} from "../utils/dynamicChartUtils.js";

const BACKEND_URL = "http://localhost:8085"; // change if backend runs elsewhere

const formatNumber = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

export default function DynamicDashboard() {
  const [chartRecords, setChartRecords] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();

  const normalizedCharts = useMemo(() => normalizeDynamicCharts(chartRecords), [chartRecords]);
  const { twoD: charts2D, threeD: charts3D } = useMemo(
    () => classifyDynamicCharts(normalizedCharts),
    [normalizedCharts]
  );

  const metrics = useMemo(() => {
    return [
      {
        label: "Connections",
        value: connections.length,
        trend: "Live data",
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
      },
      {
        label: "Charts",
        value: normalizedCharts.length,
        trend: "Dynamic visualizations",
        color: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
      },
      {
        label: "Last update",
        value: lastUpdated ? new Date(lastUpdated).toLocaleString() : "N/A",
        trend: "Auto-saved",
        color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
      }
    ];
  }, [connections.length, normalizedCharts.length, lastUpdated]);

  const persistCache = useCallback(
    (charts, connectionList, fetchedAt = Date.now()) => {
      const normalized = normalizeDynamicCharts(charts);
      saveDynamicDashboardCache({
        charts: normalized,
        connections: connectionList,
        fetchedAt
      });
    },
    []
  );

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [connectionsResponse, chartsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/connections`),
        fetch(`${BACKEND_URL}/api/charts`)
      ]);

      const connectionsData = await connectionsResponse.json();
      const chartsData = await chartsResponse.json();

      const nextConnections = connectionsData?.success ? connectionsData.connections || [] : [];
      const nextCharts = chartsData?.success ? chartsData.charts || [] : [];
      const timestamp = Date.now();

      setConnections(nextConnections);
      setChartRecords(normalizeDynamicCharts(nextCharts));
      setLastUpdated(timestamp);
      setStatusMessage(null);
      persistCache(nextCharts, nextConnections, timestamp);
    } catch (error) {
      console.error("Error fetching data:", error);
      const cached = loadDynamicDashboardCache();
      if (cached) {
        setConnections(cached.connections || []);
        setChartRecords(normalizeDynamicCharts(cached.charts || []));
        setLastUpdated(cached.fetchedAt || Date.now());
        setStatusMessage("Live data unavailable. Showing cached charts.");
      } else {
        setStatusMessage("Failed to load dashboard data. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [persistCache]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleAddChart = () => {
    navigate("/dynamic-visualize");
  };

  const handleEditChart = (chartId) => {
    navigate(`/dynamic-visualize/${chartId}`);
  };

  const handleDeleteChart = async (chartId) => {
    if (!window.confirm("Are you sure you want to delete this chart?")) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/charts/${chartId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        setChartRecords((prev) => {
          const next = prev.filter((chart) => chart.id !== chartId);
          persistCache(next, connections);
          return next;
        });
        setStatusMessage(null);
      } else {
        setStatusMessage(data.error || "Failed to delete chart.");
      }
    } catch (err) {
      console.error("Error deleting chart:", err);
      setStatusMessage("Failed to delete chart. Please try again.");
    }
  };

  const handleDuplicateChart = async (chartId) => {
    try {
      const chartToDuplicate = normalizedCharts.find((chart) => chart.id === chartId);
      if (!chartToDuplicate) return;

      const duplicateConfig = {
        ...chartToDuplicate,
        title: `Copy of ${chartToDuplicate.title}`
      };

      delete duplicateConfig.id;

      const response = await fetch(`${BACKEND_URL}/api/charts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(duplicateConfig)
      });

      const data = await response.json();

      if (data.success) {
        await fetchDashboardData();
      } else {
        setStatusMessage(data.error || "Failed to duplicate chart.");
      }
    } catch (err) {
      console.error("Error duplicating chart:", err);
      setStatusMessage("Failed to duplicate chart. Please try again.");
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const hasCharts = normalizedCharts.length > 0;
  const isLoading = loading;

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      {/* Header Section */}
      <section className="sticky top-[84px] z-30">
        <GlassCard className="sticky-edge shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dynamic Dashboard</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Real-time visualizations from your data connections.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass-hover rounded-full border border-emerald-400/40 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition dark:border-emerald-300/20 dark:bg-emerald-500/20 dark:text-emerald-200">
                Live
              </div>
              <button 
                onClick={handleRefresh}
                className="glass-hover rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {metrics.map((metric) => (
              <GlassCard key={metric.label} className="p-3 md:p-4 shadow-none">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.label}</p>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(metric.value)}</div>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${metric.color}`}>{metric.trend}</span>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Status Messaging */}
      {statusMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            statusMessage.includes("cached")
              ? "border-amber-300 bg-amber-50/80 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-red-300 bg-red-50/80 text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200"
          }`}
          role="alert"
        >
          {statusMessage}
        </div>
      )}

      {/* Charts Section - Referenced from static dashboard */}
      <section aria-labelledby="saved-charts" className="mt-4 space-y-4 md:mt-6">
        <h2 id="saved-charts" className="sr-only">
          Saved charts
        </h2>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved charts</p>
            <p className="text-sm text-slate-500 dark:text-slate-300">Manage layouts, duplicate configurations, or jump back into edit mode.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 transition-colors dark:bg-slate-800/60 dark:text-slate-300">
            {normalizedCharts.length} charts
          </div>
        </header>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/30 dark:border-slate-200/20">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading charts...</p>
            </div>
          </div>
        ) : !hasCharts ? (
          <GlassCard className="glass-hover flex h-48 flex-col items-center justify-center border border-dashed border-white/40 text-sm text-slate-600 transition-colors dark:border-slate-200/30 dark:text-slate-300">
            <p className="mb-3">No charts yet. Create your first visualization.</p>
            <button 
              onClick={handleAddChart} 
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 flex items-center gap-2"
            >
              <span className="text-lg">+</span> New Chart
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {normalizedCharts
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
              .map((chart) => {
                const connection = connections.find(c => c.id === chart.dataSource);
                const connectionName = connection?.config?.name || chart.dataSource || "Unknown connection";
                
                return (
                  <GlassCard key={chart.id} className="flex flex-col gap-3 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          {connectionName} - Updated {chart.updatedAt ? new Date(chart.updatedAt).toLocaleString() : "unknown"}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <button
                          onClick={() => handleEditChart(chart.id)}
                          className="glass-hover rounded-full border border-white/20 px-3 py-1 text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDuplicateChart(chart.id)}
                          className="glass-hover rounded-full border border-white/20 px-3 py-1 text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDeleteChart(chart.id)}
                          className="glass-hover rounded-full border border-transparent px-3 py-1 text-red-500 transition hover:border-red-100 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:hover:bg-red-500/20 dark:focus-visible:ring-offset-slate-900"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 rounded-2xl bg-slate-50 p-4 transition-colors dark:bg-slate-800/50">
                      <ChartWithRealTimeData
                        chart={chart}
                        onEdit={handleEditChart}
                        onDuplicate={handleDuplicateChart}
                        onDelete={handleDeleteChart}
                      />
                    </div>
                    <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3 dark:text-slate-300">
                      <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                        <span className="block font-semibold text-slate-700 dark:text-slate-200">Type</span>
                        <span className="uppercase">{chart.type || chart.chartType || "line"}</span>
                      </div>
                      <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                        <span className="block font-semibold text-slate-700 dark:text-slate-200">Dimension</span>
                        <span className="uppercase">{chart.dimension || "2d"}</span>
                      </div>
                      <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                        <span className="block font-semibold text-slate-700 dark:text-slate-200">Source</span>
                        <span className="truncate">{connectionName}</span>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            <GlassCard className="flex h-[300px] flex-col items-center justify-center gap-3 border-2 border-dashed border-white/40 text-center shadow-xl dark:border-slate-200/30">
              <div className="rounded-full bg-brand-100 p-4 dark:bg-brand-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create New Chart</h3>
              <p className="text-xs text-center text-slate-500 dark:text-slate-300">
                Add a new visualization to your dashboard
              </p>
              <button
                onClick={handleAddChart}
                className="mt-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                New Chart
              </button>
            </GlassCard>
          </div>
        )}
      </section>
    </div>
  );
}
