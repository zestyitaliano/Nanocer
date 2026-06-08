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

export interface PageConfig {
  photos?: string[];
  agent?: { name?: string; phone?: string; email?: string; photo_url?: string };
  // tour = show the lead form; text = sms link; link = external URL
  cta?: { type: "tour" | "text" | "link"; label?: string; value?: string };
  theme?: { color?: string };
}

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
