// Public dynamic-QR redirect. A scanned code hits /r/<short_code>; we resolve the
// current destination via the service-role `increment_scan` RPC (which also logs
// the scan + bumps the count in one round-trip) and 302 to it. This is the
// latency-critical path, so it runs on Vercel — never on Render (cold starts).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: target, error } = await admin.rpc("increment_scan", {
    p_short_code: code,
    p_user_agent: request.headers.get("user-agent") ?? null,
    p_country: request.headers.get("x-vercel-ip-country") ?? null,
  });

  if (error || !target) {
    return new NextResponse(notFoundHtml(code), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  // target is either an absolute URL ('url' mode) or a relative '/p/<slug>'
  // ('listing_page' mode) — resolve relative paths against this request's origin
  // so it works on the live domain and on preview deployments alike.
  const t = target as string;
  const url = t.startsWith("/") ? new URL(t, request.nextUrl.origin).toString() : t;
  return NextResponse.redirect(url, 302);
}

function notFoundHtml(code: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;text-align:center;margin-top:15%">
  <h1>404</h1><p>No active QR code matches <code>${code.replace(/[<>&]/g, "")}</code>.</p>
  </body></html>`;
}
