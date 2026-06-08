import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://nanocer.com").replace(
  /\/$/,
  "",
);

// Home + every published property page, so the listings get indexed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let pages: MetadataRoute.Sitemap = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("listings")
      .select("slug, updated_at")
      .eq("page_enabled", true)
      .not("slug", "is", null);
    pages = (data ?? [])
      .filter((r: { slug: string | null }) => r.slug)
      .map((r: { slug: string; updated_at: string | null }) => ({
        url: `${base}/p/${r.slug}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
      }));
  } catch {
    // If Supabase is unreachable, still return the home entry.
  }
  return [{ url: base, changeFrequency: "weekly", priority: 1 }, ...pages];
}
