import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../ui/GlassCard.jsx";
import ChartRenderer from "../ui/ChartRenderer.jsx";
import DynamicChart3D from "../ui/DynamicChart3D.jsx";
import Dynamic3DCharts from "../ui/Dynamic3DCharts.jsx";
import { buildChartData } from "../utils/chartData.js";

const BACKEND_URL = "http://localhost:8085"; // change if backend runs elsewhere

const chartTypes = [
  { value: "line", label: "Line", description: "Track trends across time" },
  { value: "bar", label: "Bar Plot", description: "Compare values side-by-side" },
  { value: "area", label: "Area Plot", description: "Emphasize cumulative totals" },
  { value: "pie", label: "Pie", description: "Show proportional breakdown" },
  { value: "scatter", label: "Scatter Plot", description: "Visualize relationships between variables" },
  { value: "histogram", label: "Histogram", description: "Shows data distribution" },
  { value: "box", label: "Box Plot", description: "Identifies outliers and data spread" },
  { value: "gauge", label: "Gauge Chart", description: "Shows progress or KPI value" },
  { value: "scatter3d", label: "3D Scatter Plot", description: "Relationship among three variables" },
  { value: "surface3d", label: "3D Surface Plot", description: "Trend or pattern visualization in 3D" },
  { value: "line3d", label: "3D Line Plot", description: "Time or path-based 3D trend visualization" }
];

export default function DynamicVisualizePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const [chartType, setChartType] = useState("line");
  const [chartDimension, setChartDimension] = useState("2d");
  const [dataSource, setDataSource] = useState("");
  const [dataFields, setDataFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState({
    xField: "",
    yField: "",
    zField: ""
  });
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartTitle, setChartTitle] = useState("New Dynamic Visualization");
  const [connections, setConnections] = useState([]);
  const [aggregation, setAggregation] = useState("none");
  const [topN, setTopN] = useState(0);

  // Keep latest selectedFields to avoid stale closure inside polling interval
  const selectedFieldsRef = useRef(selectedFields);
  useEffect(() => {
    selectedFieldsRef.current = selectedFields;
  }, [selectedFields]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/connections`);
        const data = await response.json();
        if (data.success) {
          setConnections(data.connections);
          if (data.connections.length > 0 && !dataSource) {
            setDataSource(data.connections[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching connections:", err);
      }
    };
    
    fetchConnections();
  }, []);

  useEffect(() => {
    // If editing, fetch the existing chart configuration
    if (isEditing && id) {
      const fetchChartConfig = async () => {
        try {
          setLoading(true);
          setError(null);
          console.log(`Fetching chart config for ID: ${id}`);
          const response = await fetch(`${BACKEND_URL}/api/charts/${id}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setError(`Chart with ID "${id}" not found. It may have been deleted or the server was restarted.`);
            } else {
              setError(`Failed to load chart: ${response.status} ${response.statusText}`);
            }
            setLoading(false);
            return;
          }
          
          const data = await response.json();
          console.log("Chart config response:", data);
          
          if (data.success && data.chart) {
            setChartTitle(data.chart.title);
            setChartType(data.chart.type || data.chart.chartType || "line");
            setDataSource(data.chart.dataSource);
            setSelectedFields({
              xField: data.chart.xField || "",
              yField: data.chart.yField || "",
              zField: data.chart.zField || ""
            });
            setChartDimension(data.chart.dimension || data.chart.options?.dimension || "2d");
            setAggregation(data.chart.options?.aggregation || data.chart.aggregation || "none");
            setTopN(data.chart.options?.topN || data.chart.topN || 0);
          } else {
            setError(data.error || "Failed to load chart configuration.");
          }
          setLoading(false);
        } catch (err) {
          console.error("Error fetching chart config:", err);
          setError(`Failed to load chart configuration: ${err.message}`);
          setLoading(false);
        }
      };
      
      fetchChartConfig();
    } else if (!isEditing) {
      setLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (!dataSource) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from the selected connection
        const response = await fetch(`${BACKEND_URL}/api/data/${dataSource}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          // Flatten the data if it's nested in tables
          let flatData = data.data;
          if (data.data[0].rows) {
            flatData = data.data.flatMap(table => table.rows);
          }
          
          // Extract field names from the first data item
          if (flatData.length > 0) {
            const fields = Object.keys(flatData[0]);
            setDataFields(fields);

            // Infer numeric fields from a small sample
            const sample = flatData.slice(0, Math.min(20, flatData.length));
            const isNumericField = (key) => {
              let numericCount = 0;
              for (const row of sample) {
                const v = row?.[key];
                if (v === null || v === undefined) continue;
                const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v.trim()) : NaN);
                if (Number.isFinite(n)) numericCount++;
              }
              return numericCount > 0 && numericCount >= Math.ceil(sample.length * 0.3);
            };
            const numericFields = fields.filter(isNumericField);

            // Set defaults only if not already chosen (use ref to avoid stale closure)
            if (!selectedFieldsRef.current.xField || !selectedFieldsRef.current.yField) {
              const lower = fields.map(f => f.toLowerCase());
              const idxTimestamp = lower.indexOf('timestamp');
              const idxTimeLike = idxTimestamp !== -1
                ? idxTimestamp
                : lower.findIndex(f => f.includes('date') || f.includes('time'));
              const xDefault = idxTimeLike !== -1 ? fields[idxTimeLike] : fields[0];

              // Prefer common sensor value keys, then any numeric field not equal to x
              const preferredYKeys = ['value', 'val', 'reading', 'batt', 'battery', 'temp', 'temperature', 'hum', 'humidity'];
              const yFromPreferred = preferredYKeys
                .map(k => fields[lower.indexOf(k)])
                .find(Boolean);
              const yNumeric = (numericFields.find(f => f !== xDefault)) || fields.find(f => f !== xDefault);
              const yDefault = yFromPreferred || yNumeric || fields[0];

              setSelectedFields({
                xField: xDefault,
                yField: yDefault,
                zField: numericFields.find(f => f !== xDefault && f !== yDefault) || fields[2] || fields[1] || fields[0]
              });
            }

            setPreviewData(flatData);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
        setLoading(false);
      }
    };
    
    // Fetch immediately and then poll every 2 seconds for real-time updates
    fetchData();
    const interval = setInterval(fetchData, 2000); // Poll every 2 seconds for real-time EDA
    
    return () => clearInterval(interval);
  }, [dataSource]);

  // Process preview data with aggregation
  const processedPreviewData = useMemo(() => {
    if (!previewData.length || !selectedFields.xField || !selectedFields.yField) {
      return previewData;
    }
    
    const mappings = {
      xField: selectedFields.xField,
      yField: selectedFields.yField,
      yFields: [selectedFields.yField],
      categoryField: selectedFields.xField,
      valueField: selectedFields.yField,
      angleField: selectedFields.xField,
      radiusField: selectedFields.yField
    };
    
    const options = {
      aggregation: aggregation,
      topN: topN
    };
    
    return buildChartData(previewData, chartType, mappings, options);
  }, [previewData, selectedFields, chartType, aggregation, topN]);

  useEffect(() => {
    if (chartDimension === "3d" && chartType !== "bar") {
      setChartType("bar");
    }
  }, [chartDimension, chartType]);

  const handleSave = async () => {
    if (!chartTitle || !chartType || !dataSource || !selectedFields.xField || !selectedFields.yField) {
      setError("Please fill in all required fields.");
      return;
    }
    
    try {
      const chartConfig = {
        title: chartTitle,
        type: chartType,
        dataSource,
        dimension: chartDimension,
        xField: selectedFields.xField,
        yField: selectedFields.yField,
        zField: selectedFields.zField,
        options: {
          aggregation: aggregation,
          topN: topN,
          dimension: chartDimension
        }
      };
      
      const url = isEditing 
        ? `${BACKEND_URL}/api/charts/${id}` 
        : `${BACKEND_URL}/api/charts`;
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chartConfig)
      });
      
      const data = await response.json();
      
      if (data.success) {
        navigate("/dynamic-dashboard");
      } else {
        setError(data.error || "Failed to save chart.");
      }
    } catch (err) {
      console.error("Error saving chart:", err);
      setError("Failed to save chart. Please try again.");
    }
  };

  const handleCancel = () => {
    navigate("/dynamic-dashboard");
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      <section className="sticky top-[84px] z-30">
        <GlassCard className="sticky-edge shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isEditing ? "Edit Dynamic Visualization" : "Create Dynamic Visualization"}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Connect your live data and build a chart in minutes.
              </p>
            </div>
            <div className="inline-flex items-center gap-2">
              <div className="glass-hover rounded-full border border-emerald-400/40 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition dark:border-emerald-300/20 dark:bg-emerald-500/20 dark:text-emerald-200">
                Live Preview
              </div>
              <button
                type="button"
                onClick={() => navigate("/dynamic-dashboard")}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                View dashboard
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg" role="alert">
          <p className="font-semibold mb-2">{error}</p>
          {isEditing && (
            <button
              onClick={() => {
                navigate("/dynamic-visualize");
                setError(null);
              }}
              className="text-sm underline hover:no-underline"
            >
              Create a new chart instead
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <section className="rounded-2xl">
          <GlassCard className="h-full shadow-xl transition-colors">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Chart Configuration</h2>
          
          <div className="space-y-4">
            {/* Chart Title */}
            <div>
              <label htmlFor="chart-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chart Title
              </label>
              <input
                type="text"
                id="chart-title"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="Enter chart title"
              />
            </div>
            
            {/* Chart Type */}
            <div>
              <label htmlFor="chart-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chart Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map((type) => {
                  const isDisabled = chartDimension === "3d" && !["bar", "scatter3d", "surface3d", "line3d"].includes(type.value);
                  const isActive = chartType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          setChartType(type.value);
                        }
                      }}
                      disabled={isDisabled}
                      className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center text-xs transition ${
                        isActive
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
                      } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="font-medium">{type.label}</span>
                      <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{type.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart Dimension */}
            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chart Dimension</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChartDimension("2d")}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    chartDimension === "2d"
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  2D Projection
                  <span className="mt-1 block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    Standard charts via Recharts
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartDimension("3d")}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    chartDimension === "3d"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  3D Projection
                  <span className="mt-1 block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    Experimental liquid 3D bars
                  </span>
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                3D visuals require at least one numeric value field.
              </p>
            </div>
            
            {/* Data Source */}
            <div>
              <label htmlFor="data-source" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Data Source
              </label>
              <select
                id="data-source"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select a data source</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.config?.name || connection.id}
                  </option>
                ))}
              </select>
            </div>
            
            {/* X-Axis Field */}
            <div>
              <label htmlFor="x-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                X-Axis Field
              </label>
              <select
                id="x-field"
                value={selectedFields.xField}
                onChange={(e) => setSelectedFields({ ...selectedFields, xField: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={dataFields.length === 0}
              >
                <option value="">Select X-Axis field</option>
                {dataFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Y-Axis Field */}
            <div>
              <label htmlFor="y-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Y-Axis Field
              </label>
              <select
                id="y-field"
                value={selectedFields.yField}
                onChange={(e) => setSelectedFields({ ...selectedFields, yField: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={dataFields.length === 0}
              >
                <option value="">Select Y-Axis field</option>
                {dataFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Z-Axis Field (for 3D charts) */}
            {["scatter3d", "surface3d", "line3d"].includes(chartType) && (
              <div>
                <label htmlFor="z-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Z-Axis Field
                </label>
                <select
                  id="z-field"
                  value={selectedFields.zField}
                  onChange={(e) => setSelectedFields({ ...selectedFields, zField: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={dataFields.length === 0}
                >
                  <option value="">Select Z-Axis field</option>
                  {dataFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Aggregation Options */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Options</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="aggregation" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Aggregation
                  </label>
                  <select
                    id="aggregation"
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="none">None</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="top-n" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Top N (0 = all)
                  </label>
                  <input
                    type="number"
                    id="top-n"
                    min="0"
                    value={topN}
                    onChange={(e) => setTopN(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use aggregation to summarize repeated categories before charting. Top N trims results to keep dashboards focused.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={handleCancel}
                className="glass-hover rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:focus-visible:ring-offset-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="glass-hover rounded-full border border-transparent bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:bg-brand-600 dark:hover:bg-brand-500 dark:focus-visible:ring-offset-slate-900"
              >
                {isEditing ? "Update Chart" : "Create Chart"}
              </button>
            </div>
          </div>
          </GlassCard>
        </section>
        
        {/* Preview Panel */}
        <section className="lg:col-span-2">
          <GlassCard className="h-full shadow-xl transition-colors">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Chart Preview</h2>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400">Loading data...</p>
                </div>
              </div>
            ) : processedPreviewData.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <p className="text-slate-500 dark:text-slate-400">No data available. Please select a data source.</p>
                </div>
              </div>
            ) : (
              <>
                {["scatter3d", "surface3d", "line3d"].includes(chartType) ? (
                  <div className="h-96">
                    <ChartRenderer
                      chart={{
                        chartType,
                        title: chartTitle,
                        mappings: {
                          xField: selectedFields.xField,
                          yField: selectedFields.yField,
                          zField: selectedFields.zField,
                          yFields: selectedFields.yField ? [selectedFields.yField] : []
                        },
                        options: {
                          dimension: "3d",
                          aggregation: aggregation,
                          topN: topN
                        }
                      }}
                      data={processedPreviewData}
                    />
                  </div>
                ) : chartDimension === "3d" ? (
                  <div className="flex h-96 items-center justify-center">
                    <DynamicChart3D
                      chart={{
                        id: isEditing ? id : "preview",
                        title: chartTitle,
                        dataSource,
                        xField: selectedFields.xField,
                        yField: selectedFields.yField,
                        dimension: chartDimension
                      }}
                      data={processedPreviewData}
                      wrapInCard={false}
                      showActions={false}
                      showHeader={false}
                      showMeta={false}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="h-96">
                    <ChartRenderer
                      chart={{
                        chartType,
                        title: chartTitle,
                        mappings: {
                          xField: selectedFields.xField,
                          yField: selectedFields.yField,
                          yFields: selectedFields.yField ? [selectedFields.yField] : [],
                          categoryField: selectedFields.xField,
                          valueField: selectedFields.yField,
                          angleField: selectedFields.xField,
                          radiusField: selectedFields.yField
                        },
                        options: {
                          dimension: chartDimension,
                          aggregation: aggregation,
                          topN: topN
                        }
                      }}
                      data={processedPreviewData}
                    />
                  </div>
                )}
              </>
            )}

            {/* Data Sample */}
            {previewData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Data Sample</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead>
                      <tr>
                        {dataFields.slice(0, 5).map((field) => (
                          <th
                            key={field}
                            className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                          >
                            {field}
                          </th>
                        ))}
                        {dataFields.length > 5 && (
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            ...
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {processedPreviewData.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-white/10 dark:hover:bg-white/5">
                          {dataFields.slice(0, 5).map((field) => (
                            <td
                              key={`${rowIndex}-${field}`}
                              className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                            >
                              {row[field] !== null && row[field] !== undefined ? String(row[field]) : "null"}
                            </td>
                          ))}
                          {dataFields.length > 5 && (
                            <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">...</td>
                          )}
                        </tr>
                      ))}
                      {processedPreviewData.length > 5 && (
                        <tr>
                          <td
                            colSpan={Math.min(dataFields.length, 6)}
                            className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            {processedPreviewData.length - 5} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
