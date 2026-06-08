import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// PP Frama — headline / display face.
const frama = localFont({
  src: [
    { path: "./fonts/PPFrama-Extralight.otf", weight: "200", style: "normal" },
    { path: "./fonts/PPFrama-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/PPFrama-RegularItalic.otf", weight: "400", style: "italic" },
    { path: "./fonts/PPFrama-Black.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-frama",
  display: "swap",
});

// GT Pressura — body + accent face (used for everything else, incl. UI controls).
const pressura = localFont({
  src: [
    { path: "./fonts/GTPressura-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/GTPressura-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GTPressura-RegularItalic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/GTPressura-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GTPressura-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/GTPressura-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-pressura",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nanocer",
  description:
    "Dynamic & static QR codes, hosted property pages, and lead capture — your own owned ILS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${frama.variable} ${pressura.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
