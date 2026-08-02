# Dashboard + Google Sheets Starter

Responsive admin dashboard scaffolded by the `$dashboard-sheets-expert` skill.
Frontend = React + Vite + Tailwind. Backend = Google Apps Script Web App on a Google Sheet.

## What you get

- Responsive shell: sidebar (desktop), icon rail (tablet), drawer (phone), sticky topbar.
- Container-query content area: cards/tables reflow inside the content scope, not just the viewport.
- Shared `<DataTable>`: sort, search (debounced), pagination, price/date/badge formatters,
  multi-line truncation with title tooltip, sticky header, mobile stacked-card mode.
- Detail/edit slide-over with focus trap and ESC close.
- Optimistic delete with 5-second `Undo` toast (sonner).
- Streaming hook `useSheetStream` that polls only changed rows by `version` cursor.
- Apps Script `Code.gs`: list / get / create / update / delete / stream + soft-delete + cursor.

## Setup

### 1. Backend (Google Sheet)

1. Create a Google Sheet. Add a tab `Products` with headers in row 1:
   `id, name, description, price, stock, status, created_at, updated_at, version, deleted`.
2. Extensions → Apps Script. Replace `Code.gs` with the file from `assets/apps-script/Code.gs`,
   replace `appsscript.json` with the manifest.
3. Project Settings → Script Properties:
   - `API_KEY` = a long random string (will go into the client `.env`).
   - `SPREADSHEET_ID` = the spreadsheet id (optional; defaults to the bound sheet).
4. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone with the link**.
5. Copy the Web App URL.

### 2. Frontend

```sh
pnpm install
cp .env.example .env
# edit .env with VITE_APPS_SCRIPT_URL and VITE_API_KEY
pnpm dev
```

Open http://localhost:5173 and visit `/products`.

## Add a new entity

1. Add a new tab in the spreadsheet with the same baseline columns plus your fields.
2. Copy `pages/ProductsPage.tsx` to `pages/<Entity>Page.tsx`. Adjust `columns` and the `Entity` type.
3. Add a route in `main.tsx`. Add a nav item in `AppShell.tsx`.
4. Done. The shared `<DataTable>` and `useSheetStream` work without changes.

## Notes

- The client never talks to Google Sheets directly. Apps Script is the only API surface.
- The API key lives in `Script Properties` server-side and `.env` client-side.
  Treat it like a session secret; rotate by regenerating both values.
- For larger datasets (>5k rows) switch `<DataTable>` to a `fetcher` (server-side mode)
  and pass `q/sort/offset/limit` through to `api.list`. The shared component already
  accepts a fetcher prop for this.
