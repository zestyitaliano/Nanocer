// Single source of truth for QR rendering with qr-code-styling. Both the live
// preview and the downloaded files (PNG/SVG/batch) use buildOptions(), so what
// you see is exactly what you export — logos included.
import type { Options, DotType, FileExtension } from "qr-code-styling";
import type { QrStyle, ModuleStyle } from "./types";

const DOT_TYPE: Record<ModuleStyle, DotType> = {
  square: "square",
  rounded: "rounded",
  circle: "dots",
  gapped: "square",
  vertical: "classy",
  horizontal: "classy-rounded",
};

export function buildOptions(
  value: string,
  style: QrStyle,
  size: number,
  type: "canvas" | "svg" = "canvas",
): Partial<Options> {
  const dot = DOT_TYPE[style.module_style] ?? "square";
  // Quiet zone proportional to size so preview (small) and export (large) match.
  const margin = Math.round((size / 32) * style.border);
  return {
    width: size,
    height: size,
    type,
    data: value || " ",
    margin,
    qrOptions: {
      errorCorrectionLevel: style.logo_url ? "H" : style.error_correction,
    },
    dotsOptions: { color: style.fill_color, type: dot },
    cornersSquareOptions: { color: style.fill_color },
    cornersDotOptions: { color: style.fill_color },
    backgroundOptions: { color: style.back_color },
    image: style.logo_url || undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      imageSize: style.logo_scale,
      margin: Math.round(size * 0.02),
      hideBackgroundDots: true,
    },
  };
}

// Generate a downloadable blob using the same engine/options as the preview.
export async function generateBlob(
  value: string,
  style: QrStyle,
  format: "png" | "svg",
): Promise<Blob> {
  const mod = await import("qr-code-styling");
  const QRCodeStyling = mod.default;
  const inst = new QRCodeStyling(
    buildOptions(value, style, 1024, format === "svg" ? "svg" : "canvas"),
  );
  const data = await inst.getRawData(format as FileExtension);
  if (!data) throw new Error("QR generation failed");
  return data instanceof Blob ? data : new Blob([data as BlobPart]);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
