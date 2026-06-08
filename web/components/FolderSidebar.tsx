"use client";

import { useState } from "react";
import type { Folder } from "@/lib/types";

export type FolderFilter = "all" | "unfiled" | string;

export default function FolderSidebar({
  folders,
  counts,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  counts: { all: number; unfiled: number; byId: Record<string, number> };
  selected: FolderFilter;
  onSelect: (f: FolderFilter) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const item = (key: FolderFilter, label: string, count: number) => (
    <button
      onClick={() => onSelect(key)}
      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm flex justify-between items-center ${
        selected === key ? "bg-blue-50 text-blue-700" : "hover:bg-neutral-100"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-neutral-400">{count}</span>
    </button>
  );

  return (
    <aside className="space-y-1">
      {item("all", "All codes", counts.all)}
      {item("unfiled", "Unfiled", counts.unfiled)}

      <div className="pt-3 pb-1 px-3 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
          Folders
        </span>
        <button
          onClick={() => {
            const name = window.prompt("New folder name:")?.trim();
            if (name) onCreate(name);
          }}
          className="text-blue-600 text-sm"
          aria-label="new folder"
        >
          +
        </button>
      </div>

      {folders.length === 0 && (
        <p className="px-3 text-xs text-neutral-400">No folders yet.</p>
      )}

      {folders.map((f) => (
        <div key={f.id} className="relative group flex items-center">
          <button
            onClick={() => onSelect(f.id)}
            className={`flex-1 text-left px-3 py-1.5 rounded-lg text-sm flex justify-between items-center ${
              selected === f.id ? "bg-blue-50 text-blue-700" : "hover:bg-neutral-100"
            }`}
          >
            <span className="truncate">📁 {f.name}</span>
            <span className="text-xs text-neutral-400">{counts.byId[f.id] ?? 0}</span>
          </button>
          <button
            onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}
            className="px-1 text-neutral-400 hover:text-neutral-700"
            aria-label="folder actions"
          >
            ⋯
          </button>
          {menuFor === f.id && (
            <div className="absolute right-0 top-8 z-10 w-32 bg-white border rounded-lg shadow-lg text-sm py-1">
              <button
                onClick={() => {
                  setMenuFor(null);
                  const name = window.prompt("Rename folder:", f.name)?.trim();
                  if (name) onRename(f.id, name);
                }}
                className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setMenuFor(null);
                  if (
                    window.confirm(
                      `Delete folder “${f.name}”? Its codes move to Unfiled.`,
                    )
                  )
                    onDelete(f.id);
                }}
                className="block w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
