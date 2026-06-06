// Client helpers for the Render render service + the site's own base URL.
import type { QrStyle } from "./types";

const RENDER = process.env.NEXT_PUBLIC_RENDER_API_URL;

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export async function fetchQrBlob(
  value: string,
  style: QrStyle,
  format: "png" | "svg",
): Promise<Blob> {
  if (!RENDER) throw new Error("NEXT_PUBLIC_RENDER_API_URL is not set");
  const res = await fetch(`${RENDER}/render`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value, style, format }),
  });
  if (!res.ok) throw new Error(`Render service error (${res.status})`);
  return res.blob();
}

export async function fetchBatchZip(
  items: { filename: string; value: string; style: QrStyle }[],
  format: "png" | "svg",
): Promise<Blob> {
  if (!RENDER) throw new Error("NEXT_PUBLIC_RENDER_API_URL is not set");
  const res = await fetch(`${RENDER}/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, format }),
  });
  if (!res.ok) throw new Error(`Render service error (${res.status})`);
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
