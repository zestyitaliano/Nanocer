"use client";

// Small QR thumbnail for cards. Lazy-mounts via IntersectionObserver so a large
// library doesn't render every canvas at once. Uses the shared buildOptions so
// thumbnails match the preview/export.
import { useEffect, useRef, useState } from "react";
import { buildOptions } from "@/lib/qr-styling";
import type { QrStyle } from "@/lib/types";

export default function QrThumb({
  value,
  style,
  size = 128,
}: {
  value: string;
  style: QrStyle;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let cancelled = false;
    (async () => {
      const mod = await import("qr-code-styling");
      if (cancelled || !ref.current) return;
      const inst = new mod.default(buildOptions(value, style, size, "canvas"));
      ref.current.innerHTML = "";
      inst.append(ref.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, value, JSON.stringify(style), size]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      style={{ width: size, height: size, lineHeight: 0 }}
      className="bg-white rounded"
    />
  );
}
