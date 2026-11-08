import React from 'react';

export function renderReadOnlyWizardTable(
  columns: Array<{ key: string; label: string; className?: string }>,
  rows: Array<{ key: string; cells: React.ReactNode[] }>,
  emptyMessage: string,
) {
  if (rows.length === 0) {
    return <div className="text-xs text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-auto border border-slate-200 rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.className ?? 'px-2 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500'}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50">
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${index}`} className="px-2 py-1.5 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
