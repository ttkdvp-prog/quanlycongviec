# Sheets Streaming Pattern

True SSE / WebSockets are not supported by Apps Script Web Apps. The "stream" experience is built from disciplined incremental polling.

## Cursor

- Server keeps a global `version` counter in `_meta!A1`.
- Every row write (create/update/delete) increments the counter and stamps the row's `version` cell.
- Client tracks `lastVersion` per table in memory (and optionally `localStorage` for warm reload).

## Client hook

```ts
useSheetStream("Products", { intervalMs: 3000 })
```

Returns:

```ts
{ rows, status: "idle"|"polling"|"error", lastVersion, refetch }
```

Internals:

1. Initial `action=list` to seed `rows` and `lastVersion`.
2. `setInterval` (or `requestIdleCallback` chain) calls `action=stream&since=lastVersion`.
3. On response, merge:
   - For each returned row: if `deleted`, remove by id; else upsert by id.
   - Update `lastVersion` to `response.version`.
4. Pause when `document.hidden`. Resume on `visibilitychange`. On resume, do one immediate poll to catch up.
5. Backoff: on error, exponential 3s → 6s → 12s → 30s, reset on success.

## Conflict / merge rules

- Server is authoritative on `version`. If a local optimistic edit returns from the server with a higher `version`, keep server payload.
- If local has unsent edits and server returns a newer version for the same id, surface a non-blocking toast: "This row changed on the server. Reload to see the latest."

## Optional: long-poll variant

If you control the spreadsheet load, you can implement a 25s long-poll on the server (loop with `Utilities.sleep(1000)` checking the meta cell) to cut client requests by ~10x. Watch the 6-minute execution cap and the 30 simultaneous-execution cap. Default is the simple polling variant; switch only if the user asks for fewer requests and traffic justifies it.
