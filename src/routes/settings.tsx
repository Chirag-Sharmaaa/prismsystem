import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isGuest, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [notif1, setNotif1] = useState(false);
  const [notif2, setNotif2] = useState(false);

  useEffect(() => {
    if (isGuest) navigate({ to: "/" });
  }, [isGuest, navigate]);

  useEffect(() => {
    const t = (localStorage.getItem("prism-theme") as "light" | "dark") || "light";
    setTheme(t);
    setNotif1(localStorage.getItem("prism-notif-report") === "true");
    setNotif2(localStorage.getItem("prism-notif-grant") === "true");
  }, []);

  useEffect(() => { setName(user?.name || ""); }, [user]);

  const setT = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem("prism-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  const saveName = async () => {
    if (!user) return;
    await supabase.from("users").update({ name }).eq("id", user.id);
    await refreshProfile();
    toast.success("Name updated");
  };

  const updatePw = async () => {
    if (pw !== pw2 || pw.length < 6) {
      toast.error("Passwords must match and be ≥6 chars");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPw(""); setPw2(""); }
  };

  const fmtRole = (r?: string) =>
    r === "admin" ? "Administrator" : r === "scientist_e" ? "Scientist E" : r === "manager" ? "Category Manager" : r || "—";

  if (!user) return <div className="p-6">Loading…</div>;

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Appearance</h2>
        <div className="inline-flex rounded-lg border overflow-hidden">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setT(t)}
              className={`px-4 py-2 text-sm capitalize ${theme === t ? "text-white" : "bg-background"}`}
              style={theme === t ? { background: "var(--brand)" } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Account</h2>
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Display Name</span>
          <div className="flex gap-2 mt-1">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded border bg-background px-3 py-2 text-sm" />
            <button onClick={saveName} className="px-3 py-2 rounded text-white text-sm" style={{ background: "var(--brand)" }}>Save</button>
          </div>
        </label>
        <div className="text-sm grid md:grid-cols-2 gap-3">
          <div><div className="text-xs text-muted-foreground">Email</div><div>{user.email}</div></div>
          <div><div className="text-xs text-muted-foreground">Role</div><div>{fmtRole(user.role)}</div></div>
        </div>
        {user.category_access && user.category_access.length > 0 && (
          <div className="text-sm">
            <div className="text-xs text-muted-foreground mb-1">Category Access</div>
            <div className="flex gap-1 flex-wrap">
              {user.category_access.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded text-xs bg-accent">{c}</span>
              ))}
            </div>
          </div>
        )}
        <div className="border-t pt-3">
          <h3 className="text-sm font-medium mb-2">Change Password</h3>
          <div className="grid md:grid-cols-2 gap-2">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="rounded border bg-background px-3 py-2 text-sm" />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className="rounded border bg-background px-3 py-2 text-sm" />
          </div>
          <button onClick={updatePw} className="mt-2 px-3 py-1.5 rounded text-white text-sm" style={{ background: "var(--brand)" }}>Update Password</button>
        </div>
      </section>

      <section className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Notifications</h2>
        <Toggle label="Notify when progress report is due" checked={notif1} onChange={(v) => { setNotif1(v); localStorage.setItem("prism-notif-report", String(v)); }} />
        <Toggle label="Notify when grant not released past expected date" checked={notif2} onChange={(v) => { setNotif2(v); localStorage.setItem("prism-notif-grant", String(v)); }} />
        <p className="text-xs text-muted-foreground">Email notifications will be available in a future update.</p>
      </section>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-2">Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">
          All project data is stored securely on ICMR servers. Contact your administrator for data requests.
        </p>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}
