import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseCSVText, parseJSONText } from "../utils/parseData.js";

const StoreContext = createContext(null);

const DATASETS_KEY = "datasets";
const CHARTS_KEY = "charts";
const SEED_FLAG_KEY = "seeded";

const nowIso = () => new Date().toISOString();

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const safeParse = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to parse localStorage value", error);
    return {};
  }
};

export function StoreProvider({ children }) {
  const [datasets, setDatasets] = useState({});
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const storedDatasets = safeParse(localStorage.getItem(DATASETS_KEY));
    const storedCharts = safeParse(localStorage.getItem(CHARTS_KEY));
    const seededFlag = localStorage.getItem(SEED_FLAG_KEY) === "true";
    setDatasets(storedDatasets);
    setCharts(storedCharts);
    setSeeded(seededFlag);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(DATASETS_KEY, JSON.stringify(datasets));
    }
  }, [datasets, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(CHARTS_KEY, JSON.stringify(charts));
    }
  }, [charts, loading]);

  const seedSamples = useCallback(async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const [salesResp, scatterResp, pieResp] = await Promise.all([
        fetch("/samples/sample_sales.csv"),
        fetch("/samples/sample_scatter.csv"),
        fetch("/samples/sample_pie.json")
      ]);
      const [salesText, scatterText, pieText] = await Promise.all([
        salesResp.text(),
        scatterResp.text(),
        pieResp.text()
      ]);

      const salesParsed = await parseCSVText(salesText, { firstRowHeader: true });
      const scatterParsed = await parseCSVText(scatterText, { firstRowHeader: true });
      const pieParsed = parseJSONText(pieText);

      const salesId = generateId();
      const scatterId = generateId();
      const pieId = generateId();

      const seededDatasets = {
        [salesId]: {
          id: salesId,
          name: "Sample Sales",
          sourceType: "sample_csv",
          schema: { headers: salesParsed.headers, types: salesParsed.types },
          rowsPreview: salesParsed.rows.slice(0, 50),
          data: salesParsed.rows,
          createdAt: nowIso(),
          updatedAt: nowIso()
        },
        [scatterId]: {
          id: scatterId,
          name: "Sample Scatter",
          sourceType: "sample_csv",
          schema: { headers: scatterParsed.headers, types: scatterParsed.types },
          rowsPreview: scatterParsed.rows.slice(0, 50),
          data: scatterParsed.rows,
          createdAt: nowIso(),
          updatedAt: nowIso()
        },
        [pieId]: {
          id: pieId,
          name: "Sample Categories",
          sourceType: "sample_json",
          schema: { headers: pieParsed.headers, types: pieParsed.types },
          rowsPreview: pieParsed.rows.slice(0, 50),
          data: pieParsed.rows,
          createdAt: nowIso(),
          updatedAt: nowIso()
        }
      };

      const seededCharts = (() => {
        const chartNow = nowIso();
        const entries = [
          {
            title: "Revenue by Month",
            datasetId: salesId,
            chartType: "bar",
            mappings: {
              xField: "Month",
              yFields: ["Revenue"],
              stacked: false
            },
            options: {
              aggregation: "none",
              topN: 0
            }
          },
          {
            title: "Units vs Revenue",
            datasetId: scatterId,
            chartType: "scatter",
            mappings: {
              xField: "Units",
              yField: "Revenue"
            },
            options: {
              aggregation: "none",
              topN: 0
            }
          },
          {
            title: "Share by Category",
            datasetId: pieId,
            chartType: "donut",
            mappings: {
              categoryField: "category",
              valueField: "value",
              donut: true
            },
            options: {
              aggregation: "sum",
              topN: 0
            }
          }
        ];

        return entries.reduce((acc, item) => {
          const id = generateId();
          acc[id] = {
            id,
            ...item,
            createdAt: chartNow,
            updatedAt: chartNow
          };
          return acc;
        }, {});
      })();

      setDatasets(seededDatasets);
      setCharts(seededCharts);
      localStorage.setItem(SEED_FLAG_KEY, "true");
      setSeeded(true);
    } catch (error) {
      console.error("Failed to seed samples", error);
    } finally {
      setSeeding(false);
    }
  }, [seeding]);

  useEffect(() => {
    if (!loading && !seeded && Object.keys(datasets).length === 0 && Object.keys(charts).length === 0) {
      seedSamples();
    }
  }, [datasets, charts, loading, seedSamples, seeded]);

  const saveDataset = useCallback((dataset) => {
    setDatasets((prev) => {
      const next = { ...prev, [dataset.id]: dataset };
      return next;
    });
  }, []);

  const deleteDataset = useCallback((datasetId) => {
    setDatasets((prev) => {
      const next = { ...prev };
      delete next[datasetId];
      return next;
    });
    setCharts((prev) => {
      const next = { ...prev };
      Object.values(prev).forEach((chart) => {
        if (chart.datasetId === datasetId) {
          delete next[chart.id];
        }
      });
      return next;
    });
  }, []);

  const saveChart = useCallback((chart) => {
    setCharts((prev) => {
      const next = { ...prev, [chart.id]: chart };
      return next;
    });
  }, []);

  const duplicateChart = useCallback(
    (chartId) => {
      const original = charts[chartId];
      if (!original) return;
      const clonedId = generateId();
      const clone = {
        ...original,
        id: clonedId,
        title: `${original.title} (Copy)`,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      saveChart(clone);
    },
    [charts, saveChart]
  );

  const deleteChart = useCallback((chartId) => {
    setCharts((prev) => {
      const next = { ...prev };
      delete next[chartId];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      datasets,
      charts,
      loading,
      saveDataset,
      deleteDataset,
      saveChart,
      deleteChart,
      duplicateChart,
      generateId
    }),
    [charts, datasets, deleteChart, deleteDataset, duplicateChart, loading, saveChart, saveDataset]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
}
