import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ChevronDown, Search as SearchIcon, X } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { supabase, CATEGORIES, Category, Project, YearlyStatus } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "PRISM Dashboard — ICMR" },
      { name: "description", content: "PRISM dashboard for ICMR project monitoring." },
    ],
  }),
});

const COLORS = ["#1E3A5F", "#2E75B6", "#16A34A", "#D97706", "#DC2626"];

function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [yearly, setYearly] = useState<YearlyStatus[]>([]);
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState<Category[]>([]);
  const [filterState, setFilterState] = useState<string>("");
  const [filterGrant, setFilterGrant] = useState<string>("");
  const [filterReport, setFilterReport] = useState<string>("");
  const [drilldown, setDrilldown] = useState<{ title: string; ids: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: y }] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("project_yearly_status").select("*"),
      ]);
      setProjects((p || []) as Project[]);
      setYearly((y || []) as YearlyStatus[]);
    })();
  }, []);

  const yearlyByProject = useMemo(() => {
    const m = new Map<string, YearlyStatus[]>();
    yearly.forEach((y) => {
      const arr = m.get(y.project_id) || [];
      arr.push(y);
      m.set(y.project_id, arr);
    });
    return m;
  }, [yearly]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { total: projects.length };
    CATEGORIES.forEach((c) => (counts[c] = 0));
    projects.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    let actionRequired = 0;
    const actionIds: string[] = [];
    projects.forEach((p) => {
      const ys = yearlyByProject.get(p.id) || [];
      const need = ys.some(
        (y) =>
          y.grant_released === false ||
          y.report_status === "Due" ||
          y.report_status === "Received - Not Reviewed",
      );
      if (need) {
        actionRequired++;
        actionIds.push(p.id);
      }
    });
    counts.action = actionRequired;
    return { counts, actionIds };
  }, [projects, yearlyByProject]);

  const donutData = CATEGORIES.map((c) => ({ name: c, value: stats.counts[c] || 0 })).filter(
    (d) => d.value > 0,
  );

  const grantData = CATEGORIES.map((c) => {
    const ps = projects.filter((p) => p.category === c);
    let released = 0;
    let pending = 0;
    ps.forEach((p) => {
      const ys = yearlyByProject.get(p.id) || [];
      ys.forEach((y) => {
        if (y.grant_released) released++;
        else pending++;
      });
    });
    return { name: c, Released: released, Pending: pending };
  });

  const reportData = (() => {
    const counts = { Due: 0, "Received - Not Reviewed": 0, "Received - Reviewed": 0 };
    yearly.forEach((y) => {
      if (y.report_status && y.report_status in counts) {
        (counts as any)[y.report_status]++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const filteredResults = useMemo(() => {
    if (!search.trim() && filterCats.length === 0 && !filterState && !filterGrant && !filterReport)
      return [];
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (filterCats.length && !filterCats.includes(p.category)) return false;
        if (filterState && p.project_state !== filterState) return false;
        if (q) {
          const hay = [
            p.title,
            p.pi_name,
            p.institute,
            p.e_file_number,
            p.eoffice_number,
            p.file_number,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filterGrant || filterReport) {
          const ys = yearlyByProject.get(p.id) || [];
          if (filterGrant === "released" && !ys.some((y) => y.grant_released)) return false;
          if (filterGrant === "pending" && !ys.some((y) => !y.grant_released)) return false;
          if (filterReport && !ys.some((y) => y.report_status === filterReport)) return false;
        }
        return true;
      })
      .slice(0, 50);
  }, [search, filterCats, filterState, filterGrant, filterReport, projects, yearlyByProject]);

  const openDrill = (title: string, ids: string[]) => setDrilldown({ title, ids });

  return (
    <div>
      {/* HERO */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,33,55,0.75), rgba(15,33,55,0.75)), url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1800')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="text-center px-4">
          <h1
            className="font-extrabold tracking-tight"
            style={{ fontSize: "clamp(4rem, 12vw, 9rem)", textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
          >
            PRISM
          </h1>
          <div className="mx-auto my-4 h-[3px] w-32" style={{ background: "#2E75B6" }} />
          <p className="text-xl md:text-2xl font-light">
            Project Records & Integrated Status Manager
          </p>
          <p className="mt-2 text-sm opacity-80">
            Indian Council of Medical Research — Research Administration Platform
          </p>
        </div>
        <a
          href="#dashboard"
          className="absolute bottom-8 animate-bounce"
          aria-label="Scroll down"
        >
          <ChevronDown size={36} />
        </a>
      </section>

      {/* TICKER */}
      <div
        className="overflow-hidden whitespace-nowrap py-2"
        style={{ background: "#2E75B6", color: "#fff" }}
      >
        <div className="ticker-track inline-block">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="inline-block px-4 text-sm">
              Grant Monitoring • Progress Tracking • Document Management • ADHOC Projects • IG Projects •
              SG Projects • CAR Projects • NHRP Projects • ICMR Research Administration • Status Tracking
              • Report Management •&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      <section id="dashboard" className="px-6 py-8 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">PRISM Dashboard</h2>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard
            label="Total Projects"
            value={stats.counts.total}
            onClick={() => openDrill("All Projects", projects.map((p) => p.id))}
          />
          {CATEGORIES.map((c) => (
            <StatCard
              key={c}
              label={c}
              value={stats.counts[c] || 0}
              onClick={() =>
                openDrill(`${c} Projects`, projects.filter((p) => p.category === c).map((p) => p.id))
              }
            />
          ))}
          <StatCard
            label="Action Required"
            value={stats.counts.action}
            danger
            onClick={() => openDrill("Action Required", stats.actionIds)}
          />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <ChartCard title="Projects by Category">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={100}
                  label
                  onClick={(d: any) =>
                    openDrill(
                      `${d.name} Projects`,
                      projects.filter((p) => p.category === d.name).map((p) => p.id),
                    )
                  }
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Grant Released vs Pending">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={grantData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Released" fill="#16A34A" />
                <Bar dataKey="Pending" fill="#D97706" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Report Status Overview">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={reportData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2E75B6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Universal search */}
        <div className="mt-8 bg-card rounded-xl border p-5">
          <h3 className="text-lg font-semibold mb-3">Universal Search</h3>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, PI, institute, e-file, e-office, file number…"
              className="w-full pl-10 pr-3 py-2.5 rounded-md border border-input bg-background"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={filterCats.includes(c)}
                onClick={() =>
                  setFilterCats((cur) =>
                    cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
                  )
                }
              >
                {c}
              </FilterChip>
            ))}
            <SelectChip
              value={filterState}
              onChange={setFilterState}
              options={["", "Active", "Suspended", "Under Review", "Closed", "Completed"]}
              placeholder="Project State"
            />
            <SelectChip
              value={filterGrant}
              onChange={setFilterGrant}
              options={["", "released", "pending"]}
              placeholder="Grant"
            />
            <SelectChip
              value={filterReport}
              onChange={setFilterReport}
              options={["", "Due", "Received - Not Reviewed", "Received - Reviewed"]}
              placeholder="Report"
            />
          </div>

          {filteredResults.length > 0 && (
            <div className="mt-4 grid gap-2">
              {filteredResults.map((p) => (
                <Link
                  key={p.id}
                  to="/project/$id"
                  params={{ id: p.id }}
                  className="block p-3 border border-border rounded hover:bg-accent transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.e_file_number} · {p.pi_name || "—"} · {p.institute || "—"}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge>{p.category}</Badge>
                      {p.project_state && <Badge>{p.project_state}</Badge>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          projects={projects.filter((p) => drilldown.ids.includes(p.id))}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
  danger,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-card rounded-xl border p-4 hover:shadow-md transition"
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="text-2xl font-bold mt-1"
        style={{ color: danger ? "#DC2626" : "var(--brand)" }}
      >
        {value}
      </div>
    </button>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function SelectChip({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 rounded-full text-xs border border-border bg-background"
    >
      <option value="">{placeholder}</option>
      {options.filter(Boolean).map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 text-xs rounded bg-secondary text-secondary-foreground">
      {children}
    </span>
  );
}

function DrilldownModal({
  title,
  projects,
  onClose,
}: {
  title: string;
  projects: Project[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title} ({projects.length})</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {projects.length === 0 && (
            <div className="text-center text-muted-foreground py-6">No projects.</div>
          )}
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/project/$id"
              params={{ id: p.id }}
              onClick={onClose}
              className="block p-3 border rounded hover:bg-accent"
            >
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground">
                {p.e_file_number} · {p.category} · {p.pi_name || "—"}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
