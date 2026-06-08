// This app's own public base URL — used to build the /r/<code> links that get
// encoded into dynamic QR codes.
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}
