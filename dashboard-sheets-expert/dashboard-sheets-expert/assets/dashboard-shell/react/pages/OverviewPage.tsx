export default function OverviewPage() {
  const stats = [
    { label: "Revenue", value: "₫ 12,400,000" },
    { label: "Orders", value: "184" },
    { label: "Customers", value: "1,203" },
    { label: "Active", value: "27" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="font-medium">Welcome</div>
        <p className="mt-1 text-sm text-slate-600">
          This is a responsive admin shell. Resize the browser, or open/close the sidebar
          on a tablet width, to see the content area reflow via container queries.
        </p>
      </div>
    </div>
  );
}
