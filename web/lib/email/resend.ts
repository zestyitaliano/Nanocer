// Minimal Resend client. We call the REST API directly with fetch rather than
// pulling in the SDK — keeps the dependency list lean (matches the project's
// existing approach) and the payload is a single POST.
//
// Server-only: reads RESEND_API_KEY / RESEND_FROM. Never import into a client
// component.

import type { Lead } from "@/lib/types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared send primitive. Returns false (never throws) on any failure so callers
// can treat email as best-effort.
async function send(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn("[notify] RESEND_API_KEY / RESEND_FROM not set; skipping email");
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.warn(`[notify] Resend responded ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[notify] Resend send failed:", e);
    return false;
  }
}

function dashLink(listingId: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return `${site}/dashboard/listing/${listingId}`;
}

export interface LeadEmailInput {
  to: string;
  listingId: string;
  listingName: string;
  lead: Pick<Lead, "name" | "phone" | "email" | "message" | "source">;
}

// Sends the "new lead" email. Returns false (never throws) on any failure so
// callers can treat notification as best-effort.
export async function sendLeadEmail(input: LeadEmailInput): Promise<boolean> {
  const { lead } = input;
  const name = lead.name?.trim() || "(no name)";

  const rows: [string, string | null | undefined][] = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Source", lead.source],
    ["Message", lead.message],
  ];
  const tableRows = rows
    .filter(([, v]) => v && String(v).trim())
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${k}</td>` +
        `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:480px">` +
    `<h2 style="margin:0 0 4px">New lead — ${escapeHtml(input.listingName)}</h2>` +
    `<p style="margin:0 0 16px;color:#666">${escapeHtml(name)} just submitted the form.</p>` +
    `<table style="border-collapse:collapse;font-size:14px">${tableRows}</table>` +
    `<p style="margin:20px 0 0"><a href="${dashLink(input.listingId)}" ` +
    `style="background:#ea580c;color:#fff;padding:10px 18px;border-radius:8px;` +
    `text-decoration:none;display:inline-block">Open in dashboard</a></p>` +
    `</div>`;

  return send(input.to, `New lead — ${input.listingName}`, html);
}

export interface EscalationEmailInput {
  to: string;
  listingId: string;
  listingName: string;
  lead: Pick<Lead, "name" | "phone" | "email" | "created_at">;
  ageMinutes: number;
}

// Sent to senior staff when a lead has gone uncontacted past the SLA window.
export async function sendEscalationEmail(input: EscalationEmailInput): Promise<boolean> {
  const name = input.lead.name?.trim() || "(no name)";
  const hrs = Math.round(input.ageMinutes / 60);
  const age = hrs >= 1 ? `${hrs}h` : `${input.ageMinutes}m`;
  const contact = [input.lead.phone, input.lead.email].filter(Boolean).join(" · ");
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:480px">` +
    `<h2 style="margin:0 0 4px;color:#b91c1c">Uncontacted lead — ${escapeHtml(input.listingName)}</h2>` +
    `<p style="margin:0 0 16px;color:#666">` +
    `${escapeHtml(name)} has been waiting ${age} without contact.</p>` +
    (contact ? `<p style="margin:0 0 12px;font-size:14px">${escapeHtml(contact)}</p>` : "") +
    `<p style="margin:20px 0 0"><a href="${dashLink(input.listingId)}" ` +
    `style="background:#b91c1c;color:#fff;padding:10px 18px;border-radius:8px;` +
    `text-decoration:none;display:inline-block">Follow up now</a></p>` +
    `</div>`;
  return send(input.to, `Uncontacted lead — ${input.listingName}`, html);
}
