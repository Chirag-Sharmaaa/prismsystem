import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit2, Save, Trash2, Upload, FileText, Clock, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  Project,
  YearlyStatus,
  FYBudget,
  StatusHistoryRow,
  CommentRow,
  DocumentRow,
  ReportStatus,
  ProjectState,
} from "@/lib/supabase";
import { useAuth, can } from "@/lib/auth";
import { formatINR, formatDate, fyForYearNumber, isReportOverdue, currentFinancialYear } from "@/lib/format";
import { logHistory } from "@/lib/history";
import { StateBadge } from "./category.$slug";

export const Route = createFileRoute("/project/$id")({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const { user, isGuest } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [yearly, setYearly] = useState<YearlyStatus[]>([]);
  const [fyBudgets, setFyBudgets] = useState<FYBudget[]>([]);
  const [history, setHistory] = useState<StatusHistoryRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [newComment, setNewComment] = useState("");

  const loadAll = async () => {
    const [{ data: p }, { data: y }, { data: fy }, { data: h }, { data: c }, { data: d }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_yearly_status").select("*").eq("project_id", id).order("year_number"),
      supabase.from("project_fy_budget").select("*").eq("project_id", id),
      supabase.from("status_history").select("*").eq("project_id", id).order("timestamp", { ascending: false }),
      supabase.from("comments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("project_id", id).order("uploaded_at", { ascending: false }),
    ]);
    setProject(p as Project | null);
    setYearly((y || []) as YearlyStatus[]);
    setFyBudgets((fy || []) as FYBudget[]);
    setHistory((h || []) as StatusHistoryRow[]);
    setComments((c || []) as CommentRow[]);
    setDocs((d || []) as DocumentRow[]);
    if (p) {
      setStatusNote((p as Project).current_status_note || "");
      setOutcomes((p as Project).outcomes_publications || "");
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!project) {
    return <div className="p-6 text-muted-foreground">Loading project…</div>;
  }

  const editAllowed = can(user, isGuest, "edit", project.category);
  const commentAllowed = can(user, isGuest, "comment", project.category);
  const deleteCommentAllowed = can(user, isGuest, "delete_comment", project.category);
  const uploadAllowed = can(user, isGuest, "upload", project.category);
  const deleteDocAllowed = can(user, isGuest, "delete_doc", project.category);

  const totalReleased = yearly.reduce((s, y) => s + (Number(y.amount_released) || 0), 0);
  const holdAmount = yearly.reduce((s, y) => s + (Number(y.hold_amount) || 0), 0);
  const holdReleased = yearly.some((y) => y.hold_amount_released);
  const fy2526 = fyBudgets.find((f) => f.financial_year === "2025-2026");
  const required2526 = Number(fy2526?.required_budget || 0);
  const released2526 = Number(fy2526?.released_budget || 0);
  const balance = (Number(project.total_sanctioned_amount) || 0) - totalReleased;

  const updateYearlyField = async (
    row: YearlyStatus,
    field: keyof YearlyStatus,
    value: any,
  ) => {
    if (!editAllowed) {
      toast.error("Guests cannot make changes. Please log in.");
      return;
    }
    const old = (row as any)[field];
    await supabase.from("project_yearly_status").update({ [field]: value }).eq("id", row.id);
    await logHistory({
      projectId: row.project_id,
      yearNumber: row.year_number,
      field: String(field),
      oldValue: old,
      newValue: value,
      userId: user?.id || null,
      userName: user?.name || null,
    });
    loadAll();
  };

  const saveStatusNote = async () => {
    if (!editAllowed) return;
    await supabase.from("projects").update({ current_status_note: statusNote }).eq("id", id);
    await logHistory({
      projectId: id,
      field: "current_status_note",
      oldValue: project.current_status_note,
      newValue: statusNote,
      userId: user?.id || null,
      userName: user?.name || null,
    });
    toast.success("Status note saved");
    loadAll();
  };

  const saveOutcomes = async () => {
    if (!editAllowed) return;
    await supabase.from("projects").update({ outcomes_publications: outcomes }).eq("id", id);
    await logHistory({
      projectId: id,
      field: "outcomes_publications",
      oldValue: project.outcomes_publications,
      newValue: outcomes,
      userId: user?.id || null,
      userName: user?.name || null,
    });
    toast.success("Outcomes saved");
    loadAll();
  };

  const addComment = async () => {
    if (!commentAllowed || !newComment.trim()) return;
    await supabase.from("comments").insert({
      project_id: id,
      content: newComment.trim(),
      author_id: user?.id || null,
      author_name: user?.name || null,
    });
    setNewComment("");
    loadAll();
  };

  const delComment = async (cid: string) => {
    if (!deleteCommentAllowed) return;
    await supabase.from("comments").delete().eq("id", cid);
    loadAll();
  };

  const uploadFile = async (file: File) => {
    if (!uploadAllowed) return;
    const path = `${id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("prism-documents").upload(path, file);
    if (error) {
      toast.error("Upload failed: " + error.message + " — ensure 'prism-documents' bucket exists.");
      return;
    }
    const { data } = supabase.storage.from("prism-documents").getPublicUrl(path);
    await supabase.from("documents").insert({
      project_id: id,
      filename: file.name,
      file_url: data.publicUrl,
      file_size: `${(file.size / 1024).toFixed(1)} KB`,
      uploaded_by: user?.id || null,
      uploaded_by_name: user?.name || null,
    });
    toast.success("Uploaded");
    loadAll();
  };

  const delDoc = async (d: DocumentRow) => {
    if (!deleteDocAllowed) return;
    await supabase.from("documents").delete().eq("id", d.id);
    loadAll();
  };

  const currentFY = currentFinancialYear();

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "var(--brand-light)", color: "#fff" }}>
                {project.category}
              </span>
              <StateBadge state={project.project_state || "Active"} />
              <span className="text-sm text-muted-foreground">
                e-File: <span className="font-medium text-foreground">{project.e_file_number}</span>
              </span>
            </div>
          </div>
          {editAllowed && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-accent"
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <Section title="Project Details">
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Detail k="Serial Number" v={project.serial_number} />
          <Detail k="File Number" v={project.file_number} />
          <Detail k="e-Office Number" v={project.eoffice_number} />
          <Detail k="IRIS ID/EPMS ID" v={project.iris_id} />
          <Detail k="PI Name" v={project.pi_name} />
          <Detail k="Contact Number" v={project.contact_number} />
          <Detail k="Email ID" v={project.email_id ? <a href={`mailto:${project.email_id}`} className="text-primary hover:underline">{project.email_id}</a> : null} />
          <Detail k="Institute" v={project.institute} />
          <Detail k="Institute Address" v={project.institute_address} />
          <Detail k="State" v={project.state} />
          <Detail k="Date of Start" v={formatDate(project.start_date)} />
          <Detail k="Date of Completion" v={formatDate(project.date_of_completion)} />
          <Detail k="Duration" v={project.duration_years ? `${project.duration_years} years` : null} />
          <Detail k="Project State" v={project.project_state} />
        </div>
      </Section>

      {/* Financial */}
      <Section title="Financial Summary" highlight>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <Money k="Total Sanctioned" v={Number(project.total_sanctioned_amount) || 0} />
          <Money k="Total Released So Far" v={totalReleased} />
          <Money k="10% Hold Amount" v={holdAmount} />
          <Detail k="10% Hold Released" v={holdReleased ? "Yes" : "No"} />
          <Money k="2025-2026 Required" v={required2526} />
          <Money k="2025-2026 Released" v={released2526} />
          <Money k="Balance Pending" v={balance} />
        </div>
      </Section>

      {/* Year-wise table */}
      <Section title="Year-wise Grant & Status">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Year</th>
                <th className="p-2 text-left">Financial Year</th>
                <th className="p-2 text-right">Sanctioned</th>
                <th className="p-2 text-right">Released</th>
                <th className="p-2 text-center">Grant Released</th>
                <th className="p-2 text-left">Report Status</th>
                <th className="p-2 text-center">UC Submitted</th>
                <th className="p-2 text-center">Extension</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => {
                const fy = y.financial_year || fyForYearNumber(project.start_date, y.year_number);
                const overdue = isReportOverdue(project.start_date, y.year_number, y.report_status);
                const isCurrent = fy === currentFY;
                return (
                  <tr
                    key={y.id}
                    className={`border-t ${overdue ? "bg-red-50 dark:bg-red-950/30" : isCurrent ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  >
                    <td className="p-2">Year {y.year_number}</td>
                    <td className="p-2">{fy || "—"}</td>
                    <td className="p-2 text-right">{formatINR(y.sanctioned_amount)}</td>
                    <td className="p-2 text-right">{formatINR(y.amount_released)}</td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!y.grant_released}
                        disabled={!editAllowed}
                        onChange={(e) => updateYearlyField(y, "grant_released", e.target.checked)}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={y.report_status || "Due"}
                        disabled={!editAllowed}
                        onChange={(e) =>
                          updateYearlyField(y, "report_status", e.target.value as ReportStatus)
                        }
                        className="px-2 py-1 rounded border bg-background text-xs"
                      >
                        <option>Due</option>
                        <option>Received - Not Reviewed</option>
                        <option>Received - Reviewed</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!y.uc_submitted}
                        disabled={!editAllowed}
                        onChange={(e) => updateYearlyField(y, "uc_submitted", e.target.checked)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!y.extension_requested}
                        disabled={!editAllowed}
                        onChange={(e) => updateYearlyField(y, "extension_requested", e.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
              {yearly.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    No yearly status records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Current Status & Notes">
        {editAllowed ? (
          <>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={4}
              className="w-full rounded border bg-background p-2 text-sm"
            />
            <button onClick={saveStatusNote} className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded text-white text-sm" style={{ background: "var(--brand)" }}>
              <Save size={14} /> Save
            </button>
          </>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{project.current_status_note || "—"}</p>
        )}
      </Section>

      <Section title="Outcomes & Publications">
        {editAllowed ? (
          <>
            <textarea
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
              rows={4}
              className="w-full rounded border bg-background p-2 text-sm"
            />
            <button onClick={saveOutcomes} className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded text-white text-sm" style={{ background: "var(--brand)" }}>
              <Save size={14} /> Save
            </button>
          </>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{project.outcomes_publications || "—"}</p>
        )}
      </Section>

      <Section title="Comments & Remarks" icon={MessageSquare}>
        <div className="space-y-3">
          {comments.length === 0 && (
            <div className="text-sm text-muted-foreground">No comments yet.</div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="border rounded p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  <strong className="text-foreground">{c.author_name || "Unknown"}</strong> · {formatDate(c.created_at)}
                </span>
                {deleteCommentAllowed && (
                  <button onClick={() => delComment(c.id)} className="text-destructive">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          {commentAllowed && (
            <div className="border-t pt-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Write a comment…"
                className="w-full rounded border bg-background p-2 text-sm"
              />
              <button onClick={addComment} className="mt-2 px-3 py-1.5 rounded text-white text-sm" style={{ background: "var(--brand)" }}>
                Add Comment
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Documents" icon={FileText}>
        {uploadAllowed && (
          <div className="mb-3">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer hover:bg-accent text-sm">
              <Upload size={14} /> Upload File
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
              />
            </label>
          </div>
        )}
        <div className="space-y-2">
          {docs.length === 0 && <div className="text-sm text-muted-foreground">No documents uploaded.</div>}
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 border rounded p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{d.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {d.uploaded_by_name || "Unknown"} · {formatDate(d.uploaded_at)} · {d.file_size}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                  Open
                </a>
                {deleteDocAllowed && (
                  <button onClick={() => delDoc(d)} className="text-destructive">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="History Timeline" icon={Clock}>
        <div className="space-y-2">
          {history.length === 0 && <div className="text-sm text-muted-foreground">No history yet.</div>}
          {history.map((h) => (
            <div key={h.id} className="flex gap-3 border-l-2 border-primary pl-3 py-1">
              <Clock size={14} className="mt-1 text-muted-foreground" />
              <div className="text-xs">
                <div className="font-medium text-sm">
                  {h.changed_field}
                  {h.year_number ? ` (Year ${h.year_number})` : ""}
                </div>
                <div className="text-muted-foreground">
                  {h.old_value != null ? `${h.old_value} → ` : ""}{h.new_value}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {h.changed_by_name || "System"} · {formatDate(h.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {editOpen && (
        <EditProjectModal project={project} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); loadAll(); }} />
      )}
    </div>
  );
}

function Section({ title, children, icon: Icon, highlight }: { title: string; children: React.ReactNode; icon?: any; highlight?: boolean }) {
  return (
    <section className={`bg-card border rounded-xl p-5 ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
        {Icon && <Icon size={18} />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-border py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v != null && v !== "" ? v : "—"}</span>
    </div>
  );
}

function Money({ k, v }: { k: string; v: number }) {
  return <Detail k={k} v={formatINR(v)} />;
}

function EditProjectModal({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Project>>(project);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const changes: Partial<Project> = {};
    (Object.keys(form) as (keyof Project)[]).forEach((k) => {
      if ((form as any)[k] !== (project as any)[k]) (changes as any)[k] = (form as any)[k];
    });
    if (Object.keys(changes).length) {
      await supabase.from("projects").update(changes).eq("id", project.id);
      for (const k of Object.keys(changes)) {
        await logHistory({
          projectId: project.id,
          field: k,
          oldValue: (project as any)[k],
          newValue: (changes as any)[k],
          userId: user?.id || null,
          userName: user?.name || null,
        });
      }
    }
    setSaving(false);
    toast.success("Project updated");
    onSaved();
  };

  const fields: { k: keyof Project; label: string; type?: string }[] = [
    { k: "title", label: "Title" },
    { k: "pi_name", label: "PI Name" },
    { k: "institute", label: "Institute" },
    { k: "institute_address", label: "Institute Address" },
    { k: "state", label: "State" },
    { k: "contact_number", label: "Contact Number" },
    { k: "email_id", label: "Email" },
    { k: "iris_id", label: "IRIS ID" },
    { k: "file_number", label: "File Number" },
    { k: "eoffice_number", label: "e-Office Number" },
    { k: "start_date", label: "Start Date", type: "date" },
    { k: "date_of_completion", label: "Date of Completion", type: "date" },
    { k: "duration_years", label: "Duration (years)", type: "number" },
    { k: "total_sanctioned_amount", label: "Total Sanctioned (₹)", type: "number" },
    { k: "description", label: "Description" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Edit Project</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 grid md:grid-cols-2 gap-3">
          {fields.map((f) => (
            <label key={f.k} className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">{f.label}</span>
              <input
                type={f.type || "text"}
                value={(form as any)[f.k] ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.k]: f.type === "number" ? Number(e.target.value) : e.target.value,
                  })
                }
                className="w-full rounded border bg-background px-2 py-1.5"
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Project State</span>
            <select
              value={form.project_state || "Active"}
              onChange={(e) => setForm({ ...form, project_state: e.target.value as ProjectState })}
              className="w-full rounded border bg-background px-2 py-1.5"
            >
              {["Active", "Suspended", "Under Review", "Closed", "Completed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded text-white" style={{ background: "var(--brand)" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
