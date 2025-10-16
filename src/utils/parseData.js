import Papa from "papaparse";
import * as XLSX from "xlsx";

const DEFAULT_FIRST_ROW_HEADER = true;

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const normalizeRows = (rawRows, { firstRowHeader = DEFAULT_FIRST_ROW_HEADER } = {}) => {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const cleanedRows = rawRows
    .map((row) => (Array.isArray(row) ? row : Object.values(row)))
    .filter((row) => row.some((value) => value !== null && value !== undefined && String(value).trim() !== ""));

  if (cleanedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstRow = cleanedRows[0];
  const headers = firstRowHeader
    ? firstRow.map((value, idx) => {
        const header = value ?? `Field ${idx + 1}`;
        return String(header || `Field ${idx + 1}`).trim() || `Field ${idx + 1}`;
      })
    : firstRow.map((_, idx) => `Field ${idx + 1}`);

  const dataRows = firstRowHeader ? cleanedRows.slice(1) : cleanedRows;

  const rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? null;
    });
    return obj;
  });

  return { headers, rows };
};

const isNumeric = (value) => {
  if (value === null || value === undefined || value === "") return false;
  const num = Number(value);
  return Number.isFinite(num);
};

const isDate = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

export const inferTypes = (rows, headers) => {
  return headers.map((header) => {
    let numberCount = 0;
    let dateCount = 0;
    let stringCount = 0;

    rows.forEach((row) => {
      const value = row[header];
      if (isNumeric(value)) {
        numberCount += 1;
      } else if (isDate(value)) {
        dateCount += 1;
      } else if (value !== null && value !== undefined && String(value).trim() !== "") {
        stringCount += 1;
      }
    });

    if (numberCount > 0 && stringCount === 0) return "number";
    if (dateCount > 0 && numberCount === 0) return "date";
    return "string";
  });
};

export const coerceRows = (rows, headers, types) =>
  rows.map((row) => {
    const coerced = {};
    headers.forEach((header, idx) => {
      const type = types[idx];
      const value = row[header];
      if (type === "number") {
        const num = Number(value);
        coerced[header] = Number.isFinite(num) ? num : null;
      } else if (type === "date") {
        const date = new Date(value);
        coerced[header] = Number.isNaN(date.getTime()) ? value : date.toISOString();
      } else {
        coerced[header] = value !== null && value !== undefined ? String(value) : "";
      }
    });
    return coerced;
  });

export const parseCSVText = (text, { firstRowHeader = DEFAULT_FIRST_ROW_HEADER } = {}) =>
  new Promise((resolve, reject) => {
    Papa.parse(text, {
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors?.length) {
          reject(result.errors[0]);
          return;
        }
        const rawRows = result.data;
        const rebuilt = rebuildFromRaw(rawRows, { firstRowHeader });
        resolve({ ...rebuilt, rawRows });
      },
      error: reject
    });
  });

export const rebuildFromRaw = (rawRows, { firstRowHeader = DEFAULT_FIRST_ROW_HEADER } = {}) => {
  const { headers, rows } = normalizeRows(rawRows, { firstRowHeader });
  const types = inferTypes(rows, headers);
  const typedRows = coerceRows(rows, headers, types);
  return { headers, rows: typedRows, types };
};

export const parseXLSXFile = async (file, { firstRowHeader = DEFAULT_FIRST_ROW_HEADER } = {}) => {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const rebuilt = rebuildFromRaw(json, { firstRowHeader });
  return { ...rebuilt, rawRows: json };
};

export const parseJSONText = (text) => {
  const parsed = JSON.parse(text || "[]");
  const array = Array.isArray(parsed) ? parsed : parsed.data ?? [];
  if (!Array.isArray(array)) {
    throw new Error("JSON structure must be an array of objects.");
  }
  if (array.length === 0) {
    return { headers: [], rows: [], types: [], rawRows: [] };
  }
  const headers = Object.keys(array[0]);
  const rows = array.map((item) => {
    const row = {};
    headers.forEach((header) => {
      row[header] = item[header] ?? null;
    });
    return row;
  });
  const types = inferTypes(rows, headers);
  const typedRows = coerceRows(rows, headers, types);
  return { headers, rows: typedRows, types, rawRows: rows };
};

export const parseAnyFile = async (file, { firstRowHeader = DEFAULT_FIRST_ROW_HEADER } = {}) => {
  const name = file.name?.toLowerCase() || "";
  if (name.endsWith(".csv")) {
    const text = await readFileAsText(file);
    return parseCSVText(text, { firstRowHeader });
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXLSXFile(file, { firstRowHeader });
  }
  if (name.endsWith(".json")) {
    const text = await readFileAsText(file);
    return parseJSONText(text);
  }
  if (file.type === "application/json") {
    const text = await readFileAsText(file);
    return parseJSONText(text);
  }
  throw new Error("Unsupported file type. Please upload CSV, XLSX, or JSON.");
};

export const transformGoogleSheetsUrl = (url) => {
  if (!url) return "";
  const trimmed = url.trim();
  const directCsvPattern = /\/gviz\/tq\?tqx=out:csv/;
  if (directCsvPattern.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return trimmed;
  }
  const docId = match[1];
  const gidMatch = trimmed.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&gid=${gid}`;
};

export const fetchPublicGoogleCsv = async (url, options) => {
  const transformed = transformGoogleSheetsUrl(url);
  const response = await fetch(transformed);
  if (!response.ok) {
    throw new Error("Failed to fetch Google Sheets data. Check the URL and access permissions.");
  }
  const text = await response.text();
  return parseCSVText(text, options);
};
