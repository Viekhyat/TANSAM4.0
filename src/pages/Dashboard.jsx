import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
import ChartRenderer from "../ui/ChartRenderer.jsx";
import { buildChartData } from "../utils/chartData.js";
import ChatBot from "../ui/ChatBot.jsx";

const formatNumber = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

export default function DashboardPage() {
  const { charts, datasets, deleteChart, duplicateChart } = useStore();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

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
      },
      {
        label: "Chat Assistant",
        value: "Ask questions",
        trend: "Get help",
        color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
        onClick: () => setChatOpen(true)
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
    <div className="flex flex-col gap-6 min-h-[calc(100vh-160px)]">
      {chatOpen && <ChatBot onClose={() => setChatOpen(false)} />}
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
            <div 
              key={metric.label} 
              className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors dark:border-slate-700 dark:bg-slate-800/50 ${metric.onClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50' : ''}`}
              onClick={metric.onClick}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{metric.label}</p>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(metric.value)}</div>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${metric.color}`}>{metric.trend}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 grid gap-4 lg:grid-cols-2">
        {chartList.map((chart) => (
          <div
            key={chart.id}
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{chart.title || "Untitled Chart"}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">Last updated {chart.updatedAt ? new Date(chart.updatedAt).toLocaleString() : "N/A"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => handleEdit(chart.id)}
                >
                  Edit
                </button>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => handleDuplicate(chart.id)}
                >
                  Duplicate
                </button>
                <button
                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-100 dark:border-rose-600 dark:text-rose-300 dark:hover:bg-rose-700/20"
                  onClick={() => handleDelete(chart)}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="h-64">
              <ChartRenderer chartData={buildChartData(datasets, chart)} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}