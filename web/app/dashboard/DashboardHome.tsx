"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { newShortCode } from "@/lib/shortcode";
import {
  DEFAULT_STYLE,
  encodedValue,
  type QrCode,
  type Folder,
} from "@/lib/types";
import { siteUrl } from "@/lib/api";
import { generateBlob, downloadBlob } from "@/lib/qr-styling";
import JSZip from "jszip";
import FolderSidebar, { type FolderFilter } from "@/components/FolderSidebar";
import CodeCard from "@/components/CodeCard";

export default function DashboardHome({
  initialCodes,
  initialFolders,
  userId,
  userEmail,
}: {
  initialCodes: QrCode[];
  initialFolders: Folder[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [codes, setCodes] = useState<QrCode[]>(initialCodes);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [selected, setSelected] = useState<FolderFilter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const byId: Record<string, number> = {};
    let unfiled = 0;
    for (const c of codes) {
      if (c.folder_id) byId[c.folder_id] = (byId[c.folder_id] ?? 0) + 1;
      else unfiled++;
    }
    return { all: codes.length, unfiled, byId };
  }, [codes]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((c) => {
      if (selected === "unfiled" && c.folder_id !== null) return false;
      if (selected !== "all" && selected !== "unfiled" && c.folder_id !== selected)
        return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.destination.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.short_code.toLowerCase().includes(q)
      );
    });
  }, [codes, selected, search]);

  // --- code ops ------------------------------------------------------------
  async function createCode(isDynamic: boolean) {
    setCreateOpen(false);
    setBusy(true);
    const folder_id =
      selected !== "all" && selected !== "unfiled" ? selected : null;
    try {
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({
            user_id: userId,
            short_code,
            title: isDynamic ? "New dynamic code" : "New static code",
            is_dynamic: isDynamic,
            destination: "",
            content: isDynamic ? "" : "https://example.com",
            style: DEFAULT_STYLE,
            folder_id,
          })
          .select()
          .single();
        if (!error) {
          router.push(`/dashboard/${(data as QrCode).id}`);
          return;
        }
        if (error.code !== "23505") {
          alert(error.message);
          return;
        }
      }
      alert("Could not allocate a unique short code, please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(src: QrCode) {
    setBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({
            user_id: userId,
            short_code,
            title: src.title ? `${src.title} (copy)` : "(copy)",
            is_dynamic: src.is_dynamic,
            destination: src.destination,
            content: src.content,
            style: src.style,
            folder_id: src.folder_id,
          })
          .select()
          .single();
        if (!error) {
          setCodes((cs) => [data as QrCode, ...cs]);
          return;
        }
        if (error.code !== "23505") {
          alert(error.message);
          return;
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function move(code: QrCode, folderId: string | null) {
    const { error } = await supabase
      .from("codes")
      .update({ folder_id: folderId })
      .eq("id", code.id);
    if (error) return alert(error.message);
    setCodes((cs) =>
      cs.map((c) => (c.id === code.id ? { ...c, folder_id: folderId } : c)),
    );
  }

  async function removeCode(code: QrCode) {
    if (!window.confirm(`Delete “${code.title || code.short_code}”?`)) return;
    const { error } = await supabase.from("codes").delete().eq("id", code.id);
    if (error) return alert(error.message);
    setCodes((cs) => cs.filter((c) => c.id !== code.id));
  }

  // --- folder ops ----------------------------------------------------------
  async function createFolder(name: string) {
    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error) return alert(error.message);
    setFolders((fs) => [...fs, data as Folder].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function renameFolder(id: string, name: string) {
    const { error } = await supabase.from("folders").update({ name }).eq("id", id);
    if (error) return alert(error.message);
    setFolders((fs) =>
      fs.map((f) => (f.id === id ? { ...f, name } : f)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function deleteFolder(id: string) {
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) return alert(error.message);
    setFolders((fs) => fs.filter((f) => f.id !== id));
    // codes in that folder are un-filed by the DB (on delete set null)
    setCodes((cs) => cs.map((c) => (c.folder_id === id ? { ...c, folder_id: null } : c)));
    if (selected === id) setSelected("all");
  }

  // --- import / export (reused) -------------------------------------------
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
    const folder_id =
      selected !== "all" && selected !== "unfiled" ? selected : null;
    let created = 0;
    for (const l of lines) {
      const row = l.split(",");
      const title = col(row, "title");
      const destination = col(row, "destination");
      const content = col(row, "content");
      const type = col(row, "type").toLowerCase();
      const dynamic = type === "static" ? false : type === "dynamic" ? true : !content;
      if (!destination && !content) continue;
      for (let i = 0; i < 5; i++) {
        const short_code = newShortCode();
        const { data, error } = await supabase
          .from("codes")
          .insert({
            user_id: userId,
            short_code,
            title,
            is_dynamic: dynamic,
            destination: dynamic ? destination || content : "",
            content: dynamic ? "" : content || destination,
            style: DEFAULT_STYLE,
            folder_id,
          })
          .select()
          .single();
        if (!error) {
          setCodes((cs) => [data as QrCode, ...cs]);
          created++;
          break;
        }
        if (error.code !== "23505") break;
      }
    }
    alert(`Imported ${created} codes.`);
    e.target.value = "";
  }

  async function exportAll() {
    if (!visible.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const c of visible) {
        const name = `${(c.title || c.short_code).replace(/\s+/g, "_")}_${c.short_code}.png`;
        const blob = await generateBlob(encodedValue(c, siteUrl()), c.style, "png");
        zip.file(name, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, "nanocer_qr_codes.zip");
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
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <h1 className="font-semibold text-lg">Nanocer</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search codes…"
          className="ml-2 flex-1 max-w-md border rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="relative">
          <button
            onClick={() => setCreateOpen((o) => !o)}
            disabled={busy}
            className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
          >
            Create ▾
          </button>
          {createOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg text-sm py-1 z-20">
              <button onClick={() => createCode(true)} className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50">
                🔗 Dynamic code
              </button>
              <button onClick={() => createCode(false)} className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50">
                ▪ Static code
              </button>
            </div>
          )}
        </div>
        <label className="border rounded-lg px-3 py-1.5 text-sm cursor-pointer">
          Import CSV
          <input type="file" accept=".csv" onChange={importCsv} className="hidden" />
        </label>
        <button
          onClick={exportAll}
          disabled={busy || !visible.length}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          Export ZIP
        </button>
        <span className="text-neutral-500 text-sm ml-2 hidden sm:inline">{userEmail}</span>
        <button onClick={signOut} className="text-blue-600 text-sm">
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4">
        <FolderSidebar
          folders={folders}
          counts={counts}
          selected={selected}
          onSelect={setSelected}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
        />

        <section>
          {visible.length === 0 ? (
            <div className="text-center text-neutral-400 text-sm py-20 border rounded-xl bg-white">
              No codes here yet. Click <span className="font-medium">Create</span> to add one.
            </div>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
              {visible.map((c) => (
                <CodeCard
                  key={c.id}
                  code={c}
                  folders={folders}
                  onOpen={() => router.push(`/dashboard/${c.id}`)}
                  onDuplicate={() => duplicate(c)}
                  onMove={(fid) => move(c, fid)}
                  onDelete={() => removeCode(c)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
