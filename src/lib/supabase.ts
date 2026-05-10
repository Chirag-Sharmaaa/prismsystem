import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nwwfhxmsivajjoxpvvdy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53d2ZoeG1zaXZhampveHB2dmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjE1NzEsImV4cCI6MjA5MzgzNzU3MX0._WZz2SSkww-CZntN167x8KWkoPNNzmnszIctgXBY5v0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type Role = "admin" | "scientist_e" | "manager" | "guest";
export type Category = "ADHOC" | "IG" | "SG" | "CAR" | "NHRP";
export const CATEGORIES: Category[] = ["ADHOC", "IG", "SG", "CAR", "NHRP"];
export type ProjectState =
  | "Active"
  | "Suspended"
  | "Under Review"
  | "Closed"
  | "Completed";
export type ReportStatus =
  | "Due"
  | "Received - Not Reviewed"
  | "Received - Reviewed";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  category_access: string[] | null;
}

export interface Project {
  id: string;
  title: string;
  category: Category;
  e_file_number: string;
  pi_name: string | null;
  institute: string | null;
  start_date: string | null;
  duration_years: number | null;
  total_sanctioned_amount: number | null;
  project_state: ProjectState | null;
  assigned_users: string[] | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
  serial_number: number | null;
  file_number: string | null;
  eoffice_number: string | null;
  iris_id: string | null;
  contact_number: string | null;
  email_id: string | null;
  date_of_completion: string | null;
  institute_address: string | null;
  state: string | null;
  outcomes_publications: string | null;
  current_status_note: string | null;
}

export interface YearlyStatus {
  id: string;
  project_id: string;
  year_number: number;
  sanctioned_amount: number | null;
  amount_released: number | null;
  grant_released: boolean | null;
  report_status: ReportStatus | null;
  uc_submitted: boolean | null;
  extension_requested: boolean | null;
  financial_year: string | null;
  grant_sanctioned: number | null;
  hold_amount: number | null;
  hold_amount_released: boolean | null;
}

export interface FYBudget {
  id: string;
  project_id: string;
  financial_year: string;
  required_budget: number | null;
  released_budget: number | null;
}

export interface StatusHistoryRow {
  id: string;
  project_id: string;
  year_number: number | null;
  changed_field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  timestamp: string;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  filename: string;
  file_url: string;
  file_size: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

export interface CommentRow {
  id: string;
  project_id: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}
