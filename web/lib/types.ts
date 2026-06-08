// Shared types + style helpers for QR codes.

export type ModuleStyle =
  | "square"
  | "rounded"
  | "circle"
  | "gapped"
  | "vertical"
  | "horizontal";

export type ErrorCorrection = "L" | "M" | "Q" | "H";

export interface QrStyle {
  fill_color: string;
  back_color: string;
  module_style: ModuleStyle;
  error_correction: ErrorCorrection;
  box_size: number;
  border: number;
  logo_url?: string;
  logo_scale: number;
}

export interface QrCode {
  id: string;
  user_id: string;
  short_code: string;
  title: string;
  is_dynamic: boolean;
  destination: string;
  content: string;
  style: QrStyle;
  scan_count: number;
  listing_id: string | null;
  floor_plan_id: string | null;
  // 'url' = fixed destination; 'listing_page' = the listing's page;
  // 'floor_plan' = the listing's page anchored to a specific unit
  target_mode: "url" | "listing_page" | "floor_plan";
  created_at: string;
  updated_at: string;
}

export type ListingStatus =
  | "coming_soon"
  | "active"
  | "under_contract"
  | "sold"
  | "other";

export const LISTING_STATUSES: { value: ListingStatus; label: string }[] = [
  { value: "coming_soon", label: "Coming soon" },
  { value: "active", label: "Active" },
  { value: "under_contract", label: "Under contract" },
  { value: "sold", label: "Sold" },
  { value: "other", label: "Other" },
];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  coming_soon: "Coming soon",
  active: "Active",
  under_contract: "Under contract",
  sold: "Sold",
  other: "Other",
};

// A call-to-action button. Shared by the page CTA, plan cards, and the quiz.
export interface CtaConfig {
  type: "tour" | "text" | "link";
  label?: string;
  value?: string;
}

// One selectable answer in a quiz question. `tags` are scored against each
// FloorPlan's `tags` to pick the recommended plan(s).
export interface QuizOption {
  id: string;
  label: string;
  tags?: string[];
}

export interface QuizQuestion {
  id: string;
  label: string;
  options: QuizOption[];
}

export type PlanAvailability = "available" | "waitlist" | "unavailable";

// A floor plan / unit — now a first-class DB row (table: floor_plans). A
// community lists several; a QR code can target one for per-unit scan analytics.
export interface FloorPlan {
  id: string;
  listing_id: string;
  name: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  price?: number | null; // "from" price (lower bound when price_max set)
  price_max?: number | null; // optional upper bound for a range
  price_unit?: "unit" | "bed"; // "bed" = student lease-by-the-bed (default "unit")
  availability?: PlanAvailability;
  available_text?: string; // e.g. "Available Aug 2026"
  photo_url?: string; // legacy primary; kept in sync with photos[0]
  photos?: string[];
  description?: string;
  tags?: string[];
  cta?: CtaConfig; // per-plan apply / waitlist / tour button
}

// The "find your floor plan" questionnaire. Stored inside page_config (jsonb),
// so adding/editing it needs no migration.
export interface QuizConfig {
  enabled?: boolean;
  title?: string;
  intro?: string;
  questions?: QuizQuestion[];
  plans?: FloorPlan[];
}

export type PropertyType =
  | "multifamily"
  | "student"
  | "single_family"
  | "other";

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "multifamily", label: "Multifamily" },
  { value: "student", label: "Student housing" },
  { value: "single_family", label: "Single-family" },
  { value: "other", label: "Other" },
];

export interface PageConfig {
  photos?: string[];
  agent?: { name?: string; phone?: string; email?: string; photo_url?: string };
  // tour = show the lead form; text = sms link; link = external URL
  cta?: CtaConfig;
  theme?: { color?: string };
  // First-class floor plans (units). Quiz references these; older configs may
  // still have plans under quiz.plans — read via getPlans() in lib/listing.ts.
  plans?: FloorPlan[];
  property_type?: PropertyType;
  quiz?: QuizConfig;
  // Template-specific config (see listing.template).
  event?: { date?: string; time?: string; note?: string }; // open_house
  coming_soon?: { expected?: string; blurb?: string };
}

export type PageTemplate = "property" | "agent" | "open_house" | "coming_soon";

export const PAGE_TEMPLATES: { value: PageTemplate; label: string }[] = [
  { value: "property", label: "Property (floor plans + finder)" },
  { value: "agent", label: "Agent card / link-in-bio" },
  { value: "open_house", label: "Open house / tour sign-in" },
  { value: "coming_soon", label: "Coming soon / waitlist" },
];

export interface Lead {
  id: number;
  listing_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  name: string;
  status: ListingStatus;
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  slug: string | null;
  template: string;
  page_enabled: boolean;
  page_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_STYLE: QrStyle = {
  fill_color: "#000000",
  back_color: "#ffffff",
  module_style: "square",
  error_correction: "M",
  box_size: 10,
  border: 4,
  logo_url: "",
  logo_scale: 0.22,
};

export const MODULE_STYLES: ModuleStyle[] = [
  "square",
  "rounded",
  "circle",
  "gapped",
  "vertical",
  "horizontal",
];

// The string a code encodes: dynamic codes point at our redirect; static codes
// embed their content directly.
export function encodedValue(code: QrCode, siteUrl: string): string {
  if (code.is_dynamic) {
    return `${siteUrl.replace(/\/$/, "")}/r/${code.short_code}`;
  }
  return code.content;
}
