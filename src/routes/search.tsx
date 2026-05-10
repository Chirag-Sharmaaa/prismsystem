import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Search as SearchIcon } from "lucide-react";
import { supabase, Project, CATEGORIES } from "@/lib/supabase";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("projects").select("*").then(({ data }) => setProjects((data || []) as Project[]));
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects.slice(0, 100);
    return projects.filter((p) => {
      const hay = [p.title, p.pi_name, p.institute, p.e_file_number, p.eoffice_number, p.file_number]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [q, projects]);

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Search Projects</h1>
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, PI, institute, e-file…"
          className="w-full pl-10 pr-3 py-2.5 rounded border border-input bg-background"
        />
      </div>
      <div className="space-y-2">
        {results.map((p) => (
          <Link key={p.id} to="/project/$id" params={{ id: p.id }} className="block p-3 border rounded hover:bg-accent">
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">
              {p.e_file_number} · {p.category} · {p.pi_name || "—"} · {p.institute || "—"}
            </div>
          </Link>
        ))}
        {results.length === 0 && <div className="text-muted-foreground text-sm">No projects found.</div>}
      </div>
    </div>
  );
}
