import type { DetectedKind, JsonValue, VariableInfo, VariableType } from '@/types';

const SAMPLE_LIMIT = 5;
const SAMPLE_STRING_MAX = 60;

interface Accumulator {
  path: string;
  kinds: Set<DetectedKind>;
  occurrences: number;
  samples: string[];
  seenSamples: Set<string>;
  numericMin?: number;
  numericMax?: number;
  numericCount: number;
}

function getKind(value: JsonValue): DetectedKind {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'mixed';
}

function sampleOf(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (value.length > SAMPLE_STRING_MAX) {
      return `${value.slice(0, SAMPLE_STRING_MAX)}…`;
    }
    return value;
  }
  return String(value);
}

function resolveKind(kinds: Set<DetectedKind>): DetectedKind {
  if (kinds.size === 0) return 'null';
  if (kinds.size === 1) return kinds.values().next().value as DetectedKind;
  // null + something else ⇒ keep the non-null kind
  if (kinds.size === 2 && kinds.has('null')) {
    for (const k of kinds) if (k !== 'null') return k;
  }
  return 'mixed';
}

/**
 * Walks the JSON tree and aggregates leaf values per generic path.
 * Array indices are collapsed into `[]` so a 10 000-row list yields one variable per field.
 */
export function analyzeJson(data: JsonValue): VariableInfo[] {
  const acc = new Map<string, Accumulator>();

  const record = (path: string, value: JsonValue): void => {
    let entry = acc.get(path);
    if (!entry) {
      entry = {
        path,
        kinds: new Set(),
        occurrences: 0,
        samples: [],
        seenSamples: new Set(),
        numericCount: 0,
      };
      acc.set(path, entry);
    }
    entry.kinds.add(getKind(value));
    entry.occurrences += 1;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (entry.numericMin === undefined || value < entry.numericMin) entry.numericMin = value;
      if (entry.numericMax === undefined || value > entry.numericMax) entry.numericMax = value;
      entry.numericCount += 1;
    }
    if (entry.samples.length < SAMPLE_LIMIT) {
      const s = sampleOf(value);
      if (!entry.seenSamples.has(s)) {
        entry.seenSamples.add(s);
        entry.samples.push(s);
      }
    }
  };

  const walk = (node: JsonValue, path: string): void => {
    if (node === null) {
      record(path || '$', node);
      return;
    }
    if (Array.isArray(node)) {
      if (node.length === 0) {
        record(`${path}[]`, null);
        return;
      }
      for (const item of node) walk(item, `${path}[]`);
      return;
    }
    if (typeof node === 'object') {
      const keys = Object.keys(node);
      if (keys.length === 0) {
        record(path || '$', null);
        return;
      }
      for (const key of keys) {
        const childPath = path ? `${path}.${key}` : key;
        walk(node[key], childPath);
      }
      return;
    }
    record(path || '$', node);
  };

  walk(data, '');

  const variables: VariableInfo[] = [];
  for (const entry of acc.values()) {
    variables.push({
      path: entry.path,
      detectedKind: resolveKind(entry.kinds),
      occurrences: entry.occurrences,
      samples: entry.samples,
      observedMin: entry.numericMin,
      observedMax: entry.numericMax,
      numericCount: entry.numericCount > 0 ? entry.numericCount : undefined,
    });
  }
  variables.sort((a, b) => a.path.localeCompare(b.path, 'fr'));
  return variables;
}

const COMPANY_HINTS = [
  'raison_sociale',
  'raisonsociale',
  'denomination',
  'libelle_entreprise',
  'entreprise',
  'societe',
  'company',
  'enseigne',
  'organisation',
  'siret_libelle',
];
const LAST_NAME_HINTS = ['nom_de_famille', 'nomfamille', 'lastname', 'last_name', 'surname'];
const FIRST_NAME_HINTS = ['prenom', 'prénom', 'firstname', 'first_name', 'givenname', 'given_name'];
const FULL_NAME_HINTS = [
  'nom_complet',
  'nomcomplet',
  'fullname',
  'full_name',
  'nom_prenom',
  'prenom_nom',
  'identite',
  'civilite_complete',
  'displayname',
  'display_name',
  'libelle_personne',
];
const EMAIL_HINTS = [
  'email',
  'e_mail',
  'mail',
  'courriel',
  'adresse_mail',
  'adresse_email',
  'mel',
];
const CITY_HINTS = [
  'ville',
  'city',
  'commune',
  'localite',
  'localité',
  'town',
  'municipality',
  'cityname',
  'city_name',
  'lieu_dit',
  'libelle_commune',
  'libelle_ville',
  'commune_libelle',
];

function lastSegment(path: string): string {
  const cleaned = path.replace(/\[\]/g, '');
  const parts = cleaned.split('.');
  return parts[parts.length - 1] ?? cleaned;
}

/**
 * Suggests an initial variable type based on the field name and detected kind.
 * The user can always override the suggestion in the configure step.
 */
export function suggestType(variable: VariableInfo): VariableType {
  const segment = lastSegment(variable.path).toLowerCase();
  const normalized = segment.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Order matters: more specific matches first.
  if (EMAIL_HINTS.some((h) => normalized.includes(h))) return 'email';
  if (FULL_NAME_HINTS.some((h) => normalized.includes(h))) return 'fullName';
  if (FIRST_NAME_HINTS.some((h) => normalized.includes(h))) return 'firstName';
  if (COMPANY_HINTS.some((h) => normalized.includes(h))) return 'companyName';
  if (CITY_HINTS.some((h) => normalized.includes(h))) return 'city';
  if (LAST_NAME_HINTS.some((h) => normalized.includes(h))) return 'lastName';
  // "nom" alone — but not as part of "prenom" — typically means last name.
  if (/(^|[_.-])nom([_.-]|$)/.test(normalized) && !normalized.includes('prenom')) {
    return 'lastName';
  }
  // Heuristic: string samples that look like "Word Word" with two capitalised
  // tokens almost certainly carry a "first last" identity.
  if (
    variable.detectedKind === 'string' &&
    variable.samples.some((s) => /^[A-ZÀ-Ý][\p{L}'’-]{1,}\s+[A-ZÀ-Ý][\p{L}'’-]{1,}/u.test(s))
  ) {
    return 'fullName';
  }
  // Heuristic: samples that look like e-mails.
  if (
    variable.detectedKind === 'string' &&
    variable.samples.some((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
  ) {
    return 'email';
  }
  if (variable.detectedKind === 'number') return 'numeric';
  return 'other';
}

/**
 * Suggests whether to anonymize by default. We skip booleans, IDs that look like
 * stable enums, and fields the user almost certainly wants untouched (dates).
 */
export function suggestAnonymize(variable: VariableInfo): boolean {
  if (variable.detectedKind === 'boolean' || variable.detectedKind === 'null') return false;
  const segment = lastSegment(variable.path).toLowerCase();
  // IDs and codes are tricky to anonymize meaningfully; leave the user to decide
  // but default to OFF for obvious technical keys.
  if (/(^|_)id$/.test(segment) || segment === 'uuid' || segment === 'guid') return false;
  if (segment === 'type' || segment === 'statut' || segment === 'status') return false;
  if (segment.includes('date') || segment.includes('timestamp')) return false;
  return true;
}
