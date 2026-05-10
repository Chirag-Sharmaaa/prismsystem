import { supabase } from "./supabase";

export async function logHistory(args: {
  projectId: string;
  yearNumber?: number | null;
  field: string;
  oldValue?: any;
  newValue?: any;
  userId: string | null;
  userName: string | null;
}) {
  await supabase.from("status_history").insert({
    project_id: args.projectId,
    year_number: args.yearNumber ?? null,
    changed_field: args.field,
    old_value: args.oldValue == null ? null : String(args.oldValue),
    new_value: args.newValue == null ? null : String(args.newValue),
    changed_by: args.userId,
    changed_by_name: args.userName,
  });
}
