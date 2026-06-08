"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import type { QrCode, Folder } from "@/lib/types";

export default function EditorView({
  code,
  folders,
  userId,
}: {
  code: QrCode;
  folders: Folder[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [folderId, setFolderId] = useState<string | null>(code.folder_id);

  function back() {
    router.push("/dashboard");
    router.refresh();
  }

  async function changeFolder(v: string) {
    const fid = v === "" ? null : v;
    setFolderId(fid);
    const { error } = await supabase
      .from("codes")
      .update({ folder_id: fid })
      .eq("id", code.id);
    if (error) alert(error.message);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={back} className="text-blue-600 text-sm font-medium">
          ← Dashboard
        </button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium truncate">
          {code.title || code.short_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-neutral-500">Folder</label>
          <select
            value={folderId ?? ""}
            onChange={(e) => changeFolder(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            <option value="">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-5">
        <div className="bg-white border rounded-xl p-5">
          <CodeEditor
            code={code}
            userId={userId}
            onSaved={() => router.refresh()}
            onDeleted={back}
          />
        </div>
      </div>
    </main>
  );
}
