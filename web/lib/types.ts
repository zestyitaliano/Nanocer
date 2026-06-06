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
