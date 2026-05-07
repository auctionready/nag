import { customType } from "drizzle-orm/sqlite-core";

const HEX = "0123456789abcdef";

const parseUuid = (s: string): Uint8Array => {
  const bytes = new Uint8Array(16);
  let bi = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x2d) continue; // '-'
    const hi = hexNibble(c);
    const lo = hexNibble(s.charCodeAt(++i));
    bytes[bi++] = (hi << 4) | lo;
  }
  if (bi !== 16) throw new Error(`uuid: bad input "${s}"`);
  return bytes;
};

const hexNibble = (c: number): number => {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  throw new Error(`uuid: non-hex char "${String.fromCharCode(c)}"`);
};

const formatUuid = (bytes: Uint8Array): string => {
  if (bytes.length !== 16)
    throw new Error(`uuid: expected 16 bytes, got ${bytes.length}`);
  let out = "";
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += "-";
    const b = bytes[i];
    out += HEX[b >> 4] + HEX[b & 0xf];
  }
  return out;
};

/**
 * 16-byte BLOB column surfaced as a canonical 36-char UUID string.
 * Halves the storage of TEXT UUIDs and tightens index compares; the JS
 * surface stays as plain strings so call sites and wire formats are
 * unchanged.
 */
export const uuid = customType<{ data: string; driverData: Uint8Array }>({
  dataType: () => "blob",
  toDriver: (value) => parseUuid(value),
  fromDriver: (value) => formatUuid(value),
});
