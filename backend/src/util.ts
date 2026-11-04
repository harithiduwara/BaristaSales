// Small pure helpers that work in Apps Script, Node and the browser.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0) as number;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return out;
}

/** UTF-8 string → base64url without padding. */
export function b64uEncode(s: string): string {
  const b = utf8Bytes(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] as number) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += (B64[(n >> 18) & 63] as string) + (B64[(n >> 12) & 63] as string);
    if (i + 1 < b.length) out += B64[(n >> 6) & 63] as string;
    if (i + 2 < b.length) out += B64[n & 63] as string;
  }
  return out;
}

/** base64url → UTF-8 string. Returns null for malformed input. */
export function b64uDecode(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(bytes.map((x) => `%${x.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return null;
  }
}

/** Compares two strings in time that depends only on their length. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Bytes (signed or unsigned, as Apps Script returns them) → lowercase hex. */
export const bytesToHex = (bytes: readonly number[]): string =>
  bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
