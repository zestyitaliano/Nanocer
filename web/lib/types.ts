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

// Leasing statuses (multifamily/student ILS). Keys reuse the original
// other/active/leased_up so no data migration is needed.
export type ListingStatus = "other" | "active" | "leased_up";

export const LISTING_STATUSES: { value: ListingStatus; label: string }[] = [
  { value: "other", label: "No Status" },
  { value: "active", label: "Leasing" },
  { value: "leased_up", label: "Sold Out" },
];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  other: "No Status",
  active: "Leasing",
  leased_up: "Sold Out",
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
  // Sync provenance (added in 0012_plan_sync). 'manual' rows are never touched
  // by a sync; 'sync' rows can be pinned with sync_enabled=false.
  source?: PlanSource;
  external_id?: string | null;
  sync_enabled?: boolean;
  last_synced_at?: string | null;
  synced_fields?: string[];
}

export type PlanSource = "manual" | "sync";

// Per-listing sync config (table: listing_sync_sources).
export type SyncKind = "webhook" | "csv_url";

export interface ListingSyncSource {
  id: string;
  listing_id: string;
  user_id: string;
  kind: SyncKind;
  enabled: boolean;
  webhook_secret: string;
  feed_url: string | null;
  synced_fields: string[];
  last_synced_at: string | null;
  last_status: "ok" | "partial" | "error" | null;
  last_error: string | null;
  last_row_count: number | null;
  created_at: string;
  updated_at: string;
}

// A normalized incoming plan row (from CSV or JSON) keyed by external_id.
export interface IncomingPlanRow {
  external_id: string;
  name?: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  price?: number | null;
  price_max?: number | null;
  price_unit?: "unit" | "bed";
  availability?: PlanAvailability;
  available_text?: string | null;
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

// Lead pipeline stage. Stored on leads.status (default 'uncontacted').
export type LeadStatus =
  | "uncontacted"
  | "contacted"
  | "touring"
  | "applied"
  | "leased"
  | "lost";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "uncontacted", label: "Uncontacted" },
  { value: "contacted", label: "Contacted" },
  { value: "touring", label: "Touring" },
  { value: "applied", label: "Applied" },
  { value: "leased", label: "Leased" },
  { value: "lost", label: "Lost" },
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
  // Added in 0011_lead_workflow (optional so older reads still type-check).
  status?: LeadStatus;
  assigned_to?: string | null;
  contacted_at?: string | null;
  status_updated_at?: string;
  notes?: string | null;
  // Added in 0013_teams.
  escalated_at?: string | null;
  escalated_to?: string | null;
}

// Team roles (table: portfolio_members). Layered on the single-owner model.
export type TeamRole = "leasing_agent" | "senior_staff" | "property_manager";

export const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: "leasing_agent", label: "Leasing agent" },
  { value: "senior_staff", label: "Senior staff" },
  { value: "property_manager", label: "Property manager" },
];

export interface PortfolioMember {
  portfolio_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
}

// Per-user lead-alert settings (table: notification_prefs). A missing row means
// defaults: email on, sent to the user's auth email.
export interface NotificationPrefs {
  user_id: string;
  email_enabled: boolean;
  email_to: string | null;
  sms_enabled: boolean;
  sms_to: string | null;
  created_at: string;
  updated_at: string;
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
