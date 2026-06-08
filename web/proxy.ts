// Next.js 16 renamed "middleware" to "proxy" (nodejs runtime, not edge).
// Refreshes the Supabase session and guards /dashboard on every matched request.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip static assets and the public redirect route (/r/...) — redirects must
  // stay fast and never run auth/session logic.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|r/|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
