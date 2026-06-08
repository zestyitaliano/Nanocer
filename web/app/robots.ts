import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://nanocer.com").replace(
  /\/$/,
  "",
);

// Public marketing page (/) and property pages (/p/...) are indexable; the app,
// auth, and the raw redirect endpoint are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/login", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
