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

export default function ChartRenderer({ chart, data = [], compact = false }) {
  const containerRef = useRef(null);
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

  const colorDomain = useMemo(() => {
    if (chartType === "scatter" && mappings.colorField) {
      const uniqueValues = [...new Set(mappedData.map((item) => item[mappings.colorField]).filter(Boolean))];
      return uniqueValues;
    }
    return [];
  }, [chartType, mappings.colorField, mappedData]);

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

  const renderChart = () => {
    if (!mappedData.length) {
      return (
        <div className="flex h-56 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Configure mappings to see the chart preview.
        </div>
      );
    }

    if (["line", "bar", "area"].includes(chartType)) {
      const xField = mappings.xField;
      const yFields = mappings.yFields || [];
      if (!xField || yFields.length === 0) return null;
      const ChartComponent = chartType === "line" ? LineChart : chartType === "bar" ? BarChart : AreaChart;
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <ChartComponent data={mappedData}>
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
      if (!xField || !yField) return null;
      const defaultScatterColor = seriesColors[yField] || palette[0];
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis type="number" dataKey={xField} stroke={axisColor} tick={{ fill: axisColor }} />
            <YAxis type="number" dataKey={yField} stroke={axisColor} tick={{ fill: axisColor }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltipStyles} />
            <Legend {...legendProps} />
            {colorDomain.length > 0
              ? colorDomain.map((category, index) => (
                  <Scatter
                    key={category}
                    name={category}
                    data={mappedData.filter((row) => row[mappings.colorField] === category)}
                    fill={palette[index % palette.length]}
                  />
                ))
              : (
                <Scatter data={mappedData} fill={defaultScatterColor} />
                )}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (["pie", "donut"].includes(chartType)) {
      const categoryField = mappings.categoryField;
      const valueField = mappings.valueField;
      if (!categoryField || !valueField) return null;
      const innerRadius = chartType === "donut" && mappings.donut !== false ? 70 : 0;
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 320}>
          <PieChart>
            <Tooltip {...tooltipStyles} />
            <Legend {...legendProps} />
            <Pie dataKey={valueField} nameKey={categoryField} data={mappedData} innerRadius={innerRadius} outerRadius={120} paddingAngle={3}>
              {mappedData.map((entry, index) => (
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
      if (!angleField || !radiusField) return null;
      const radarColor = seriesColors[radiusField] || palette[0];
      return (
        <ResponsiveContainer width="100%" height={compact ? 280 : 320}>
          <RadarChart data={mappedData}>
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
      <div ref={containerRef} className="overflow-hidden rounded-xl bg-white transition-colors dark:bg-slate-900/40">
        {renderChart()}
      </div>
    </div>
  );
}

