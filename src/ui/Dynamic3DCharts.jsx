import { useMemo, useState } from "react";

// Project 3D to 2D using isometric projection
const projectPoint = (x, y, z, angleX, angleY) => {
  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  
  const projX = x * Math.cos(radY) - z * Math.sin(radY);
  const projZ = x * Math.sin(radY) + z * Math.cos(radY);
  const projY = y * Math.cos(radX) - projZ * Math.sin(radX);
  
  return { x: projX, y: projY };
};

// Main 3D Chart Renderer - Uses simplified projection
export default function Dynamic3DCharts({
  chartType,
  data = [],
  mappings = {},
  seriesColors = {},
  palette = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"]
}) {
  const [viewAngle, setViewAngle] = useState({ x: 45, y: 45 });

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-slate-400 dark:text-slate-500">
        No data available for 3D visualization
      </div>
    );
  }

  const { xField, yField, zField } = mappings;
  const color = seriesColors[yField] || palette[0];

  // Normalize data to fit in a reasonable 3D space
  const normalizedData = useMemo(() => {
    if (!xField || !yField || !zField) return [];

    const xValues = data.map((d) => Number(d[xField]) || 0);
    const yValues = data.map((d) => Number(d[yField]) || 0);
    const zValues = data.map((d) => Number(d[zField]) || 0);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const zRange = zMax - zMin || 1;

    // Normalize to [0, 100] range
    return data.map((d, i) => ({
      id: i,
      x: ((Number(d[xField]) || 0) - xMin) / xRange * 100,
      y: ((Number(d[yField]) || 0) - yMin) / yRange * 100,
      z: ((Number(d[zField]) || 0) - zMin) / zRange * 100
    }));
  }, [data, xField, yField, zField]);

  const projectedData = useMemo(() => {
    if (normalizedData.length === 0) return [];
    return normalizedData.map(point => ({
      ...point,
      ...projectPoint(point.x, point.y, point.z, viewAngle.x, viewAngle.y)
    }));
  }, [normalizedData, viewAngle]);

  if (!projectedData || projectedData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-slate-400 dark:text-slate-500">
        No valid data points for 3D visualization
      </div>
    );
  }

  const minX = Math.min(...projectedData.map(d => d.x));
  const maxX = Math.max(...projectedData.map(d => d.x));
  const minY = Math.min(...projectedData.map(d => d.y));
  const maxY = Math.max(...projectedData.map(d => d.y));

  const scaleX = 300 / (maxX - minX || 1);
  const scaleY = 200 / (maxY - minY || 1);
  const translateX = -minX * scaleX;
  const translateY = -minY * scaleY;

  return (
    <div className="h-full w-full flex flex-col gap-3">
      <div className="flex items-center justify-between px-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">3D {chartType}</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setViewAngle({ ...viewAngle, x: viewAngle.x - 15 })}
            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600"
          >
            ↻ X
          </button>
          <button
            onClick={() => setViewAngle({ ...viewAngle, y: viewAngle.y - 15 })}
            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600"
          >
            ↻ Y
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <svg width="400" height="300" className="border border-slate-200 dark:border-slate-700 rounded">
          {chartType === "scatter3d" && projectedData.map((point, i) => (
            <circle
              key={i}
              cx={point.x * scaleX + translateX}
              cy={point.y * scaleY + translateY}
              r="4"
              fill={color}
              opacity="0.6"
            />
          ))}
          {chartType === "line3d" && (
            <polyline
              points={projectedData.map(p => `${p.x * scaleX + translateX},${p.y * scaleY + translateY}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2"
            />
          )}
          {chartType === "surface3d" && projectedData.map((point, i) => (
            <rect
              key={i}
              x={point.x * scaleX + translateX - 2}
              y={point.y * scaleY + translateY - 2}
              width="4"
              height="4"
              fill={color}
              opacity="0.4"
            />
          ))}
        </svg>
      </div>
      <div className="text-xs text-center text-slate-500 dark:text-slate-400 px-4 pb-2">
        X: {xField} | Y: {yField} | Z: {zField}
      </div>
    </div>
  );
}

