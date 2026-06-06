"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { newShortCode } from "@/lib/shortcode";
import { DEFAULT_STYLE, encodedValue, type QrCode } from "@/lib/types";
import { fetchBatchZip, downloadBlob, siteUrl } from "@/lib/api";
import CodeEditor from "@/components/CodeEditor";

export default function Dashboard({
  initialCodes,
  userId,
  userEmail,
}: {
  initialCodes: QrCode[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [codes, setCodes] = useState<QrCode[]>(initialCodes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCodes[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const selected = codes.find((c) => c.id === selectedId) ?? null;

  async function insertCode(partial: Partial<QrCode>): Promise<void> {
    setBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({ user_id: userId, short_code, ...partial })
          .select()
          .single();
        if (!error) {
          setCodes((cs) => [data as QrCode, ...cs]);
          setSelectedId((data as QrCode).id);
          return;
        }
        if (error.code !== "23505") {
          alert(error.message);
          return;
        }
        // 23505 = unique violation on short_code → retry
      }
      alert("Could not allocate a unique short code, please retry.");
    } finally {
      setBusy(false);
    }
  }

  const newDynamic = () =>
    insertCode({
      title: "New dynamic code",
      is_dynamic: true,
      destination: "",
      content: "",
      style: DEFAULT_STYLE,
    });

  const newStatic = () =>
    insertCode({
      title: "New static code",
      is_dynamic: false,
      destination: "",
      content: "https://example.com",
      style: DEFAULT_STYLE,
    });

  function onSaved(updated: QrCode) {
    setCodes((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
  }
  function onDeleted(id: string) {
    setCodes((cs) => cs.filter((c) => c.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines.shift()?.toLowerCase().split(",").map((h) => h.trim()) ?? [];
    const col = (row: string[], name: string) => {
      const i = header.indexOf(name);
      return i >= 0 ? (row[i] ?? "").trim() : "";
    };
    const rows = lines.map((l) => l.split(","));
    let created = 0;
    for (const row of rows) {
      const title = col(row, "title");
      const destination = col(row, "destination");
      const content = col(row, "content");
      const type = col(row, "type").toLowerCase();
      const dynamic = type === "static" ? false : type === "dynamic" ? true : !content;
      if (!destination && !content) continue;
      await insertCode({
        title,
        is_dynamic: dynamic,
        destination: dynamic ? destination || content : "",
        content: dynamic ? "" : content || destination,
        style: DEFAULT_STYLE,
      });
      created++;
    }
    alert(`Imported ${created} codes.`);
    e.target.value = "";
  }

  async function exportAll() {
    if (!codes.length) return;
    setBusy(true);
    try {
      const items = codes.map((c) => ({
        filename: `${(c.title || c.short_code).replace(/\s+/g, "_")}_${c.short_code}`,
        value: encodedValue(c, siteUrl()),
        style: c.style,
      }));
      const blob = await fetchBatchZip(items, "png");
      downloadBlob(blob, "nanocer_qr_codes.zip");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Batch export failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Nanocer</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{userEmail}</span>
          <button onClick={signOut} className="text-blue-600">
            Sign out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4">
        {/* sidebar */}
        <aside className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={newDynamic}
              disabled={busy}
              className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm"
            >
              + Dynamic
            </button>
            <button
              onClick={newStatic}
              disabled={busy}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              + Static
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <label className="border rounded-lg px-2 py-1 cursor-pointer">
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={importCsv}
                className="hidden"
              />
            </label>
            <button
              onClick={exportAll}
              disabled={busy || !codes.length}
              className="border rounded-lg px-2 py-1"
            >
              Export all (ZIP)
            </button>
          </div>

          <ul className="bg-white border rounded-lg divide-y max-h-[70vh] overflow-auto">
            {codes.length === 0 && (
              <li className="p-3 text-sm text-neutral-400">No codes yet.</li>
            )}
            {codes.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    c.id === selectedId ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="mr-1">{c.is_dynamic ? "🔗" : "▪"}</span>
                  {c.title || "(untitled)"}
                  <span className="block text-[11px] text-neutral-400">
                    {c.short_code}
                    {c.is_dynamic ? ` · ${c.scan_count} scans` : " · static"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* editor */}
        <section className="bg-white border rounded-xl p-5">
          {selected ? (
            <CodeEditor
              key={selected.id}
              code={selected}
              userId={userId}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          ) : (
            <p className="text-neutral-400 text-sm">
              Select a code, or create a new one.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
