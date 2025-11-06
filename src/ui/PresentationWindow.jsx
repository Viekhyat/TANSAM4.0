import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../providers/StoreContext.jsx";
import ChartRenderer from "./ChartRenderer.jsx";
import ChartWithRealTimeData from "./ChartWithRealTimeData.jsx";
import { buildChartData } from "../utils/chartData.js";

const BACKEND_URL = "http://localhost:8085";

export default function PresentationWindow() {
  const { charts: staticCharts, datasets } = useStore();
  const [dynamicCharts, setDynamicCharts] = useState([]);
  const [chart, setChart] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef(null);

  // Get URL parameters
  const params = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      chartId: searchParams.get("chartId"),
      index: parseInt(searchParams.get("index") || "0"),
      total: parseInt(searchParams.get("total") || "1")
    };
  }, []);

  const { source, id } = useMemo(() => {
    if (!params.chartId) return { source: null, id: null };
    const parts = params.chartId.split("-");
    const chartSource = parts[0];
    const chartId_ = parts.slice(1).join("-");
    return { source: chartSource, id: chartId_ };
  }, [params.chartId]);

  // Fetch chart data
  useEffect(() => {
    if (source === "static") {
      const foundChart = staticCharts[id];
      if (foundChart) {
        setChart(foundChart);
        const dataset = datasets[foundChart.datasetId];
        const rows = dataset?.data || dataset?.rowsPreview || [];
        const data = buildChartData(rows, foundChart.chartType, foundChart.mappings, foundChart.options || {});
        setChartData(data);
      }
      setLoading(false);
    } else if (source === "dynamic") {
      const fetchDynamicCharts = async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
          const response = await fetch(`${BACKEND_URL}/api/charts`, { signal });
          const data = await response.json();
          const charts = data?.success ? data.charts || [] : [];
          const foundChart = charts.find(c => c.id === id);
          if (foundChart) {
            setChart(foundChart);
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Error fetching dynamic chart:", error);
          }
        } finally {
          setLoading(false);
        }
      };

      fetchDynamicCharts();
    }
  }, [source, id, staticCharts, datasets]);

  // Request fullscreen on load
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      } catch (error) {
        console.log("Fullscreen request failed:", error);
      }
    };

    // Small delay to ensure window is ready
    const timer = setTimeout(requestFullscreen, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        window.close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
          <p>Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="mb-4">Chart not found</p>
          <button
            onClick={() => window.close()}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="w-full h-full flex flex-col">
          {source === "static" ? (
            <div className="flex-1 flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-4">{chart.title}</h2>
              <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden">
                <ChartRenderer chart={chart} data={chartData} skipValidation />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-4">{chart.title}</h2>
              <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden">
                <ChartWithRealTimeData chart={chart} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-950 border-t border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="text-white text-sm font-semibold">
          {params.index + 1} / {params.total}
        </div>
        <div className="text-slate-400 text-xs">
          Press ESC to close • Window will close automatically when main presentation ends
        </div>
        <button
          onClick={() => window.close()}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
