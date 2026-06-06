"use client";

// Instant client-side preview using qr-code-styling. This is an APPROXIMATION:
// the authoritative download comes from the Render service (which honours all six
// module shapes exactly). Loaded lazily in the browser to avoid SSR DOM access.
import { useEffect, useRef } from "react";
import type { Options, DotType } from "qr-code-styling";
import type { QrStyle, ModuleStyle } from "@/lib/types";

// Map our module styles to qr-code-styling dot types (best-effort).
const DOT_TYPE: Record<ModuleStyle, DotType> = {
  square: "square",
  rounded: "rounded",
  circle: "dots",
  gapped: "square",
  vertical: "classy",
  horizontal: "classy-rounded",
};

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
  // qr-code-styling instance (typed loosely; lib has no bundled types we rely on)
  const qrRef = useRef<{ append: (el: HTMLElement) => void; update: (o: object) => void } | null>(null);

  const options: Partial<Options> = {
    width: size,
    height: size,
    type: "canvas",
    data: value || " ",
    margin: style.border * 2,
    qrOptions: {
      errorCorrectionLevel: style.logo_url ? "H" : style.error_correction,
    },
    dotsOptions: {
      color: style.fill_color,
      type: DOT_TYPE[style.module_style] ?? "square",
    },
    backgroundOptions: { color: style.back_color },
    image: style.logo_url || undefined,
    imageOptions: { crossOrigin: "anonymous", imageSize: style.logo_scale, margin: 4 },
  };

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
