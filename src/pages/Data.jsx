import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
  // allow user to opt-in to storing full dataset (may impact performance)
  const [storeFullData, setStoreFullData] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const savedDatasets = useMemo(
    () => Object.values(datasets).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [datasets]
  );

  const datasetPreviewMap = useMemo(() => {
    return savedDatasets.reduce((acc, dataset) => {
      acc[dataset.id] = {
        rows: dataset.rowsPreview || [],
        headers: dataset.schema?.headers || [],
        types: dataset.schema?.types || [],
        totalRows:
          dataset.originalRowCount ??
          dataset.data?.length ??
          dataset.rowsPreview?.length ??
          0,
        storedRows:
          dataset.storedRowCount ??
          dataset.data?.length ??
          dataset.rowsPreview?.length ??
          0,
        fullDataStored: !!dataset.fullDataStored
      };
      return acc;
    }, {});
  }, [savedDatasets]);

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

    const rows = activePreview.rows || [];
    const rowsPreview = rows.slice(0, 50);
    // Behavior: persisted "full" dataset will only include the last N rows.
    const STORE_LAST_N = 1000;
    // keep existing large-save guard but still allow storing (last N rows) when opted-in
    const MAX_FULL_ROWS = 20000;
    const allowAutoFullStore = rows.length > 0 && rows.length <= MAX_FULL_ROWS;

    const wantFullStore = storeFullData || allowAutoFullStore;
    const rowsToStore = wantFullStore ? rows.slice(Math.max(0, rows.length - STORE_LAST_N)) : undefined;
    const payload = {
      id,
      name: datasetName,
      sourceType: activeSource?.kind || "manual",
      schema: { headers: activePreview.headers, types: activePreview.types },
      rowsPreview,
      // store only last STORE_LAST_N rows when persisting "full" dataset
      data: rowsToStore,
      fullDataStored: !!rowsToStore,
      originalRowCount: rows.length,
      storedRowCount: rowsToStore ? rowsToStore.length : 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const performSave = () => {
      try {
        const result = saveDataset(payload);
        if (result && typeof result.then === "function") {
          return result.then(() => {
            const storedCount = payload.storedRowCount ?? 0;
            setStatusMessage(
              storedCount > 0
                ? `Saved dataset "${datasetName}" (stored ${storedCount.toLocaleString()} of ${payload.originalRowCount.toLocaleString()} rows).`
                : `Saved dataset "${datasetName}".`
            );
            resetField("datasetName");
            resetField("googleUrl");
            resetPreview();
          });
        } else {
          const storedCount = payload.storedRowCount ?? 0;
          setStatusMessage(
            storedCount > 0
              ? `Saved dataset "${datasetName}" (stored ${storedCount.toLocaleString()} of ${payload.originalRowCount.toLocaleString()} rows).`
              : `Saved dataset "${datasetName}".`
          );
          resetField("datasetName");
          resetField("googleUrl");
          resetPreview();
          return Promise.resolve();
        }
      } catch (err) {
        console.error(err);
        setStatusMessage(err?.message || "Failed to save dataset.");
        return Promise.reject(err);
      }
    };

    // If dataset is large and user requested full store, save asynchronously to avoid blocking the main thread.
    if (rows.length > MAX_FULL_ROWS && storeFullData) {
      setStatusMessage(`Saving full dataset (${rows.length.toLocaleString()} rows) in background...`);
      // defer slightly so UI can update before heavy work starts
      setTimeout(() => {
        performSave().catch(() => {}); // errors already handled in performSave
      }, 50);
      return;
    }

    // If dataset is larger than threshold and user didn't opt-in, only persist preview and warn.
    if (rows.length > MAX_FULL_ROWS && !storeFullData) {
      const previewOnlyPayload = {
        ...payload,
        data: undefined,
        fullDataStored: false,
        storedRowCount: 0
      };
      try {
        const res = saveDataset(previewOnlyPayload);
        if (res && typeof res.then === "function") {
          res.then(() =>
            setStatusMessage(
              `Dataset "${datasetName}" saved (preview only). Toggle "Store full dataset" to persist last ${STORE_LAST_N.toLocaleString()} rows.`
            )
          );
        } else {
          setStatusMessage(
            `Dataset "${datasetName}" saved (preview only). Toggle "Store full dataset" to persist last ${STORE_LAST_N.toLocaleString()} rows.`
          );
        }
        resetField("datasetName");
        resetField("googleUrl");
        resetPreview();
      } catch (err) {
        console.error(err);
        setStatusMessage(err?.message || "Failed to save dataset.");
      }
      return;
    }

    // Normal small/full save
    performSave().catch(() => {});
  };

  const toggleDatasetPreview = (datasetId) => {
    setExpandedId((current) => (current === datasetId ? null : datasetId));
  };

  const onDeleteDataset = (id, name) => {
    if (window.confirm(`Delete dataset "${name}"? This also removes linked charts.`)) {
      deleteDataset(id);
      setExpandedId((current) => (current === id ? null : current));
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col gap-6 sm:gap-8 lg:grid lg:grid-cols-[2fr,1fr] min-h-0">
      <section className="flex flex-col gap-6 min-h-0 lg:overflow-y-auto">
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
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-2">
              <input
                type="checkbox"
                checked={storeFullData}
                onChange={(e) => setStoreFullData(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
              />
              Store full dataset (will persist only the last 1,000 rows)
            </label>
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

        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm flex flex-col min-h-0">
          <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preview (first 50 rows)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-300">Detected headers and inferred data types are shown below.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activePreview ? (
              <div className="h-full overflow-auto">
                <DataPreviewTable headers={activePreview.headers} types={activePreview.types} rows={activePreview.rows.slice(0, 50)} />
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-300">
                <p>No data loaded yet. Import a file or fetch a Google Sheet to see the preview.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-6 min-h-0 lg:overflow-y-auto">
        <div className="rounded-2xl bg-white dark:bg-slate-800/80 p-6 shadow-sm flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved datasets</h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {savedDatasets.length}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {savedDatasets.length === 0 ? (
              <p className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-300">No datasets saved yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {savedDatasets.map((dataset) => {
                  const isExpanded = expandedId === dataset.id;
                  const preview = datasetPreviewMap[dataset.id];
                  const totalRows = preview?.totalRows ?? dataset.rowsPreview?.length ?? 0;
                  const storedRows = preview?.storedRows ?? dataset.rowsPreview?.length ?? 0;
                  const headerCount = dataset.schema?.headers?.length ?? 0;
                  return (
                    <div key={dataset.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dataset.name || "Untitled dataset"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            {totalRows.toLocaleString()} rows x {headerCount.toLocaleString()} columns
                          </p>
                          {preview?.fullDataStored ? (
                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                              Last {storedRows.toLocaleString()} rows stored from the original dataset.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => toggleDatasetPreview(dataset.id)}
                            className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-200 hover:bg-white/70 dark:text-slate-200"
                          >
                            {isExpanded ? "Hide preview" : "Show preview"}
                          </button>
                          <button
                            onClick={() => onDeleteDataset(dataset.id, dataset.name)}
                            className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-red-500 transition hover:border-red-100 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        preview ? (
                          <div className="mt-3 space-y-2">
                            <DataPreviewTable
                              headers={preview.headers}
                              types={preview.types}
                              rows={preview.rows.slice(0, 20)}
                              compact
                              maxHeight={240}
                              totalRows={preview.totalRows}
                            />
                            {preview.totalRows > preview.rows.length ? (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Showing preview rows only. Re-import with &ldquo;Store full dataset&rdquo; enabled to persist additional rows.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                            Preview unavailable for this dataset.
                          </p>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
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
