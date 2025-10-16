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
  { value: "donut", label: "Donut", description: "Pie chart with empty center" },
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
    colorField: "",
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

export default function VisualizePage() {
  const { datasets, charts, saveChart, generateId } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("");
  const baseDefaults = useMemo(() => createDefaultValues(), []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty }
  } = useForm({ defaultValues: baseDefaults });

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
  const availableFields = selectedDataset?.schema?.headers || [];

  const currentChartId = searchParams.get("chartId");
  const editingChart = currentChartId ? charts[currentChartId] : null;

  useEffect(() => {
    if (editingChart) {
      const defaults = createDefaultValues();
      reset({
        ...defaults,
        title: editingChart.title,
        datasetId: editingChart.datasetId,
        chartType: editingChart.chartType,
        mappings: {
          ...defaults.mappings,
          ...editingChart.mappings
        },
        options: {
          ...defaults.options,
          ...editingChart.options,
          seriesColors: {
            ...defaults.options.seriesColors,
            ...(editingChart.options?.seriesColors || {})
          },
          palette:
            editingChart.options?.palette && editingChart.options.palette.length > 0
              ? editingChart.options.palette
              : defaults.options.palette
        }
      });
      setStatusMessage(`Editing chart "${editingChart.title}".`);
    } else {
      reset(createDefaultValues());
      setStatusMessage("");
    }
  }, [editingChart, reset]);

  const previewData = useMemo(() => {
    const rows = selectedDataset?.data || selectedDataset?.rowsPreview || [];
    return buildChartData(rows, chartType, mappings, options);
  }, [chartType, mappings, options, selectedDataset]);

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
        palette:
          values.options.palette && values.options.palette.length > 0
            ? values.options.palette
            : defaultPalette.slice()
      },
      createdAt: editingChart?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveChart(payload);
    setStatusMessage(`Chart "${payload.title}" saved.`);
    setSearchParams({});
    reset(createDefaultValues());
  };

  const clearEditing = () => {
    setSearchParams({});
    reset(createDefaultValues());
    setStatusMessage("");
  };

  const handleTopNChange = (event) => {
    const value = Number(event.target.value);
    setValue("options.topN", Number.isFinite(value) ? value : 0, { shouldDirty: true, shouldValidate: true });
  };

  const handleYFieldsChange = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setValue("mappings.yFields", selected, { shouldDirty: true, shouldValidate: true });
    const existing = options.seriesColors || {};
    const selectedSet = new Set(selected);
    const filtered = Object.entries(existing).reduce((acc, [field, color]) => {
      if (selectedSet.has(field)) {
        acc[field] = color;
      }
      return acc;
    }, {});
    selected.forEach((field, index) => {
      if (!filtered[field]) {
        filtered[field] = defaultPalette[index % defaultPalette.length];
      }
    });
    setValue("options.seriesColors", filtered, { shouldDirty: true });
  };

  const formError = (path) => {
    const segments = path.split(".");
    let current = errors;
    for (const segment of segments) {
      current = current?.[segment];
      if (!current) break;
    }
    return current?.message;
  };

  const seriesColors = options.seriesColors || {};
  const paletteColors = options.palette && options.palette.length > 0 ? options.palette : defaultPalette;

  const handleSeriesColorChange = (field, fallbackIndex, color) => {
    const next = {
      ...seriesColors,
      [field]: color || defaultPalette[fallbackIndex % defaultPalette.length]
    };
    setValue("options.seriesColors", next, { shouldDirty: true });
  };

  const handleSeriesColorReset = (field) => {
    const { [field]: _removed, ...rest } = seriesColors;
    setValue("options.seriesColors", rest, { shouldDirty: true });
  };

  const handlePaletteColorChange = (index, color) => {
    const current = options.palette && options.palette.length > 0 ? options.palette.slice() : defaultPalette.slice();
    current[index] = color || defaultPalette[index % defaultPalette.length];
    setValue("options.palette", current, { shouldDirty: true });
  };

  const handlePaletteColorAdd = () => {
    const current = options.palette && options.palette.length > 0 ? options.palette.slice() : defaultPalette.slice();
    const nextColor = defaultPalette[current.length % defaultPalette.length];
    current.push(nextColor);
    setValue("options.palette", current, { shouldDirty: true });
  };

  const handlePaletteColorRemove = (index) => {
    const current = options.palette && options.palette.length > 0 ? options.palette.slice() : defaultPalette.slice();
    if (current.length <= 2) return;
    current.splice(index, 1);
    setValue("options.palette", current, { shouldDirty: true });
  };

  const handlePaletteColorReset = () => {
    setValue("options.palette", defaultPalette.slice(), { shouldDirty: true });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
      <section className="flex flex-col gap-6">
        <form className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chart Builder</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Configure your visualization and preview changes in real time.</p>
            </div>
            {editingChart ? (
              <button type="button" onClick={clearEditing} className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                Exit edit mode
              </button>
            ) : null}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Chart title
              <input
                type="text"
                placeholder="Performance overview"
                className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                {...register("title")}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Dataset
              <select
                className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                {...register("datasetId", { required: "Pick a dataset to continue." })}
              >
                <option value="">Select dataset</option>
                {datasetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {formError("datasetId") ? <span className="text-xs text-red-500">{formError("datasetId")}</span> : null}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 lg:col-span-2">
              Chart type
              <div className="grid gap-3 sm:grid-cols-2">
                {chartDefinitions.map((chart) => (
                  <button
                    type="button"
                    key={chart.value}
                    onClick={() => setValue("chartType", chart.value, { shouldDirty: true })}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      chartType === chart.value
                        ? "border-brand-300 bg-brand-50 text-brand-800 shadow-sm"
                        : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    <span className="block font-semibold">{chart.label}</span>
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-300">{chart.description}</span>
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mappings</p>
            {!selectedDataset ? (
              <p className="text-xs text-slate-500 dark:text-slate-300">Select a dataset to configure mappings.</p>
            ) : (
              <>
                {["line", "bar", "area"].includes(chartType) ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      X-axis field
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.xField", { required: "Select X-axis field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                      {formError("mappings.xField") ? <span className="text-xs text-red-500">{formError("mappings.xField")}</span> : null}
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Y-axis fields
                      <select
                        multiple
                        value={mappings.yFields || []}
                        onChange={handleYFieldsChange}
                        className="min-h-[120px] rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-500 dark:text-slate-300">Hold Ctrl/Cmd to pick multiple series.</span>
                      {mappings.yFields && mappings.yFields.length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                          <p className="font-semibold uppercase tracking-wide text-[11px]">Series colors</p>
                          <div className="space-y-2">
                            {mappings.yFields.map((field, index) => {
                              const color = seriesColors[field] || defaultPalette[index % defaultPalette.length];
                              return (
                                <div key={field} className="flex items-center gap-3">
                                  <span className="flex-1 truncate">{field}</span>
                                  <input
                                    type="color"
                                    value={color}
                                    onChange={(event) => handleSeriesColorChange(field, index, event.target.value)}
                                    className="h-8 w-10 cursor-pointer rounded border border-slate-200 dark:border-slate-600 bg-transparent p-0 dark:border-slate-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSeriesColorReset(field)}
                                    className="text-xs font-semibold text-slate-500 dark:text-slate-300 transition hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-200"
                                  >
                                    Reset
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                        checked={mappings.stacked || false}
                        onChange={(event) =>
                          setValue("mappings.stacked", event.target.checked, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                      Stacked bars / areas
                    </label>
                  </>
                ) : null}

                {chartType === "scatter" ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      X field (numeric)
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.xField", { required: "Select X field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Y field (numeric)
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.yField", { required: "Select Y field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Color by (optional)
                    <select
                      className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      {...register("mappings.colorField")}
                    >
                      <option value="">None</option>
                      {availableFields.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </label>
                  {mappings.yField ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 transition-colors dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                      <span className="font-semibold uppercase tracking-wide text-[11px]">Point color</span>
                      <input
                        type="color"
                        value={seriesColors[mappings.yField] || defaultPalette[0]}
                        onChange={(event) => handleSeriesColorChange(mappings.yField, 0, event.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent p-0 dark:border-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSeriesColorReset(mappings.yField)}
                        className="text-xs font-semibold text-slate-500 transition hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-200"
                      >
                        Reset
                      </button>
                    </div>
                  ) : null}
                  </>
                ) : null}

                {["pie", "donut"].includes(chartType) ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Category field
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.categoryField", { required: "Select category field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Value field
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.valueField", { required: "Select value field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                      checked={chartType === "donut" ? mappings.donut !== false : mappings.donut || false}
                      onChange={(event) =>
                        setValue("mappings.donut", event.target.checked, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                    Use donut style
                  </label>
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold uppercase tracking-wide text-[11px]">Slice colors</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePaletteColorReset}
                          className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handlePaletteColorAdd}
                          className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {paletteColors.map((color, index) => (
                        <div key={`palette-color-${index}`} className="flex items-center gap-3">
                          <span className="w-5 text-center font-semibold">{index + 1}</span>
                          <input
                            type="color"
                            value={color}
                            onChange={(event) => handlePaletteColorChange(index, event.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-200 dark:border-slate-600 bg-transparent p-0 dark:border-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => handlePaletteColorRemove(index)}
                            disabled={paletteColors.length <= 2}
                            className="text-xs font-semibold text-slate-500 dark:text-slate-300 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

                {chartType === "radar" ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Angle field (category)
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.angleField", { required: "Select category field" })}
                      >
                        <option value="">Select column</option>
                        {availableFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Radius field (numeric)
                      <select
                        className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        {...register("mappings.radiusField", { required: "Select value field" })}
                      >
                        <option value="">Select column</option>
                  {availableFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </label>
              {mappings.radiusField ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 transition-colors dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                  <span className="font-semibold uppercase tracking-wide text-[11px]">Fill color</span>
                  <input
                    type="color"
                    value={seriesColors[mappings.radiusField] || defaultPalette[0]}
                    onChange={(event) => handleSeriesColorChange(mappings.radiusField, 0, event.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent p-0 dark:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSeriesColorReset(mappings.radiusField)}
                    className="text-xs font-semibold text-slate-500 transition hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-200"
                  >
                    Reset
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-white dark:bg-slate-800/80">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Options</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Aggregation
                <select
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  {...register("options.aggregation")}
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
                  placeholder="0"
                  value={options.topN ?? 0}
                  onChange={handleTopNChange}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500 dark:text-slate-300">{statusMessage}</div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => reset(createDefaultValues())}
                className="rounded-full border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
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
        </form>

        {selectedDataset ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dataset context</h3>
            <div className="mt-3 grid gap-3 text-xs text-slate-500 dark:text-slate-300 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
                <p className="font-semibold text-slate-700 dark:text-slate-200">{selectedDataset.name}</p>
                <p>{selectedDataset.data?.length ?? selectedDataset.rowsPreview?.length ?? 0} rows</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Columns</p>
                <p>{availableFields.join(", ") || "N/A"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Updated</p>
                <p>{new Date(selectedDataset.updatedAt || Date.now()).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="flex flex-col gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live preview</h3>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              View dashboard
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4">
            {previewData && previewData.length > 0 ? (
              <ChartRenderer
                chart={{
                  id: currentChartId || "preview",
                  title: title || "Preview",
                  chartType,
                  mappings: mappings,
                  options: options
                }}
                data={previewData}
                compact
              />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                Configure mappings to see the chart preview.
              </div>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900 ring-1 ring-inset ring-brand-100">
          <h4 className="text-base font-semibold text-brand-900">Builder tips</h4>
          <ul className="mt-2 space-y-2 text-sm">
            <li>Use aggregation to summarize repeated categories.</li>
            <li>Apply Top N to keep dashboards focused.</li>
            <li>Pie/Donut charts show only the first value field.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}



