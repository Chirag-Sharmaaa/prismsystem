# PRISM Build Plan

A full ICMR research grant monitoring platform on TanStack Start + Supabase.

## Scope

This is a large multi-page app. Before I start coding, please confirm a few important things — once you approve I will build everything end-to-end in one pass.

## Tech reality check

Your spec says "React + TypeScript + Tailwind + @supabase/supabase-js". This Lovable project is **TanStack Start v1** (file-based routing in `src/routes/`, SSR-capable, Tailwind v4 via `src/styles.css`). I will:
- Keep the stack as TanStack Start (not bare CRA/Next)
- Use `@supabase/supabase-js` directly with the anon key you provided (browser client only — no server functions needed since RLS gates everything)
- Use Tailwind v4 tokens in `src/styles.css` for the navy/blue palette
- Add `recharts`, `xlsx`, `date-fns`, `lucide-react`, `sonner`

If you'd rather I switch the project to plain Vite+React Router, say so — otherwise I'll proceed with TanStack Start.

## Routes

- `/login` — email/password + "Continue as Guest"
- `/` — Hero + ticker + dashboard (stats, donut, bars, universal search)
- `/category/$slug` — one component for ADHOC/IG/SG/CAR/NHRP with filterable dashboard, Excel import modal, project table
- `/project/$id` — 9 sections (header, details, financials, year-wise table, status note, outcomes, comments, documents, history timeline)
- `/admin` — create user + users list (admin / scientist_e only)
- `/settings` — appearance (light/dark), account, notifications, data&privacy

## Shared shell

- Collapsible sidebar (PanelLeftClose/Open, localStorage `prism-sidebar-collapsed`, mobile collapsed by default)
- Guest banner when `localStorage.prism-guest === 'true'`
- Footer "© 2026 Chirag · ICMR Research Administration · PRISM"
- Auth context wrapping app: reads Supabase session + guest flag, exposes `user`, `role`, `categoryAccess`, `isGuest`, `can(action, category?)`
- Theme toggle writes `data-theme` on `<html>`, inline script in root shell to prevent flash

## Key logic

- `formatINR(n)` Indian grouping with ₹
- `formatDate(d)` → DD MMM YYYY via date-fns
- `currentFinancialYear()` → "2025-2026" style
- `isReportOverdue(startDate, yearNumber, status)`
- `actionRequired(project, yearlyRows)` for the "Action Required" stat
- Every mutation to `project_yearly_status` / `projects.project_state` inserts into `status_history` from the client (since DB triggers aren't in scope)
- Excel import: parse with `xlsx`, map ADHOC columns case-insensitively, dedupe by `e_file_number`, auto-create `project_yearly_status` rows, log to history
- Permissions matrix enforced both in UI (hide buttons) and in mutation helpers (toast block for guests / unauthorized managers)

## Storage

- Use Supabase bucket `prism-documents` for the Documents section. I will assume this bucket already exists (per "schema already created"). If uploads 404 I'll surface a clear message telling you to create the bucket.

## What I need from you

1. **Confirm TanStack Start is fine** (vs. switching to plain Vite + React Router).
2. **Storage bucket `prism-documents`** — does it already exist with public-read or signed URLs? If unsure, I'll proceed assuming it exists; otherwise you may need to create it in the Supabase dashboard.
3. **Admin user creation** — your spec says "Supabase auth invite". The anon key cannot send invites (needs service role). I will implement Section A as: create the row in `public.users` with the chosen role/category, and show a note that the user must complete signup via the invite email (or you provide a service-role key as a runtime secret so I can wire a server function for true invites). OK?
4. **Anon key in client bundle** — fine to hardcode in `src/lib/supabase.ts` (it's the publishable key). Confirm.

Reply "go" (and answer 2–4 if relevant) and I'll build the whole thing.