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
  const [tab, setTab] = useState<"template" | "upload">("upload");
  const [rows, setRows] = useState<any[]>([]);
  const [sheetCount, setSheetCount] = useState(0);
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
      "S.No.","File No.","E-Office No.","IRIS-ID","PI Name","Title","Institute","Department",
      "PI Mail","PI Contact No.","Date of start","Date of end","Duration",
      "Total Amount of Grant (in lac INR)","TotalAmount Released",
      "1st Year Grant","1st year grant released",
      "2nd Year Grant","2nd year grant released",
      "3rd Year Grant","3rd year grant released",
      "Co-PI","Broad Subject Area","Remarks","Current Status","Outcomes/ Publications","State","City",
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
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const allJson: any[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
        allJson.push(...json);
      }
      const mapped = allJson.map((row) => mapRow(row, category)).filter(Boolean) as any[];
      setSheetCount(wb.SheetNames.length);
      setRows(mapped);
      if (mapped.length === 0) toast.error("No valid project rows detected in file.");
    } catch (e: any) {
      toast.error("Failed to read file: " + (e?.message || "unknown error"));
    }
  };

  const seenInFile = new Set<string>();
  const validatedRows = rows.map((r) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    if (!r.title && !r.pi_name) issues.push("Missing title and PI");
    else if (!r.title) issues.push("Missing title");
    else if (!r.pi_name) issues.push("Missing PI");
    if (!r.start_date) warnings.push("Date unparseable");
    const dup = seenInFile.has(r.e_file_number);
    if (dup) issues.push("Duplicate in file");
    else seenInFile.add(r.e_file_number);
    const inDb = existingEFiles.has(r.e_file_number);
    if (inDb) issues.push("Already exists");
    const invalid = issues.length > 0;
    return { ...r, _issues: issues, _warnings: warnings, _invalid: invalid, _skip: invalid };
  });

  const validCount = validatedRows.filter((r) => !r._skip).length;

  const doImport = async () => {
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    for (const r of validatedRows) {
      if (r._skip) { skipped++; continue; }
      const { _issues, _warnings, _invalid, _skip, _yearly, _fyBudgets, ...projData } = r;
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
    toast.success(`${imported} imported. ${skipped} skipped.`);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Import {category} Projects</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex border-b">
          <button
            onClick={() => setTab("upload")}
            className={`px-4 py-2 text-sm ${tab === "upload" ? "border-b-2 border-primary font-semibold" : ""}`}
          >
            Upload File
          </button>
          <button
            onClick={() => setTab("template")}
            className={`px-4 py-2 text-sm ${tab === "template" ? "border-b-2 border-primary font-semibold" : ""}`}
          >
            Download Template
          </button>
        </div>
        <div className="p-4">
          {tab === "template" && (
            <div>
              <p className="text-sm mb-3">
                Download the CSV template, fill it in, and upload it. Extra columns are ignored.
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
                  <div className="text-sm mb-3 font-medium">
                    {rows.length} projects found across {sheetCount} sheet{sheetCount !== 1 ? "s" : ""} ·{" "}
                    <span className="text-green-700 dark:text-green-400">{validCount} valid</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">Preview (first 5 rows)</div>
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-1.5 text-left">S.No / File No.</th>
                          <th className="p-1.5 text-left">PI Name</th>
                          <th className="p-1.5 text-left">Project Title</th>
                          <th className="p-1.5 text-left">Start Date</th>
                          <th className="p-1.5 text-left">Duration</th>
                          <th className="p-1.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validatedRows.slice(0, 5).map((r, i) => (
                          <tr
                            key={i}
                            className={`border-t ${
                              r._invalid
                                ? "bg-red-50 dark:bg-red-950/30"
                                : r._warnings.length
                                ? "bg-yellow-50 dark:bg-yellow-950/30"
                                : ""
                            }`}
                          >
                            <td className="p-1.5">{r.serial_number || r.file_number || r.e_file_number || "—"}</td>
                            <td className="p-1.5">{r.pi_name || "—"}</td>
                            <td className="p-1.5 max-w-xs truncate">{r.title || "—"}</td>
                            <td className="p-1.5">{r.start_date || "—"}</td>
                            <td className="p-1.5">{r.duration_years ? `${r.duration_years} yr` : "—"}</td>
                            <td className="p-1.5">
                              {r._invalid ? (
                                <span className="text-red-700 dark:text-red-400">{r._issues.join(", ")}</span>
                              ) : r._warnings.length ? (
                                <span className="text-yellow-700 dark:text-yellow-400">{r._warnings.join(", ")}</span>
                              ) : (
                                <span className="text-green-700 dark:text-green-400">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={doImport}
                    disabled={importing || validCount === 0}
                    className="mt-4 px-5 py-2.5 rounded text-white font-medium disabled:opacity-50"
                    style={{ background: "#2E75B6" }}
                  >
                    {importing ? "Importing…" : `Confirm Import (${validCount})`}
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

// ---------- column helpers ----------
function normKey(k: string) {
  return k.toLowerCase().replace(/[\s._\-/]+/g, "");
}

function makeGetter(row: any) {
  const map: Record<string, any> = {};
  Object.keys(row).forEach((k) => {
    map[normKey(k)] = row[k];
  });
  return {
    get: (...keys: string[]) => {
      for (const k of keys) {
        const v = map[normKey(k)];
        if (v != null && v !== "") return v;
      }
      return null;
    },
    findKey: (regex: RegExp): string | null => {
      // search original keys
      for (const orig of Object.keys(row)) {
        if (regex.test(orig)) {
          const v = row[orig];
          if (v != null && v !== "") return orig;
        }
      }
      return null;
    },
    raw: row,
  };
}

function getYearAmount(row: any, year: number, kind: "sanctioned" | "released"): any {
  // year 1..5; match patterns like "1st Year Grant" / "1st year (Sanctioned)" / "1st year grant released" / "1st year (Released)"
  const ords = ["1st", "2nd", "3rd", "4th", "5th"];
  const ord = ords[year - 1];
  const yearRx = new RegExp(`(^|[^0-9])${year}\\s*(st|nd|rd|th)?`, "i");
  for (const orig of Object.keys(row)) {
    const k = orig.toLowerCase();
    if (!yearRx.test(k) && !k.includes(ord)) continue;
    if (!k.includes("year") && !k.includes("yr")) continue;
    if (kind === "sanctioned") {
      if (k.includes("released") || k.includes("release")) continue;
      if (k.includes("sanction") || k.includes("grant") || k.includes("(sanctioned)")) {
        const v = row[orig];
        if (v != null && v !== "") return v;
      }
    } else {
      if (k.includes("released") || k.includes("release") || k.includes("(released)")) {
        const v = row[orig];
        if (v != null && v !== "") return v;
      }
    }
  }
  return null;
}

function isLacHeader(row: any, ...keys: string[]): boolean {
  for (const orig of Object.keys(row)) {
    const k = orig.toLowerCase();
    for (const want of keys) {
      if (normKey(orig) === normKey(want) && (k.includes("lac") || k.includes("lakh"))) return true;
    }
  }
  return false;
}

// Map any-style spreadsheet row to project + yearly + fy budgets
function mapRow(row: any, category: Category): any | null {
  const { get } = makeGetter(row);

  const title = String(get("Project Title", "Title") || "").trim();
  const pi = String(get("PI Name", "PI/Guide Name", "pi_name") || "").trim();
  if (!title && !pi) return null;

  const serial = parseNumber(get("S.No.", "S.No", "S No", "serial_number"));
  const fileNo = get("File No.", "File.no.", "File No", "file_number");
  const eoffice = get("E-Office No.", "e-Office No.", "E-Office No", "eoffice_number");
  const efile =
    String(eoffice || fileNo || `${category}-${serial ?? Math.floor(Math.random() * 100000)}`);

  const startDate = parseFlexDate(get("Date of start", "Date of Start", "start_date"));
  const completionDate = parseFlexDate(get("Date of end", "Date of completion", "date_of_completion"));
  const durationRaw = get("Duration", "duration_years");
  const duration = parseDurationYears(durationRaw) || 3;

  // total: support lac multiplier
  const totalRaw = get("Total budget", "Total Amount of Grant (in lac INR)", "TotalAmount", "total_sanctioned_amount");
  let total = parseMultiNumber(totalRaw);
  if (total != null && isLacHeader(row, "Total Amount of Grant (in lac INR)")) total = total * 100000;

  const totalReleasedRaw = get("TotalAmount Released", "Total Amount Released", "total_amount_released");
  const totalReleased = parseMultiNumber(totalReleasedRaw);

  const instituteAddr = get("Institute Address", "institute_address");
  const institute = get("Institute", "Institute/Department") || instituteAddr;
  const city = get("City");

  const proj: any = {
    title,
    pi_name: pi,
    category,
    e_file_number: efile,
    serial_number: serial,
    file_number: fileNo ? String(fileNo) : null,
    eoffice_number: eoffice ? String(eoffice) : null,
    iris_id: get("IRIS-ID", "IRIS ID/EPMS ID", "Iris-ID", "IRIS_ID", "iris_id"),
    contact_number: get("PI Contact no.", "Contact No.", "PI Contact No", "contact_number"),
    email_id: get("PI mail", "e-mail ID", "PI Mail", "email_id"),
    start_date: startDate,
    date_of_completion: completionDate,
    duration_years: duration,
    institute_address: instituteAddr || (city ? String(city) : null),
    institute,
    state: get("State"),
    total_sanctioned_amount: total,
    current_status_note: get("Current status", "Current Status", "current_status_note"),
    outcomes_publications: get("Outcomes/ Publications", "Outcomes/Publications", "outcomes_publications"),
    description: get("description"),
    project_state: "Active" as const,
    co_pi: get("Co-PI", "co_pi"),
    department: get("Department", "department"),
    broad_subject_area: get("Broad Subject Area", "broad_subject_area"),
    remarks: get("Remarks", "remarks"),
    total_amount_released: totalReleased,
  };

  // yearly rows
  const yearlyRows: any[] = [];
  for (let i = 1; i <= Math.max(duration, 1); i++) {
    const sancRaw = getYearAmount(row, i, "sanctioned");
    const relRaw = getYearAmount(row, i, "released");
    const sanctioned = parseMultiNumber(sancRaw);
    let released = false;
    let amountReleased: number | null = null;
    const numRel = parseMultiNumber(relRaw);
    if (numRel != null && numRel > 0) {
      released = true;
      amountReleased = numRel;
    } else if (relRaw != null && relRaw !== "") {
      released = parseBool(relRaw);
    }
    const yrow: any = {
      year_number: i,
      sanctioned_amount: sanctioned,
      amount_released: amountReleased,
      grant_released: released,
      report_status: "Due",
      uc_submitted: false,
      extension_requested: false,
    };
    if (i === 1) {
      yrow.hold_amount = parseMultiNumber(get("10 % Hold Amount", "10% hold amount"));
      yrow.hold_amount_released = parseBool(
        get("10 % Hold Amount Released", "10% hold amount released"),
      );
    }
    yearlyRows.push(yrow);
  }

  const fyBudgets: any[] = [];
  const req = parseMultiNumber(get("2025-2026 Required Budget", "2025-2026 required budget"));
  const rel = parseMultiNumber(get("2025-2026 Released Budget", "2025-2026 released budget"));
  if (req != null || rel != null) {
    fyBudgets.push({ financial_year: "2025-2026", required_budget: req, released_budget: rel });
  }

  return { ...proj, _yearly: yearlyRows, _fyBudgets: fyBudgets };
}
