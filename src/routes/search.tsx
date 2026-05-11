import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Search as SearchIcon } from "lucide-react";
import { supabase, Project } from "@/lib/supabase";
import { StateBadge } from "./category.$slug";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

function SearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.from("projects").select("*").then(({ data }) => setProjects((data || []) as Project[]));
  }, []);

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return projects.slice(0, 100);
    return projects.filter((p) => {
      const hay = [
        p.title, p.pi_name, p.institute, p.e_file_number,
        p.eoffice_number, p.file_number, p.iris_id,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [query, projects]);

  const runSearch = () => setQuery(input);

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Search Projects</h1>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="Search by title, PI, institute, e-file, IRIS-ID…"
            className="w-full pl-10 pr-3 py-2.5 rounded border border-input bg-background"
          />
        </div>
        <button
          onClick={runSearch}
          className="px-5 py-2.5 rounded text-white font-medium"
          style={{ background: "#2E75B6" }}
        >
          Search
        </button>
      </div>
      <div className="space-y-3">
        {results.map((p) => (
          <Link
            key={p.id}
            to="/project/$id"
            params={{ id: p.id }}
            className="block p-4 border rounded-lg hover:bg-accent bg-card"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-1 space-x-2">
                  {p.file_number && <span>File No.: <span className="text-foreground">{p.file_number}</span></span>}
                  {p.eoffice_number && <span>· e-Office No.: <span className="text-foreground">{p.eoffice_number}</span></span>}
                </div>
                <div className="text-sm mt-1.5">
                  <span className="text-muted-foreground">PI:</span> {p.pi_name || "—"}
                  <span className="text-muted-foreground ml-3">Institute:</span> {p.institute || "—"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ background: "var(--brand)" }}
                >
                  {p.category}
                </span>
                <StateBadge state={p.project_state || "Active"} />
              </div>
            </div>
          </Link>
        ))}
        {results.length === 0 && <div className="text-muted-foreground text-sm">No projects found.</div>}
      </div>
    </div>
  );
}
