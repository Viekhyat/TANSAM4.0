import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useTheme } from "../providers/ThemeContext.jsx";
import { defaultPalette } from "../utils/colors.js";
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

