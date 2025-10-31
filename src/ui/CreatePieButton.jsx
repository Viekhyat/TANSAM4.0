import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
import { defaultPalette } from "../utils/colors.js";

export default function CreatePieButton({ className = "" }) {
  const { datasets, generateId, saveChart } = useStore();
  const navigate = useNavigate();
  const datasetList = useMemo(() => Object.values(datasets || {}), [datasets]);

  // very small type inference (schema preferred, otherwise sample rows)
  const inferTypeMap = (dataset) => {
    const headers = dataset?.schema?.headers || [];
    const schemaTypes = dataset?.schema?.types || [];
    if (Array.isArray(schemaTypes) && schemaTypes.length >= headers.length) {
      const map = {};
      headers.forEach((h, i) => {
        map[h] = schemaTypes[i] === "number" ? "number" : schemaTypes[i] === "date" ? "date" : "string";
      });
      return map;
    }
    const rows = dataset?.data || dataset?.rowsPreview || [];
    const counts = {};
    const sample = Math.min(rows.length, 100);
    headers.forEach((h) => (counts[h] = { num: 0, date: 0, distinct: new Set() }));
    for (let i = 0; i < sample; i += 1) {
      const r = rows[i] || {};
      headers.forEach((h) => {
        const v = r[h];
        counts[h].distinct.add(String(v));
        const n = Number(v);
        if (v !== null && v !== undefined && v !== "" && Number.isFinite(n)) counts[h].num += 1;
        else if (v && !Number.isNaN(new Date(v).getTime())) counts[h].date += 1;
      });
    }
    const map = {};
    headers.forEach((h) => {
      const c = counts[h];
      if (c.num > 0 && c.date === 0) map[h] = "number";
      else if (c.date > 0 && c.num === 0) map[h] = "date";
      else if (c.distinct.size <= Math.max(10, Math.ceil(sample * 0.2))) map[h] = "category";
      else map[h] = "string";
    });
    return map;
  };

  const handleCreatePie = (dataset) => {
    if (!dataset) {
      window.alert("No dataset available. Import or save a dataset first.");
      return;
    }
    const headers = dataset?.schema?.headers || [];
    if (!headers.length) {
      window.alert("Selected dataset has no columns.");
      return;
    }
    const typeMap = inferTypeMap(dataset);
    const numericFields = headers.filter((h) => typeMap[h] === "number");
    const categoryFields = headers.filter((h) => typeMap[h] === "category" || typeMap[h] === "string");

    const valueField = numericFields[0] || headers.find((h) => h !== (categoryFields[0] || "")) || headers[0];
    const categoryField = categoryFields[0] || headers[0];

    if (!valueField) {
      window.alert("Couldn't find a numeric field to use as values for the pie chart.");
      return;
    }

    const id = generateId();
    const payload = {
      id,
      title: `Share by ${categoryField}`,
      datasetId: dataset.id,
      chartType: "donut",
      mappings: {
        categoryField,
        valueField,
        donut: true
      },
      options: {
        aggregation: "sum",
        topN: 0,
        palette: defaultPalette.slice(),
        seriesColors: {}
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      saveChart(payload);
      navigate("/dashboard");
      // Give quick feedback
      setTimeout(() => window.alert(`Saved pie chart "${payload.title}"`), 50);
    } catch (err) {
      console.error(err);
      window.alert("Failed to save pie chart.");
    }
  };

  if (!datasetList.length) {
    return (
      <button
        type="button"
        className={`rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 ${className}`}
        onClick={() => window.alert("No datasets available")}
      >
        Create pie chart
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Primary: create from first dataset (quick action) */}
      <button
        type="button"
        onClick={() => handleCreatePie(datasetList[0])}
        className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-600"
      >
        Create pie (auto)
      </button>

      {/* Dropdown-like affordance to pick dataset if needed */}
      <div className="relative">
        <select
          onChange={(e) => {
            const ds = datasetList.find((d) => d.id === e.target.value);
            handleCreatePie(ds);
          }}
          defaultValue=""
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          <option value="">Pick dataset…</option>
          {datasetList.map((ds) => (
            <option key={ds.id} value={ds.id}>
              {ds.name} ({ds.originalRowCount ?? ds.rowsPreview?.length ?? 0})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
