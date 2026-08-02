---
name: dashboard-sheets-expert
description: "Expert agent profile for building responsive admin dashboards backed by Google Sheets through Apps Script. Auto-load this skill when the user asks to build a web dashboard, admin panel, CRUD UI, data table, sortable/searchable/paginated list, detail/edit overlay or drawer, delete-confirm toast, format pricing or currency cells, multi-line truncation in table cells, responsive layout for phone and desktop, mobile-friendly sidebar, stream live rows from a Google Sheet, or use Google Apps Script (doGet/doPost web app, JSONP, SSE-style polling) as the backend for a frontend app."
---

# Dashboard + Sheets Expert

Use this skill whenever the user wants to build a dashboard-style web app where:

- Layout is a responsive admin shell (sidebar/topbar/content) that adapts from desktop to phone.
- The main content area itself is responsive and scrollable independently from the shell.
- A reusable table component drives most data views (list, search, sort, paginate, format, edit, delete, view detail).
- The backend is Google Sheets accessed through Google Apps Script (a `doGet`/`doPost` web app) and rows can stream/refresh live into the table.

The agent must produce a working baseline, not a description. Always emit code, wired together, with copy-ready files. Prefer the assets in `assets/` over re-typing large blocks.

## Auto-load triggers

Treat any of these signals as "load this skill":

- "dashboard", "admin panel", "admin layout", "sidebar layout", "responsive dashboard"
- "shared table", "data table component", "reusable table", "CRUD table"
- "sort table", "search table", "pagination", "view detail overlay/drawer/modal", "edit row in overlay"
- "format price", "currency formatting", "truncate text in cell", "multi-line ellipsis", "line-clamp"
- "toast confirm delete", "confirm delete dialog"
- "Google Sheet as backend", "Apps Script backend", "doGet doPost", "stream from Google Sheet", "live data from sheet"
- Explicit invocation: `$dashboard-sheets-expert`

## Operating principles

1. **Mobile-first, two-axis responsive.** The shell adapts (sidebar collapses to a drawer on phones, topbar stays sticky). The main content uses container queries / fluid grids so widgets reflow inside the content scope, independent of the viewport.
2. **One shared `<DataTable>` is the contract.** Every list view in the app must use it. Per-view config (columns, formatters, actions, fetcher) is passed in as props. No bespoke tables.
3. **Sheets is the database, Apps Script is the API.** The frontend never touches Sheets directly. It calls a single Apps Script Web App endpoint with `action=list|get|create|update|delete|stream`. Auth is by shared secret in the request body or `Authorization` header (Apps Script can read it from `e.postData.contents`).
4. **Streaming is polling done well.** True SSE is not available in Apps Script free tier. Implement "stream" as cursor-based incremental polling: client sends `since=<rowVersion>`; server returns only rows changed after that version. Frontend merges with optimistic in-memory state.
5. **Optimistic UI + toast confirm.** Mutations update local cache immediately, show a toast with Undo for destructive actions, then reconcile with the server response.
6. **Accessibility is non-negotiable.** Every interactive element has a label, focus ring, and keyboard path. The overlay (detail/edit) traps focus and restores it on close. Toasts use `role="status"` (or `role="alert"` for destructive).

## Default tech choices

Pick these unless the project already commits to something else:

- **Framework:** Vite + React + TypeScript. (Plain HTML/JS variant lives in `assets/dashboard-shell/vanilla/` for no-build Apps Script-hosted UIs.)
- **Styling:** Tailwind CSS + CSS variables for theming. Container queries (`@container`) for in-content responsiveness.
- **State:** TanStack Query for fetch/cache/streaming, Zustand for UI state (overlay open, selection).
- **Icons:** lucide-react.
- **Toasts:** sonner (or a 60-line custom one if "no extra deps" is requested).
- **Apps Script:** single `Code.gs` web app deployed as "Anyone with the link", auth via `X-API-Key` shared secret stored in Script Properties.

## Deliverables checklist

A finished dashboard from this skill must include:

- [ ] App shell: `Sidebar`, `Topbar`, `Content`, `MobileDrawer`, route outlet.
- [ ] Responsive at two scopes: viewport (≤640px collapses sidebar to drawer) and content (`@container` reflow for cards/grids inside the content area).
- [ ] Shared `DataTable<T>` with: column defs, per-column formatter, sortable headers, debounced search, server or client pagination, row click → detail overlay, action menu (view/edit/delete), price/currency formatter, multi-line truncate (line-clamp) with tooltip on overflow, sticky header, horizontal scroll on narrow screens with priority columns kept visible.
- [ ] Detail/edit overlay (slide-over on desktop, full-screen sheet on phone) with focus trap and ESC/backdrop close.
- [ ] Delete flow: optimistic remove + sonner toast with Undo (5s) before committing to Apps Script.
- [ ] Apps Script `Code.gs`: `doGet` for `list/get/stream`, `doPost` for `create/update/delete`, row-version cursor, API key check, JSON envelope `{ok, data, error, version}`.
- [ ] `apiClient.ts` with typed methods and `useSheetStream(table, opts)` hook that returns merged rows + status.
- [ ] One example resource ("Products") wired end-to-end so the user can copy and clone it for the next entity.
- [ ] README block in the generated project explaining: deploy Apps Script, set Script Properties (`API_KEY`, `SPREADSHEET_ID`), paste Web App URL into `.env`, run `pnpm dev`.

## Workflow

1. **Scope check.** Confirm or infer: framework (default React+Vite+TS), CSS approach (default Tailwind), entity name(s), and Apps Script deploy target (new vs existing spreadsheet ID).
2. **Scaffold.** Drop `assets/dashboard-shell/` into the target repo. Wire routes for `/`, `/:resource`.
3. **Drop the table.** Copy `assets/shared-table/DataTable.tsx` and its sub-files. Build one `<ProductsPage>` that uses it as the canonical example.
4. **Drop the backend.** Copy `assets/apps-script/Code.gs` into a new Apps Script project bound to the spreadsheet. Set Script Properties. Deploy as Web App. Capture URL.
5. **Wire the client.** Fill `.env` with `VITE_APPS_SCRIPT_URL` and `VITE_API_KEY`. Implement `apiClient.ts` and `useSheetStream`.
6. **Verify.** Run dev server. Check: list loads, search filters, sort toggles, pagination works, detail overlay opens, edit saves and re-renders, delete shows toast and reconciles, mobile drawer opens, content area reflows under 480px container width.
7. **Document.** Update the project README block with deploy steps and the column→sheet mapping.

## When user asks for a feature already in the table

Do not rebuild. Extend `DataTable` props or add a new column type. The component is the single source of truth.

## References

Open only what the current task needs:

- `references/responsive-layout.md` — sidebar+content shell, container queries, breakpoints.
- `references/shared-table-spec.md` — column model, formatters, sort/search/paginate, overlay.
- `references/apps-script-backend.md` — `Code.gs` contract, auth, row-version cursor, streaming.
- `references/sheets-streaming.md` — incremental polling pattern, conflict resolution, offline merge.
- `references/ux-patterns.md` — overlay, toast, confirm, optimistic update.

## Asset map

- `assets/dashboard-shell/react/` — React+TS shell (App, Sidebar, Topbar, MobileDrawer, Content).
- `assets/dashboard-shell/vanilla/` — single-file HTML/CSS/JS shell for Apps Script-hosted UIs.
- `assets/shared-table/` — `DataTable.tsx`, `columns.ts`, `formatters.ts`, `useTableState.ts`, `RowDetailOverlay.tsx`, `ConfirmDeleteToast.tsx`.
- `assets/apps-script/Code.gs` — full backend with list/get/create/update/delete + cursor stream.
- `assets/apps-script/appsscript.json` — manifest with required scopes.

## Hard rules

- Never write Sheets API calls in the frontend. Always go through Apps Script.
- Never put the API key in client source. Use `import.meta.env.VITE_API_KEY` and document it as a deploy-time secret.
- Never produce a "skeleton with TODOs" version. The example resource (`Products`) must work end-to-end on first run.
- Never use fixed pixel widths for the main content. Use `min-w-0` + `flex-1` + container queries so it reflows inside its scope.
