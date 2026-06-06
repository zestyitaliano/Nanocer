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

  const { data: destination, error } = await admin.rpc("increment_scan", {
    p_short_code: code,
    p_user_agent: request.headers.get("user-agent") ?? null,
    p_country: request.headers.get("x-vercel-ip-country") ?? null,
  });

  if (error || !destination) {
    return new NextResponse(notFoundHtml(code), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  return NextResponse.redirect(destination as string, 302);
}

function notFoundHtml(code: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;text-align:center;margin-top:15%">
  <h1>404</h1><p>No active QR code matches <code>${code.replace(/[<>&]/g, "")}</code>.</p>
  </body></html>`;
}
