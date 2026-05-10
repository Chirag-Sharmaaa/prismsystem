import { Outlet, useRouterState, Link, useNavigate } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { GuestBanner, Footer } from "./Shell";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isGuest, loading } = useAuth();
  const navigate = useNavigate();

  // Auth gate: only /login allows unauthenticated and non-guest
  useEffect(() => {
    if (loading) return;
    if (path === "/login") return;
    if (!user && !isGuest) {
      navigate({ to: "/login" });
    }
  }, [user, isGuest, loading, path, navigate]);

  if (path === "/login") {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading PRISM…</div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Link to="/login" className="text-primary underline">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <GuestBanner />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
