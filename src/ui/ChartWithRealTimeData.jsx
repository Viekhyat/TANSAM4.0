import { useEffect, useState, useMemo, useRef } from "react";
import DynamicChart2D from "./DynamicChart2D.jsx";
import DynamicChart3D from "./DynamicChart3D.jsx";
import ChartRenderer from "./ChartRenderer.jsx";
import { toRendererConfig } from "../utils/dynamicChartUtils.js";
import { buildChartData } from "../utils/chartData.js";

const BACKEND_URL = "http://localhost:8085";

/**
 * Wrapper component that fetches real-time data for charts
 * and passes it to the appropriate chart component
 */
export default function ChartWithRealTimeData({ chart, onEdit, onDuplicate, onDelete, className, wrapInCard = false, showActions = false }) {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef(null);
  
  const dataSource = chart?.dataSource;
  const dimension = chart?.dimension || chart?.options?.dimension || "2d";
  const aggregation = chart?.options?.aggregation || chart?.aggregation || "none";
  const topN = chart?.options?.topN || chart?.topN || 0;
  
  useEffect(() => {
    if (!dataSource) {
      // No data source, chart will use chart.data if available
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/data/${dataSource}`, { signal });
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          // Flatten the data if it's nested in tables
          let flatData = data.data;
          if (data.data[0].rows) {
            flatData = data.data.flatMap(table => table.rows);
          }
          // Keep only the last 50 entries from the tail
          setChartData(flatData.slice(-50));
        }
        setIsLoading(false);
      } catch (err) {
        // Don't set error if request was aborted
        if (err.name === 'AbortError') {
          return;
        }
        console.error("Error fetching chart data:", err);
        setIsLoading(false);
      }
    };
    
    // Fetch immediately and then poll every 15 seconds for better performance
    fetchData();
    const interval = setInterval(fetchData, 15000); // Poll every 15 seconds to reduce load
    
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [dataSource]);

  // Process chart data with aggregation
  const processedChartData = useMemo(() => {
    if (!chartData.length) {
      return chartData;
    }
    
    // Get chart configuration
    const rendererConfig = toRendererConfig(chart);
    if (!rendererConfig) {
      return chartData;
    }
    
    const mappings = rendererConfig.mappings || {};
    const chartType = rendererConfig.chartType || chart?.type || chart?.chartType || "bar";
    
    // Only apply aggregation if mappings are defined
    if (!mappings.xField || !mappings.yFields?.length && !mappings.yField) {
      return chartData;
    }
    
    // Ensure yFields is set
    if (!mappings.yFields || mappings.yFields.length === 0) {
      if (mappings.yField) {
        mappings.yFields = [mappings.yField];
      } else {
        return chartData;
      }
    }
    
    const options = {
      aggregation: aggregation,
      topN: topN
    };
    
    return buildChartData(chartData, chartType, mappings, options);
  }, [chartData, chart, aggregation, topN]);
  
  if (isLoading && dataSource) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading data...</p>
        </div>
      </div>
    );
  }
  
  // Pass the fetched data to the appropriate chart component
  if (dimension === "3d") {
    return (
      <DynamicChart3D
        chart={chart}
        data={processedChartData.length > 0 ? processedChartData : undefined}
        onEdit={showActions ? onEdit : undefined}
        onDuplicate={showActions ? onDuplicate : undefined}
        onDelete={showActions ? onDelete : undefined}
        className={className}
        wrapInCard={wrapInCard}
        showActions={showActions}
        showHeader={false}
        showMeta={false}
      />
    );
  } else {
    // For 2D charts in dashboard, render just the chart without card wrapper
    const rendererChart = toRendererConfig(chart);
    const dataset = processedChartData.length > 0 ? processedChartData : [];
    
    // Infer missing mappings for pie/donut from data sample
    if (rendererChart && ["pie", "donut"].includes(rendererChart.chartType)) {
      const mappings = rendererChart.mappings || {};
      const hasCategory = !!mappings.categoryField;
      const hasValue = !!mappings.valueField;
      // Prefer processed data; if empty, fall back to raw fetched rows
      const sampleRows = (dataset.length > 0 ? dataset : (chartData.length > 0 ? chartData : []));
      if ((!hasCategory || !hasValue) && sampleRows.length > 0) {
        const sample = sampleRows[0];
        const keys = Object.keys(sample);
        const isNumeric = (v) => {
          if (typeof v === 'number') return Number.isFinite(v);
          if (typeof v === 'string') {
            const n = Number(v.trim());
            return Number.isFinite(n);
          }
          return false;
        };
        const numericKey = keys.find(k => isNumeric(sample[k]));
        const categoryKey = keys.find(k => k !== numericKey);
        if (!mappings.valueField && numericKey) {
          mappings.valueField = numericKey;
        }
        if (!mappings.categoryField && categoryKey) {
          mappings.categoryField = categoryKey;
        }
        rendererChart.mappings = mappings;
        // If we inferred mappings and processed data was empty, rebuild dataset
        if (dataset.length === 0) {
          const opts = rendererChart.options || { aggregation, topN };
          const rebuilt = buildChartData(sampleRows, rendererChart.chartType, mappings, {
            aggregation: opts.aggregation ?? aggregation,
            topN: opts.topN ?? topN
          });
          // Overwrite dataset reference for rendering below
          if (Array.isArray(rebuilt)) {
            // eslint-disable-next-line no-var
            var inferredDataset = rebuilt;
          }
        }
      }
    }
    
    if (!rendererChart) {

      return (
        <div className="w-full h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Invalid chart configuration. Please edit the chart to set fields.
        </div>
      );
    }
    
    // Ensure options include aggregation and topN
    if (rendererChart.options) {
      rendererChart.options.aggregation = aggregation;
      rendererChart.options.topN = topN;
    } else {
      rendererChart.options = {
        aggregation: aggregation,
        topN: topN,
        dimension: dimension
      };
    }
    
    if (wrapInCard) {
      return (
        <DynamicChart2D
          chart={chart}
          data={dataset}
          onEdit={showActions ? onEdit : undefined}
          onDuplicate={showActions ? onDuplicate : undefined}
          onDelete={showActions ? onDelete : undefined}
          className={className}
        />
      );
    } else {
      // Render just the chart without wrapper (dashboard provides the card)
      return (
        <div className="w-full h-full">
          <ChartRenderer chart={rendererChart} data={typeof inferredDataset !== 'undefined' ? inferredDataset : dataset} compact />
        </div>
      );
    }
  }
}
