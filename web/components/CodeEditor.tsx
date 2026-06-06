"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_STYLE,
  MODULE_STYLES,
  encodedValue,
  type QrCode,
  type QrStyle,
} from "@/lib/types";
import { fetchQrBlob, downloadBlob, siteUrl } from "@/lib/api";
import QrPreview from "./QrPreview";
import Analytics from "./Analytics";

export default function CodeEditor({
  code,
  userId,
  onSaved,
  onDeleted,
}: {
  code: QrCode;
  userId: string;
  onSaved: (c: QrCode) => void;
  onDeleted: (id: string) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(code.title);
  const [isDynamic, setIsDynamic] = useState(code.is_dynamic);
  const [destination, setDestination] = useState(code.destination);
  const [content, setContent] = useState(code.content);
  const [style, setStyle] = useState<QrStyle>({ ...DEFAULT_STYLE, ...code.style });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset the form when a different code is selected.
  useEffect(() => {
    setTitle(code.title);
    setIsDynamic(code.is_dynamic);
    setDestination(code.destination);
    setContent(code.content);
    setStyle({ ...DEFAULT_STYLE, ...code.style });
    setMsg(null);
  }, [code]);

  const value = isDynamic
    ? `${siteUrl().replace(/\/$/, "")}/r/${code.short_code}`
    : content || "https://example.com";

  function patchStyle(p: Partial<QrStyle>) {
    setStyle((s) => ({ ...s, ...p }));
  }

  async function save() {
    setBusy("save");
    setMsg(null);
    const { data, error } = await supabase
      .from("codes")
      .update({ title, is_dynamic: isDynamic, destination, content, style })
      .eq("id", code.id)
      .select()
      .single();
    setBusy(null);
    if (error) return setMsg(error.message);
    onSaved(data as QrCode);
    setMsg("Saved.");
  }

  async function remove() {
    if (!confirm(`Delete “${code.title || code.short_code}”?`)) return;
    setBusy("delete");
    const { error } = await supabase.from("codes").delete().eq("id", code.id);
    setBusy(null);
    if (error) return setMsg(error.message);
    onDeleted(code.id);
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("logo");
    const path = `${userId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });
    if (error) {
      setBusy(null);
      return setMsg(error.message);
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    patchStyle({ logo_url: data.publicUrl });
    setBusy(null);
  }

  async function exportImage(format: "png" | "svg") {
    setBusy(format);
    setMsg(null);
    try {
      const blob = await fetchQrBlob(value, style, format);
      downloadBlob(blob, `${(title || code.short_code).replace(/\s+/g, "_")}.${format}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* form */}
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-neutral-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={isDynamic}
              onChange={() => setIsDynamic(true)}
            />
            Dynamic (editable later)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!isDynamic}
              onChange={() => setIsDynamic(false)}
            />
            Static (fixed)
          </label>
        </div>

        {isDynamic ? (
          <label className="block">
            <span className="text-xs text-neutral-500">Destination URL</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="https://example.com/landing"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs text-neutral-500">Static content</span>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="URL or text to encode"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        )}

        <p className="text-[11px] text-neutral-400 break-all">
          Encodes: {value}
        </p>

        {/* styling */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-neutral-500">Foreground</span>
            <input
              type="color"
              value={style.fill_color}
              onChange={(e) => patchStyle({ fill_color: e.target.value })}
              className="w-full h-9 border rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Background</span>
            <input
              type="color"
              value={style.back_color}
              onChange={(e) => patchStyle({ back_color: e.target.value })}
              className="w-full h-9 border rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Module shape</span>
            <select
              value={style.module_style}
              onChange={(e) =>
                patchStyle({ module_style: e.target.value as QrStyle["module_style"] })
              }
              className="w-full border rounded-lg px-2 py-2 text-sm"
            >
              {MODULE_STYLES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Error correction</span>
            <select
              value={style.error_correction}
              onChange={(e) =>
                patchStyle({
                  error_correction: e.target.value as QrStyle["error_correction"],
                })
              }
              className="w-full border rounded-lg px-2 py-2 text-sm"
            >
              {(["L", "M", "Q", "H"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-neutral-500">Centre logo</span>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={uploadLogo}
              className="text-xs"
            />
            {style.logo_url && (
              <button
                onClick={() => patchStyle({ logo_url: "" })}
                className="text-xs text-red-600"
              >
                remove
              </button>
            )}
          </div>
          {style.logo_url && (
            <label className="block">
              <span className="text-xs text-neutral-500">
                Logo size: {Math.round(style.logo_scale * 100)}%
              </span>
              <input
                type="range"
                min={0.1}
                max={0.4}
                step={0.02}
                value={style.logo_scale}
                onChange={(e) => patchStyle({ logo_scale: Number(e.target.value) })}
                className="w-full"
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={save}
            disabled={busy === "save"}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => exportImage("png")}
            disabled={busy === "png"}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {busy === "png" ? "…" : "Export PNG"}
          </button>
          <button
            onClick={() => exportImage("svg")}
            disabled={busy === "svg"}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {busy === "svg" ? "…" : "Export SVG"}
          </button>
          <button
            onClick={remove}
            disabled={busy === "delete"}
            className="border border-red-300 text-red-600 rounded-lg px-3 py-2 text-sm"
          >
            Delete
          </button>
        </div>
        {msg && <p className="text-sm text-neutral-600">{msg}</p>}
      </div>

      {/* preview + analytics */}
      <div className="space-y-5">
        <div>
          <QrPreview value={value} style={style} />
          <p className="text-[11px] text-neutral-400 mt-1">
            Live preview is approximate; exported files are rendered precisely by
            the server.
          </p>
        </div>
        <div className="border-t pt-4">
          <Analytics code={code} />
        </div>
      </div>
    </div>
  );
}
