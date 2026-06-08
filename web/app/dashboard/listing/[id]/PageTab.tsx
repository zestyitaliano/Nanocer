"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/api";
import type { Listing, PageConfig } from "@/lib/types";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function PageTab({
  listing,
  userId,
  onSaved,
}: {
  listing: Listing;
  userId: string;
  onSaved: (patch: Partial<Listing>) => void;
}) {
  const supabase = createClient();
  const cfg0 = (listing.page_config ?? {}) as PageConfig;
  const [enabled, setEnabled] = useState(listing.page_enabled);
  const [slug, setSlug] = useState(
    listing.slug || slugify(listing.address || listing.name || ""),
  );
  const [photos, setPhotos] = useState<string[]>(cfg0.photos ?? []);
  const [agent, setAgent] = useState(cfg0.agent ?? {});
  const [cta, setCta] = useState<NonNullable<PageConfig["cta"]>>(
    cfg0.cta ?? { type: "tour" },
  );
  const [color, setColor] = useState(cfg0.theme?.color ?? "#1a73e8");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const publicUrl = `${siteUrl().replace(/\/$/, "")}/p/${slug}`;

  async function upload(file: File, single = false): Promise<string | null> {
    const path = `${userId}/${listing.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("listing-photos")
      .upload(path, file, { upsert: true });
    if (error) {
      setMsg(error.message);
      return null;
    }
    return supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setBusy(true);
    const urls: string[] = [];
    for (const f of files) {
      const u = await upload(f);
      if (u) urls.push(u);
    }
    setPhotos((p) => [...p, ...urls]);
    setBusy(false);
    e.target.value = "";
  }

  async function setAgentPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const u = await upload(f, true);
    if (u) setAgent((a) => ({ ...a, photo_url: u }));
    setBusy(false);
    e.target.value = "";
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const page_config: PageConfig = { photos, agent, cta, theme: { color } };
    const patch = {
      page_enabled: enabled,
      slug: enabled ? slug : listing.slug,
      template: "property",
      page_config,
    };
    const { error } = await supabase.from("listings").update(patch).eq("id", listing.id);
    setBusy(false);
    if (error) {
      setMsg(
        error.code === "23505"
          ? "That page URL is taken — try a different slug."
          : error.message,
      );
      return;
    }
    onSaved(patch as Partial<Listing>);
    setMsg("Saved.");
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4 max-w-xl">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Publish public property page
      </label>

      <label className="block">
        <span className="text-xs text-neutral-500">Page URL</span>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-neutral-400">/p/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="flex-1 border rounded-lg px-2 py-1.5"
            placeholder="123-main-st"
          />
        </div>
        {enabled && slug && (
          <div className="mt-1 text-xs text-neutral-500 flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 truncate">
              {publicUrl}
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="text-blue-600"
            >
              Copy
            </button>
          </div>
        )}
      </label>

      <div>
        <span className="text-xs text-neutral-500">Photos</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-16 h-16 object-cover rounded border" />
              <button
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-white border rounded-full w-5 h-5 text-xs text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="w-16 h-16 border border-dashed rounded flex items-center justify-center text-neutral-400 text-xl cursor-pointer">
            +
            <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
          </label>
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <span className="text-xs font-medium text-neutral-500">Agent</span>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Name" value={agent.name ?? ""} onChange={(e) => setAgent({ ...agent, name: e.target.value })} className="border rounded-lg px-2 py-1.5 text-sm" />
          <input placeholder="Phone" value={agent.phone ?? ""} onChange={(e) => setAgent({ ...agent, phone: e.target.value })} className="border rounded-lg px-2 py-1.5 text-sm" />
          <input placeholder="Email" value={agent.email ?? ""} onChange={(e) => setAgent({ ...agent, email: e.target.value })} className="border rounded-lg px-2 py-1.5 text-sm col-span-2" />
        </div>
        <label className="text-xs text-neutral-500 flex items-center gap-2">
          Photo:
          <input type="file" accept="image/*" onChange={setAgentPhoto} className="text-xs" />
          {agent.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
        </label>
      </div>

      <div className="border-t pt-3 space-y-2">
        <span className="text-xs font-medium text-neutral-500">
          Primary button (besides the tour form)
        </span>
        <div className="flex gap-2 items-center">
          <select
            value={cta.type}
            onChange={(e) =>
              setCta({ ...cta, type: e.target.value as "tour" | "text" | "link" })
            }
            className="border rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="tour">Tour form only</option>
            <option value="text">Text me</option>
            <option value="link">External link</option>
          </select>
          {cta.type !== "tour" && (
            <input
              placeholder={cta.type === "text" ? "Phone number" : "https://…"}
              value={cta.value ?? ""}
              onChange={(e) => setCta({ ...cta, value: e.target.value })}
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Accent color
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 border rounded" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60">
          {busy ? "Saving…" : "Save page"}
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
      </div>
    </div>
  );
}
