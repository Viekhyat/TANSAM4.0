const resolveMaxHeight = (maxHeight) => {
  if (maxHeight === undefined || maxHeight === null) return undefined;
  return typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
};

export default function DataPreviewTable({
  headers = [],
  types = [],
  rows = [],
  compact = false,
  maxHeight,
  showTypes = true,
  totalRows
}) {
  if (!headers.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        No columns detected.
      </div>
    );
  }

  const resolvedMaxHeight = resolveMaxHeight(maxHeight);
  const shownRows = rows.length;
  const total = totalRows ?? rows.length;
  const summaryText =
    shownRows === 0
      ? "No rows available."
      : shownRows >= total
      ? `Showing ${shownRows.toLocaleString()} rows.`
      : `Showing first ${shownRows.toLocaleString()} of ${total.toLocaleString()} rows.`;

  const wrapperClasses = compact
    ? "relative overflow-auto rounded-xl border border-slate-200/70 bg-white/70 transition-colors dark:border-slate-700/70 dark:bg-slate-900/40"
    : "overflow-auto rounded-xl border border-slate-200 transition-colors dark:border-slate-600";

  const tableClasses = compact
    ? "min-w-full divide-y divide-slate-200 text-left text-[11px] text-slate-600 dark:divide-slate-700 dark:text-slate-300"
    : "min-w-full divide-y divide-slate-200 text-left text-xs text-slate-600 dark:divide-slate-700 dark:text-slate-300";

  const headCellClasses = compact
    ? "sticky top-0 z-10 bg-slate-50/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm dark:bg-slate-800/70 dark:text-slate-300"
    : "sticky top-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300";

  const typeBadgeClasses = compact
    ? "inline-flex w-fit items-center rounded-full bg-slate-100/80 px-2 py-0.5 text-[9px] font-medium uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"
    : "inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-300";

  const cellClasses = compact
    ? "px-3 py-1.5 font-mono text-[10px] text-slate-700 dark:text-slate-200"
    : "px-4 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-200";

  const emptyCellClasses = compact
    ? "px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500"
    : "px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500";

  const scrollerStyle = compact ? { maxHeight: resolvedMaxHeight } : undefined;

  const tableMarkup = (
    <table className={tableClasses}>
        <thead className="bg-slate-50/95 backdrop-blur-sm dark:bg-slate-800/70">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={headCellClasses}
              >
                <div className="flex flex-col gap-1">
                  <span>{header}</span>
                  {showTypes && types[index] ? (
                    <span className={typeBadgeClasses}>
                      {types[index]}
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className={emptyCellClasses}>
                No rows available.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white dark:bg-slate-900/40" : "bg-slate-50/60 dark:bg-slate-800/50"}>
                {headers.map((header) => (
                  <td key={header} className={cellClasses}>
                    {row[header] !== null && row[header] !== undefined && row[header] !== "" ? String(row[header]) : <span className="text-slate-400 dark:text-slate-500">-</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
  );

  return (
    <div>
      <div className={wrapperClasses} style={scrollerStyle}>
        {tableMarkup}
      </div>
      {!compact ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{summaryText}</p>
      ) : null}
    </div>
  );
}
