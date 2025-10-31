import GlassCard from "./GlassCard.jsx";
import { toRendererConfig } from "../utils/dynamicChartUtils.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function DynamicChart3D({
  chart,
  data,
  onEdit,
  onDuplicate,
  onDelete,
  className = "",
  wrapInCard = true,
  showActions = true,
  showHeader = true,
  showMeta = true,
  titleOverride,
  subtitleOverride
}) {
  const normalizedChart = toRendererConfig(chart);
  const dataset = Array.isArray(data) ? data : Array.isArray(chart?.data) ? chart.data : [];
  const valueField =
    chart?.yField ||
    chart?.valueField ||
    chart?.mappings?.valueField ||
    normalizedChart?.mappings?.valueField ||
    normalizedChart?.mappings?.yField;
  const categoryField =
    chart?.xField ||
    chart?.categoryField ||
    chart?.mappings?.categoryField ||
    normalizedChart?.mappings?.categoryField ||
    normalizedChart?.mappings?.xField;

  const entries = dataset
    .map((row) => {
      const value = Number(row?.[valueField]);
      return {
        raw: row,
        label: categoryField ? String(row?.[categoryField] ?? "") : "",
        value: Number.isFinite(value) ? value : 0
      };
    })
    .filter((d) => d.label !== "" && Number.isFinite(d.value));

  const maxValue = entries.reduce((acc, item) => (item.value > acc ? item.value : acc), 0);
  const safeMax = maxValue === 0 ? 1 : maxValue;

  const title = titleOverride || normalizedChart?.title || chart?.title || "Dynamic 3D Chart";
  const subtitle =
    subtitleOverride || (chart?.dataSource ? `Source: ${chart.dataSource}` : "Live dataset");

  const actionsAvailable = showActions && (onEdit || onDuplicate || onDelete);

  const header = showHeader ? (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">{subtitle}</p>
      </div>
      {actionsAvailable ? (
        <div className="flex gap-2">
          {onEdit ? (
            <button
              onClick={() => onEdit(chart?.id)}
              className="glass-hover rounded-lg border border-white/15 bg-white/20 p-1.5 text-slate-600 transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/10 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:focus-visible:ring-offset-slate-900"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          ) : null}
          {onDuplicate ? (
            <button
              onClick={() => onDuplicate(chart?.id)}
              className="glass-hover rounded-lg border border-white/15 bg-white/20 p-1.5 text-slate-600 transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/10 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:focus-visible:ring-offset-slate-900"
              title="Duplicate"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
              </svg>
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={() => onDelete(chart?.id)}
              className="glass-hover rounded-lg border border-red-200/40 bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-red-400/20 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 dark:focus-visible:ring-offset-slate-900"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const chartBody = (
    <div className="dynamic-3d-chart h-64 w-full">
      {entries.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400 dark:text-slate-500">
          Provide numeric data to preview the 3D projection.
        </div>
      ) : (
        entries.slice(0, 10).map((entry, index) => {
          const heightRatio = clamp(entry.value / safeMax, 0, 1);
          const barHeight = 20 + heightRatio * 70;
          return (
            <div key={`${entry.label}-${index}`} className="dynamic-3d-bar">
              <div
                className="dynamic-3d-bar__prism"
                style={{
                  "--bar-height": `${barHeight}%`,
                  "--bar-delay": `${index * 0.05}s`
                }}
              >
                <span className="dynamic-3d-bar__top" />
                <span className="dynamic-3d-bar__side dynamic-3d-bar__side--left" />
                <span className="dynamic-3d-bar__side dynamic-3d-bar__side--right" />
                <span className="dynamic-3d-bar__front" />
              </div>
              <div className="dynamic-3d-bar__label">
                <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{entry.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{entry.value}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const footer = showMeta ? (
    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span>Dimension: 3D</span>
      {chart?.updatedAt ? <span>Updated {new Date(chart.updatedAt).toLocaleString()}</span> : null}
    </div>
  ) : null;

  const content = (
    <>
      {header}
      {chartBody}
      {footer}
    </>
  );

  if (!wrapInCard) {
    return <div className={className}>{content}</div>;
  }

  return (
    <GlassCard className={`p-4 shadow-xl transition-colors md:p-6 ${className}`}>
      {content}
    </GlassCard>
  );
}
