import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useStore } from "../providers/StoreContext.jsx";
import ChartRenderer from "./ChartRenderer.jsx";
import ChartWithRealTimeData from "./ChartWithRealTimeData.jsx";
import { buildChartData } from "../utils/chartData.js";
import GlassCard from "./GlassCard.jsx";

const BACKEND_URL = "http://localhost:8085";

export default function PresentationMode() {
  const { charts: staticCharts, datasets } = useStore();
  const [dynamicCharts, setDynamicCharts] = useState([]);
  const [dynamicConnections, setDynamicConnections] = useState([]);
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [screenAssignments, setScreenAssignments] = useState({});
  const [availableScreens, setAvailableScreens] = useState([]);
  const [showScreenConfig, setShowScreenConfig] = useState(false);
  const abortControllerRef = useRef(null);

  const allCharts = useMemo(() => {
    const staticList = Object.values(staticCharts).map((chart) => ({
      ...chart,
      source: "static",
      displayName: `${chart.title} (Static)`
    }));

    const dynamicList = dynamicCharts.map((chart) => ({
      ...chart,
      source: "dynamic",
      displayName: `${chart.title} (Dynamic)`
    }));

    return [...staticList, ...dynamicList];
  }, [staticCharts, dynamicCharts]);

  const fetchDynamicCharts = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    try {
      const [connectionsResponse, chartsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/connections`, { signal }),
        fetch(`${BACKEND_URL}/api/charts`, { signal })
      ]);

      const connectionsData = await connectionsResponse.json();
      const chartsData = await chartsResponse.json();

      const nextConnections = connectionsData?.success ? connectionsData.connections || [] : [];
      const nextCharts = chartsData?.success ? chartsData.charts || [] : [];

      setDynamicConnections(nextConnections);
      setDynamicCharts(nextCharts);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error fetching dynamic charts:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDynamicCharts();
  }, [fetchDynamicCharts]);

  const handleChartToggle = (chartId) => {
    setSelectedCharts((prev) => {
      if (prev.includes(chartId)) {
        return prev.filter((id) => id !== chartId);
      } else {
        return [...prev, chartId];
      }
    });
  };

  const detectScreens = useCallback(() => {
    if (window.getScreenDetails) {
      window.getScreenDetails().then(details => {
        const screens = details.screens.map((screen, index) => ({
          id: index,
          label: `Display ${index + 1}`,
          width: screen.width,
          height: screen.height,
          isPrimary: screen.isPrimary
        }));
        setAvailableScreens(screens);
      }).catch(() => {
        setAvailableScreens([{ id: 0, label: "Primary Display", width: window.innerWidth, height: window.innerHeight, isPrimary: true }]);
      });
    } else {
      setAvailableScreens([{ id: 0, label: "Primary Display", width: window.innerWidth, height: window.innerHeight, isPrimary: true }]);
    }
  }, []);

  useEffect(() => {
    detectScreens();
  }, [detectScreens]);

  const handleConfigureScreens = () => {
    if (selectedCharts.length === 0) {
      alert("Please select at least one chart to present");
      return;
    }
    setShowScreenConfig(true);
  };

  const handleStartPresentation = async () => {
    if (selectedCharts.length === 0) {
      alert("Please select at least one chart to present");
      return;
    }
    
    // Store presentation data in sessionStorage for child windows to access
    const presentationData = {
      charts: selectedCharts,
      assignments: screenAssignments,
      timestamp: Date.now()
    };
    sessionStorage.setItem('presentationData', JSON.stringify(presentationData));
    
    // Try to use Screen Details API for accurate multi-screen positioning
    try {
      if (window.getScreenDetails) {
        const screenDetails = await window.getScreenDetails();
        
        // Open presentation windows on each assigned screen
        selectedCharts.forEach((chartId, index) => {
          const screenId = screenAssignments[chartId] ?? 0;
          const screen = screenDetails.screens[screenId];
          
          if (screen) {
            // Use screen coordinates for positioning
            const left = Math.round(screen.availLeft || screen.left || 0);
            const top = Math.round(screen.availTop || screen.top || 0);
            const width = Math.round(screen.availWidth || screen.width);
            const height = Math.round(screen.availHeight || screen.height);
            
            const windowFeatures = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`;
            const presentationUrl = `/presentation-window?chartId=${encodeURIComponent(chartId)}&index=${index}&total=${selectedCharts.length}&screenId=${screenId}`;
            window.open(presentationUrl, `presentation-${index}`, windowFeatures);
          }
        });
      } else {
        // Fallback for browsers without Screen Details API
        selectedCharts.forEach((chartId, index) => {
          const screenId = screenAssignments[chartId] ?? 0;
          const screen = availableScreens[screenId];
          
          if (screen) {
            const left = screen.left || (screenId * 1920); // Estimate position
            const top = screen.top || 0;
            const width = screen.width || 1920;
            const height = screen.height || 1080;
            
            const windowFeatures = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`;
            const presentationUrl = `/presentation-window?chartId=${encodeURIComponent(chartId)}&index=${index}&total=${selectedCharts.length}&screenId=${screenId}`;
            window.open(presentationUrl, `presentation-${index}`, windowFeatures);
          }
        });
      }
    } catch (error) {
      console.error("Error accessing screen details:", error);
      // Fallback: just open windows
      selectedCharts.forEach((chartId, index) => {
        const screenId = screenAssignments[chartId] ?? 0;
        const presentationUrl = `/presentation-window?chartId=${encodeURIComponent(chartId)}&index=${index}&total=${selectedCharts.length}&screenId=${screenId}`;
        window.open(presentationUrl, `presentation-${index}`);
      });
    }
    
    setIsPresenting(true);
  };

  const handleNextScreen = () => {
    if (currentScreenIndex < selectedCharts.length - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1);
    }
  };

  const handlePreviousScreen = () => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex(currentScreenIndex - 1);
    }
  };

  const handleExitPresentation = () => {
    setIsPresenting(false);
    setCurrentScreenIndex(0);
    
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log("Exit fullscreen failed:", err));
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    } else if (document.mozFullScreenElement) {
      document.mozCancelFullScreen();
    } else if (document.msFullscreenElement) {
      document.msExitFullscreen();
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (!isPresenting) return;

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleNextScreen();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePreviousScreen();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleExitPresentation();
      }
    },
    [isPresenting, currentScreenIndex, selectedCharts.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isPresenting) {
    return <PresentationScreen chartId={selectedCharts[currentScreenIndex]} onExit={handleExitPresentation} onNext={handleNextScreen} onPrev={handlePreviousScreen} currentIndex={currentScreenIndex} totalCharts={selectedCharts.length} />;
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      <section className="sticky top-[84px] z-30">
        <GlassCard className="sticky-edge shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Presentation Mode</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Select charts to present in fullscreen. Use arrow keys or space to navigate.
              </p>
            </div>
            <button
              onClick={handleStartPresentation}
              disabled={selectedCharts.length === 0}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              Start Presentation ({selectedCharts.length})
            </button>
          </div>
        </GlassCard>
      </section>

      {showScreenConfig && (
        <ScreenConfigurationModal
          selectedCharts={selectedCharts}
          availableScreens={availableScreens}
          screenAssignments={screenAssignments}
          onAssignmentsChange={setScreenAssignments}
          onClose={() => setShowScreenConfig(false)}
          onStart={handleStartPresentation}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Available Charts</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-500 dark:text-slate-300">
              {selectedCharts.length} selected
            </div>
            {selectedCharts.length > 0 && availableScreens.length > 1 && (
              <button
                onClick={handleConfigureScreens}
                className="rounded-full bg-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-600"
              >
                🖥️ Configure Screens
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/30 dark:border-slate-200/20">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading charts...</p>
            </div>
          </div>
        ) : allCharts.length === 0 ? (
          <GlassCard className="flex h-48 flex-col items-center justify-center border border-dashed border-white/40 text-sm text-slate-600 transition-colors dark:border-slate-200/30 dark:text-slate-300">
            <p>No charts available. Create some charts first.</p>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {allCharts.map((chart) => (
              <ChartSelectionCard
                key={`${chart.source}-${chart.id}`}
                chart={chart}
                isSelected={selectedCharts.includes(`${chart.source}-${chart.id}`)}
                onToggle={() => handleChartToggle(`${chart.source}-${chart.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChartSelectionCard({ chart, isSelected, onToggle }) {
  const { datasets } = useStore();

  const chartPreview = useMemo(() => {
    if (chart.source === "static") {
      const dataset = datasets[chart.datasetId];
      const rows = dataset?.data || dataset?.rowsPreview || [];
      return buildChartData(rows, chart.chartType, chart.mappings, chart.options || {});
    }
    return null;
  }, [chart, datasets]);

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <GlassCard
      className={`flex flex-col gap-3 shadow-xl transition-all ${
        isSelected ? "ring-2 ring-brand-500 bg-brand-50/30 dark:bg-brand-500/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 cursor-pointer" onClick={onToggle}>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{chart.displayName}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {chart.source === "static" ? "Static Dashboard" : "Dynamic Dashboard"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 rounded border-2 border-slate-300 text-brand-500 focus:ring-2 focus:ring-brand-500 cursor-pointer accent-brand-500 flex-shrink-0"
        />
      </div>

      <div className="flex-1 rounded-2xl bg-slate-50 p-4 transition-colors dark:bg-slate-800/50 min-h-[200px]">
        {chart.source === "static" && chartPreview ? (
          <ChartRenderer chart={chart} data={chartPreview} compact skipValidation />
        ) : chart.source === "dynamic" ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
            <div className="text-center">
              <div className="mb-2 text-2xl">📊</div>
              <p>{chart.title}</p>
              <p className="text-xs mt-1">Dynamic Chart</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400 dark:text-slate-500">
            Preview unavailable
          </div>
        )}
      </div>

      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2 dark:text-slate-300">
        <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
          <span className="block font-semibold text-slate-700 dark:text-slate-200">Type</span>
          <span className="uppercase">{chart.chartType || chart.type || "chart"}</span>
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
          <span className="block font-semibold text-slate-700 dark:text-slate-200">Source</span>
          <span className="capitalize">{chart.source}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function PresentationScreen({ chartId, onExit, onNext, onPrev, currentIndex, totalCharts }) {
  const { charts: staticCharts, datasets } = useStore();
  const [dynamicCharts, setDynamicCharts] = useState([]);
  const [dynamicConnections, setDynamicConnections] = useState([]);
  const abortControllerRef = useRef(null);

  const { source, id } = useMemo(() => {
    const parts = chartId.split("-");
    const chartSource = parts[0];
    const chartId_ = parts.slice(1).join("-");
    return { source: chartSource, id: chartId_ };
  }, [chartId]);

  const chart = useMemo(() => {
    if (source === "static") {
      return staticCharts[id];
    } else {
      return dynamicCharts.find((c) => c.id === id);
    }
  }, [source, id, staticCharts, dynamicCharts]);

  const chartData = useMemo(() => {
    if (source === "static" && chart) {
      const dataset = datasets[chart.datasetId];
      const rows = dataset?.data || dataset?.rowsPreview || [];
      return buildChartData(rows, chart.chartType, chart.mappings, chart.options || {});
    }
    return null;
  }, [source, chart, datasets]);

  useEffect(() => {
    if (source === "dynamic") {
      const fetchDynamicCharts = async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
          const [connectionsResponse, chartsResponse] = await Promise.all([
            fetch(`${BACKEND_URL}/api/connections`, { signal }),
            fetch(`${BACKEND_URL}/api/charts`, { signal })
          ]);

          const connectionsData = await connectionsResponse.json();
          const chartsData = await chartsResponse.json();

          const nextConnections = connectionsData?.success ? connectionsData.connections || [] : [];
          const nextCharts = chartsData?.success ? chartsData.charts || [] : [];

          setDynamicConnections(nextConnections);
          setDynamicCharts(nextCharts);
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Error fetching dynamic charts:", error);
          }
        }
      };

      fetchDynamicCharts();
    }
  }, [source]);

  if (!chart) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="mb-4">Chart not found</p>
          <button
            onClick={onExit}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
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

      {/* Controls */}
      <div className="bg-slate-950 border-t border-slate-800 px-8 py-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:cursor-not-allowed transition"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-4 text-white">
          <span className="text-sm font-semibold">
            {currentIndex + 1} / {totalCharts}
          </span>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${((currentIndex + 1) / totalCharts) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNext}
            disabled={currentIndex === totalCharts - 1}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
          <button
            onClick={onExit}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            Exit (ESC)
          </button>
        </div>
      </div>

      {/* Keyboard Hints */}
      <div className="bg-slate-900 px-8 py-2 text-center text-xs text-slate-400">
        Use arrow keys or space to navigate • ESC to exit
      </div>
    </div>
  );
}

function ScreenConfigurationModal({ selectedCharts, availableScreens, screenAssignments, onAssignmentsChange, onClose, onStart }) {
  const { charts: staticCharts } = useStore();
  const [dynamicCharts, setDynamicCharts] = useState([]);

  useEffect(() => {
    const fetchDynamicCharts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/charts`);
        const data = await response.json();
        setDynamicCharts(data?.success ? data.charts || [] : []);
      } catch (error) {
        console.error("Error fetching dynamic charts:", error);
      }
    };
    fetchDynamicCharts();
  }, []);

  const allCharts = useMemo(() => {
    const staticList = Object.values(staticCharts).map((chart) => ({
      ...chart,
      source: "static",
      displayName: `${chart.title} (Static)`
    }));

    const dynamicList = dynamicCharts.map((chart) => ({
      ...chart,
      source: "dynamic",
      displayName: `${chart.title} (Dynamic)`
    }));

    return [...staticList, ...dynamicList];
  }, [staticCharts, dynamicCharts]);

  const getChartTitle = (chartId) => {
    const [source, ...idParts] = chartId.split("-");
    const id = idParts.join("-");
    const chart = allCharts.find(c => c.id === id && c.source === source);
    return chart?.displayName || chartId;
  };

  const handleAssignChart = (chartId, screenId) => {
    onAssignmentsChange(prev => ({
      ...prev,
      [chartId]: screenId
    }));
  };

  const handleStartWithAssignments = () => {
    onClose();
    onStart();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Configure Multi-Screen Presentation</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Assign each chart to a specific display. Charts without assignment will use the primary display.
          </p>

          <div className="grid gap-6">
            {/* Available Screens */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Available Displays</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {availableScreens.map(screen => (
                  <div key={screen.id} className="bg-white dark:bg-slate-700 rounded-lg p-3 text-center border-2 border-slate-300 dark:border-slate-600">
                    <div className="text-2xl mb-1">🖥️</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{screen.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{screen.width}x{screen.height}</div>
                    {screen.isPrimary && <div className="text-xs text-brand-500 font-semibold mt-1">Primary</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Chart Assignments */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Chart Assignments</h3>
              {selectedCharts.map((chartId, index) => (
                <div key={chartId} className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {index + 1}. {getChartTitle(chartId)}
                    </div>
                  </div>
                  <select
                    value={screenAssignments[chartId] ?? ""}
                    onChange={(e) => handleAssignChart(chartId, e.target.value ? parseInt(e.target.value) : undefined)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Primary Display</option>
                    {availableScreens.map(screen => (
                      <option key={screen.id} value={screen.id}>
                        {screen.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-brand-50 dark:bg-brand-500/10 rounded-lg p-4 border border-brand-200 dark:border-brand-500/30">
              <p className="text-sm text-brand-900 dark:text-brand-100">
                <span className="font-semibold">📊 Ready to present:</span> {selectedCharts.length} chart{selectedCharts.length !== 1 ? 's' : ''} across {availableScreens.length} display{availableScreens.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 justify-end">
            <button
              onClick={onClose}
              className="rounded-full border border-slate-300 dark:border-slate-600 px-6 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleStartWithAssignments}
              className="rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition"
            >
              Start Presentation
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
