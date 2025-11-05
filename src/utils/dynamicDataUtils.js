const DATA_CACHE_KEY = "datanaut_dynamic_data_cache";

const readCache = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Unable to read dynamic data cache", error);
    return {};
  }
};

const writeCache = (payload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to persist dynamic data cache", error);
  }
};

export const saveDynamicDataCache = (connectionId, payload) => {
  if (!connectionId) return;
  const cache = readCache();
  cache[connectionId] = payload;
  writeCache(cache);
};

export const loadDynamicDataCache = (connectionId) => {
  if (!connectionId) return null;
  const cache = readCache();
  return cache?.[connectionId] || null;
};

const makeDatasetId = (prefix, index) => `${prefix}-${index}`;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isArrayOfObjects = (arr) =>
  Array.isArray(arr) && arr.length > 0 && arr.every((item) => isObject(item));

export const normalizeDataPayload = (payload, connectionId = "dataset") => {
  const sourceArray = Array.isArray(payload) ? payload : payload != null ? [payload] : [];

  return sourceArray.map((entry, index) => {
    const baseId = makeDatasetId(connectionId, index);
    const label =
      (entry && (entry.table || entry.name || entry.id || entry.topic)) || `Dataset ${index + 1}`;

    // SQL style: { table, rows: [...] }
    if (entry && Array.isArray(entry.rows)) {
      const rows = entry.rows;
      const isTabular = isArrayOfObjects(rows);
      return {
        id: baseId,
        label,
        type: isTabular ? "table" : "list",
        rows: isTabular ? rows : rows.map((value) => ({ value })),
        items: !isTabular ? rows : undefined,
        raw: entry
      };
    }

    // If entry itself is an array
    if (Array.isArray(entry)) {
      const isTabular = isArrayOfObjects(entry);
      return {
        id: baseId,
        label,
        type: isTabular ? "table" : "list",
        rows: isTabular ? entry : undefined,
        items: !isTabular ? entry : undefined,
        raw: entry
      };
    }

    // Plain object fallback
    if (isObject(entry)) {
      const objectEntries = Object.entries(entry);
      const allArrays = objectEntries.every(([, value]) => Array.isArray(value));
      if (allArrays && objectEntries.length > 0) {
        const longestArray = objectEntries.reduce(
          (acc, [, value]) => (value.length > acc ? value.length : acc),
          0
        );
        const rows = Array.from({ length: longestArray }).map((_, rowIdx) => {
          const row = {};
          objectEntries.forEach(([key, value]) => {
            row[key] = value[rowIdx];
          });
          return row;
        });
        return {
          id: baseId,
          label,
          type: "table",
          rows,
          raw: entry
        };
      }

      return {
        id: baseId,
        label,
        type: "object",
        data: entry,
        raw: entry
      };
    }

    // Primitive fallback
    return {
      id: baseId,
      label,
      type: "value",
      value: entry,
      raw: entry
    };
  });
};
