# Shared Table Spec

## Column model

```ts
export type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;          // default true
  searchable?: boolean;        // default true if string
  width?: string;              // CSS, e.g. "minmax(120px, 1fr)"
  priority?: 1 | 2 | 3;        // 1 = always visible, 3 = hide first on narrow
  align?: "left" | "right" | "center";
  format?: "text" | "price" | "date" | "datetime" | "badge" | "custom";
  currency?: string;           // for format="price", default "VND"
  clamp?: number;              // line-clamp for long text
  render?: (row: T) => React.ReactNode; // overrides format
};
```

## Formatters (built-in)

- `price`: `Intl.NumberFormat(locale, { style: "currency", currency })` with VND default and `maximumFractionDigits: 0` for VND.
- `date` / `datetime`: `Intl.DateTimeFormat` with locale-aware short forms.
- `badge`: pill with semantic color from a `tone` map (`success | warning | danger | neutral`).
- `text` with `clamp`: CSS line-clamp + `title` tooltip when overflowing.

```css
.cell-clamp {
  display: -webkit-box;
  -webkit-line-clamp: var(--clamp, 2);
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
```

## Behaviors

- **Sort**: click header toggles `asc → desc → none`. Multi-column with shift-click (optional flag `multiSort`).
- **Search**: top-right input, 250ms debounce, filters across all `searchable` columns. Server mode sends `q` to Apps Script.
- **Pagination**: page size selector `[10, 25, 50, 100]`, prev/next, jump-to. Server mode uses `offset/limit`.
- **Row click**: opens `RowDetailOverlay` with read mode by default; "Edit" button toggles to form mode.
- **Actions column**: per-row dropdown (View, Edit, Delete). Delete triggers `ConfirmDeleteToast` (sonner) with 5s Undo.
- **Selection** (optional): checkbox column, bulk action bar appears when count > 0.

## Props contract

```ts
type DataTableProps<T> = {
  columns: Column<T>[];
  data?: T[];                          // client mode
  fetcher?: (q: QueryArgs) => Promise<Page<T>>; // server mode
  stream?: { table: string; intervalMs?: number }; // sheet streaming
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T, patch: Partial<T>) => Promise<void>;
  onDelete?: (row: T) => Promise<void>;
  responsive?: "scroll" | "stack" | "auto";
  emptyState?: React.ReactNode;
};
```

## Overlay (detail / edit)

- Slide-over panel, width `min(560px, 100vw)` on desktop.
- Full-screen sheet under `@sm/main` (container query, not viewport).
- Focus trap; ESC closes; backdrop click closes only in read mode.
- Form auto-generates from columns when `onEdit` is provided; per-column `editor` prop overrides.
- Save uses optimistic update; on failure, revert and show error toast.

## Delete confirm via toast (no modal)

Pattern (sonner):

```ts
toast("Delete this row?", {
  description: row.name,
  action: { label: "Delete", onClick: () => commitDelete(row) },
  cancel: { label: "Undo", onClick: () => {} },
  duration: 5000,
});
```

Optimistic: remove from local list immediately, schedule commit after 5s; if Undo clicked, restore. This is friendlier than a blocking dialog and matches Gmail-style UX.
