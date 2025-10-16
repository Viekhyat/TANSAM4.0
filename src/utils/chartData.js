const aggregateValues = (values, method) => {
  if (method === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (method === "avg") return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  if (method === "min") return values.length === 0 ? 0 : Math.min(...values);
  if (method === "max") return values.length === 0 ? 0 : Math.max(...values);
  return values[values.length - 1] ?? 0;
};

const filterTopN = (data, topN, valueField) => {
  if (!topN || topN <= 0 || !valueField) return data;
  const sorted = [...data].sort((a, b) => (Number(b[valueField]) || 0) - (Number(a[valueField]) || 0));
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
        .filter((row) => row[xField] !== undefined && row[xField] !== null)
        .map((row) => {
          const entry = { [xField]: row[xField] };
          yFields.forEach((field) => {
            const numeric = Number(row[field]);
            entry[field] = Number.isFinite(numeric) ? numeric : null;
          });
          return entry;
        });
    }
    const grouped = dataRows.reduce((acc, row) => {
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
        const values = items
          .map((item) => Number(item[field]))
          .filter((value) => Number.isFinite(value));
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
        const x = Number(row[xField]);
        const y = Number(row[yField]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {
          [xField]: x,
          [yField]: y,
          ...(mappings?.colorField ? { [mappings.colorField]: row[mappings.colorField] } : {})
        };
      })
      .filter(Boolean);
  }

  if (["pie", "donut"].includes(chartType)) {
    const categoryField = mappings?.categoryField;
    const valueField = mappings?.valueField;
    if (!categoryField || !valueField) return [];
    const grouped = dataRows.reduce((acc, row) => {
      const key = row[categoryField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(Number(row[valueField]));
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, values]) => ({
      [categoryField]: key,
      [valueField]: aggregateValues(
        values.filter((value) => Number.isFinite(value)),
        aggregation === "none" ? "sum" : aggregation
      )
    }));
    return filterTopN(aggregated, topN, valueField);
  }

  if (chartType === "radar") {
    const angleField = mappings?.angleField;
    const radiusField = mappings?.radiusField;
    if (!angleField || !radiusField) return [];
    if (aggregation === "none") {
      return dataRows
        .filter((row) => row[angleField] !== undefined && row[angleField] !== null)
        .map((row) => {
          const numeric = Number(row[radiusField]);
          return {
            [angleField]: row[angleField],
            [radiusField]: Number.isFinite(numeric) ? numeric : 0
          };
        });
    }
    const grouped = dataRows.reduce((acc, row) => {
      const key = row[angleField];
      if (key === undefined || key === null) return acc;
      const bucket = acc.get(key) || [];
      bucket.push(Number(row[radiusField]));
      acc.set(key, bucket);
      return acc;
    }, new Map());
    const aggregated = Array.from(grouped.entries()).map(([key, values]) => ({
      [angleField]: key,
      [radiusField]: aggregateValues(values.filter((value) => Number.isFinite(value)), aggregation)
    }));
    return filterTopN(aggregated, topN, radiusField);
  }

  return dataRows;
};
