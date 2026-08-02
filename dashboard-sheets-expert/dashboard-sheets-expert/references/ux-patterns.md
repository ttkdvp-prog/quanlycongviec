# UX Patterns

## Detail / edit overlay

- Right-anchored slide-over on >= 640px content width; bottom sheet under that.
- Header: title, close (X), action buttons (Edit / Save / Cancel).
- Body: scrollable, padded, label-on-top form fields.
- Footer: sticky on mobile, inline on desktop.
- Focus: on open, focus the first interactive element. On close, restore focus to the row's action trigger.
- ESC closes (in read mode) or prompts unsaved-changes (in edit mode with dirty form).

## Confirm-delete via toast (preferred)

Avoid modal dialogs for single-row delete. Use a 5s "Undo" toast with optimistic local removal. Modal is reserved for bulk delete (>= 5 rows) and irreversible actions.

```ts
function handleDelete(row) {
  const snapshot = rows;
  setRows(rs => rs.filter(r => r.id !== row.id));
  const t = setTimeout(() => api.delete(row.id).catch(() => setRows(snapshot)), 5000);
  toast("Deleted " + row.name, {
    cancel: { label: "Undo", onClick: () => { clearTimeout(t); setRows(snapshot); } },
    duration: 5000,
  });
}
```

## Optimistic update on edit

1. Capture `before = row`.
2. Apply patch to local state immediately, close overlay.
3. Call `api.update(id, patch)`.
4. On success, replace with server response (authoritative `version`).
5. On failure, revert to `before`, reopen overlay with error banner.

## Toast taxonomy

- `success` — green, 3s, dismissible.
- `info` — neutral, 4s.
- `warning` — amber, 6s.
- `error` — red, sticky until dismissed.
- `action` (delete/undo) — neutral, 5s, with `cancel` button.

## Empty / loading / error states

- Loading: skeleton rows in the table (3-5), not a centered spinner.
- Empty: friendly illustration + primary CTA ("Add first product").
- Error: inline banner above the table with `Retry`. Do not unmount the table.

## Keyboard

- `/` focuses the search input.
- `n` opens the create overlay (when allowed).
- Arrow up/down navigates rows when the table has focus; Enter opens detail.
- ESC closes overlay or clears search if overlay is closed.
