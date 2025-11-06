
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
  const [multiWindow, setMultiWindow] = useState(false);
  const [showLayoutConfig, setShowLayoutConfig] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState(2);
  const [selectedDisplayId, setSelectedDisplayId] = useState(0);
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

  const handleSelectAll = () => {
    setSelectedCharts(allCharts.map(c => `${c.source}-${c.id}`));
  };

  const handleClearSelection = () => {
    setSelectedCharts([]);
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

  // Auto-start kiosk presentation if query param present and session data exists
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kiosk') === '1') {
      try {
        const raw = sessionStorage.getItem('presentationSingleTab');
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved.charts) && saved.charts.length > 0) {
            setSelectedCharts(saved.charts);
            if (saved.columns) setLayoutColumns(saved.columns);
            setIsPresenting(true);
          }
        }
      } catch (_) {}
    }
  }, []);

  const handleConfigureScreens = () => {
    if (selectedCharts.length === 0) {
      alert("Please select at least one chart to present");
      return;
    }
    if (multiWindow) {
      setShowScreenConfig(true);
    } else {
      setShowLayoutConfig(true);
    }
  };

  const handleStartPresentation = async () => {
    if (selectedCharts.length === 0) {
      alert("Please select at least one chart to present");
      return;
    }
    
    // Single-tab slideshow mode
    if (!multiWindow) {
      // Require layout configuration before presenting
      setShowLayoutConfig(true);
      return;
    }
    
    // Preflight: request Window Management / Screen Details permission so we can target displays
    try {
      if (window.getScreenDetails) {
        // If permission API exists, surface state to user if denied
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const p = await navigator.permissions.query({ name: 'window-management' });
            if (p.state === 'denied') {
              alert("Please allow 'Manage windows and tabs' (Window Management) permission for this site in your browser settings to present on selected displays. Then click Start Presentation again.");
              return;
            }
          } catch (_) {
            // Ignore; not all browsers implement this permission query
          }
        }
        // This call may prompt the user; if they deny, we catch below
        await window.getScreenDetails();
      }
    } catch (e) {
      // User denied or API unavailable
      console.warn('Screen Details permission not granted or unavailable:', e);
      // Continue; child windows will still open on primary screen as fallback
    }
    
    // Store presentation data in sessionStorage for child windows to access
    const presentationData = {
      charts: selectedCharts,
      assignments: screenAssignments,
      timestamp: Date.now()
    };
    sessionStorage.setItem('presentationData', JSON.stringify(presentationData));

    // IMPORTANT: Open windows synchronously (popup blockers require user gesture)
    const openedWindows = [];
    selectedCharts.forEach((chartId, index) => {
      const screenId = screenAssignments[chartId] ?? 0;
      const presentationUrl = `/presentation-window?chartId=${encodeURIComponent(chartId)}&index=${index}&total=${selectedCharts.length}&screenId=${screenId}`;
      const baseFeatures = "popup=yes,noopener,noreferrer,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
      const winRef = window.open(presentationUrl, `presentation-${index}`, baseFeatures);
      openedWindows.push({ winRef, chartId, index, screenId });
    });

    // Try to use Screen Details API for accurate multi-screen positioning AFTER windows are opened
    try {
      const screenDetails = window.getScreenDetails ? await window.getScreenDetails() : null;

      openedWindows.forEach(({ winRef, chartId, index, screenId }) => {
        if (!winRef || winRef.closed) return;

        let left = 0;
        let top = 0;
        let width = window.screen.availWidth;
        let height = window.screen.availHeight;

        if (screenDetails && screenDetails.screens && screenDetails.screens[screenId]) {
          const screen = screenDetails.screens[screenId];
          left = Math.round((screen.availLeft ?? screen.left ?? 0));
          top = Math.round((screen.availTop ?? screen.top ?? 0));
          width = Math.round((screen.availWidth ?? screen.width ?? width));
          height = Math.round((screen.availHeight ?? screen.height ?? height));
        } else if (availableScreens && availableScreens[screenId]) {
          const fallback = availableScreens[screenId];
          left = Math.round(fallback.left ?? (screenId * (fallback.width || 1920)));
          top = Math.round(fallback.top ?? 0);
          width = Math.round(fallback.width || 1920);
          height = Math.round(fallback.height || 1080);
        }

        try {
          winRef.moveTo(left, top);
          winRef.resizeTo(width, height);
          winRef.focus();
        } catch (e) {
          // Some browsers may restrict programmatic moving/resizing
          // We already opened windows; worst case they remain on primary screen
        }
      });
    } catch (error) {
      console.error("Error accessing screen details:", error);
      // We already opened windows synchronously; nothing else to do here
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
    if (!multiWindow) {
      return <PresentationCanvas selectedCharts={selectedCharts} columns={layoutColumns} onExit={handleExitPresentation} />;
    }
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

      {showLayoutConfig && (
        <PresentationLayoutModal
          availableScreens={availableScreens}
          selectedDisplayId={selectedDisplayId}
          setSelectedDisplayId={setSelectedDisplayId}
          onClose={() => setShowLayoutConfig(false)}
          onStart={async () => {
            setShowLayoutConfig(false);
            // Persist single-tab presentation state for kiosk window
            try {
              sessionStorage.setItem('presentationSingleTab', JSON.stringify({ charts: selectedCharts, columns: layoutColumns }));
            } catch (_) {}
            // Fire backend to open kiosk window on selected display
            try {
              const presentUrl = `${window.location.origin}/presentation?kiosk=1`;
              await fetch(`${BACKEND_URL}/api/present`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: presentUrl, monitorIndex: selectedDisplayId })
              });
            } catch (e) {
              console.warn('Failed to trigger external presenter:', e);
            }
            setIsPresenting(true);
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
            } catch (_) {}
          }}
          columns={layoutColumns}
          setColumns={setLayoutColumns}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Available Charts</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-500 dark:text-slate-300">
              {selectedCharts.length} selected
            </div>
            <button
              onClick={handleSelectAll}
              className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Select All
            </button>
            {selectedCharts.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Clear
              </button>
            )}
            {selectedCharts.length > 0 && (
              <button
                onClick={handleConfigureScreens}
                className="rounded-full bg-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-600"
              >
                ⚙️ Configure Presentation
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

function PresentationCanvas({ selectedCharts, columns, onExit }) {
  const { charts: staticCharts, datasets } = useStore();
  const [dynamicCharts, setDynamicCharts] = useState([]);
  const [dynamicConnections, setDynamicConnections] = useState([]);
  const abortControllerRef = useRef(null);

  useEffect(() => {
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
        if (error.name !== 'AbortError') {
          console.error('Error fetching dynamic charts:', error);
        }
      }
    };
    fetchDynamicCharts();
  }, []);

  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, columns))}, minmax(0, 1fr))`
  }), [columns]);

  const parseId = useCallback((chartId) => {
    const parts = chartId.split('-');
    return { source: parts[0], id: parts.slice(1).join('-') };
  }, []);

  const resolveChart = useCallback((chartId) => {
    const { source, id } = parseId(chartId);
    if (source === 'static') return { source, chart: staticCharts[id] };
    const found = dynamicCharts.find(c => c.id === id);
    return { source, chart: found };
  }, [parseId, staticCharts, dynamicCharts]);

  const buildStaticData = useCallback((chart) => {
    const dataset = datasets[chart.datasetId];
    const rows = dataset?.data || dataset?.rowsPreview || [];
    return buildChartData(rows, chart.chartType, chart.mappings, chart.options || {});
  }, [datasets]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6" style={gridStyle}>
          {selectedCharts.map((cid) => {
            const { source, chart } = resolveChart(cid);
            if (!chart) {
              return (
                <div key={cid} className="bg-slate-900 rounded-lg p-4 text-center text-slate-300">Chart not found</div>
              );
            }
            return (
              <div key={cid} className="bg-slate-900 rounded-lg p-4 min-h-[240px] flex flex-col">
                <div className="text-white text-sm font-semibold mb-3">{chart.title}</div>
                <div className="flex-1 rounded-md overflow-hidden">
                  {source === 'static' ? (
                    <ChartRenderer chart={chart} data={buildStaticData(chart)} skipValidation />
                  ) : (
                    <ChartWithRealTimeData chart={chart} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="text-slate-400 text-xs">ESC to exit fullscreen</div>
        <button onClick={onExit} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition">Exit</button>
      </div>
    </div>
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

function PresentationLayoutModal({ onClose, onStart, columns, setColumns, availableScreens, selectedDisplayId, setSelectedDisplayId }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md shadow-2xl">
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Configure Presentation Layout</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Target Display</label>
              <select
                value={selectedDisplayId ?? ''}
                onChange={(e) => setSelectedDisplayId(e.target.value ? parseInt(e.target.value) : 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium"
              >
                {availableScreens.map(screen => (
                  <option key={screen.id} value={screen.id}>
                    {screen.label} ({screen.width}x{screen.height}){screen.isPrimary ? ' • Primary' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Move the browser to this display before starting, then it will go fullscreen there.</p>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Columns</label>
            <input
              type="range"
              min={1}
              max={6}
              value={columns}
              onChange={(e) => setColumns(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-slate-500 dark:text-slate-300">{columns} column{columns !== 1 ? 's' : ''}</div>
          </div>

          <div className="flex gap-3 mt-6 justify-end">
            <button
              onClick={onClose}
              className="rounded-full border border-slate-300 dark:border-slate-600 px-6 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={onStart}
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
