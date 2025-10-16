export default function DataPreviewTable({ headers = [], types = [], rows = [] }) {
  if (!headers.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        No columns detected.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 transition-colors dark:border-slate-600 max-h-full">
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-600 dark:divide-slate-700 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"
              >
                <div className="flex flex-col gap-1">
                  <span>{header}</span>
                  {types[index] ? (
                    <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
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
              <td colSpan={headers.length} className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No rows available.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white dark:bg-slate-900/40" : "bg-slate-50/60 dark:bg-slate-800/50"}>
                {headers.map((header) => (
                  <td key={header} className="px-4 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-200">
                    {row[header] !== null && row[header] !== undefined && row[header] !== "" ? String(row[header]) : <span className="text-slate-400 dark:text-slate-500">-</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
