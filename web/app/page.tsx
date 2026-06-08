import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 overflow-hidden">
      {/* soft brand glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, rgba(124,58,237,0.16), transparent 60%), radial-gradient(40rem 30rem at 90% 110%, rgba(79,70,229,0.12), transparent 60%)",
        }}
      />
      <div className="max-w-xl text-center space-y-7">
        <span className="chip brand-gradient text-white shadow-sm">
          ✦ Your own owned ILS
        </span>
        <h1 className="text-5xl font-bold tracking-tight">
          Nanocer
        </h1>
        <p className="text-lg text-[var(--muted)] leading-relaxed">
          Dynamic &amp; static QR codes you can restyle and re-point anytime — no
          reprinting. Host beautiful property pages, capture leads, and track
          every scan.
        </p>
        <div className="flex gap-3 justify-center pt-1">
          <Link href="/login" className="btn btn-primary px-6 py-3">
            Get started
          </Link>
          <Link href="/dashboard" className="btn btn-secondary px-6 py-3">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
