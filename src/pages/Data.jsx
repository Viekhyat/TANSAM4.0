import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useStore } from "../providers/StoreContext.jsx";
import {
  fetchPublicGoogleCsv,
  parseAnyFile,
  rebuildFromRaw,
  transformGoogleSheetsUrl
} from "../utils/parseData.js";
import DataPreviewTable from "../ui/DataPreviewTable.jsx";

const nowIso = () => new Date().toISOString();

export default function DataPage() {
  const { datasets, saveDataset, deleteDataset, generateId } = useStore();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    resetField,
    formState: { errors }
  } = useForm({
    defaultValues: {
      datasetName: "",
      googleUrl: ""
    }
  });

  const [firstRowHeader, setFirstRowHeader] = useState(true);
  const [activePreview, setActivePreview] = useState(null);
  const [activeSource, setActiveSource] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const savedDatasets = useMemo(() => Object.values(datasets).sort((a, b) => (a.name || "").localeCompare(b.name || "")), [datasets]);

  const resetPreview = () => {
    setActivePreview(null);
    setActiveSource(null);
    setStatusMessage("");
  };

  const processResult = useCallback(
    (result, sourceMeta) => {
      const supportsHeaderToggle =
        sourceMeta.supportsHeaderToggle !== undefined ? sourceMeta.supportsHeaderToggle : true;
      setActivePreview(result);
      setActiveSource({ ...sourceMeta, supportsHeaderToggle, rawRows: result.rawRows ?? result.rows });
      setStatusMessage(`Loaded ${result.rows.length.toLocaleString()} rows.`);
    },
    []
  );

  const parseFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setStatusMessage("Parsing file...");
    try {
      const parsed = await parseAnyFile(file, { firstRowHeader });
      const extension = file.name?.split(".").pop()?.toLowerCase();
      const supportsHeaderToggle = ["csv", "xlsx", "xls"].includes(extension || "");
      processResult(parsed, { kind: "file", file, supportsHeaderToggle });
      setValue("datasetName", file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || "Failed to parse file.");
      resetPreview();
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (event) => {
    const file = event.target.files?.[0];
    parseFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    parseFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const onFetchGoogle = async (event) => {
    event.preventDefault();
    const url = watch("googleUrl");
    if (!url) return;
    setLoading(true);
    setStatusMessage("Fetching Google Sheet...");
    try {
      const parsed = await fetchPublicGoogleCsv(url, { firstRowHeader });
      processResult(parsed, { kind: "google", url: transformGoogleSheetsUrl(url), supportsHeaderToggle: true });
      setValue("datasetName", "Google Sheet Dataset");
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || "Failed to fetch Google Sheets data.");
      resetPreview();
    } finally {
      setLoading(false);
    }
  };

  const onToggleHeader = (event) => {
    if (activeSource?.supportsHeaderToggle === false) return;
    const checked = event.target.checked;
    setFirstRowHeader(checked);
    if (!activeSource?.rawRows) return;
    const rebuilt = rebuildFromRaw(activeSource.rawRows, { firstRowHeader: checked });
    setActivePreview((prev) => (prev ? { ...prev, ...rebuilt } : prev));
  };

  const onSaveDataset = () => {
    if (!activePreview) {
      setStatusMessage("Load and preview data before saving.");
      return;
    }
    const datasetName = watch("datasetName")?.trim();
    if (!datasetName) {
      setStatusMessage("Dataset name is required.");
      return;
    }
    const id = generateId();
    const payload = {
      id,
      name: datasetName,
      sourceType: activeSource?.kind || "manual",
      schema: { headers: activePreview.headers, types: activePreview.types },
      rowsPreview: activePreview.rows.slice(0, 50),
      data: activePreview.rows,
      fullDataStored: true,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    saveDataset(payload);
    setStatusMessage(`Saved dataset "${datasetName}".`);
    resetField("datasetName");
    resetField("googleUrl");
    resetPreview();
  };

  const onDeleteDataset = (id, name) => {
    if (window.confirm(`Delete dataset "${name}"? This also removes linked charts.`)) {
      deleteDataset(id);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <section className="flex flex-col gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import Data</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Drag & drop or browse for CSV, XLSX, or JSON files. You can also paste public Google Sheets links.
            </p>
          </div>
          <div
            className="mt-4 flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-center transition hover:border-brand-200 hover:bg-brand-50"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">Drop your file here or</p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600">
              Browse files
              <input type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={handleFileInput} />
            </label>
          </div>
          <form className="mt-6 flex flex-col gap-3" onSubmit={onFetchGoogle}>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Google Sheets public link</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                {...register("googleUrl", {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: "Enter a valid URL"
                  }
                })}
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? "Loading..." : "Fetch"}
              </button>
            </div>
            {errors.googleUrl ? <span className="text-xs text-red-500">{errors.googleUrl.message}</span> : null}
          </form>
          <div className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Dataset name</label>
            <input
              type="text"
              placeholder="Quarterly performance"
              className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              {...register("datasetName", { required: "Dataset name is required" })}
            />
          </div>
          <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
            <label
              className={`flex items-center gap-2 text-sm ${
                activeSource?.supportsHeaderToggle === false ? "text-slate-300" : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400 disabled:bg-slate-100 dark:bg-slate-800/60 disabled:text-slate-300"
                checked={firstRowHeader}
                onChange={onToggleHeader}
                disabled={activeSource?.supportsHeaderToggle === false}
              />
              First row contains headers
            </label>
            <button
              type="button"
              onClick={onSaveDataset}
              disabled={!activePreview || loading}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              Save dataset
            </button>
          </div>
          {statusMessage ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">{statusMessage}</p> : null}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preview (first 50 rows)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-300">Detected headers and inferred data types are shown below.</p>
          </div>
          <div className="mt-4">
            {activePreview ? (
              <DataPreviewTable headers={activePreview.headers} types={activePreview.types} rows={activePreview.rows.slice(0, 50)} />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-300">
                <p>No data loaded yet. Import a file or fetch a Google Sheet to see the preview.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved datasets</h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {savedDatasets.length}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {savedDatasets.length === 0 ? (
              <p className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-300">No datasets saved yet.</p>
            ) : (
              savedDatasets.map((dataset) => (
                <div key={dataset.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dataset.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {dataset.rowsPreview?.length || 0} rows · {dataset.schema?.headers?.length || 0} columns
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteDataset(dataset.id, dataset.name)}
                      className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-100 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900 ring-1 ring-inset ring-brand-100">
          <h3 className="text-base font-semibold text-brand-900">Need tips?</h3>
          <p className="mt-2">
            Ensure Google Sheets are shared as &ldquo;Anyone with the link&rdquo; and use the fetch button. Parsed datasets persist in
            localStorage until you clear them.
          </p>
        </div>
      </aside>
    </div>
  );
}

