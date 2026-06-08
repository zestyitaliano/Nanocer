"use client";

import { useState } from "react";
import { encodedValue, type QrCode, type Folder } from "@/lib/types";
import { siteUrl } from "@/lib/api";
import QrThumb from "./QrThumb";

export default function CodeCard({
  code,
  folders,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
}: {
  code: QrCode;
  folders: Folder[];
  onOpen: () => void;
  onDuplicate: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const value = encodedValue(code, siteUrl());

  function act(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenu(false);
      setMoveOpen(false);
      fn();
    };
  }

  return (
    <div
      onClick={onOpen}
      className="group relative bg-white border rounded-xl p-3 hover:shadow-md transition cursor-pointer flex flex-col"
    >
      <div className="flex justify-center">
        <QrThumb value={value} style={code.style} size={128} />
      </div>

      <div className="mt-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">
            {code.title || "(untitled)"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenu((m) => !m);
              setMoveOpen(false);
            }}
            className="text-neutral-400 hover:text-neutral-700 px-1 shrink-0"
            aria-label="actions"
          >
            ⋯
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
          <span
            className={`px-1.5 py-0.5 rounded ${
              code.is_dynamic
                ? "bg-blue-50 text-blue-700"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {code.is_dynamic ? "dynamic" : "static"}
          </span>
          {code.is_dynamic && <span>{code.scan_count} scans</span>}
        </div>
      </div>

      {menu && (
        <div
          className="absolute right-2 top-10 z-10 w-44 bg-white border rounded-lg shadow-lg text-sm py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={act(onOpen)} className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50">
            Open
          </button>
          <button onClick={act(onDuplicate)} className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50">
            Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMoveOpen((m) => !m);
            }}
            className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50"
          >
            Move to folder →
          </button>
          {moveOpen && (
            <div className="max-h-44 overflow-auto border-t">
              <button
                onClick={act(() => onMove(null))}
                className={`block w-full text-left px-5 py-1.5 hover:bg-neutral-50 ${
                  code.folder_id === null ? "font-semibold" : ""
                }`}
              >
                Unfiled
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={act(() => onMove(f.id))}
                  className={`block w-full text-left px-5 py-1.5 hover:bg-neutral-50 truncate ${
                    code.folder_id === f.id ? "font-semibold" : ""
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={act(onDelete)}
            className="block w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 border-t"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
