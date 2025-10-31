import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ChartRenderer from "../ui/ChartRenderer";

const BACKEND_URL = "http://localhost:8085"; // change if backend runs elsewhere

const formatNumber = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

export default function DynamicDashboard() {
  const [charts, setCharts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const navigate = useNavigate();

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
        value: charts.length,
        trend: "Dynamic visualizations",
        color: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
      },
      {
        label: "Last update",
        value: new Date().toLocaleString(),
        trend: "Auto-refreshed",
        color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
      }
    ];
  }, [connections.length, charts.length]);

  useEffect(() => {
    // Fetch data from backend API
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch connections
        const connectionsResponse = await fetch(`${BACKEND_URL}/api/connections`);
        const connectionsData = await connectionsResponse.json();
        
        if (connectionsData.success) {
          setConnections(connectionsData.connections);
        }
        
        // Fetch charts
        const chartsResponse = await fetch(`${BACKEND_URL}/api/charts`);
        const chartsData = await chartsResponse.json();
        
        if (chartsData.success) {
          setCharts(chartsData.charts || []);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load dashboard data. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchData, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

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
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted chart from state
        setCharts(charts.filter(chart => chart.id !== chartId));
      } else {
        setError(data.error || "Failed to delete chart.");
      }
    } catch (err) {
      console.error("Error deleting chart:", err);
      setError("Failed to delete chart. Please try again.");
    }
  };

  const handleDuplicateChart = async (chartId) => {
    try {
      const chartToDuplicate = charts.find(chart => chart.id === chartId);
      if (!chartToDuplicate) return;
      
      const duplicateConfig = {
        ...chartToDuplicate,
        title: `Copy of ${chartToDuplicate.title}`
      };
      
      delete duplicateConfig.id;
      
      const response = await fetch(`${BACKEND_URL}/api/charts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(duplicateConfig)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh charts
        const chartsResponse = await fetch(`${BACKEND_URL}/api/charts`);
        const chartsData = await chartsResponse.json();
        
        if (chartsData.success) {
          setCharts(chartsData.charts || []);
        }
      } else {
        setError(data.error || "Failed to duplicate chart.");
      }
    } catch (err) {
      console.error("Error duplicating chart:", err);
      setError("Failed to duplicate chart. Please try again.");
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      {/* Header Section */}
      <section className="sticky top-[84px] z-30 glass-panel sticky-edge rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dynamic Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-300">Real-time visualizations from your data connections.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAddChart}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 transition"
            >
              Add Chart
            </button>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, i) => (
          <div key={i} className="glass-panel rounded-2xl p-4 shadow-xl transition-colors md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</h3>
              <div className={`rounded-full ${metric.color} px-2 py-0.5 text-[11px] font-semibold`}>
                {metric.trend}
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(metric.value)}
            </p>
          </div>
        ))}
      </section>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Charts Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading charts...</p>
            </div>
          </div>
        ) : charts.length === 0 ? (
          <div className="col-span-full flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="mb-4 text-slate-500 dark:text-slate-400">No charts yet. Create your first visualization!</p>
              <button
                onClick={handleAddChart}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 transition"
              >
                Create Chart
              </button>
            </div>
          </div>
        ) : (
          charts.map((chart) => (
            <div key={chart.id} className="glass-panel rounded-2xl p-4 shadow-xl transition-colors md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditChart(chart.id)}
                    className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDuplicateChart(chart.id)}
                    className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    title="Duplicate"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                      <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteChart(chart.id)}
                    className="rounded-lg bg-red-100 p-1.5 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="h-64 w-full">
                <ChartRenderer
                  chart={{
                    chartType: chart.type,
                    title: chart.title,
                    mappings: {
                      x: chart.xField,
                      y: chart.yField
                    }
                  }}
                  data={chart.data || []}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Data source: {chart.dataSource}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}