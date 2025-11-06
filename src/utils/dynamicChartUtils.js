const DASHBOARD_CACHE_KEY = "datanaut_dynamic_dashboard_cache";

export const saveDynamicDashboardCache = (payload) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to persist dashboard cache", error);
  }
};

export const loadDynamicDashboardCache = () => {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Unable to read dashboard cache", error);
    return null;
  }
};

export const classifyDynamicCharts = (charts = []) => {
  const base = Array.isArray(charts) ? charts : [];
  return base.reduce(
    (acc, chart) => {
      const dimension = chart?.dimension || chart?.options?.dimension || "2d";
      if (String(dimension).toLowerCase() === "3d") {
        acc.threeD.push(chart);
      } else {
        acc.twoD.push(chart);
      }
      return acc;
    },
    { twoD: [], threeD: [] }
  );
};

export const normalizeDynamicChart = (chart) => {
  if (!chart) return null;
  const dimension = chart?.dimension || chart?.options?.dimension || "2d";
  return {
    ...chart,
    dimension: String(dimension).toLowerCase() === "3d" ? "3d" : "2d"
  };
};

export const normalizeDynamicCharts = (charts = []) => charts.map((chart) => normalizeDynamicChart(chart)).filter(Boolean);

const resolveField = (chart = {}, keys = []) => {
  for (const key of keys) {
    const value = chart[key];
    if (value) return value;
  }
  return undefined;
};

export const toRendererConfig = (chart) => {
  if (!chart) return null;
  const normalized = normalizeDynamicChart(chart);
  const mappings = {
    xField:
      resolveField(normalized, ["xField"]) ||
      resolveField(normalized?.mappings || {}, ["xField", "categoryField"]),
    yField:
      resolveField(normalized, ["yField"]) ||
      resolveField(normalized?.mappings || {}, ["yField", "valueField"]),
    yFields:
      normalized?.mappings?.yFields ||
      (normalized?.yFields && Array.isArray(normalized.yFields) ? normalized.yFields : normalized?.mappings?.series || [])
  };

  if (!mappings.yFields?.length && mappings.yField) {
    mappings.yFields = [mappings.yField];
  }

  mappings.categoryField =
    resolveField(normalized, ["categoryField"]) ||
    resolveField(normalized?.mappings || {}, ["categoryField", "xField"]);
  mappings.valueField =
    resolveField(normalized, ["valueField"]) ||
    resolveField(normalized?.mappings || {}, ["valueField", "yField"]);
  mappings.angleField =
    resolveField(normalized, ["angleField"]) ||
    resolveField(normalized?.mappings || {}, ["angleField", "categoryField"]);
  mappings.radiusField =
    resolveField(normalized, ["radiusField"]) ||
    resolveField(normalized?.mappings || {}, ["radiusField", "valueField", "yField"]);

  const options = {
    aggregation: normalized.options?.aggregation || normalized.aggregation || "none",
    topN: normalized.options?.topN || normalized.topN || 0,
    ...(normalized.options || {}),
    dimension: normalized.dimension
  };

  return {
    chartType: normalized.chartType || normalized.type || "bar",
    title: normalized.title || "Dynamic Chart",
    description: normalized.description,
    mappings,
    options
  };
};
