import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../ui/GlassCard.jsx";
import DynamicChart2D from "../ui/DynamicChart2D.jsx";
import DynamicChart3D from "../ui/DynamicChart3D.jsx";
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
              <button
                onClick={handleRefresh}
                className="glass-hover rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
              >
                Refresh
              </button>
              <button
                onClick={handleAddChart}
                className="glass-hover rounded-full border border-white/20 bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-transparent dark:focus-visible:ring-offset-slate-900"
              >
                Add Chart
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Metrics Section */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, i) => (
          <GlassCard key={metric.label || i} className="p-4 shadow-lg md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</h3>
              <div className={`rounded-full ${metric.color} px-2 py-0.5 text-[11px] font-semibold`}>{metric.trend}</div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(metric.value)}</p>
          </GlassCard>
        ))}
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

      {/* Charts Section */}
      <section className="space-y-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/30 dark:border-slate-200/20">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading charts...</p>
            </div>
          </div>
        ) : !hasCharts ? (
          <GlassCard className="flex h-64 flex-col items-center justify-center text-center shadow-lg">
            <p className="mb-4 text-slate-500 dark:text-slate-300">
              No charts yet. Create your first visualization!
            </p>
            <button
              onClick={handleAddChart}
              className="glass-hover rounded-full border border-white/20 bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-transparent dark:focus-visible:ring-offset-slate-900"
            >
              Create Chart
            </button>
          </GlassCard>
        ) : (
          <>
            {charts2D.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">2D Visualizations</h2>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800/40 dark:text-slate-300">
                    {charts2D.length} charts
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {charts2D.map((chart) => (
                    <DynamicChart2D
                      key={chart.id}
                      chart={chart}
                      onEdit={handleEditChart}
                      onDuplicate={handleDuplicateChart}
                      onDelete={handleDeleteChart}
                    />
                  ))}
                </div>
              </div>
            )}

            {charts3D.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">3D Visualizations</h2>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800/40 dark:text-slate-300">
                    {charts3D.length} charts
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {charts3D.map((chart) => (
                    <DynamicChart3D
                      key={chart.id}
                      chart={chart}
                      onEdit={handleEditChart}
                      onDuplicate={handleDuplicateChart}
                      onDelete={handleDeleteChart}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
