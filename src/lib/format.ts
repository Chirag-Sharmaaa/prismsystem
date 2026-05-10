import { format, parse, addYears, isAfter } from "date-fns";

export function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "₹0";
  const num = Number(n);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const [int, dec] = abs.toFixed(2).split(".");
  // Indian grouping: last 3, then groups of 2
  let last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const grouped = rest ? `${restGrouped},${last3}` : last3;
  return `${sign}₹${grouped}${dec !== "00" ? "." + dec : ""}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return "—";
    return format(date, "dd MMM yyyy");
  } catch {
    return "—";
  }
}

export function currentFinancialYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0=Jan
  if (m >= 3) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

export function fyForYearNumber(startDate: string | null, yearNumber: number): string {
  if (!startDate) return "";
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return "";
  const startY = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const y = startY + (yearNumber - 1);
  return `${y}-${y + 1}`;
}

export function isReportOverdue(
  startDate: string | null,
  yearNumber: number,
  status: string | null,
): boolean {
  if (!startDate || status !== "Due") return false;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return false;
  const due = addYears(d, yearNumber);
  return isAfter(new Date(), due);
}

// Parse various date formats including Excel serial
export function parseFlexDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const utc = (v - 25569) * 86400 * 1000;
    const d = new Date(utc);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "d/M/yyyy", "dd-MM-yyyy"];
  for (const f of formats) {
    try {
      const d = parse(s, f, new Date());
      if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    } catch {}
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function parseNumber(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[₹,\s]/g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export function parseBool(v: any): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "y" || s === "1";
}

export function parseDurationYears(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).toLowerCase();
  const monthsMatch = s.match(/(\d+)\s*month/);
  if (monthsMatch) return Math.max(1, Math.round(parseInt(monthsMatch[1]) / 12));
  const yearMatch = s.match(/(\d+)/);
  if (yearMatch) return parseInt(yearMatch[1]);
  return null;
}
