import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase, AppUser, CATEGORIES, Category, Role } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<AppUser | null>(null);

  useEffect(() => {
    if (isGuest || (user && user.role !== "admin" && user.role !== "scientist_e")) {
      navigate({ to: "/" });
    }
  }, [user, isGuest, navigate]);

  const load = async () => {
    const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    setUsers((data || []) as AppUser[]);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sign-up via auth (will send confirmation email if enabled)
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
    const { data, error } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) {
      toast.error("Auth error: " + error.message);
      return;
    }
    const uid = data.user?.id;
    if (uid) {
      await supabase.from("users").insert({
        id: uid,
        email,
        name,
        role,
        category_access: role === "manager" ? cats : [],
      });
    }
    toast.success(`User created. Temp password sent to ${email}. They should reset via password recovery.`);
    setName(""); setEmail(""); setRole("manager"); setCats([]);
    load();
  };

  const del = async (u: AppUser) => {
    if (u.role !== "manager") {
      toast.error("Only managers can be deleted from this panel.");
      return;
    }
    if (!confirm(`Delete ${u.name}?`)) return;
    await supabase.from("users").delete().eq("id", u.id);
    load();
  };

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Create New User</h2>
        <form onSubmit={create} className="grid md:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" className="rounded border bg-background px-3 py-2 text-sm" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="rounded border bg-background px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded border bg-background px-3 py-2 text-sm">
            <option value="manager">Category Manager</option>
            <option value="scientist_e">Scientist E</option>
          </select>
          {role === "manager" && (
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="inline-flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={cats.includes(c)}
                    onChange={(e) => setCats((cur) => e.target.checked ? [...cur, c] : cur.filter((x) => x !== c))}
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
          <div className="md:col-span-2">
            <button className="px-4 py-2 rounded text-white" style={{ background: "var(--brand)" }}>
              Create User
            </button>
          </div>
        </form>
      </section>

      <section className="bg-card border rounded-xl">
        <div className="p-4 border-b font-semibold">Users</div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Category Access</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <span className="px-2 py-0.5 rounded bg-secondary text-xs">{u.role}</span>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {(u.category_access || []).map((c) => (
                      <span key={c} className="px-1.5 py-0.5 text-xs rounded bg-accent">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(u)} className="text-primary text-xs hover:underline">Edit</button>
                    {u.role === "manager" && (
                      <button onClick={() => del(u)} className="text-destructive">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [cats, setCats] = useState<string[]>(user.category_access || []);
  const save = async () => {
    await supabase.from("users").update({ role, category_access: role === "manager" ? cats : [] }).eq("id", user.id);
    toast.success("User updated");
    onSaved();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Edit User</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm">{user.name} · {user.email}</div>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded border bg-background px-3 py-2 text-sm">
            <option value="manager">Category Manager</option>
            <option value="scientist_e">Scientist E</option>
            <option value="admin">Administrator</option>
          </select>
          {role === "manager" && (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="inline-flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={cats.includes(c)}
                    onChange={(e) => setCats((cur) => e.target.checked ? [...cur, c] : cur.filter((x) => x !== c))}
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 rounded text-white" style={{ background: "var(--brand)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}
