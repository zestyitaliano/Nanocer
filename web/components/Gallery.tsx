"use client";

// Lightweight swipeable image gallery: CSS scroll-snap (free mobile swipe) plus
// arrow buttons + dots for desktop. No external deps.
import { useRef, useState } from "react";

export default function Gallery({
  images,
  alt = "",
  aspect = "4 / 3",
  rounded = false,
}: {
  images: string[];
  alt?: string;
  aspect?: string;
  rounded?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const imgs = images.filter(Boolean);
  if (imgs.length === 0) return null;

  const radius = rounded ? "rounded-xl" : "";

  if (imgs.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imgs[0]} alt={alt} className={`w-full object-cover ${radius}`} style={{ aspectRatio: aspect }} />
    );
  }

  function go(dir: number) {
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(imgs.length - 1, idx + dir));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIdx(next);
  }
  function onScroll() {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="relative group">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {imgs.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`${alt} ${i + 1}`}
            className={`w-full shrink-0 snap-center object-cover ${radius}`}
            style={{ aspectRatio: aspect }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        disabled={idx === 0}
        aria-label="Previous photo"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 shadow grid place-items-center text-lg disabled:opacity-0 transition"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={idx === imgs.length - 1}
        aria-label="Next photo"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 shadow grid place-items-center text-lg disabled:opacity-0 transition"
      >
        ›
      </button>

      <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5">
        {imgs.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
