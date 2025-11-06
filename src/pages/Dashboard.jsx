import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
import GlassCard from "../ui/GlassCard.jsx";
import ChartRenderer from "../ui/ChartRenderer.jsx";
import { buildChartData } from "../utils/chartData.js";

const formatNumber = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

export default function DashboardPage() {
  const { charts, datasets, deleteChart, duplicateChart } = useStore();
  const navigate = useNavigate();

  const chartList = useMemo(
    () =>
      Object.values(charts)
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()),
    [charts]
  );

  const metrics = useMemo(() => {
    const datasetCount = Object.keys(datasets).length;
    const chartCount = chartList.length;
    const lastUpdated = chartList[0]?.updatedAt ? new Date(chartList[0].updatedAt).toLocaleString() : "N/A";
    return [
      {
        label: "Datasets",
        value: datasetCount,
        trend: "+1 new",
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
      },
      {
        label: "Charts",
        value: chartCount,
        trend: "Ready to share",
        color: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
      },
      {
        label: "Last update",
        value: lastUpdated,
        trend: "Auto-saved",
        color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
      }
    ];
  }, [chartList, datasets]);

  const handleEdit = (chartId) => {
    navigate(`/visualize?chartId=${chartId}`);
  };

  const handleDelete = (chart) => {
    if (window.confirm(`Delete chart "${chart.title}"?`)) {
      deleteChart(chart.id);
    }
  };

  const handleDuplicate = (chartId) => {
    duplicateChart(chartId);
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      <section className="sticky top-[84px] z-30">
        <GlassCard className="sticky-edge shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dashboard Overview</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Your saved insights update live with every dataset change.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass-hover rounded-full border border-emerald-400/40 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition dark:border-emerald-300/20 dark:bg-emerald-500/20 dark:text-emerald-200">
                Live
              </div>
              <button className="glass-hover rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900">
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {metrics.map((metric) => (
              <GlassCard key={metric.label} className="p-3 md:p-4 shadow-none">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.label}</p>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(metric.value)}</div>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${metric.color}`}>{metric.trend}</span>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </section>

      <section aria-labelledby="saved-charts" className="mt-4 space-y-4 md:mt-6">
        <h2 id="saved-charts" className="sr-only">
          Saved charts
        </h2>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved charts</p>
            <p className="text-sm text-slate-500 dark:text-slate-300">Manage layouts, duplicate configurations, or jump back into edit mode.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 transition-colors dark:bg-slate-800/60 dark:text-slate-300">
            {chartList.length} charts
          </div>
        </header>
        {chartList.length === 0 ? (
          <GlassCard className="glass-hover flex h-48 flex-col items-center justify-center border border-dashed border-white/40 text-sm text-slate-600 transition-colors dark:border-slate-200/30 dark:text-slate-300">
            <p className="mb-3">No charts yet. Create your first visualization.</p>
            <button 
              onClick={() => navigate("/visualize")} 
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 flex items-center gap-2"
            >
              <span className="text-lg">+</span> New Chart
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {chartList.map((chart) => {
              const dataset = datasets[chart.datasetId];
              const rows = dataset?.data || dataset?.rowsPreview || [];
              const chartData = buildChartData(rows, chart.chartType, chart.mappings, chart.options || {});
              return (
                <GlassCard key={chart.id} className="flex flex-col gap-3 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {dataset?.name || "Dataset missing"} - Updated {chart.updatedAt ? new Date(chart.updatedAt).toLocaleString() : "unknown"}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs font-semibold">
                      <button
                        onClick={() => handleEdit(chart.id)}
                        className="glass-hover rounded-full border border-white/20 px-3 py-1 text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(chart.id)}
                        className="glass-hover rounded-full border border-white/20 px-3 py-1 text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-300 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(chart)}
                        className="glass-hover rounded-full border border-transparent px-3 py-1 text-red-500 transition hover:border-red-100 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:hover:bg-red-500/20 dark:focus-visible:ring-offset-slate-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl bg-slate-50 p-4 transition-colors dark:bg-slate-800/50">
                    <ChartRenderer chart={chart} data={chartData} compact />
                  </div>
                  <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3 dark:text-slate-300">
                    <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                      <span className="block font-semibold text-slate-700 dark:text-slate-200">Type</span>
                      <span className="uppercase">{chart.chartType}</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                      <span className="block font-semibold text-slate-700 dark:text-slate-200">Aggregation</span>
                      <span>{chart.options?.aggregation || "none"}</span>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-3 py-2 transition-colors dark:bg-slate-800/60">
                      <span className="block font-semibold text-slate-700 dark:text-slate-200">Top N</span>
                      <span>{chart.options?.topN || 0}</span>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
            <GlassCard className="flex h-[300px] flex-col items-center justify-center gap-3 border-2 border-dashed border-white/40 text-center shadow-xl dark:border-slate-200/30">
              <div className="rounded-full bg-brand-100 p-4 dark:bg-brand-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create New Chart</h3>
              <p className="text-xs text-center text-slate-500 dark:text-slate-300">
                Add a new visualization to your dashboard
              </p>
              <button
                onClick={() => navigate("/visualize")}
                className="mt-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                New Chart
              </button>
            </GlassCard>
          </div>
        )}
      </section>
    </div>
  );
}
