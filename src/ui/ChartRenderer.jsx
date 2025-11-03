import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useTheme } from "../providers/ThemeContext.jsx";
import { defaultPalette } from "../utils/colors.js";
import Dynamic3DCharts from "./Dynamic3DCharts.jsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const exportNodeToPng = async (node, filename = "chart.png") => {
  if (!node) return;
  const backgroundColor =
    typeof window !== "undefined" ? window.getComputedStyle(document.body).backgroundColor : "#ffffff";
  const canvas = await html2canvas(node, { backgroundColor, scale: 2 });
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

const makeDomId = (chartId) => {
  if (chartId) {
    return `chart-${String(chartId).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  }
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `chart-${crypto.randomUUID()}`;
  }
  return `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export default function ChartRenderer({ chart, data = [], compact = false, skipValidation = false }) {
  const containerRef = useRef(null);
  const chartDomIdRef = useRef(makeDomId(chart?.id));
  const [exporting, setExporting] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const mappedData = Array.isArray(data) ? data : [];
  const chartType = chart?.chartType || "bar";
  const mappings = chart?.mappings || {};
  const title = chart?.title || "Chart";
  const options = chart?.options || {};
  const seriesColors = options.seriesColors || {};
  const palette = options.palette && options.palette.length > 0 ? options.palette : defaultPalette;
  const wrapperClasses = compact
    ? "flex flex-col gap-4 transition-colors"
    : "flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700";
  const axisColor = isDark ? "#cbd5f5" : "#94a3b8";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const legendProps = useMemo(
    () => ({
      wrapperStyle: {
        color: axisColor,
        paddingTop: 8
      }
    }),
    [axisColor]
  );
  const tooltipStyles = useMemo(
    () => ({
      contentStyle: {
        backgroundColor: isDark ? "#0f172a" : "#ffffff",
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        color: isDark ? "#e2e8f0" : "#0f172a"
      },
      labelStyle: { color: isDark ? "#cbd5f5" : "#334155" },
      itemStyle: { color: isDark ? "#f8fafc" : "#0f172a" }
    }),
    [isDark]
  );

  const coerceNumeric = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const handleExport = async () => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      await exportNodeToPng(containerRef.current, `${title.replace(/\s+/g, "_").toLowerCase()}.png`);
    } catch (error) {
      console.error("Export failed", error);
      window.alert("Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const renderPlaceholder = (message) => (
    <div className="flex h-56 items-center justify-center px-4 text-center text-sm text-slate-400 dark:text-slate-500">
      {message}
    </div>
  );

  const ensureFieldsPresent = (requiredFields) => requiredFields.every((field) => field && typeof field === "string");

  const safeData = useMemo(() => {
    if (!mappedData.length) return [];

    if (["line", "bar", "area"].includes(chartType)) {
      const xField = mappings.xField;
      const yFields = mappings.yFields || [];
      if (!ensureFieldsPresent([xField]) || yFields.length === 0) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const entry = { [xField]: row[xField] };
          let hasValue = false;
          yFields.forEach((field) => {
            const coerced = coerceNumeric(row[field]);
            if (coerced !== null) hasValue = true;
            entry[field] = coerced;
          });
          return hasValue ? entry : null;
        })
        .filter(Boolean);
    }

    if (chartType === "scatter") {
      const xField = mappings.xField;
      const yField = mappings.yField;
      if (!ensureFieldsPresent([xField, yField])) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const x = coerceNumeric(row[xField]);
          const y = coerceNumeric(row[yField]);
          if (x === null || y === null) return null;
          return { [xField]: x, [yField]: y };
        })
        .filter(Boolean);
    }

    if (["pie", "donut"].includes(chartType)) {
      const categoryField = mappings.categoryField;
      const valueField = mappings.valueField;
      if (!ensureFieldsPresent([categoryField, valueField])) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const category = row[categoryField];
          const value = coerceNumeric(row[valueField]);
          if (category === undefined || category === null || value === null) return null;
          return { [categoryField]: category, [valueField]: value };
        })
        .filter(Boolean);
    }

    if (chartType === "radar") {
      const angleField = mappings.angleField;
      const radiusField = mappings.radiusField;
      if (!ensureFieldsPresent([angleField, radiusField])) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const angle = row[angleField];
          const radius = coerceNumeric(row[radiusField]);
          if (angle === undefined || angle === null || radius === null) return null;
          return { [angleField]: angle, [radiusField]: radius };
        })
        .filter(Boolean);
    }

    if (["histogram", "box", "gauge"].includes(chartType)) {
      const yField = mappings.yField || (mappings.yFields && mappings.yFields[0]) || mappings.valueField;
      if (!ensureFieldsPresent([yField])) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const value = coerceNumeric(row[yField]);
          if (value === null) return null;
          return { [yField]: value };
        })
        .filter(Boolean);
    }

    if (["scatter3d", "surface3d", "line3d"].includes(chartType)) {
      const { xField, yField, zField } = mappings;
      if (!ensureFieldsPresent([xField, yField, zField])) return [];
      return mappedData
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const x = coerceNumeric(row[xField]);
          const y = coerceNumeric(row[yField]);
          const z = coerceNumeric(row[zField]);
          if (x === null || y === null || z === null) return null;
          return { [xField]: x, [yField]: y, [zField]: z };
        })
        .filter(Boolean);
    }

    return mappedData;
  }, [chartType, mappedData, mappings]);

  const renderChart = () => {
    if (["line", "bar", "area"].includes(chartType)) {
      const xField = mappings.xField;
      const yFields = mappings.yFields || [];
      if (!skipValidation && (!ensureFieldsPresent([xField]) || yFields.length === 0)) {
        return renderPlaceholder("Select X and at least one Y field to preview.");
      }
      if (!safeData.length) {
        return renderPlaceholder("No numeric values available for the selected mappings.");
      }
      const ChartComponent = chartType === "line" ? LineChart : chartType === "bar" ? BarChart : AreaChart;
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <ChartComponent data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey={xField} stroke={axisColor} tick={{ fill: axisColor }} />
            <YAxis stroke={axisColor} tick={{ fill: axisColor }} />
            <Tooltip {...tooltipStyles} />
            <Legend {...legendProps} />
            {yFields.map((field, index) => {
              const color = seriesColors[field] || palette[index % palette.length];
              if (chartType === "line") {
                return <Line key={field} type="monotone" dataKey={field} stroke={color} strokeWidth={2} dot={false} />;
              }
              if (chartType === "bar") {
                return (
                  <Bar key={field} dataKey={field} stackId={mappings.stacked ? "stack" : undefined} fill={color} radius={[6, 6, 0, 0]} />
                );
              }
              return <Area key={field} type="monotone" dataKey={field} stroke={color} fill={`${color}80`} strokeWidth={2} stackId={mappings.stacked ? "stack" : undefined} />;
            })}
          </ChartComponent>
        </ResponsiveContainer>
      );
    }

    if (chartType === "scatter") {
      const xField = mappings.xField;
      const yField = mappings.yField;
      if (!skipValidation && !ensureFieldsPresent([xField, yField])) {
        return renderPlaceholder("Select X and Y fields to preview.");
      }
      if (!safeData.length) {
        return renderPlaceholder("Unable to plot scatter data. Check that chosen fields are numeric.");
      }
      const defaultScatterColor = seriesColors[yField] || palette[0];
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis type="number" dataKey={xField} stroke={axisColor} tick={{ fill: axisColor }} />
            <YAxis type="number" dataKey={yField} stroke={axisColor} tick={{ fill: axisColor }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltipStyles} />
            <Scatter data={safeData} fill={defaultScatterColor} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (["pie", "donut"].includes(chartType)) {
      const categoryField = mappings.categoryField;
      const valueField = mappings.valueField;
      if (!skipValidation && !ensureFieldsPresent([categoryField, valueField])) {
        return renderPlaceholder("Select category and value fields to preview.");
      }
      if (!safeData.length) {
        return renderPlaceholder("No values available for the selected fields.");
      }
      const innerRadius = chartType === "donut" && mappings.donut !== false ? 70 : 0;
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 320}>
          <PieChart>
            <Tooltip {...tooltipStyles} />
            <Legend {...legendProps} />
            <Pie
              dataKey={valueField}
              nameKey={categoryField}
              data={safeData}
              innerRadius={innerRadius}
              outerRadius={120}
              paddingAngle={3}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {safeData.map((entry, index) => (
                <Cell key={`slice-${index}`} fill={palette[index % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "radar") {
      const angleField = mappings.angleField;
      const radiusField = mappings.radiusField;
      if (!skipValidation && !ensureFieldsPresent([angleField, radiusField])) {
        return renderPlaceholder("Select a category for the angle and numeric field for the radius.");
      }
      if (!safeData.length) {
        return renderPlaceholder("Radar preview needs numeric radius values for the chosen field.");
      }
      const radarColor = seriesColors[radiusField] || palette[0];
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 320}>
          <RadarChart data={safeData}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis dataKey={angleField} stroke={axisColor} tick={{ fill: axisColor }} />
            <PolarRadiusAxis stroke={axisColor} tick={{ fill: axisColor }} />
            <Tooltip {...tooltipStyles} />
            <Radar dataKey={radiusField} stroke={radarColor} fill={`${radarColor}66`} fillOpacity={0.6} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    // Histogram - uses bar chart to show data distribution
    if (chartType === "histogram") {
      const yField = mappings.yField || (mappings.yFields && mappings.yFields[0]);
      if (!skipValidation && !ensureFieldsPresent([yField])) {
        return renderPlaceholder("Select a numeric field for histogram.");
      }
      if (!mappedData.length) return renderPlaceholder("No data available.");
      
      // Create histogram bins
      const values = mappedData.map(row => coerceNumeric(row[yField])).filter(v => v !== null);
      if (values.length === 0) return renderPlaceholder("No numeric values available.");
      
      const bins = 10;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const binWidth = (max - min) / bins;
      const histogramData = Array.from({ length: bins }, (_, i) => {
        const binStart = min + i * binWidth;
        const binEnd = binStart + binWidth;
        const count = values.filter(v => v >= binStart && (i === bins - 1 ? v <= binEnd : v < binEnd)).length;
        return { bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`, count };
      });
      
      const color = seriesColors[yField] || palette[0];
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="bin" stroke={axisColor} tick={{ fill: axisColor }} angle={-45} textAnchor="end" height={80} />
            <YAxis stroke={axisColor} tick={{ fill: axisColor }} />
            <Tooltip {...tooltipStyles} />
            <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Box Plot - shows quartiles and outliers
    if (chartType === "box") {
      const yField = mappings.yField || (mappings.yFields && mappings.yFields[0]);
      if (!skipValidation && !ensureFieldsPresent([yField])) {
        return renderPlaceholder("Select a numeric field for box plot.");
      }
      if (!mappedData.length) return renderPlaceholder("No data available.");
      
      const values = mappedData.map(row => coerceNumeric(row[yField])).filter(v => v !== null).sort((a, b) => a - b);
      if (values.length === 0) return renderPlaceholder("No numeric values available.");
      
      const q1Index = Math.floor(values.length * 0.25);
      const medianIndex = Math.floor(values.length * 0.5);
      const q3Index = Math.floor(values.length * 0.75);
      
      const min = values[0];
      const q1 = values[q1Index];
      const median = values[medianIndex];
      const q3 = values[q3Index];
      const max = values[values.length - 1];
      
      // Detect outliers (values beyond 1.5 * IQR)
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      const outliers = values.filter(v => v < lowerBound || v > upperBound);
      
      const boxData = [{ name: yField, min, q1, median, q3, max, outliers: outliers.length }];
      const color = seriesColors[yField] || palette[0];
      
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <div className="flex flex-col items-center justify-center p-4">
            <div className="text-sm font-semibold mb-2">{yField}</div>
            <div className="w-full max-w-md">
              <div className="relative h-32 border-l-2 border-slate-400 dark:border-slate-500">
                <div className="absolute left-4 top-4 w-16">
                  <div className="h-16 border-2 border-slate-400 dark:border-slate-400">
                    <div className="h-1/4 bg-slate-300 dark:bg-slate-600"></div>
                    <div className="h-1/2 bg-white dark:bg-slate-800 border-t border-b border-slate-400 dark:border-slate-400">
                      <div className="h-full border-l border-r border-slate-400 dark:border-slate-400 mx-auto" style={{width: '70%'}}></div>
                    </div>
                    <div className="h-1/4 bg-slate-300 dark:bg-slate-600"></div>
                  </div>
                </div>
                <div className="absolute left-20 top-0 text-xs text-slate-600 dark:text-slate-300">Max: {max.toFixed(2)}</div>
                <div className="absolute left-20 top-8 text-xs text-slate-600 dark:text-slate-300">Q3: {q3.toFixed(2)}</div>
                <div className="absolute left-20 top-16 text-xs font-semibold text-slate-900 dark:text-slate-100">Median: {median.toFixed(2)}</div>
                <div className="absolute left-20 top-24 text-xs text-slate-600 dark:text-slate-300">Q1: {q1.toFixed(2)}</div>
                <div className="absolute left-20 top-32 text-xs text-slate-600 dark:text-slate-300">Min: {min.toFixed(2)}</div>
                {outliers.length > 0 && (
                  <div className="absolute left-80 top-8 text-xs text-red-600 dark:text-red-400">Outliers: {outliers.length}</div>
                )}
              </div>
            </div>
          </div>
        </ResponsiveContainer>
      );
    }

    // Gauge Chart - shows progress/KPI value
    if (chartType === "gauge") {
      const valueField = mappings.valueField || (mappings.yFields && mappings.yFields[0]);
      if (!skipValidation && !ensureFieldsPresent([valueField])) {
        return renderPlaceholder("Select a value field for gauge.");
      }
      if (!mappedData.length) return renderPlaceholder("No data available.");
      
      const values = mappedData.map(row => coerceNumeric(row[valueField])).filter(v => v !== null);
      if (values.length === 0) return renderPlaceholder("No numeric values available.");
      
      const value = values.reduce((sum, v) => sum + v, 0) / values.length;
      const max = Math.max(...values) * 1.1; // Add 10% padding
      const percentage = Math.min((value / max) * 100, 100);
      
      const color = seriesColors[valueField] || palette[0];
      const gaugeColor = percentage > 80 ? "#ef4444" : percentage > 50 ? "#f59e0b" : "#22c55e";
      
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">{valueField}</div>
            <div className="relative w-48 h-24 mb-4">
              <svg className="w-full h-full" viewBox="0 0 200 100">
                <path
                  d="M 20 80 A 80 80 0 0 1 180 80"
                  fill="none"
                  stroke={gridColor}
                  strokeWidth="20"
                  strokeLinecap="round"
                />
                <path
                  d={`M 20 80 A 80 80 0 0 1 ${180} 80`}
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="20"
                  strokeLinecap="round"
                  strokeDasharray={`${percentage * 3.14159} 314.159`}
                  transform="rotate(180 100 80)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold" style={{color: gaugeColor}}>{percentage.toFixed(0)}%</span>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Value: {value.toFixed(2)} / {max.toFixed(2)}</div>
          </div>
        </ResponsiveContainer>
      );
    }

    // 3D Charts
    if (["scatter3d", "surface3d", "line3d"].includes(chartType)) {
      const { xField, yField, zField } = mappings;
      if (!skipValidation && !ensureFieldsPresent([xField, yField, zField])) {
        return renderPlaceholder("Select X, Y, and Z fields for 3D visualization.");
      }
      if (!safeData.length) return renderPlaceholder("No numeric values available.");
      
      return (
        <div style={{ height: compact ? 280 : 340, width: "100%" }}>
          <Dynamic3DCharts
            chartType={chartType}
            data={safeData}
            mappings={mappings}
            seriesColors={seriesColors}
            palette={palette}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className={wrapperClasses}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
          {chart?.description ? <p className="text-xs text-slate-500 dark:text-slate-300">{chart.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:bg-slate-700/60"
        >
          {exporting ? "Exporting..." : "Export PNG"}
        </button>
      </div>
      <div ref={containerRef} id={chartDomIdRef.current} className="overflow-hidden rounded-xl bg-white transition-colors dark:bg-slate-900/40">
        {renderChart()}
      </div>
    </div>
  );
}

