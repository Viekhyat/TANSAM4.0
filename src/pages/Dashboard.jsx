import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
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
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">Your saved insights update live with every dataset change.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              Live
            </div>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
              Refresh
            </button>
            <button
              className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
              onClick={() => navigate("/visualize")}
            >
              New chart
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.label}</p>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(metric.value)}</div>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${metric.color}`}>{metric.trend}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved charts</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Manage layouts, duplicate configurations, or jump back into edit mode.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 transition-colors dark:bg-slate-800/60 dark:text-slate-300">
            {chartList.length} charts
          </div>
        </div>
        {chartList.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500 transition-colors dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            No charts yet. Build your first visualization from the{" "}
            <button onClick={() => navigate("/visualize")} className="font-semibold text-brand-500 underline underline-offset-2">
              visualize page
            </button>
            .
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {chartList.map((chart) => {
              const dataset = datasets[chart.datasetId];
              const rows = dataset?.data || dataset?.rowsPreview || [];
              const chartData = buildChartData(rows, chart.chartType, chart.mappings, chart.options || {});
              return (
                <div key={chart.id} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {dataset?.name || "Dataset missing"} • Updated {chart.updatedAt ? new Date(chart.updatedAt).toLocaleString() : "unknown"}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs font-semibold">
                      <button
                        onClick={() => handleEdit(chart.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(chart.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(chart)}
                        className="rounded-full border border-transparent px-3 py-1 text-red-500 transition hover:border-red-100 hover:bg-red-50 dark:hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 transition-colors dark:bg-slate-800/50">
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
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
