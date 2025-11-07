import React from 'react';
import GlassCard from './GlassCard.jsx';

export default function CardAggregation({ data, mappings, palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] }) {
  if (!data || !data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        No data available
      </div>
    );
  }

  const yField = mappings?.yField;
  if (!yField) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        Please select a numeric field for aggregation
      </div>
    );
  }

  // Extract numeric values
  const values = data.map(d => {
    const val = d[yField];
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  }).filter(v => !isNaN(v));

  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        No numeric data found for selected field
      </div>
    );
  }

  // Calculate aggregations
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const count = values.length;

  const formatNumber = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(2);
  };

  const Card = ({ title, value, subtitle, colorClass }) => (
    <GlassCard className="p-3 md:p-4 shadow-none">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>{subtitle}</span>
    </GlassCard>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 p-6">
      <Card 
        title="Average" 
        value={formatNumber(avg)} 
        subtitle={yField}
        colorClass="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" 
      />
      <Card 
        title="Sum" 
        value={formatNumber(sum)} 
        subtitle={yField}
        colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" 
      />
      <Card 
        title="Maximum" 
        value={formatNumber(max)} 
        subtitle={yField}
        colorClass="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" 
      />
      <Card 
        title="Minimum" 
        value={formatNumber(min)} 
        subtitle={yField}
        colorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" 
      />
      <Card 
        title="Count" 
        value={count} 
        subtitle="Total Records"
        colorClass="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200" 
      />
    </div>
  );
}