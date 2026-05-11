import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Upload, X, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  supabase,
  Category,
  CATEGORIES,
  Project,
  YearlyStatus,
} from "@/lib/supabase";
import { useAuth, can } from "@/lib/auth";
import {
  parseFlexDate,
  parseNumber,
  parseBool,
  parseDurationYears,
  parseMultiNumber,
} from "@/lib/format";
import { logHistory } from "@/lib/history";

export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const category = slug.toUpperCase() as Category;
  const { user, isGuest } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [yearly, setYearly] = useState<YearlyStatus[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState<{ kind: string; value: string }[]>([]);

  useEffect(() => {
    if (!CATEGORIES.includes(category)) {
      navigate({ to: "/" });
    }
  }, [category, navigate]);

  const load = async () => {
    const { data: p } = await supabase
      .from("projects")
      .select("*")
      .eq("category", category)
      .order("serial_number", { ascending: true, nullsFirst: false });
    const ids = (p || []).map((x: any) => x.id);
    let y: YearlyStatus[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("project_yearly_status")
        .select("*")
        .in("project_id", ids);
      y = (data || []) as YearlyStatus[];
    }
    setProjects((p || []) as Project[]);
    setYearly(y);
  };

  useEffect(() => {
    if (CATEGORIES.includes(category)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const yearlyByProject = useMemo(() => {
    const m = new Map<string, YearlyStatus[]>();
    yearly.forEach((y) => {
      const a = m.get(y.project_id) || [];
      a.push(y);
      m.set(y.project_id, a);
    });
    return m;
  }, [yearly]);

  const stats = useMemo(() => {
    let released = 0,
      pending = 0,
      due = 0,
      notReviewed = 0,
      reviewed = 0;
    yearly.forEach((y) => {
      if (y.grant_released) released++;
      else pending++;
      if (y.report_status === "Due") due++;
      else if (y.report_status === "Received - Not Reviewed") notReviewed++;
      else if (y.report_status === "Received - Reviewed") reviewed++;
    });
    return { total: projects.length, released, pending, due, notReviewed, reviewed };
  }, [yearly, projects]);

  const grantByYear = useMemo(() => {
    const map = new Map<number, { Released: number; Pending: number }>();
    yearly.forEach((y) => {
      const r = map.get(y.year_number) || { Released: 0, Pending: 0 };
      if (y.grant_released) r.Released++;
      else r.Pending++;
      map.set(y.year_number, r);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([yr, v]) => ({ name: `Yr ${yr}`, ...v }));
  }, [yearly]);

  const reportByYear = useMemo(() => {
    const map = new Map<number, any>();
    yearly.forEach((y) => {
      const r = map.get(y.year_number) || { Due: 0, "Not Reviewed": 0, Reviewed: 0 };
      if (y.report_status === "Due") r.Due++;
      else if (y.report_status === "Received - Not Reviewed") r["Not Reviewed"]++;
      else if (y.report_status === "Received - Reviewed") r.Reviewed++;
      map.set(y.year_number, r);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([yr, v]) => ({ name: `Yr ${yr}`, ...v }));
  }, [yearly]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const ys = yearlyByProject.get(p.id) || [];
      for (const f of filters) {
        if (f.kind === "grant" && f.value === "released" && !ys.some((y) => y.grant_released))
          return false;
        if (f.kind === "grant" && f.value === "pending" && !ys.some((y) => !y.grant_released))
          return false;
        if (f.kind === "report" && !ys.some((y) => y.report_status === f.value)) return false;
      }
      return true;
    });
  }, [projects, yearlyByProject, filters]);

  const addFilter = (kind: string, value: string) => {
    setFilters((cur) => {
      if (cur.some((f) => f.kind === kind && f.value === value)) return cur;
      return [...cur, { kind, value }];
    });
  };

  const canImport = can(user, isGuest, "import", category);

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{category} Projects</h1>
          <p className="text-sm text-muted-foreground">{stats.total} projects in this category</p>
        </div>
        {canImport && (
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded text-white"
            style={{ background: "var(--brand)" }}
          >
            <Upload size={16} /> Import Projects
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Total" value={stats.total} />
        <Stat
          label="Grant Released"
          value={stats.released}
          color="#16A34A"
          onClick={() => addFilter("grant", "released")}
        />
        <Stat
          label="Grant Pending"
          value={stats.pending}
          color="#D97706"
          onClick={() => addFilter("grant", "pending")}
        />
        <Stat
          label="Reports Due"
          value={stats.due}
          color="#DC2626"
          onClick={() => addFilter("report", "Due")}
        />
        <Stat
          label="Not Reviewed"
          value={stats.notReviewed}
          color="#2E75B6"
          onClick={() => addFilter("report", "Received - Not Reviewed")}
        />
        <Stat
          label="Reviewed"
          value={stats.reviewed}
          color="#16A34A"
          onClick={() => addFilter("report", "Received - Reviewed")}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Grant Status by Year</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={grantByYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Released" fill="#16A34A" />
              <Bar dataKey="Pending" fill="#D97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Report Status by Year</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={reportByYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Due" fill="#DC2626" />
              <Bar dataKey="Not Reviewed" fill="#D97706" />
              <Bar dataKey="Reviewed" fill="#16A34A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {filters.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary text-primary-foreground"
            >
              {f.kind}: {f.value}
              <button onClick={() => setFilters((c) => c.filter((_, idx) => idx !== i))}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button onClick={() => setFilters([])} className="text-xs text-muted-foreground underline">
            Clear all
          </button>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">S.No</th>
              <th className="p-2">File No.</th>
              <th className="p-2">e-Office No.</th>
              <th className="p-2">Project Title</th>
              <th className="p-2">PI Name</th>
              <th className="p-2">Institute</th>
              <th className="p-2">State</th>
              <th className="p-2">Project State</th>
              <th className="p-2">Grant</th>
              <th className="p-2">Report</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  No projects found.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const ys = yearlyByProject.get(p.id) || [];
              const released = ys.filter((y) => y.grant_released).length;
              const due = ys.filter((y) => y.report_status === "Due").length;
              return (
                <tr key={p.id} className="border-t hover:bg-accent/40">
                  <td className="p-2">{p.serial_number || "—"}</td>
                  <td className="p-2">{p.file_number || "—"}</td>
                  <td className="p-2">{p.eoffice_number || "—"}</td>
                  <td className="p-2">
                    <Link
                      to="/project/$id"
                      params={{ id: p.id }}
                      className="text-primary hover:underline font-medium"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="p-2">{p.pi_name || "—"}</td>
                  <td className="p-2">{p.institute || "—"}</td>
                  <td className="p-2">{p.state || "—"}</td>
                  <td className="p-2">
                    <StateBadge state={p.project_state || "Active"} />
                  </td>
                  <td className="p-2 text-xs">
                    {released}/{ys.length} released
                  </td>
                  <td className="p-2 text-xs">{due > 0 ? `${due} due` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {importOpen && (
        <ImportModal
          category={category}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-card rounded-xl border p-4 hover:shadow transition"
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: color || "var(--brand)" }}>
        {value}
      </div>
    </button>
  );
}

export function StateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    Active: "#16A34A",
    Suspended: "#D97706",
    "Under Review": "#2E75B6",
    Closed: "#DC2626",
    Completed: "#6B7280",
  };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ background: colors[state] || "#6B7280" }}
    >
      {state}
    </span>
  );
}

function ImportModal({
  category,
  onClose,
  onDone,
}: {
  category: Category;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"template" | "upload">("template");
  const [rows, setRows] = useState<any[]>([]);
  const [existingEFiles, setExistingEFiles] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    supabase
      .from("projects")
      .select("e_file_number")
      .then(({ data }) => {
        setExistingEFiles(new Set((data || []).map((r: any) => r.e_file_number)));
      });
  }, []);

  const downloadTemplate = () => {
    const headers = [
      "title",
      "e_file_number",
      "pi_name",
      "institute",
      "start_date",
      "duration_years",
      "total_sanctioned_amount",
      "description",
    ];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${category}_template.csv`;
    a.click();
  };

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    const mapped = json.map((row) => mapRow(row, category)).filter(Boolean) as any[];
    setRows(mapped);
  };

  const seenInFile = new Set<string>();
  const validatedRows = rows.map((r) => {
    const issues: string[] = [];
    if (!r.title) issues.push("Missing title");
    if (!r.pi_name) issues.push("Missing PI");
    const dup = seenInFile.has(r.e_file_number);
    if (dup) issues.push("Duplicate in file");
    else seenInFile.add(r.e_file_number);
    const inDb = existingEFiles.has(r.e_file_number);
    if (inDb) issues.push("Already exists in DB");
    return { ...r, _issues: issues, _skip: issues.includes("Already exists in DB") || dup };
  });

  const doImport = async () => {
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    for (const r of validatedRows) {
      if (r._skip || !r.title || !r.pi_name) {
        skipped++;
        continue;
      }
      const { _issues, _skip, _yearly, _fyBudgets, ...projData } = r;
      const { data: inserted, error } = await supabase
        .from("projects")
        .insert({ ...projData, created_by: user?.id || null })
        .select()
        .single();
      if (error || !inserted) {
        console.error(error);
        skipped++;
        continue;
      }
      const yearly = (_yearly as any[]).map((y) => ({ ...y, project_id: inserted.id }));
      if (yearly.length) await supabase.from("project_yearly_status").insert(yearly);
      const fy = (_fyBudgets as any[]).map((y) => ({ ...y, project_id: inserted.id }));
      if (fy.length) await supabase.from("project_fy_budget").insert(fy);
      await logHistory({
        projectId: inserted.id,
        field: "project_created",
        newValue: "Imported via Excel",
        userId: user?.id || null,
        userName: user?.name || null,
      });
      imported++;
    }
    setImporting(false);
    toast.success(`${imported} projects imported. ${skipped} skipped.`);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Import {category} Projects</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex border-b">
          <button
            onClick={() => setTab("template")}
            className={`px-4 py-2 text-sm ${tab === "template" ? "border-b-2 border-primary font-semibold" : ""}`}
          >
            Download Template
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`px-4 py-2 text-sm ${tab === "upload" ? "border-b-2 border-primary font-semibold" : ""}`}
          >
            Upload File
          </button>
        </div>
        <div className="p-4">
          {tab === "template" && (
            <div>
              <p className="text-sm mb-3">
                Download the CSV template, fill it in, and upload it. Extra columns will be ignored.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-2 rounded text-white"
                style={{ background: "var(--brand)" }}
              >
                <Download size={16} /> Download {category} Template
              </button>
            </div>
          )}
          {tab === "upload" && (
            <div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="text-sm"
              />
              {rows.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm mb-2">{rows.length} projects found in file</div>
                  <div className="border rounded overflow-x-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-1.5 text-left">e-File</th>
                          <th className="p-1.5 text-left">Title</th>
                          <th className="p-1.5 text-left">PI</th>
                          <th className="p-1.5 text-left">Institute</th>
                          <th className="p-1.5 text-left">Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validatedRows.slice(0, 50).map((r, i) => (
                          <tr
                            key={i}
                            className={`border-t ${
                              r._skip
                                ? "bg-red-50 dark:bg-red-950/30"
                                : r._issues.length
                                ? "bg-yellow-50 dark:bg-yellow-950/30"
                                : ""
                            }`}
                          >
                            <td className="p-1.5">{r.e_file_number}</td>
                            <td className="p-1.5">{r.title || "—"}</td>
                            <td className="p-1.5">{r.pi_name || "—"}</td>
                            <td className="p-1.5">{r.institute || "—"}</td>
                            <td className="p-1.5 text-red-700 dark:text-red-400">
                              {r._issues.join(", ") || "OK"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={doImport}
                    disabled={importing}
                    className="mt-4 px-4 py-2 rounded text-white disabled:opacity-50"
                    style={{ background: "var(--brand)" }}
                  >
                    {importing ? "Importing…" : "Confirm Import"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Map ADHOC-style spreadsheet row to project + yearly + fy budgets
function mapRow(row: any, category: Category): any | null {
  // case-insensitive lookup
  const lc: Record<string, any> = {};
  Object.keys(row).forEach((k) => {
    lc[k.toLowerCase().trim()] = row[k];
  });
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = lc[k.toLowerCase().trim()];
      if (v != null && v !== "") return v;
    }
    return null;
  };

  const title = String(get("project title", "title") || "").trim();
  const pi = String(get("pi name", "pi_name") || "").trim();
  if (!title && !pi) return null;

  const serial = parseNumber(get("s.no", "s no", "serial_number"));
  const fileNo = get("file no.", "file no", "file_number");
  const eoffice = get("e-office no.", "e-office no", "eoffice_number");
  const efile =
    get("e_file_number") ||
    eoffice ||
    fileNo ||
    `${category}-${serial ?? Math.floor(Math.random() * 10000)}`;

  const startDate = parseFlexDate(get("date of start", "start_date"));
  const completionDate = parseFlexDate(get("date of completion", "date_of_completion"));
  const duration = parseDurationYears(get("duration", "duration_years")) || 3;
  const total = parseNumber(get("total budget", "total_sanctioned_amount"));
  const instituteAddr = get("institute address", "institute_address");
  const institute = get("institute") || instituteAddr;

  const proj = {
    title,
    pi_name: pi,
    category,
    e_file_number: String(efile),
    serial_number: serial,
    file_number: fileNo ? String(fileNo) : null,
    eoffice_number: eoffice ? String(eoffice) : null,
    iris_id: get("iris id/epms id", "iris_id"),
    contact_number: get("contact no.", "contact_number"),
    email_id: get("e-mail id", "email", "email_id"),
    start_date: startDate,
    date_of_completion: completionDate,
    duration_years: duration,
    institute_address: instituteAddr,
    institute,
    state: get("state"),
    total_sanctioned_amount: total,
    current_status_note: get("current status", "current_status_note"),
    outcomes_publications: get("outcomes/ publications", "outcomes/publications", "outcomes_publications"),
    description: get("description"),
    project_state: "Active" as const,
  };

  // yearly rows
  const yearlyRows: any[] = [];
  const yrLabels: [string, string, number][] = [
    ["1st year grant", "1st year grant released", 1],
    ["2nd year grant", "2nd year grant released", 2],
    ["3rd year grant", "3rd year grant released", 3],
  ];
  for (let i = 1; i <= duration; i++) {
    const lbl = yrLabels.find((l) => l[2] === i);
    let sanctioned: number | null = null;
    let released: boolean = false;
    let amountReleased: number | null = null;
    if (lbl) {
      sanctioned = parseNumber(get(lbl[0]));
      const relVal = get(lbl[1]);
      const numRel = parseNumber(relVal);
      if (numRel != null && numRel > 0) {
        released = true;
        amountReleased = numRel;
      } else {
        released = parseBool(relVal);
      }
    }
    const row: any = {
      year_number: i,
      sanctioned_amount: sanctioned,
      amount_released: amountReleased,
      grant_released: released,
      report_status: "Due",
      uc_submitted: false,
      extension_requested: false,
    };
    if (i === 1) {
      row.hold_amount = parseNumber(get("10 % hold amount", "10% hold amount"));
      row.hold_amount_released = parseBool(get("10 % hold amount released", "10% hold amount released"));
    }
    yearlyRows.push(row);
  }

  const fyBudgets: any[] = [];
  const req = parseNumber(get("2025-2026 required budget"));
  const rel = parseNumber(get("2025-2026 released budget"));
  if (req != null || rel != null) {
    fyBudgets.push({ financial_year: "2025-2026", required_budget: req, released_budget: rel });
  }

  return { ...proj, _yearly: yearlyRows, _fyBudgets: fyBudgets };
}
