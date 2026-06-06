// URL-safe short codes, mirroring the desktop app's qrgen/shortcode.py:
// 27-char alphabet with ambiguous chars (0 o 1 l i) removed.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const DEFAULT_LENGTH = 7;

export function newShortCode(length = DEFAULT_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
