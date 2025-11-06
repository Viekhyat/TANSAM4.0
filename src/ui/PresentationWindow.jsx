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
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.mozFullScreenElement || !!document.msFullscreenElement);
  const abortControllerRef = useRef(null);

  // Get URL parameters
  const params = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      chartId: searchParams.get("chartId"),
      index: parseInt(searchParams.get("index") || "0"),
      total: parseInt(searchParams.get("total") || "1"),
      screenId: (() => {
        const v = searchParams.get("screenId");
        return v !== null ? parseInt(v) : undefined;
      })()
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

  // Position this window onto the selected display and go fullscreen
  useEffect(() => {
    let cancelled = false;

    const positionAndFullscreen = async () => {
      try {
        // Try to get screen details (may prompt for permission)
        const details = window.getScreenDetails ? await window.getScreenDetails() : null;

        if (!cancelled && details && Number.isInteger(params.screenId) && details.screens[params.screenId]) {
          const screen = details.screens[params.screenId];
          const left = Math.round((screen.availLeft ?? screen.left ?? 0));
          const top = Math.round((screen.availTop ?? screen.top ?? 0));
          const width = Math.round((screen.availWidth ?? screen.width ?? window.screen.availWidth));
          const height = Math.round((screen.availHeight ?? screen.height ?? window.screen.availHeight));
          try {
            window.moveTo(left, top);
            window.resizeTo(width, height);
            window.focus();
          } catch {}
        }

        // Best effort: request fullscreen after positioning
        const elem = document.documentElement;
        try {
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
          } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
          } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
          }
        } catch (e) {
          // Ignore if denied; content will still render
        }
      } catch (error) {
        // Ignore positioning errors; window remains on primary
      }
    };

    // Small delay to ensure the new window is fully initialized before moving
    const timer = setTimeout(positionAndFullscreen, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [params.screenId]);

  // Track fullscreen changes to show manual trigger overlay when needed
  useEffect(() => {
    const updateFs = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.mozFullScreenElement || !!document.msFullscreenElement);
    };
    document.addEventListener('fullscreenchange', updateFs);
    document.addEventListener('webkitfullscreenchange', updateFs);
    document.addEventListener('mozfullscreenchange', updateFs);
    document.addEventListener('MSFullscreenChange', updateFs);
    return () => {
      document.removeEventListener('fullscreenchange', updateFs);
      document.removeEventListener('webkitfullscreenchange', updateFs);
      document.removeEventListener('mozfullscreenchange', updateFs);
      document.removeEventListener('MSFullscreenChange', updateFs);
    };
  }, []);

  const handleManualFullscreen = async () => {
    try {
      // Reposition once more before requesting fullscreen
      if (window.getScreenDetails && Number.isInteger(params.screenId)) {
        try {
          const details = await window.getScreenDetails();
          const scr = details.screens[params.screenId];
          if (scr) {
            const left = Math.round((scr.availLeft ?? scr.left ?? 0));
            const top = Math.round((scr.availTop ?? scr.top ?? 0));
            const width = Math.round((scr.availWidth ?? scr.width ?? window.screen.availWidth));
            const height = Math.round((scr.availHeight ?? scr.height ?? window.screen.availHeight));
            try { window.moveTo(left, top); window.resizeTo(width, height); } catch {}
          }
        } catch {}
      }

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
    } catch {}
  };

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
      {!isFullscreen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="text-center text-white space-y-4">
            <div className="text-lg font-semibold">This display needs permission to go fullscreen</div>
            <button
              onClick={handleManualFullscreen}
              className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition shadow-lg"
            >
              Go Fullscreen on this Display
            </button>
            <div className="text-xs text-slate-300">If it doesn’t cover the projector, drag this window to the projector and click again.</div>
          </div>
        </div>
      )}
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
