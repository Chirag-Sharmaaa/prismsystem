import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, enterGuest } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Signed in");
      // Wait for the session to be persisted before navigating so the
      // AppLayout auth gate doesn't bounce us back to /login.
      await supabase.auth.getSession();
      if (typeof window !== "undefined") {
        window.location.assign("/");
      } else {
        navigate({ to: "/" });
      }
    }
  };

  const guest = () => {
    enterGuest();
    navigate({ to: "/" });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #2E75B6 100%)" }}
    >
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold tracking-tight" style={{ color: "var(--brand)" }}>
            PRISM
          </h1>
          <p className="mt-2 text-sm font-medium text-foreground">
            Project Records & Integrated Status Manager
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ICMR Research Administration
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@icmr.in"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            disabled={loading}
            className="w-full py-2.5 rounded-md text-white font-medium disabled:opacity-60"
            style={{ background: "var(--brand)" }}
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={guest}
            className="text-sm text-primary hover:underline"
          >
            Continue as Guest →
          </button>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
