import { useEffect, useState } from "react";
import DynamicChart2D from "./DynamicChart2D.jsx";
import DynamicChart3D from "./DynamicChart3D.jsx";
import ChartRenderer from "./ChartRenderer.jsx";
import { toRendererConfig } from "../utils/dynamicChartUtils.js";

const BACKEND_URL = "http://localhost:8085";

/**
 * Wrapper component that fetches real-time data for charts
 * and passes it to the appropriate chart component
 */
export default function ChartWithRealTimeData({ chart, onEdit, onDuplicate, onDelete, className, wrapInCard = false, showActions = false }) {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const dataSource = chart?.dataSource;
  const dimension = chart?.dimension || chart?.options?.dimension || "2d";
  
  useEffect(() => {
    if (!dataSource) {
      // No data source, chart will use chart.data if available
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/data/${dataSource}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          // Flatten the data if it's nested in tables
          let flatData = data.data;
          if (data.data[0].rows) {
            flatData = data.data.flatMap(table => table.rows);
          }
          setChartData(flatData);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching chart data:", err);
        setIsLoading(false);
      }
    };
    
    // Fetch immediately and then poll every 2 seconds for real-time updates
    fetchData();
    const interval = setInterval(fetchData, 2000); // Poll every 2 seconds for real-time EDA
    
    return () => clearInterval(interval);
  }, [dataSource]);
  
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
        data={chartData.length > 0 ? chartData : undefined}
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
    const dataset = chartData.length > 0 ? chartData : [];
    
    if (!rendererChart) {
      return null;
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
          <ChartRenderer chart={rendererChart} data={dataset} compact />
        </div>
      );
    }
  }
}
