# Apps Script Backend Contract

A single Apps Script Web App is the only backend. Frontend talks to it via `fetch` with JSON.

## Endpoint shape

- URL: `https://script.google.com/macros/s/<deploy-id>/exec`
- Method: `GET` for read, `POST` for write (CORS-friendly through Apps Script).
- Auth: `X-API-Key` header **or** `apiKey` field in body. Compared against `PropertiesService.getScriptProperties().getProperty("API_KEY")`.

## Request

```json
{
  "action": "list" | "get" | "create" | "update" | "delete" | "stream",
  "table": "Products",
  "id": "row-id",
  "since": 142,           // for stream / incremental
  "q": "search text",     // for list
  "sort": "price:desc",
  "offset": 0,
  "limit": 25,
  "data": { "name": "...", "price": 12000 }
}
```

## Response envelope

```json
{
  "ok": true,
  "data": [...],
  "version": 187,
  "total": 1234,
  "error": null
}
```

On error: `{ "ok": false, "error": "code: message", "data": null }` with HTTP 200 (Apps Script does not return arbitrary status codes reliably).

## Sheet conventions

Each entity is one sheet (tab) with:

- Row 1: column headers, lowercase, snake_case (`id`, `name`, `price`, `created_at`, `updated_at`, `version`, `deleted`).
- `id`: UUID generated on create.
- `version`: monotonic integer per row, bumped on every write. Used as the cursor for streaming.
- `deleted`: `TRUE` for soft-deletes; `list` filters them out by default.
- A separate hidden sheet `_meta` holds the global `lastVersion` counter.

## Streaming

Client sends `action=stream&table=Products&since=<lastVersion>`. Server returns rows where `version > since`, plus the new global version. Client merges by `id`.

Polling cadence: 3s when tab visible, 30s when hidden (use `document.visibilityState`).

## Deploy steps

1. Open the spreadsheet, Extensions → Apps Script.
2. Paste `Code.gs` and `appsscript.json`.
3. Project Settings → Script Properties → add `API_KEY` (long random) and `SPREADSHEET_ID` (current sheet id).
4. Deploy → New deployment → type "Web app" → execute as "Me", access "Anyone with the link".
5. Copy Web App URL. Paste into client `.env` as `VITE_APPS_SCRIPT_URL`.
6. Add `VITE_API_KEY` (matching `API_KEY`) to `.env`.

## Quotas to design around

- 6 min execution per request → keep handlers fast, avoid full-sheet scans for stream.
- 20k UrlFetch/day in free tier (only matters if Apps Script itself fans out).
- 100MB response cap → enforce `limit` <= 500 server-side.
