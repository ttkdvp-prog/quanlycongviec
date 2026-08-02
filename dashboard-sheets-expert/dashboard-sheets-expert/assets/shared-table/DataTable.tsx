import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { badgeClass, formatCell, formatPrice } from "./formatters";
import { RowDetailOverlay } from "./RowDetailOverlay";

export type ColumnFormat = "text" | "price" | "date" | "datetime" | "badge" | "custom";

export type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  width?: string;
  priority?: 1 | 2 | 3;
  align?: "left" | "right" | "center";
  format?: ColumnFormat;
  currency?: string;
  clamp?: number;
  render?: (row: T) => React.ReactNode;
  editor?: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  responsive?: "scroll" | "stack" | "auto";
  pageSizes?: number[];
  defaultPageSize?: number;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T, patch: Partial<T>) => Promise<void> | void;
  onDelete?: (row: T) => Promise<void> | void;
  emptyState?: React.ReactNode;
};

function useDebouncedValue<V>(value: V, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function DataTable<T extends object>(props: DataTableProps<T>) {
  const {
    columns,
    data,
    rowKey,
    responsive = "auto",
    pageSizes = [10, 25, 50, 100],
    defaultPageSize = 25,
    onRowClick,
    onEdit,
    onDelete,
    emptyState,
  } = props;

  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [active, setActive] = useState<{ row: T; mode: "view" | "edit" } | null>(null);

  const filtered = useMemo(() => {
    if (!debounced) return data;
    const q = debounced.toLowerCase();
    return data.filter(row =>
      columns.some(c => {
        if (c.searchable === false) return false;
        const v = (row as any)[c.key];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, debounced, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a as any)[key]; const bv = (b as any)[key];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av > bv ? sign : -sign;
    });
  }, [filtered, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string, sortable: boolean | undefined) {
    if (sortable === false) return;
    setSort(s => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function confirmDelete(row: T) {
    if (!onDelete) return;
    let cancelled = false;
    const t = window.setTimeout(() => { if (!cancelled) void onDelete(row); }, 5000);
    toast("Row deleted", {
      description: "It will be removed permanently in 5s.",
      cancel: { label: "Undo", onClick: () => { cancelled = true; window.clearTimeout(t); } },
      duration: 5000,
    });
  }

  const responsiveStack = responsive === "stack";
  const tableClass = responsive === "auto"
    ? "hidden @sm/main:block"
    : responsiveStack ? "hidden" : "block";
  const stackClass = responsive === "auto"
    ? "@sm/main:hidden"
    : responsiveStack ? "block" : "hidden";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 px-3 py-3 border-b border-slate-200">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="text-xs text-slate-500 ml-auto">
          {total.toLocaleString()} rows
        </div>
      </header>

      <div className={`overflow-x-auto ${tableClass}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50 sticky top-0 z-10">
              {columns.map(c => {
                const isSorted = sort?.key === c.key;
                const Icon = !isSorted ? ChevronsUpDown : sort!.dir === "asc" ? ChevronUp : ChevronDown;
                const hideAtPriority = c.priority === 3 ? "hidden lg:table-cell" : c.priority === 2 ? "hidden md:table-cell" : "";
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${hideAtPriority}`}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      onClick={() => toggleSort(c.key, c.sortable)}
                      disabled={c.sortable === false}
                    >
                      {c.header}
                      {c.sortable !== false && <Icon size={14} />}
                    </button>
                  </th>
                );
              })}
              {(onEdit || onDelete) && <th className="w-[88px]"></th>}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-500">
                  {emptyState ?? "No rows."}
                </td>
              </tr>
            )}
            {slice.map(row => (
              <tr
                key={rowKey(row)}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => { onRowClick ? onRowClick(row) : setActive({ row, mode: "view" }); }}
              >
                {columns.map(c => {
                  const raw = (row as any)[c.key];
                  const hideAtPriority = c.priority === 3 ? "hidden lg:table-cell" : c.priority === 2 ? "hidden md:table-cell" : "";
                  let body: React.ReactNode;
                  if (c.render) body = c.render(row);
                  else if (c.format === "badge") body = <span className={badgeClass(String(raw))}>{String(raw ?? "")}</span>;
                  else if (c.format === "price") body = formatPrice(raw, c.currency);
                  else body = formatCell(c.format, raw, { currency: c.currency });
                  const align = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "";
                  const clampStyle = c.clamp ? { ["--clamp" as any]: c.clamp } : undefined;
                  return (
                    <td key={c.key} className={`px-3 py-2 align-top ${align} ${hideAtPriority}`}>
                      <div className={c.clamp ? "cell-clamp" : ""} style={clampStyle} title={typeof body === "string" ? body : undefined}>
                        {body}
                      </div>
                    </td>
                  );
                })}
                {(onEdit || onDelete) && (
                  <td className="px-2 py-2 align-top text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100" aria-label="View" onClick={() => setActive({ row, mode: "view" })}>
                      <Eye size={16} />
                    </button>
                    {onEdit && (
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100" aria-label="Edit" onClick={() => setActive({ row, mode: "edit" })}>
                        <Pencil size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-rose-50 text-rose-600" aria-label="Delete" onClick={() => confirmDelete(row)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked card view for narrow content */}
      <div className={`p-2 space-y-2 ${stackClass}`}>
        {slice.length === 0 && (
          <div className="px-3 py-8 text-center text-slate-500">{emptyState ?? "No rows."}</div>
        )}
        {slice.map(row => (
          <button
            key={rowKey(row)}
            type="button"
            className="w-full text-left rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
            onClick={() => setActive({ row, mode: "view" })}
          >
            <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
              {columns.map(c => {
                const raw = (row as any)[c.key];
                let body: React.ReactNode;
                if (c.render) body = c.render(row);
                else if (c.format === "badge") body = <span className={badgeClass(String(raw))}>{String(raw ?? "")}</span>;
                else if (c.format === "price") body = formatPrice(raw, c.currency);
                else body = formatCell(c.format, raw, { currency: c.currency });
                return (
                  <div className="contents" key={c.key}>
                    <dt className="col-span-1 text-xs uppercase tracking-wide text-slate-500">{c.header}</dt>
                    <dd className="col-span-2">
                      <div className={c.clamp ? "cell-clamp" : ""} style={c.clamp ? { ["--clamp" as any]: c.clamp } : undefined}>
                        {body}
                      </div>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </button>
        ))}
      </div>

      <footer className="flex flex-wrap items-center gap-3 px-3 py-3 border-t border-slate-200 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          Rows per page
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="rounded-md border border-slate-200 px-2 py-1"
          >
            {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-500">
            {total === 0 ? "0" : `${safePage * pageSize + 1}-${Math.min(total, (safePage + 1) * pageSize)}`} of {total}
          </span>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-slate-200 disabled:opacity-40"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >Prev</button>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-slate-200 disabled:opacity-40"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >Next</button>
        </div>
      </footer>

      {active && (
        <RowDetailOverlay
          row={active.row}
          columns={columns}
          mode={active.mode}
          onClose={() => setActive(null)}
          onSave={onEdit ? async (patch) => { await onEdit(active.row, patch); setActive(null); } : undefined}
        />
      )}
    </div>
  );
}
