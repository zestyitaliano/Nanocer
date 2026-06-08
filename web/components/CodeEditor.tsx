"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_STYLE,
  MODULE_STYLES,
  encodedValue,
  type FloorPlan,
  type QrCode,
  type QrStyle,
} from "@/lib/types";
import { generateBlob, downloadBlob } from "@/lib/qr-styling";
import { siteUrl } from "@/lib/api";
import QrPreview from "./QrPreview";
import Analytics from "./Analytics";

export type EditorListing = {
  id: string;
  name: string;
  address: string | null;
  slug: string | null;
  page_enabled: boolean;
};

export default function CodeEditor({
  code,
  userId,
  listing,
  floorPlans = [],
  onSaved,
  onDeleted,
}: {
  code: QrCode;
  userId: string;
  listing?: EditorListing | null;
  floorPlans?: FloorPlan[];
  onSaved: (c: QrCode) => void;
  onDeleted: (id: string) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(code.title);
  const [isDynamic, setIsDynamic] = useState(code.is_dynamic);
  const [destination, setDestination] = useState(code.destination);
  const [targetMode, setTargetMode] = useState<
    "url" | "listing_page" | "floor_plan"
  >(code.target_mode);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(
    code.floor_plan_id,
  );
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
    setTargetMode(code.target_mode);
    setFloorPlanId(code.floor_plan_id);
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
      .update({
        title,
        is_dynamic: isDynamic,
        destination,
        content,
        style,
        target_mode: targetMode,
        floor_plan_id: targetMode === "floor_plan" ? floorPlanId : null,
      })
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
      const blob = await generateBlob(value, style, format);
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
          <span className="text-xs text-[var(--muted)]">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full mt-1"
          />
        </label>

        <div className="flex gap-2 text-sm">
          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition flex-1 ${
              isDynamic
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              checked={isDynamic}
              onChange={() => setIsDynamic(true)}
              className="accent-violet-600"
            />
            Dynamic (editable later)
          </label>
          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition flex-1 ${
              !isDynamic
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              checked={!isDynamic}
              onChange={() => setIsDynamic(false)}
              className="accent-violet-600"
            />
            Static (fixed)
          </label>
        </div>

        {isDynamic ? (
          <div className="space-y-2">
            {listing && (
              <div className="flex flex-wrap gap-2 text-sm">
                {(
                  [
                    ["listing_page", "Property page"],
                    ...(floorPlans.length
                      ? ([["floor_plan", "Specific floor plan"]] as const)
                      : []),
                    ["url", "Custom URL"],
                  ] as const
                ).map(([mode, label]) => (
                  <label
                    key={mode}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition ${
                      targetMode === mode
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={targetMode === mode}
                      onChange={() => setTargetMode(mode)}
                      className="accent-violet-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {listing && targetMode === "listing_page" ? (
              <>
                {listing.page_enabled && listing.slug ? (
                  <p className="text-[11px] text-[var(--muted)] bg-violet-50 rounded-lg px-3 py-2">
                    Resolves to{" "}
                    <span className="font-medium">/p/{listing.slug}</span> —
                    change the page in the property&apos;s Page tab and every code
                    follows, no reprint.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      This property&apos;s page isn&apos;t published yet (Page tab).
                      Until then, scans fall back to the URL below.
                    </p>
                    <label className="block">
                      <span className="text-xs text-[var(--muted)]">
                        Fallback URL
                      </span>
                      <input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="https://example.com/landing"
                        className="input w-full mt-1"
                      />
                    </label>
                  </>
                )}
              </>
            ) : listing && targetMode === "floor_plan" ? (
              <div className="space-y-1.5">
                <select
                  value={floorPlanId ?? ""}
                  onChange={(e) => setFloorPlanId(e.target.value || null)}
                  className="input w-full"
                >
                  <option value="">Select a floor plan…</option>
                  {floorPlans.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.name || "(unnamed plan)"}
                    </option>
                  ))}
                </select>
                {listing.page_enabled && listing.slug ? (
                  <p className="text-[11px] text-[var(--muted)] bg-violet-50 rounded-lg px-3 py-2">
                    Lands on this plan&apos;s section of{" "}
                    <span className="font-medium">/p/{listing.slug}</span> and
                    counts as a scan for the plan (per-unit analytics).
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    Publish this property&apos;s page (Page tab) to activate.
                  </p>
                )}
              </div>
            ) : (
              <label className="block">
                <span className="text-xs text-[var(--muted)]">Destination URL</span>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="https://example.com/landing"
                  className="input w-full mt-1"
                />
              </label>
            )}
          </div>
        ) : (
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Static content</span>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="URL or text to encode"
              className="input w-full mt-1"
            />
          </label>
        )}

        <p className="text-[11px] text-[var(--muted)] break-all bg-neutral-50 rounded-lg px-3 py-2">
          Encodes: {value}
        </p>

        {/* styling */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Foreground</span>
            <input
              type="color"
              value={style.fill_color}
              onChange={(e) => patchStyle({ fill_color: e.target.value })}
              className="w-full h-10 border border-[var(--border)] rounded-xl mt-1 cursor-pointer"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Background</span>
            <input
              type="color"
              value={style.back_color}
              onChange={(e) => patchStyle({ back_color: e.target.value })}
              className="w-full h-10 border border-[var(--border)] rounded-xl mt-1 cursor-pointer"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Module shape</span>
            <select
              value={style.module_style}
              onChange={(e) =>
                patchStyle({ module_style: e.target.value as QrStyle["module_style"] })
              }
              className="input w-full mt-1"
            >
              {MODULE_STYLES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-[var(--muted)]">Error correction</span>
            <select
              value={style.error_correction}
              onChange={(e) =>
                patchStyle({
                  error_correction: e.target.value as QrStyle["error_correction"],
                })
              }
              className="input w-full mt-1"
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
          <span className="text-xs text-[var(--muted)]">Centre logo</span>
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
                className="text-xs text-red-500 hover:text-red-600"
              >
                remove
              </button>
            )}
          </div>
          {style.logo_url && (
            <label className="block">
              <span className="text-xs text-[var(--muted)]">
                Logo size: {Math.round(style.logo_scale * 100)}%
              </span>
              <input
                type="range"
                min={0.1}
                max={0.4}
                step={0.02}
                value={style.logo_scale}
                onChange={(e) => patchStyle({ logo_scale: Number(e.target.value) })}
                className="w-full accent-violet-600"
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={save}
            disabled={busy === "save"}
            className="btn btn-primary"
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => exportImage("png")}
            disabled={busy === "png"}
            className="btn btn-secondary"
          >
            {busy === "png" ? "…" : "Export PNG"}
          </button>
          <button
            onClick={() => exportImage("svg")}
            disabled={busy === "svg"}
            className="btn btn-secondary"
          >
            {busy === "svg" ? "…" : "Export SVG"}
          </button>
          <button
            onClick={remove}
            disabled={busy === "delete"}
            className="btn btn-danger"
          >
            Delete
          </button>
        </div>
        {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}
      </div>

      {/* preview + analytics */}
      <div className="space-y-5">
        <div>
          <QrPreview value={value} style={style} />
          <p className="text-[11px] text-[var(--muted)] mt-1">
            The downloaded file uses the same renderer as this preview, so they
            match exactly.
          </p>
        </div>
        <div className="border-t border-[var(--border)] pt-4">
          <Analytics code={code} />
        </div>
      </div>
    </div>
  );
}
