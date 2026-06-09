// Normalizes incoming feed data into IncomingPlanRow[]. Dependency-free: a small
// hand-rolled CSV reader (handles quotes + commas) plus a JSON normalizer, so a
// PMS export, middleware, or pasted file all funnel into the same row shape
// before applyPlanSync merges them.

import type { IncomingPlanRow, PlanAvailability } from "@/lib/types";

const AVAIL = new Set(["available", "waitlist", "unavailable"]);

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  // Strip currency symbols / commas so "$1,295" parses.
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toAvailability(v: unknown): PlanAvailability | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  return AVAIL.has(s) ? (s as PlanAvailability) : undefined;
}

// Maps one loose record (string keys, string|number values) to a row. Accepts a
// few common header aliases. Rows without an external_id are dropped.
function toRow(rec: Record<string, unknown>): IncomingPlanRow | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(rec).find((rk) => rk.trim().toLowerCase() === k);
      if (found != null && rec[found] !== "" && rec[found] != null) return rec[found];
    }
    return undefined;
  };

  const external = get("external_id", "id", "plan_id", "unit_id", "code");
  if (external == null || String(external).trim() === "") return null;

  const unitRaw = String(get("price_unit", "unit") ?? "").trim().toLowerCase();
  const row: IncomingPlanRow = { external_id: String(external).trim() };

  const name = get("name", "plan", "floorplan", "title");
  if (name != null) row.name = String(name);
  const beds = toNum(get("beds", "bedrooms", "bed"));
  if (beds != null) row.beds = beds;
  const baths = toNum(get("baths", "bathrooms", "bath"));
  if (baths != null) row.baths = baths;
  const sqft = toNum(get("sqft", "sq_ft", "square_feet", "size"));
  if (sqft != null) row.sqft = sqft;
  const price = toNum(get("price", "rent", "starting_price", "min_price"));
  if (price != null) row.price = price;
  const priceMax = toNum(get("price_max", "max_price", "rent_max"));
  if (priceMax != null) row.price_max = priceMax;
  if (unitRaw === "bed" || unitRaw === "unit") row.price_unit = unitRaw;
  const avail = toAvailability(get("availability", "status"));
  if (avail) row.availability = avail;
  const availText = get("available_text", "available", "avail_text");
  if (availText != null) row.available_text = String(availText);

  return row;
}

export function parseJson(body: unknown): IncomingPlanRow[] {
  const arr = Array.isArray(body)
    ? body
    : Array.isArray((body as { rows?: unknown[] })?.rows)
      ? (body as { rows: unknown[] }).rows
      : [];
  return arr
    .map((r) => (r && typeof r === "object" ? toRow(r as Record<string, unknown>) : null))
    .filter((r): r is IncomingPlanRow => r != null);
}

// Minimal RFC-4180-ish CSV: handles quoted fields, escaped quotes, and \r\n.
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function parseCsv(text: string): IncomingPlanRow[] {
  const grid = splitCsv(text);
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => h.trim());
  return grid
    .slice(1)
    .map((cells) => {
      const rec: Record<string, unknown> = {};
      headers.forEach((h, i) => (rec[h] = cells[i]));
      return toRow(rec);
    })
    .filter((r): r is IncomingPlanRow => r != null);
}
