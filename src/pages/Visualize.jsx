import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../providers/StoreContext.jsx";
import ChartRenderer from "../ui/ChartRenderer.jsx";
import { buildChartData } from "../utils/chartData.js";
import { defaultPalette } from "../utils/colors.js";

const chartDefinitions = [
  { value: "line", label: "Line", description: "Track trends across a dimension" },
  { value: "bar", label: "Bar", description: "Compare values side-by-side" },
  { value: "area", label: "Area", description: "Emphasize cumulative totals" },
  { value: "scatter", label: "Scatter", description: "Spot relationships between metrics" },
  { value: "pie", label: "Pie", description: "Show proportional breakdown" },
  { value: "donut", label: "Donut", description: "Pie chart with an open center" },
  { value: "radar", label: "Radar", description: "Compare metrics across categories" }
];

const createDefaultValues = () => ({
  title: "",
  datasetId: "",
  chartType: "bar",
  mappings: {
    xField: "",
    yFields: [],
    stacked: false,
    yField: "",
    categoryField: "",
    valueField: "",
    donut: true,
    angleField: "",
    radiusField: ""
  },
  options: {
    aggregation: "none",
    topN: 0,
    seriesColors: {},
    palette: defaultPalette.slice()
  }
});

const getDatasetMeta = (dataset) => {
  if (!dataset) {
    return {
      headers: [],
      types: [],
      numericFields: [],
      stringFields: []
    };
  }
  const headers = dataset.schema?.headers ?? [];
  const rawTypes = dataset.schema?.types ?? [];
  const types = headers.map((header, index) => rawTypes[index] || "string");
  const numericFields = headers.filter((_, index) => types[index] === "number");
  const stringFields = headers.filter((_, index) => types[index] !== "number");
  return { headers, types, numericFields, stringFields };
};

const suggestMappings = (chartType, meta, current) => {
  const { headers, numericFields, stringFields } = meta;
  const suggestions = {};

  const firstHeader = headers[0] ?? "";
  const firstNumeric = numericFields[0] ?? headers[1] ?? headers[0] ?? "";
  const secondNumeric = numericFields[1] ?? numericFields[0] ?? "";
  const firstString = stringFields[0] ?? headers[0] ?? "";

  const mapHasField = (field) => field && headers.includes(field);

  if (!headers.length) {
    return {
      xField: "",
      yFields: [],
      yField: "",
      categoryField: "",
      valueField: "",
      angleField: "",
      radiusField: ""
    };
  }

  if (["line", "bar", "area"].includes(chartType)) {
    if (!mapHasField(current.xField)) {
      suggestions.xField = firstHeader;
    }
    const validY = (current.yFields || []).filter(mapHasField);
    if (validY.length === 0) {
      if (numericFields.length > 0) {
        suggestions.yFields = numericFields.slice(0, Math.min(3, numericFields.length));
      } else if (headers.length > 1) {
        suggestions.yFields = [headers[1]];
      } else {
        suggestions.yFields = [headers[0]];
      }
    } else if (validY.length !== (current.yFields || []).length) {
      suggestions.yFields = validY;
    }
  } else if (chartType === "scatter") {
    if (!mapHasField(current.xField) || current.xField === current.yField) {
      suggestions.xField = secondNumeric || firstNumeric;
    }
    if (!mapHasField(current.yField)) {
      suggestions.yField = firstNumeric;
    }
  } else if (["pie", "donut"].includes(chartType)) {
    if (!mapHasField(current.categoryField)) {
      suggestions.categoryField = firstString;
    }
    if (!mapHasField(current.valueField)) {
      suggestions.valueField = firstNumeric;
    }
  } else if (chartType === "radar") {
    if (!mapHasField(current.angleField)) {
      suggestions.angleField = firstString;
    }
    if (!mapHasField(current.radiusField)) {
      suggestions.radiusField = firstNumeric;
    }
  }

  return suggestions;
};

const fieldTypeLabel = (field, typeMap) => {
  if (!field) return "";
  const type = typeMap[field];
  if (!type) return "";
  if (type === "number") return "Numeric";
  if (type === "date") return "Date";
  return "Text";
};

export default function VisualizePage() {
  const { datasets, charts, saveChart, generateId } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("");
  const defaults = useMemo(() => createDefaultValues(), []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { isDirty }
  } = useForm({ defaultValues: defaults });

  const datasetId = watch("datasetId");
  const chartType = watch("chartType");
  const mappings = watch("mappings");
  const options = watch("options");
  const title = watch("title");

  const datasetOptions = useMemo(
    () => Object.values(datasets).map((dataset) => ({ value: dataset.id, label: dataset.name || "Untitled dataset" })),
    [datasets]
  );

  const selectedDataset = datasetId ? datasets[datasetId] : null;
  const meta = useMemo(() => getDatasetMeta(selectedDataset), [selectedDataset]);
  const typeMap = useMemo(
    () => meta.headers.reduce((acc, header, index) => ({ ...acc, [header]: meta.types[index] }), {}),
    [meta.headers, meta.types]
  );

  const currentChartId = searchParams.get("chartId");
  const editingChart = currentChartId ? charts[currentChartId] : null;

  useEffect(() => {
    if (editingChart) {
      reset({
        ...defaults,
        ...editingChart,
        options: {
          ...defaults.options,
          ...(editingChart.options || {}),
          seriesColors: { ...defaults.options.seriesColors, ...(editingChart.options?.seriesColors || {}) }
        }
      });
      setStatusMessage(`Editing "${editingChart.title}"`);
    } else {
      reset(createDefaultValues());
      setStatusMessage("");
    }
  }, [defaults, editingChart, reset]);

  useEffect(() => {
    if (!selectedDataset) {
      setValue("mappings", createDefaultValues().mappings, { shouldDirty: false });
      return;
    }
    const current = getValues("mappings");
    const suggestions = suggestMappings(chartType, meta, current);
    Object.entries(suggestions).forEach(([key, value]) => {
      if (value === undefined) return;
      const path = `mappings.${key}`;
      const existing = current[key];
      const equalsArray =
        Array.isArray(existing) && Array.isArray(value) ? existing.join("|") === value.join("|") : existing === value;
      if (!equalsArray) {
        setValue(path, value, { shouldDirty: false });
      }
    });
    if (Array.isArray(current.yFields)) {
      const unique = current.yFields.filter((field, index, arr) => arr.indexOf(field) === index && meta.headers.includes(field));
      if (unique.length !== current.yFields.length) {
        setValue("mappings.yFields", unique, { shouldDirty: false });
      }
    }
  }, [chartType, getValues, meta, selectedDataset, setValue]);

  useEffect(() => {
    if (!selectedDataset && !editingChart) {
      setSearchParams({});
    }
  }, [editingChart, selectedDataset, setSearchParams]);

  const datasetRows = selectedDataset?.data || selectedDataset?.rowsPreview || [];

  const previewData = useMemo(
    () => buildChartData(datasetRows, chartType, mappings, options),
    [datasetRows, chartType, mappings, options]
  );

  const datasetField = register("datasetId");
  const chartTypeField = register("chartType");

  const handleYFieldsChange = (event) => {
    const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
    setValue("mappings.yFields", selectedValues, { shouldDirty: true, shouldValidate: true });
    const colorMap = options.seriesColors || {};
    const nextColorMap = {};
    selectedValues.forEach((field, index) => {
      nextColorMap[field] = colorMap[field] || defaultPalette[index % defaultPalette.length];
    });
    setValue("options.seriesColors", nextColorMap, { shouldDirty: true });
  };

  const handleSeriesColorChange = (field, fallbackIndex, color) => {
    const next = {
      ...(options.seriesColors || {}),
      [field]: color || defaultPalette[fallbackIndex % defaultPalette.length]
    };
    setValue("options.seriesColors", next, { shouldDirty: true });
  };

  const removeChartFromUrl = () => {
    if (!searchParams.has("chartId")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("chartId");
    setSearchParams(next);
  };

  const onSubmit = (values) => {
    if (!values.datasetId) {
      setStatusMessage("Select a dataset to build a chart.");
      return;
    }
    const id = editingChart?.id || generateId();
    const payload = {
      id,
      title: values.title || chartDefinitions.find((c) => c.value === values.chartType)?.label || "Untitled chart",
      datasetId: values.datasetId,
      chartType: values.chartType,
      mappings: { ...values.mappings },
      options: {
        aggregation: values.options.aggregation,
        topN: Number(values.options.topN) || 0,
        seriesColors: values.options.seriesColors || {},
        palette: values.options.palette?.length ? values.options.palette : defaultPalette.slice()
      },
      createdAt: editingChart?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveChart(payload);
    setSearchParams({ chartId: id });
    setStatusMessage(`Saved chart "${payload.title}".`);
  };

  const resetForm = () => {
    if (editingChart) {
      reset({
        ...defaults,
        ...editingChart,
        options: {
          ...defaults.options,
          ...(editingChart.options || {}),
          seriesColors: { ...defaults.options.seriesColors, ...(editingChart.options?.seriesColors || {}) }
        }
      });
    } else {
      reset(createDefaultValues());
      removeChartFromUrl();
    }
    setStatusMessage("");
  };

  const mappingHint = (field, expectation) => {
    if (!field) return null;
    const type = typeMap[field];
    if (!type) return null;
    if (expectation === "number" && type !== "number") {
      return <p className="text-xs text-amber-600">Tip: choose a numeric field for best results.</p>;
    }
    if (expectation === "string" && type === "number") {
      return <p className="text-xs text-amber-600">Tip: a categorical/text field works best here.</p>;
    }
    return null;
  };

  const chartSummary = chartDefinitions.find((item) => item.value === chartType);

  return (
    <div className="flex w-full flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8 flex-1 min-h-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Visualize</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Configure a dataset, choose a chart type, and see changes reflected instantly in the preview.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          View dashboard
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0 lg:gap-8">
        <section className="space-y-6 min-h-0 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chart details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Title
                  <input
                    type="text"
                    placeholder="Untitled chart"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                    {...register("title")}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dataset
                  <select
                    {...datasetField}
                    value={datasetId}
                    onChange={(event) => {
                      datasetField.onChange(event);
                      setValue("datasetId", event.target.value, { shouldDirty: true });
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                  >
                    <option value="">Select dataset</option>
                    {datasetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!datasetId ? <span className="text-xs text-slate-400">Choose a dataset to unlock field mappings.</span> : null}
                </label>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chart type</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {chartDefinitions.map((chart) => (
                    <button
                      key={chart.value}
                      type="button"
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        chartType === chart.value
                          ? "border-brand-300 bg-brand-50 text-brand-900 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-brand-200 hover:bg-brand-50/40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-300/40"
                      }`}
                      onClick={() => {
                        chartTypeField.onChange({ target: { value: chart.value } });
                        setValue("chartType", chart.value, { shouldDirty: true });
                      }}
                    >
                      <span
                        className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                          chartType === chart.value ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-500"
                        }`}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{chart.label}</span>
                        <span className="text-xs leading-snug text-slate-500 dark:text-slate-300">{chart.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {chartSummary ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Hint: {chartSummary.description}.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Field mappings</h2>
              {!datasetId ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  Choose a dataset to configure field mappings.
                </div>
              ) : (
                <div className="mt-4 space-y-6">
                  {["line", "bar", "area"].includes(chartType) ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        X axis field
                        <select
                          value={mappings.xField || ""}
                          onChange={(event) => setValue("mappings.xField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.xField, "string")}
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Y axis fields
                        <select
                          multiple
                          value={mappings.yFields || []}
                          onChange={handleYFieldsChange}
                          className="h-32 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint((mappings.yFields || [])[0], "number")}
                        {mappings.yFields?.length ? (
                          <div className="flex flex-wrap gap-3 text-xs">
                            {mappings.yFields.map((field, index) => (
                              <label key={field} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 dark:border-slate-600">
                                <span className="font-medium text-slate-600 dark:text-slate-200">{field}</span>
                                <input
                                  type="color"
                                  value={(options.seriesColors || {})[field] || defaultPalette[index % defaultPalette.length]}
                                  onChange={(event) => handleSeriesColorChange(field, index, event.target.value)}
                                  className="h-6 w-6 cursor-pointer rounded-full border border-slate-200 bg-transparent p-0 dark:border-slate-600"
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600">Select at least one numeric field.</p>
                        )}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={mappings.stacked || false}
                          onChange={(event) => setValue("mappings.stacked", event.target.checked, { shouldDirty: true })}
                          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                        />
                        Stacked bars / areas
                      </label>
                    </div>
                  ) : null}

                  {chartType === "scatter" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        X (numeric)
                        <select
                          value={mappings.xField || ""}
                          onChange={(event) => setValue("mappings.xField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.xField, "number")}
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Y (numeric)
                        <select
                          value={mappings.yField || ""}
                          onChange={(event) => setValue("mappings.yField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.yField, "number")}
                      </label>
                    </div>
                  ) : null}

                  {["pie", "donut"].includes(chartType) ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Category field
                        <select
                          value={mappings.categoryField || ""}
                          onChange={(event) => setValue("mappings.categoryField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.categoryField, "string")}
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Value field
                        <select
                          value={mappings.valueField || ""}
                          onChange={(event) => setValue("mappings.valueField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.valueField, "number")}
                      </label>
                      {chartType === "donut" ? (
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={mappings.donut !== false}
                            onChange={(event) => setValue("mappings.donut", event.target.checked, { shouldDirty: true })}
                            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                          />
                          Show as donut
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  {chartType === "radar" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Angle (category)
                        <select
                          value={mappings.angleField || ""}
                          onChange={(event) => setValue("mappings.angleField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.angleField, "string")}
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Radius (numeric)
                        <select
                          value={mappings.radiusField || ""}
                          onChange={(event) => setValue("mappings.radiusField", event.target.value, { shouldDirty: true })}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                        >
                          <option value="">Select column</option>
                          {meta.headers.map((header) => (
                            <option key={header} value={header}>
                              {header} ({fieldTypeLabel(header, typeMap)})
                            </option>
                          ))}
                        </select>
                        {mappingHint(mappings.radiusField, "number")}
                      </label>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Options</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Aggregation
                  <select
                    {...register("options.aggregation")}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                  >
                    <option value="none">None</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Top N (0 = all)
                  <input
                    type="number"
                    min="0"
                    value={options.topN ?? 0}
                    onChange={(event) =>
                      setValue("options.topN", event.target.value === "" ? 0 : Number(event.target.value), { shouldDirty: true })
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-300">{statusMessage}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-300"
                  >
                    Save chart
                  </button>
                </div>
              </div>
            </div>
          </form>

          {selectedDataset ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dataset context</h3>
              <div className="mt-4 grid gap-3 text-xs text-slate-500 dark:text-slate-300 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{selectedDataset.name}</p>
                  <p>{datasetRows.length} rows</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Columns</p>
                  <p className="max-h-20 overflow-y-auto text-slate-500 dark:text-slate-300">
                    {meta.headers.join(", ") || "N/A"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Updated</p>
                  <p>{new Date(selectedDataset.updatedAt || Date.now()).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        <aside className="flex flex-col gap-6 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto lg:pl-6">
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-100 transition-colors dark:bg-slate-800/80 dark:ring-slate-700 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live preview</h3>
              {isDirty ? <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Unsaved changes</span> : null}
            </div>
            <div className="flex-1 min-h-0 rounded-xl bg-slate-50 p-6 dark:bg-slate-900/40 h-full w-full">
              <ChartRenderer
                chart={{
                  id: currentChartId || "preview",
                  title: title || "Preview",
                  chartType,
                  mappings,
                  options
                }}
                data={previewData}
                compact
              />
            </div>
          </div>
          <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900 ring-1 ring-inset ring-brand-100">
            <h4 className="text-base font-semibold text-brand-900">Builder tips</h4>
            <ul className="mt-2 space-y-2 text-sm">
              <li>Use aggregation to summarize repeated categories before charting.</li>
              <li>Top N trims results to keep dashboards focused.</li>
              <li>Radar and Scatter charts work best with numeric measures.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
