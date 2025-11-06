import GlassCard from "./GlassCard.jsx";
import ChartRenderer from "./ChartRenderer.jsx";
import { toRendererConfig } from "../utils/dynamicChartUtils.js";

export default function DynamicChart2D({
  chart,
  data,
  onEdit,
  onDuplicate,
  onDelete,
  className = ""
}) {
  const rendererChart = toRendererConfig(chart);
  const dataset = Array.isArray(data) ? data : Array.isArray(chart?.data) ? chart.data : [];

  if (!rendererChart) {
    return null;
  }

  return (
    <GlassCard className={`p-4 shadow-xl transition-colors md:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{rendererChart.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {(chart?.dataSource && `Source: ${chart.dataSource}`) || "Live dataset"}
          </p>
        </div>
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
      </div>
      <div className="h-64 w-full">
        <ChartRenderer chart={rendererChart} data={dataset} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Dimension: 2D</span>
        {chart?.updatedAt ? <span>Updated {new Date(chart.updatedAt).toLocaleString()}</span> : null}
      </div>
    </GlassCard>
  );
}
