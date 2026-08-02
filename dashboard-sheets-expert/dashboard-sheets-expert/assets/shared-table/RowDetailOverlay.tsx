import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Column } from "./DataTable";
import { formatCell } from "./formatters";

type Props<T> = {
  row: T;
  columns: Column<T>[];
  mode: "view" | "edit";
  onClose: () => void;
  onSave?: (patch: Partial<T>) => Promise<void>;
};

export function RowDetailOverlay<T extends object>({ row, columns, mode: initialMode, onClose, onSave }: Props<T>) {
  const [mode, setMode] = useState(initialMode);
  const [draft, setDraft] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<HTMLButtonElement>(null);

  useEffect(() => { firstFocus.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mode === "edit" && Object.keys(draft).length > 0) {
          if (!confirm("Discard unsaved changes?")) return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, draft, onClose]);

  function set<K extends keyof T>(k: K, v: T[K]) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try { await onSave(draft); }
    finally { setSaving(false); }
  }

  const merged = { ...(row as any), ...(draft as any) } as T;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => mode === "view" && onClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 w-full sm:w-[min(560px,100vw)] bg-white shadow-2xl flex flex-col"
      >
        <header className="h-14 flex items-center px-4 border-b border-slate-200 gap-3">
          <h2 className="font-semibold">{mode === "edit" ? "Edit row" : "Row detail"}</h2>
          <div className="ml-auto flex items-center gap-1">
            {mode === "view" && onSave && (
              <button
                ref={firstFocus}
                type="button"
                className="px-3 py-1.5 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => setMode("edit")}
              >Edit</button>
            )}
            <button type="button" aria-label="Close" className="w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-slate-100" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
          {columns.map(c => {
            const value = (merged as any)[c.key];
            if (mode === "view" || c.key === "id" || c.key === "version") {
              return (
                <div key={c.key} className="grid grid-cols-3 gap-3 items-start">
                  <div className="text-xs uppercase tracking-wide text-slate-500 pt-1">{c.header}</div>
                  <div className="col-span-2 text-sm">
                    {c.render ? c.render(merged) : formatCell(c.format, value, { currency: c.currency }) || <span className="text-slate-400">—</span>}
                  </div>
                </div>
              );
            }
            if (c.editor) {
              return (
                <div key={c.key} className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-500">{c.header}</label>
                  {c.editor(merged, (patch) => setDraft(d => ({ ...d, ...patch })))}
                </div>
              );
            }
            const inputType = c.format === "price" || c.key === "stock" ? "number" : c.format === "date" ? "date" : "text";
            return (
              <label key={c.key} className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">{c.header}</span>
                <input
                  type={inputType}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={value ?? ""}
                  onChange={e => set(c.key as keyof T, (inputType === "number" ? Number(e.target.value) : e.target.value) as any)}
                />
              </label>
            );
          })}
        </div>

        {mode === "edit" && (
          <footer className="border-t border-slate-200 px-4 py-3 flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 rounded-md text-sm hover:bg-slate-100" onClick={() => setMode("view")} disabled={saving}>Cancel</button>
            <button
              type="button"
              className="ml-auto px-3 py-1.5 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={handleSave}
              disabled={saving || Object.keys(draft).length === 0}
            >{saving ? "Saving..." : "Save"}</button>
          </footer>
        )}
      </div>
    </div>
  );
}
