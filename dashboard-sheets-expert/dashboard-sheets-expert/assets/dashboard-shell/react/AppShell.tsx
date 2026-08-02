import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Menu, LayoutDashboard, Package, Users, Settings } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      <aside className="hidden md:flex md:w-16 lg:w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="h-14 flex items-center px-4 font-semibold tracking-tight">
          <span className="lg:inline hidden">Dashboard</span>
          <span className="lg:hidden inline">D</span>
        </div>
        <nav className="flex-1 px-2 py-2 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition
                 ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              <item.icon size={18} />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="h-14 flex items-center px-4 font-semibold border-b">Dashboard</div>
            <nav className="flex-1 px-2 py-2 space-y-1">
              {NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm
                     ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center px-3 md:px-6 gap-3">
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-slate-100"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="font-medium">Admin</div>
          <div className="ml-auto text-sm text-slate-500">v0.1</div>
        </header>
        <section className="flex-1 overflow-auto p-4 md:p-6 @container/main">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
