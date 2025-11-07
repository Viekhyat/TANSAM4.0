const coerceNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const aggregateValues = (values, method) => {
  const cleanValues = values
    .map(coerceNumber)
    .filter((value) => value !== null);
  if (cleanValues.length === 0) return 0;
  if (method === "sum") {
    return cleanValues.reduce((sum, value) => sum + value, 0);
  }
  if (method === "avg") {
    return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
  }
  if (method === "min") {
    return Math.min(...cleanValues);
  }
  if (method === "max") {
    return Math.max(...cleanValues);
  }
  return cleanValues[cleanValues.length - 1];
};

const filterTopN = (data, topN, valueField) => {
  if (!topN || topN <= 0 || !valueField) return data;
  const sorted = [...data].sort((a, b) => {
    const aVal = coerceNumber(a[valueField]) ?? -Infinity;
    const bVal = coerceNumber(b[valueField]) ?? -Infinity;
    return bVal - aVal;
  });
  return sorted.slice(0, topN);
};

export const buildChartData = (rows, chartType, mappings, options) => {
  if (!rows || rows.length === 0) return [];
  const dataRows = Array.isArray(rows) ? rows : [];
  const aggregation = options?.aggregation || "none";
  const topN = Number(options?.topN) || 0;

  if (["line", "bar", "area"].includes(chartType)) {
    const xField = mappings?.xField;
    const yFields = mappings?.yFields || [];
    if (!xField || yFields.length === 0) return [];
    if (aggregation === "none") {
      return dataRows
        .filter((row) => row && row[xField] !== undefined && row[xField] !== null)
        .map((row) => {
          const entry = { [xField]: row[xField] };
          yFields.forEach((field) => {
            entry[field] = coerceNumber(row[field]);
          });
          return entry;
        });
    }
    const grouped = dataRows.reduce((acc, row) => {
      if (!row) return acc;
      const key = row[xField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(row);
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, items]) => {
      const entry = { [xField]: key };
      yFields.forEach((field) => {
        const values = items.map((item) => (item ? item[field] : null));
        entry[field] = aggregateValues(values, aggregation);
      });
      return entry;
    });
    const firstY = yFields[0];
    return filterTopN(aggregated, topN, firstY);
  }

  if (chartType === "scatter") {
    const xField = mappings?.xField;
    const yField = mappings?.yField;
    if (!xField || !yField) return [];
    return dataRows
      .map((row) => {
        if (!row) return null;
        const x = coerceNumber(row[xField]);
        const y = coerceNumber(row[yField]);
        if (x === null || y === null) return null;
        return { [xField]: x, [yField]: y };
      })
      .filter(Boolean);
  }

  if (["pie", "donut"].includes(chartType)) {
    const categoryField = mappings?.categoryField;
    const valueField = mappings?.valueField;
    if (!categoryField || !valueField) return [];
    const grouped = dataRows.reduce((acc, row) => {
      if (!row) return acc;
      const key = row[categoryField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(row[valueField]);
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, values]) => ({
      [categoryField]: key,
      [valueField]: aggregateValues(values, aggregation === "none" ? "sum" : aggregation)
    }));
    return filterTopN(aggregated, topN, valueField);
  }

  if (chartType === "radar") {
    const angleField = mappings?.angleField;
    const radiusField = mappings?.radiusField;
    if (!angleField || !radiusField) return [];
    if (aggregation === "none") {
      return dataRows
        .filter((row) => row && row[angleField] !== undefined && row[angleField] !== null)
        .map((row) => {
          const radius = coerceNumber(row[radiusField]);
          if (radius === null) return null;
          return {
            [angleField]: row[angleField],
            [radiusField]: radius
          };
        })
        .filter(Boolean);
    }
    const grouped = dataRows.reduce((acc, row) => {
      if (!row) return acc;
      const key = row[angleField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(row[radiusField]);
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, values]) => ({
      [angleField]: key,
      [radiusField]: aggregateValues(values, aggregation)
    }));
    return filterTopN(aggregated, topN, radiusField);
  }



  if (chartType === "table") {
    const xField = mappings?.xField;
    const yFields = mappings?.yFields || [];
    if (!xField || yFields.length === 0) return [];
    if (aggregation === "none") {
      return dataRows
        .filter((row) => row && row[xField] !== undefined && row[xField] !== null)
        .map((row) => {
          const entry = { [xField]: row[xField] };
          yFields.forEach((field) => {
            entry[field] = coerceNumber(row[field]) ?? row[field];
          });
          return entry;
        });
    }
    const grouped = dataRows.reduce((acc, row) => {
      if (!row) return acc;
      const key = row[xField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(row);
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, items]) => {
      const entry = { [xField]: key };
      yFields.forEach((field) => {
        const values = items.map((item) => (item ? item[field] : null));
        entry[field] = aggregateValues(values, aggregation);
      });
      return entry;
    });
    return filterTopN(aggregated, topN, yFields[0]);
  }

  if (chartType === "heatmap") {
    const xField = mappings?.xField;
    const yField = mappings?.yField;
    if (!xField || !yField) return [];
    if (aggregation === "none") {
      return dataRows
        .filter((row) => row && row[xField] !== undefined && row[xField] !== null)
        .map((row) => {
          const y = coerceNumber(row[yField]);
          if (y === null) return null;
          return {
            [xField]: row[xField],
            [yField]: y
          };
        })
        .filter(Boolean);
    }
    const grouped = dataRows.reduce((acc, row) => {
      if (!row) return acc;
      const key = row[xField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(row[yField]);
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, values]) => ({
      [xField]: key,
      [yField]: aggregateValues(values, aggregation)
    }));
    return filterTopN(aggregated, topN, yField);
  }

  return dataRows;
};
