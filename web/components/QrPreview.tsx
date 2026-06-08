"use client";

// Live preview using qr-code-styling. Shares buildOptions() with the export path
// (lib/qr-styling.ts), so the preview matches the downloaded file exactly.
import { useEffect, useRef } from "react";
import { buildOptions } from "@/lib/qr-styling";
import type { QrStyle } from "@/lib/types";

export default function QrPreview({
  value,
  style,
  size = 280,
}: {
  value: string;
  style: QrStyle;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<{ append: (el: HTMLElement) => void; update: (o: object) => void } | null>(null);

  const options = buildOptions(value, style, size, "canvas");

  // Create once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("qr-code-styling");
      if (cancelled || !ref.current) return;
      const QRCodeStyling = mod.default;
      const inst = new QRCodeStyling(options);
      qrRef.current = inst as unknown as typeof qrRef.current;
      ref.current.innerHTML = "";
      inst.append(ref.current);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update on any style/value change.
  useEffect(() => {
    qrRef.current?.update(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, JSON.stringify(style), size]);

  return (
    <div
      ref={ref}
      className="rounded-lg border bg-white p-2 inline-block"
      style={{ lineHeight: 0 }}
    />
  );
}
