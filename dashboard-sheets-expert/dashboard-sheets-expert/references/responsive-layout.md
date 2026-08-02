# Responsive Layout — Two Scopes

## Scope A: viewport-level shell

Breakpoints (Tailwind defaults):

- `< 640px` (sm): sidebar hidden, replaced by hamburger drawer; topbar sticky.
- `640–1024px`: sidebar collapses to icon rail (64px).
- `>= 1024px`: full sidebar (240px) + content.

```tsx
<div className="flex h-dvh w-full overflow-hidden">
  <Sidebar className="hidden md:flex md:w-16 lg:w-60 shrink-0" />
  <MobileDrawer className="md:hidden" />
  <main className="flex-1 min-w-0 flex flex-col">
    <Topbar className="sticky top-0 z-20" />
    <section className="flex-1 overflow-auto p-4 @container/main">
      {children}
    </section>
  </main>
</div>
```

Critical: `min-w-0` on the main column so flex children can shrink. Without it, wide tables push the layout.

## Scope B: in-content responsiveness

Use container queries on the content section so widgets reflow based on the available content width, not the viewport. This matters when the sidebar is open vs closed.

```css
@container/main (max-width: 480px) {
  .stat-grid { grid-template-columns: 1fr; }
  .table-card { padding: 0.5rem; }
}
@container/main (min-width: 481px) and (max-width: 900px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
@container/main (min-width: 901px) {
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}
```

Tailwind v3.4+: enable `@tailwindcss/container-queries` plugin and use `@md/main:grid-cols-2` syntax.

## Table on small screens

Two strategies, pick per project:

1. **Horizontal scroll with priority columns frozen.** Wrap table in `overflow-x-auto`, set `position: sticky; left: 0` on the priority column (e.g., name).
2. **Stacked cards under `@sm/main`.** Each row renders as a card with label/value pairs; reuse the same column definitions.

`DataTable` supports both via the `responsive` prop: `"scroll" | "stack" | "auto"`.

## Safe-area + dvh

Use `h-dvh` (dynamic viewport) instead of `h-screen` so iOS Safari address bar collapse does not clip the layout. Add `env(safe-area-inset-bottom)` padding on bottom-anchored toasts.
