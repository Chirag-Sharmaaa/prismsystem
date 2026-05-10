import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function GuestBanner() {
  const { isGuest } = useAuth();
  if (!isGuest) return null;
  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm text-white"
      style={{ background: "var(--brand-light)" }}
    >
      <span>Browsing as Guest — Read Only Access. Log in to make changes.</span>
      <Link
        to="/login"
        className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 font-medium"
      >
        Login
      </Link>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="text-center text-xs text-muted-foreground py-3">
        © 2026 Chirag · ICMR Research Administration · PRISM
      </div>
    </footer>
  );
}
