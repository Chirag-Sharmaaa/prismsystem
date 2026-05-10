import { Link, useRouterState } from "@tanstack/react-router";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  FolderKanban,
  Search,
  Shield,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/supabase";

export function Sidebar() {
  const { user, isGuest, signOut } = useAuth();
  const router = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("prism-sidebar-collapsed");
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (saved !== null) setCollapsed(saved === "true");
    else setCollapsed(isMobile);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("prism-sidebar-collapsed", String(!c));
      return !c;
    });
  };

  const isActive = (p: string) => router === p || router.startsWith(p + "/");
  const showAdmin = user && (user.role === "admin" || user.role === "scientist_e");

  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ...CATEGORIES.map((c) => ({
      to: `/category/${c.toLowerCase()}`,
      label: c,
      icon: FolderKanban,
      exact: false,
    })),
    { to: "/search", label: "Search", icon: Search, exact: true },
    ...(showAdmin ? [{ to: "/admin", label: "Admin", icon: Shield, exact: true }] : []),
    { to: "/settings", label: "Settings", icon: Settings, exact: true },
  ];

  return (
    <aside
      className="shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-250 flex flex-col"
      style={{
        width: collapsed ? 60 : 240,
        background: "var(--brand)",
        color: "var(--brand-foreground)",
        transitionDuration: "250ms",
      }}
    >
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        {!collapsed && (
          <div className="font-bold text-xl tracking-wide">PRISM</div>
        )}
        <button
          onClick={toggle}
          className="p-1.5 rounded hover:bg-white/10 transition"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.exact ? router === it.to : isActive(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded text-sm transition ${
                active ? "bg-white/15 font-semibold" : "hover:bg-white/10"
              }`}
              title={collapsed ? it.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user ? (
          <>
            {!collapsed && (
              <div className="mb-2 text-xs">
                <div className="font-medium truncate">{user.name}</div>
                <div className="opacity-70 capitalize">{user.role.replace("_", " ")}</div>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/10 text-sm"
              title="Logout"
            >
              <LogOut size={16} />
              {!collapsed && <span>Logout</span>}
            </button>
          </>
        ) : isGuest ? (
          <>
            {!collapsed && <div className="mb-2 text-xs opacity-80">Guest mode</div>}
            <Link
              to="/login"
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/10 text-sm"
              title="Login"
            >
              <LogIn size={16} />
              {!collapsed && <span>Login</span>}
            </Link>
          </>
        ) : null}
      </div>
    </aside>
  );
}
