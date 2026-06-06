import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold">Nanocer</h1>
        <p className="text-neutral-600">
          Dynamic & static QR codes you can restyle and re-point anytime — no
          reprinting. Add a logo, track scans, and export in bulk.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Get started
          </Link>
          <Link
            href="/dashboard"
            className="border rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
