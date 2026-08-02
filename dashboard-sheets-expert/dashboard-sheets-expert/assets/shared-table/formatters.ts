export type Format = "text" | "price" | "date" | "datetime" | "badge" | "custom";

const BADGE_TONE: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  draft:    "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  archived: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  success:  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  warning:  "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  danger:   "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  neutral:  "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function formatPrice(value: unknown, currency = "VND", locale = "vi-VN") {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  const opts: Intl.NumberFormatOptions = { style: "currency", currency };
  if (currency === "VND" || currency === "JPY") opts.maximumFractionDigits = 0;
  return new Intl.NumberFormat(locale, opts).format(n);
}

export function formatDate(value: unknown, withTime = false, locale = "vi-VN") {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
  }).format(d);
}

export function badgeClass(tone: string) {
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_TONE[tone] ?? BADGE_TONE.neutral}`;
}

export function formatCell(format: Format | undefined, raw: unknown, opts: { currency?: string } = {}) {
  switch (format) {
    case "price":    return formatPrice(raw, opts.currency);
    case "date":     return formatDate(raw, false);
    case "datetime": return formatDate(raw, true);
    default:         return raw == null ? "" : String(raw);
  }
}
