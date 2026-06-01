import {
  CITIES,
  COMPANY_NAMES,
  EMAIL_DOMAINS,
  FIRST_NAMES,
  LAST_NAMES,
  randomFrom,
} from '@/lib/fakeData';
import type { JsonValue, VariableConfig, VariableType } from '@/types';

/* ------------------------------------------------------------------ */
/* Seeded PRNG (xmur3 hasher + sfc32 stream)                          */
/* ------------------------------------------------------------------ */

/** Mixes a string into a 32-bit state used to seed `sfc32`. */
function xmur3(input: string): () => number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32 PRNG — small, fast, good distribution for our needs (not crypto). */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function next(): number {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Builds a deterministic random stream from a string seed. */
function makeRng(seed: string): () => number {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

/**
 * Computes a hex SHA-256 of the input. Used once per session as the
 * "file fingerprint" that salts every deterministic shuffle.
 */
export async function computeFileSeed(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hash);
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
  }
  // Fallback for very old runtimes: a (weaker) string fold.
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* Numeric                                                            */
/* ------------------------------------------------------------------ */

function decimalCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const s = Math.abs(value).toString();
  if (s.includes('e') || s.includes('E')) {
    // Exponential form (rare) — fall back to a reasonable default
    return 0;
  }
  const idx = s.indexOf('.');
  return idx === -1 ? 0 : s.length - idx - 1;
}

function randomDigit(): number {
  return Math.floor(Math.random() * 10);
}

function buildSimilarInteger(magnitude: number, originalAbs: number): number {
  // Same digit count, different value.
  const digits = magnitude === 0 ? 1 : Math.floor(Math.log10(magnitude)) + 1;
  if (digits <= 1) {
    // Single digit: pick another digit in 0..9.
    let pick = randomDigit();
    let safety = 0;
    while (pick === originalAbs && safety < 12) {
      pick = randomDigit();
      safety += 1;
    }
    return pick;
  }
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  let pick = Math.floor(Math.random() * (max - min + 1)) + min;
  let safety = 0;
  while (pick === originalAbs && safety < 12) {
    pick = Math.floor(Math.random() * (max - min + 1)) + min;
    safety += 1;
  }
  return pick;
}

export interface NumericBounds {
  min?: number;
  max?: number;
}

function roundToDecimals(value: number, decimals: number): number {
  if (decimals <= 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampInside(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function anonymizeNumber(value: number, bounds?: NumericBounds): number {
  if (!Number.isFinite(value)) return value;
  // When both bounds are provided, sample uniformly inside [min, max]
  // and round to the same number of decimals as the original.
  if (bounds && bounds.min !== undefined && bounds.max !== undefined) {
    let lo = bounds.min;
    let hi = bounds.max;
    if (lo > hi) [lo, hi] = [hi, lo]; // swap if user inverted them
    const decimals = decimalCount(value);
    const step = decimals > 0 ? 10 ** -decimals : 1;
    if (hi - lo < step) {
      // Range is too narrow to produce a distinct value — return the closest bound.
      return clampInside(value === lo ? hi : lo, lo, hi);
    }
    let result = roundToDecimals(lo + Math.random() * (hi - lo), decimals);
    let safety = 0;
    while (result === value && safety < 8) {
      result = roundToDecimals(lo + Math.random() * (hi - lo), decimals);
      safety += 1;
    }
    return clampInside(result, lo, hi);
  }
  // Default behaviour: preserve magnitude / sign / decimals, change the value.
  if (value === 0) {
    return Math.floor(Math.random() * 9) + 1;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const decimals = decimalCount(value);
  if (decimals === 0 && Number.isInteger(abs)) {
    return sign * buildSimilarInteger(abs, abs);
  }
  const intPart = Math.trunc(abs);
  const newInt = buildSimilarInteger(intPart, intPart);
  let decString = '';
  for (let i = 0; i < decimals; i += 1) decString += randomDigit().toString();
  const combined = parseFloat(`${newInt}.${decString || '0'}`);
  if (combined === abs) {
    return sign * (combined + 10 ** -decimals);
  }
  return sign * combined;
}

/* ------------------------------------------------------------------ */
/* Strings (lists + char shuffle)                                     */
/* ------------------------------------------------------------------ */

/**
 * Mirrors the case profile of `original` onto `pick`. Three cases are
 * detected — *all upper*, *all lower*, otherwise the picked value's own
 * casing is kept. We deliberately do NOT try to do mixed-case matching
 * (e.g. "Mac Donald") because that requires word-aligned heuristics that
 * would be wrong more often than right on free-form company names.
 */
function applyCase(original: string, pick: string): string {
  if (!/\p{L}/u.test(original)) return pick;
  if (original === original.toUpperCase()) return pick.toUpperCase();
  if (original === original.toLowerCase()) return pick.toLowerCase();
  return pick;
}

export function anonymizeCompanyName(current: string): string {
  return applyCase(current, randomFrom(COMPANY_NAMES, current));
}

export function anonymizeFirstName(current: string): string {
  return applyCase(current, randomFrom(FIRST_NAMES, current));
}

export function anonymizeLastName(current: string): string {
  return applyCase(current, randomFrom(LAST_NAMES, current));
}

/**
 * Replaces a city by another (real but unrelated) francophone city,
 * mirroring the casing of the original (`PARIS` → `MARSEILLE`,
 * `paris` → `marseille`, `Paris` → `Marseille`).
 */
export function anonymizeCity(current: string): string {
  return applyCase(current, randomFrom(CITIES, current));
}

/**
 * Replaces a "Prénom Nom" / "Nom Prénom" value by a random pair drawn from
 * the same lists. Tries to preserve the original separator + casing pattern
 * (e.g. "DUPONT JEAN" → "ROUSSEL CAMILLE", "Dupont, Jean" → "Roussel, Camille").
 */
export function anonymizeFullName(current: string): string {
  const trimmed = current.trim();
  if (!trimmed) return current;

  // Detect the separator used between the two name parts.
  const separators: Array<[RegExp, string]> = [
    [/,\s+/, ', '],
    [/\s+-\s+/, ' - '],
    [/\s+/, ' '],
  ];
  let sep = ' ';
  let isLastFirst = false;
  for (const [re, asString] of separators) {
    if (re.test(trimmed)) {
      sep = asString;
      // When the original contains a comma, the convention is usually
      // "Last, First" — preserve it.
      if (asString === ', ') isLastFirst = true;
      break;
    }
  }

  const first = randomFrom(FIRST_NAMES);
  const last = randomFrom(LAST_NAMES);
  const composed = isLastFirst ? `${last}${sep}${first}` : `${first}${sep}${last}`;
  const out = applyCase(trimmed, composed);
  return out === trimmed
    ? applyCase(trimmed, `${first}${sep}${randomFrom(LAST_NAMES, last)}`)
    : out;
}

/**
 * Forges a fake e-mail address `prenom.nom@domain` using the existing pools
 * and a reserved-TLD domain (RFC 2606 / 6761). Letters are stripped of
 * diacritics so the result is a syntactically valid SMTP address.
 */
export function anonymizeEmail(current: string): string {
  const first = stripDiacritics(randomFrom(FIRST_NAMES)).toLowerCase();
  const last = stripDiacritics(randomFrom(LAST_NAMES)).toLowerCase();
  // Try to keep the original domain only if it already points to a reserved
  // sentinel TLD; otherwise pick one from our pool. This avoids leaking the
  // real provider while preserving the shape when the input was already fake.
  let domain = randomFrom(EMAIL_DOMAINS);
  const atIdx = current.lastIndexOf('@');
  if (atIdx > 0) {
    const originalDomain = current.slice(atIdx + 1).toLowerCase();
    if (/\.(example|test|invalid|localhost)$/.test(originalDomain)) {
      domain = originalDomain;
    }
  }
  const local = `${first}.${last}`.replace(/[^a-z0-9._-]/g, '');
  return `${local}@${domain}`;
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

/**
 * Replaces each "interesting" character of `value` with a pseudo-random one
 * drawn from the same bucket (lowercase / uppercase / digit). Spaces and
 * punctuation are preserved so the result keeps the shape of the original
 * (e.g. "+33 6 12 34 56 78" → "+87 4 91 03 27 65"). The substitution is
 * deterministic for a given `(fileSeed, value)` pair, which means:
 *
 *   • re-running the anonymisation on the same file produces the same output,
 *   • two identical original values yield the same anonymised value
 *     (consistent within the file),
 *   • the result cannot be reverted to the original without knowing the
 *     fingerprint of the source document.
 */
export function shuffleOther(value: string, fileSeed: string): string {
  if (value.length === 0) return value;
  const rng = makeRng(`${fileSeed}::${value}`);
  let out = '';
  let attempts = 0;
  while (attempts < 6) {
    out = mapChars(value, rng);
    // On very short or low-entropy strings the PRNG could pick the same
    // character — re-roll a few times so the output is visibly different.
    if (out !== value) break;
    attempts += 1;
  }
  return out;
}

function mapChars(value: string, rng: () => number): string {
  let out = '';
  for (const ch of value) {
    out += substituteChar(ch, rng);
  }
  return out;
}

function substituteChar(ch: string, rng: () => number): string {
  // ASCII fast paths — case preserved by construction.
  if (ch >= 'a' && ch <= 'z') return LOWER[Math.floor(rng() * 26)];
  if (ch >= 'A' && ch <= 'Z') return UPPER[Math.floor(rng() * 26)];
  if (ch >= '0' && ch <= '9') return DIGITS[Math.floor(rng() * 10)];

  // Accented Latin letters (é, ñ, É, Ç, …): look at the *base* character via
  // NFD decomposition to detect the case, then output a plain ASCII letter
  // of the same case. We drop the diacritic on purpose: trying to keep it
  // would break the one-character-in / one-character-out invariant (some
  // letter+accent pairs have no NFC pre-composition and end up as 2 cps).
  const decomposed = ch.normalize('NFD');
  if (decomposed.length > 0) {
    const base = decomposed.charCodeAt(0);
    if (base >= 97 /* 'a' */ && base <= 122 /* 'z' */) return LOWER[Math.floor(rng() * 26)];
    if (base >= 65 /* 'A' */ && base <= 90 /* 'Z' */) return UPPER[Math.floor(rng() * 26)];
  }

  // Non-Latin scripts (Greek, Cyrillic, …) and ligatures (œ, ß, …): substitute
  // with an ASCII letter of the same case bucket.
  if (/\p{Ll}/u.test(ch)) return LOWER[Math.floor(rng() * 26)];
  if (/\p{Lu}/u.test(ch)) return UPPER[Math.floor(rng() * 26)];
  if (/\p{Lt}/u.test(ch)) return UPPER[Math.floor(rng() * 26)]; // titlecase → uppercase

  // Spaces, punctuation, symbols — preserved (no PII, anchors the silhouette).
  return ch;
}

/* ------------------------------------------------------------------ */
/* Apply config to a full JSON tree                                   */
/* ------------------------------------------------------------------ */

export function anonymizeValue(
  value: JsonValue,
  type: VariableType,
  fileSeed: string,
  bounds?: NumericBounds,
): JsonValue {
  if (value === null || value === undefined) return value;
  switch (type) {
    case 'numeric': {
      if (typeof value === 'number') return anonymizeNumber(value, bounds);
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return anonymizeNumber(parsed, bounds);
      return typeof value === 'string' ? shuffleOther(value, fileSeed) : value;
    }
    case 'companyName':
      return anonymizeCompanyName(typeof value === 'string' ? value : String(value));
    case 'firstName':
      return anonymizeFirstName(typeof value === 'string' ? value : String(value));
    case 'lastName':
      return anonymizeLastName(typeof value === 'string' ? value : String(value));
    case 'fullName':
      return anonymizeFullName(typeof value === 'string' ? value : String(value));
    case 'email':
      return anonymizeEmail(typeof value === 'string' ? value : String(value));
    case 'city':
      return anonymizeCity(typeof value === 'string' ? value : String(value));
    case 'other':
    default:
      if (typeof value === 'string') return shuffleOther(value, fileSeed);
      if (typeof value === 'number') return anonymizeNumber(value);
      return value;
  }
}

interface ApplyOptions {
  configs: readonly VariableConfig[];
  /** Hex SHA-256 of the source document — salts the deterministic "Other" shuffle. */
  fileSeed: string;
}

/**
 * Returns a deep-copy of `input` with leaves anonymized according to `configs`.
 * Arrays and objects are recreated; original tree is left untouched.
 */
export function applyAnonymization(input: JsonValue, options: ApplyOptions): JsonValue {
  const map = new Map<string, VariableConfig>();
  for (const c of options.configs) map.set(c.path, c);
  const { fileSeed } = options;

  const visit = (node: JsonValue, path: string): JsonValue => {
    if (node === null) return resolveLeaf(node, path);
    if (Array.isArray(node)) return node.map((item) => visit(item, `${path}[]`));
    if (typeof node === 'object') {
      const out: { [key: string]: JsonValue } = {};
      for (const key of Object.keys(node)) {
        const child = (node as Record<string, JsonValue>)[key];
        out[key] = visit(child, path ? `${path}.${key}` : key);
      }
      return out;
    }
    return resolveLeaf(node, path);
  };

  const resolveLeaf = (node: JsonValue, path: string): JsonValue => {
    const cfg = map.get(path || '$');
    if (!cfg || !cfg.anonymize) return node;
    const bounds: NumericBounds | undefined =
      cfg.type === 'numeric' && (cfg.numericMin !== undefined || cfg.numericMax !== undefined)
        ? { min: cfg.numericMin, max: cfg.numericMax }
        : undefined;
    return anonymizeValue(node, cfg.type, fileSeed, bounds);
  };

  return visit(input, '');
}

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  numeric: 'Numérique',
  companyName: 'Raison sociale',
  lastName: 'Nom',
  firstName: 'Prénom',
  fullName: 'Nom et prénom',
  email: 'Email',
  city: 'Ville',
  other: 'Autre',
};

export const VARIABLE_TYPE_DESCRIPTIONS: Record<VariableType, string> = {
  numeric: 'Génère un nombre du même format (entier ou décimales) mais différent.',
  companyName: 'Remplace par une raison sociale fictive piochée au hasard.',
  lastName: 'Remplace par un nom de famille fictif piochée au hasard.',
  firstName: 'Remplace par un prénom fictif piochée au hasard.',
  fullName:
    'Remplace par « Prénom Nom » fictif en préservant le séparateur (espace, virgule) et la casse de l’original.',
  email:
    'Forge une adresse fictive prenom.nom@example.* (TLD réservé RFC 2606, donc jamais réelle).',
  city:
    'Remplace par une autre ville (vraie commune francophone) tirée au hasard, casse préservée.',
  other:
    'Substitue chaque caractère par un autre du même type (lettre/chiffre) en conservant la casse, via un générateur seedé par le SHA‑256 du fichier — irréversible.',
};
