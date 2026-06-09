// Render-time image optimization. We keep storing raw Supabase public URLs;
// these helpers rewrite them to Supabase Storage's image-transform endpoint
// (…/render/image/public/…) only at render. This avoids re-uploading, a new
// vendor, and routing the high-traffic public /p/[slug] pages through Next's
// image optimizer.
//
// Gated by NEXT_PUBLIC_IMG_TRANSFORM: when off (or for non-Supabase / data:
// URLs), the raw URL is returned untouched — zero regression. (Supabase image
// transformations require the Pro plan; leave the flag off if unavailable.)

const ENABLED = process.env.NEXT_PUBLIC_IMG_TRANSFORM === "1";

function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export interface TransformOpts {
  width?: number;
  quality?: number; // 20–100, default 75
  resize?: "cover" | "contain" | "fill";
}

// Rewrites a Supabase public object URL to its transform URL. Returns the input
// unchanged when disabled, when the URL isn't a Supabase public object, or for
// data:/blob: URLs.
export function transformUrl(rawUrl: string, opts: TransformOpts = {}): string {
  if (!ENABLED || !rawUrl) return rawUrl;
  const host = supabaseHost();
  if (!host) return rawUrl;

  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl; // relative, data:, blob:, malformed → leave alone
  }
  if (u.host !== host) return rawUrl; // external (e.g. agent-supplied) URLs

  const marker = "/storage/v1/object/public/";
  const at = u.pathname.indexOf(marker);
  if (at === -1) return rawUrl; // not a public object URL

  const objectPath = u.pathname.slice(at + marker.length); // <bucket>/<path>
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  params.set("quality", String(opts.quality ?? 75));
  if (opts.resize) params.set("resize", opts.resize);

  return `${u.origin}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}

// Builds a srcSet across widths so the browser picks the right resolution.
export function srcSetFor(
  rawUrl: string,
  widths: number[],
  quality = 75,
): string | undefined {
  if (!ENABLED || !rawUrl) return undefined;
  // If transformUrl is a no-op (non-Supabase/disabled), a srcSet adds nothing.
  if (transformUrl(rawUrl, { width: widths[0], quality }) === rawUrl) return undefined;
  return widths
    .map((w) => `${transformUrl(rawUrl, { width: w, quality })} ${w}w`)
    .join(", ");
}
