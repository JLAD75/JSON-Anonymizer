export type DetectedEncoding =
  | 'utf-8-bom'
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'windows-1252';

export interface DecodedFile {
  text: string;
  encoding: DetectedEncoding;
  /** True if we had to fall back to a legacy encoding (no BOM, not valid UTF-8). */
  fallbackUsed: boolean;
}

/**
 * Reads a `File` as text using a best-effort encoding detection:
 *
 *   1. Look for a UTF-8 / UTF-16 BOM and strip it.
 *   2. Try strict UTF-8 (fatal mode) — succeeds for all well-formed UTF-8 input
 *      (which covers ASCII as well: ASCII is a subset of UTF-8).
 *   3. Fall back to **windows-1252**, the de facto Western-Europe single-byte
 *      encoding on Windows. It's a strict superset of ISO-8859-1 (Latin-1)
 *      and covers what most R / Excel / legacy exports produce on Windows
 *      when "UTF-8 without BOM" is not explicitly selected.
 *
 * The `fallbackUsed` flag lets callers warn the user so they can fix their
 * upstream exporter (e.g. `write_json(x, "f.json", auto_unbox = TRUE)` in R
 * defaults to UTF-8 on Linux/macOS but to the system locale on Windows).
 */
export async function decodeFile(file: File): Promise<DecodedFile> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. BOM-based detection (authoritative when present).
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf-8-bom',
      fallbackUsed: false,
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      encoding: 'utf-16le',
      fallbackUsed: false,
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      encoding: 'utf-16be',
      fallbackUsed: false,
    };
  }

  // 2. No BOM — try strict UTF-8 first. `fatal: true` throws on the first
  //    invalid byte sequence, which is exactly what we want to distinguish
  //    "well-formed UTF-8 without BOM" from "Latin-1 mistakenly served as UTF-8".
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8', fallbackUsed: false };
  } catch {
    // 3. Fall back to windows-1252. The decoder is lossless for any single
    //    byte (every 0x00..0xFF maps to a codepoint), so this cannot fail.
    const text = new TextDecoder('windows-1252').decode(bytes);
    return { text, encoding: 'windows-1252', fallbackUsed: true };
  }
}

export const ENCODING_LABELS: Record<DetectedEncoding, string> = {
  'utf-8-bom': 'UTF‑8 (avec BOM)',
  'utf-8': 'UTF‑8',
  'utf-16le': 'UTF‑16 LE',
  'utf-16be': 'UTF‑16 BE',
  'windows-1252': 'Windows‑1252 / Latin‑1',
};
