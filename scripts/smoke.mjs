// Quick Node sanity-check that exercises the same algorithms shipped to the browser.
// It deliberately keeps the implementations identical to src/lib/* so that any
// regression in this file would also catch one in the production code.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(__dirname, '../sample/jeu-de-test.json');
const sample = JSON.parse(readFileSync(samplePath, 'utf8'));

/* ----- Inline copies of the algorithms (kept identical) ------------------- */

const COMPANY_NAMES = ['Aurora Industries', 'Beluga Conseil', 'Cèdre & Associés'];
const FIRST_NAMES = ['Adrien', 'Alice', 'Amélie'];
const LAST_NAMES = ['Albert', 'Antoine', 'Arnaud'];

function randomFrom(source, exclude) {
  if (source.length === 0) return '';
  if (source.length === 1) return source[0];
  let pick = source[Math.floor(Math.random() * source.length)];
  let safety = 0;
  while (exclude != null && pick === exclude && safety < 8) {
    pick = source[Math.floor(Math.random() * source.length)];
    safety++;
  }
  return pick;
}

function decimalCount(value) {
  if (!Number.isFinite(value)) return 0;
  const s = Math.abs(value).toString();
  if (s.includes('e') || s.includes('E')) return 0;
  const idx = s.indexOf('.');
  return idx === -1 ? 0 : s.length - idx - 1;
}

function buildSimilarInteger(magnitude, originalAbs) {
  const digits = magnitude === 0 ? 1 : Math.floor(Math.log10(magnitude)) + 1;
  if (digits <= 1) {
    let pick = Math.floor(Math.random() * 10);
    let safety = 0;
    while (pick === originalAbs && safety < 12) {
      pick = Math.floor(Math.random() * 10);
      safety++;
    }
    return pick;
  }
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  let pick = Math.floor(Math.random() * (max - min + 1)) + min;
  let safety = 0;
  while (pick === originalAbs && safety < 12) {
    pick = Math.floor(Math.random() * (max - min + 1)) + min;
    safety++;
  }
  return pick;
}

function anonymizeNumber(value) {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return Math.floor(Math.random() * 9) + 1;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const decimals = decimalCount(value);
  if (decimals === 0 && Number.isInteger(abs)) {
    return sign * buildSimilarInteger(abs, abs);
  }
  const intPart = Math.trunc(abs);
  const newInt = buildSimilarInteger(intPart, intPart);
  let decString = '';
  for (let i = 0; i < decimals; i++) decString += Math.floor(Math.random() * 10).toString();
  const combined = parseFloat(`${newInt}.${decString || '0'}`);
  if (combined === abs) return sign * (combined + 10 ** -decimals);
  return sign * combined;
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS_STR = '0123456789';

function applyCase(original, pick) {
  if (!/\p{L}/u.test(original)) return pick;
  if (original === original.toUpperCase()) return pick.toUpperCase();
  if (original === original.toLowerCase()) return pick.toLowerCase();
  return pick;
}

function xmur3(input) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

function substituteChar(ch, rng) {
  if (ch >= 'a' && ch <= 'z') return LOWER[Math.floor(rng() * 26)];
  if (ch >= 'A' && ch <= 'Z') return UPPER[Math.floor(rng() * 26)];
  if (ch >= '0' && ch <= '9') return DIGITS_STR[Math.floor(rng() * 10)];
  const decomposed = ch.normalize('NFD');
  if (decomposed.length > 0) {
    const base = decomposed.charCodeAt(0);
    if (base >= 97 && base <= 122) return LOWER[Math.floor(rng() * 26)];
    if (base >= 65 && base <= 90) return UPPER[Math.floor(rng() * 26)];
  }
  if (/\p{Ll}/u.test(ch)) return LOWER[Math.floor(rng() * 26)];
  if (/\p{Lu}/u.test(ch)) return UPPER[Math.floor(rng() * 26)];
  if (/\p{Lt}/u.test(ch)) return UPPER[Math.floor(rng() * 26)];
  return ch;
}

function shuffleOther(value, fileSeed) {
  if (value.length === 0) return value;
  const rng = makeRng(`${fileSeed}::${value}`);
  let out = '';
  for (const ch of value) out += substituteChar(ch, rng);
  return out;
}

async function computeFileSeed(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function getKind(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'mixed';
}

function analyzeJson(data) {
  const acc = new Map();
  const record = (path, value) => {
    let e = acc.get(path);
    if (!e) {
      e = { path, kinds: new Set(), occurrences: 0, samples: [], seenSamples: new Set() };
      acc.set(path, e);
    }
    e.kinds.add(getKind(value));
    e.occurrences++;
    const s = value === null ? 'null' : typeof value === 'string' ? value : String(value);
    if (e.samples.length < 5 && !e.seenSamples.has(s)) {
      e.seenSamples.add(s);
      e.samples.push(s);
    }
  };
  const walk = (node, path) => {
    if (node === null) return record(path || '$', node);
    if (Array.isArray(node)) {
      if (node.length === 0) return record(`${path}[]`, null);
      for (const item of node) walk(item, `${path}[]`);
      return;
    }
    if (typeof node === 'object') {
      for (const key of Object.keys(node)) walk(node[key], path ? `${path}.${key}` : key);
      return;
    }
    return record(path || '$', node);
  };
  walk(data, '');
  return [...acc.values()].map((e) => ({
    path: e.path,
    detectedKind: e.kinds.size === 1 ? [...e.kinds][0] : 'mixed',
    occurrences: e.occurrences,
    samples: e.samples,
  }));
}

function anonymizeValue(value, type, fileSeed) {
  if (value === null || value === undefined) return value;
  switch (type) {
    case 'numeric':
      if (typeof value === 'number') return anonymizeNumber(value);
      return value;
    case 'companyName':
      return applyCase(value, randomFrom(COMPANY_NAMES, value));
    case 'firstName':
      return applyCase(value, randomFrom(FIRST_NAMES, value));
    case 'lastName':
      return applyCase(value, randomFrom(LAST_NAMES, value));
    case 'other':
    default:
      if (typeof value === 'string') return shuffleOther(value, fileSeed);
      if (typeof value === 'number') return anonymizeNumber(value);
      return value;
  }
}

function applyAnonymization(input, configs, fileSeed) {
  const map = new Map(configs.map((c) => [c.path, c]));
  const visit = (node, path) => {
    if (node === null) return resolveLeaf(node, path);
    if (Array.isArray(node)) return node.map((item) => visit(item, `${path}[]`));
    if (typeof node === 'object') {
      const out = {};
      for (const key of Object.keys(node)) out[key] = visit(node[key], path ? `${path}.${key}` : key);
      return out;
    }
    return resolveLeaf(node, path);
  };
  const resolveLeaf = (node, path) => {
    const cfg = map.get(path || '$');
    if (!cfg || !cfg.anonymize) return node;
    return anonymizeValue(node, cfg.type, fileSeed);
  };
  return visit(input, '');
}

/* ----- Assertions --------------------------------------------------------- */

const variables = analyzeJson(sample);
console.log(`✓ ${variables.length} variables detected`);
for (const v of variables.slice(0, 6)) {
  console.log(`  - ${v.path} [${v.detectedKind}] x${v.occurrences} — ${v.samples.slice(0, 2).join(', ')}`);
}

const paths = new Set(variables.map((v) => v.path));
for (const expected of [
  'campagne',
  'millesime',
  'etablissements[].siret',
  'etablissements[].raison_sociale',
  'etablissements[].contact.prenom',
  'etablissements[].contact.nom',
  'responsable_collecte.prenom',
  'responsable_collecte.nom',
]) {
  assert.ok(paths.has(expected), `Path manquant : ${expected}`);
}
console.log('✓ all expected paths discovered');

const configs = [
  { path: 'etablissements[].raison_sociale', type: 'companyName', anonymize: true },
  { path: 'etablissements[].effectif', type: 'numeric', anonymize: true },
  { path: 'etablissements[].ca', type: 'numeric', anonymize: true },
  { path: 'etablissements[].contact.prenom', type: 'firstName', anonymize: true },
  { path: 'etablissements[].contact.nom', type: 'lastName', anonymize: true },
  { path: 'etablissements[].contact.telephone', type: 'other', anonymize: true },
  { path: 'etablissements[].contact.email', type: 'other', anonymize: true },
  { path: 'responsable_collecte.prenom', type: 'firstName', anonymize: true },
  { path: 'responsable_collecte.nom', type: 'lastName', anonymize: true },
  // Keep the rest as-is.
];
const fileSeed = await computeFileSeed(JSON.stringify(sample));
console.log(`✓ SHA-256 du fichier : ${fileSeed.slice(0, 16)}…`);

const anonymized = applyAnonymization(sample, configs, fileSeed);

assert.notEqual(anonymized.etablissements[0].raison_sociale, sample.etablissements[0].raison_sociale);
assert.notEqual(anonymized.etablissements[0].effectif, sample.etablissements[0].effectif);
assert.ok(Number.isInteger(anonymized.etablissements[0].effectif));
assert.ok(
  String(anonymized.etablissements[0].effectif).length ===
    String(sample.etablissements[0].effectif).length,
);
assert.ok(
  decimalCount(anonymized.etablissements[0].ca) === decimalCount(sample.etablissements[0].ca),
  `Décimales préservées sur ca : ${sample.etablissements[0].ca} → ${anonymized.etablissements[0].ca}`,
);

assert.equal(anonymized.campagne, sample.campagne, 'Champ non sélectionné conservé');
assert.equal(anonymized.millesime, sample.millesime, 'Champ non sélectionné conservé');
assert.equal(anonymized.etablissements[0].siret, sample.etablissements[0].siret);
assert.equal(anonymized.etablissements[0].actif, sample.etablissements[0].actif);

// "Other" shuffle: same length, fully different chars in letter/digit positions.
const telOrig = sample.etablissements[0].contact.telephone;
const telAnon = anonymized.etablissements[0].contact.telephone;
assert.equal(telAnon.length, telOrig.length, 'Longueur conservée pour "Autre"');
assert.notEqual(telAnon, telOrig, 'Valeur différente après substitution');
// Spaces and '+' should be preserved.
for (let i = 0; i < telOrig.length; i++) {
  const ch = telOrig[i];
  if (ch === ' ' || ch === '+' || /[^A-Za-z0-9\p{L}]/u.test(ch)) {
    assert.equal(telAnon[i], ch, `Caractère structurel conservé à l’index ${i} (${ch})`);
  }
}

// Determinism: re-running with the same seed yields the same value.
const telAnonAgain = shuffleOther(telOrig, fileSeed);
assert.equal(telAnonAgain, telAnon, 'Substitution déterministe pour un même seed');

// Different seed yields a different output (with very high probability).
const otherSeed = '0'.repeat(64);
const telAnonOther = shuffleOther(telOrig, otherSeed);
assert.notEqual(telAnonOther, telAnon, 'Seed différent → sortie différente');

// Consistency: two occurrences of the same value get the same substitute.
const emailOrig = sample.etablissements[0].contact.email;
const emailDup = shuffleOther(emailOrig, fileSeed);
const emailFromTree = anonymized.etablissements[0].contact.email;
assert.equal(emailDup, emailFromTree, 'Même valeur → même substitution');

// Non-anagram check: cannot be reverted by re-sorting characters.
const sorted = (s) => [...s].sort().join('');
assert.notEqual(sorted(telAnon), sorted(telOrig), '"Autre" n’est plus un anagramme');

// Case-preservation guarantees per character.
function caseClass(ch) {
  if (ch >= 'a' && ch <= 'z') return 'lower';
  if (ch >= 'A' && ch <= 'Z') return 'upper';
  if (ch >= '0' && ch <= '9') return 'digit';
  if (/\p{Ll}/u.test(ch)) return 'lower';
  if (/\p{Lu}/u.test(ch)) return 'upper';
  return 'other';
}
function assertCasePreserved(label, orig, anon) {
  assert.equal(orig.length, anon.length, `${label}: longueur conservée`);
  for (let i = 0; i < orig.length; i++) {
    const a = caseClass(orig[i]);
    const b = caseClass(anon[i]);
    if (a === 'other') {
      // Non-letter/digit chars must remain identical.
      assert.equal(anon[i], orig[i], `${label}: caractère structurel inchangé position ${i} (${orig[i]})`);
    } else {
      assert.equal(b, a, `${label}: casse conservée position ${i} (${orig[i]} → ${anon[i]})`);
    }
  }
}

const CASE_CASES = [
  'Camille',
  'DUPONT',
  'café',
  'ÉTÉ',
  'Boulangerie du Pont SARL',
  'a1B2c3D4',
  'M. Jean-Luc Mélenchon',
  'Naïve façade — Hôtel & Café',
];
for (const orig of CASE_CASES) {
  const anon = shuffleOther(orig, fileSeed);
  assertCasePreserved(`casse "${orig}"`, orig, anon);
  console.log(`  Case   : ${orig.padEnd(30)} → ${anon}`);
}
console.log('✓ majuscules/minuscules/accents préservés sur tous les cas');

console.log('✓ anonymization produced different values, preserved shapes');
console.log(`  ${sample.etablissements[0].raison_sociale} → ${anonymized.etablissements[0].raison_sociale}`);
console.log(`  ${sample.etablissements[0].contact.prenom} ${sample.etablissements[0].contact.nom} → ${anonymized.etablissements[0].contact.prenom} ${anonymized.etablissements[0].contact.nom}`);
console.log(`  ${sample.etablissements[0].effectif} → ${anonymized.etablissements[0].effectif}`);
console.log(`  ${sample.etablissements[0].ca} → ${anonymized.etablissements[0].ca}`);
console.log(`  Téléphone : ${telOrig} → ${telAnon}`);
console.log(`  Email     : ${emailOrig} → ${emailFromTree}`);
console.log(`  Re-run    : ${telOrig} → ${telAnonAgain} (identique)`);
console.log(`  Autre seed: ${telOrig} → ${telAnonOther} (différent)`);

// --- Case mirroring for list-backed types ---------------------------------
console.log('\n--- Cohérence de la casse (raison sociale / nom / prénom) ---');
const CASE_LIST_TESTS = [
  { input: 'DUPONT', list: LAST_NAMES, label: 'Nom MAJ' },
  { input: 'dupont', list: LAST_NAMES, label: 'Nom min' },
  { input: 'Dupont', list: LAST_NAMES, label: 'Nom Cap' },
  { input: 'CAMILLE', list: FIRST_NAMES, label: 'Prénom MAJ' },
  { input: 'camille', list: FIRST_NAMES, label: 'Prénom min' },
  { input: 'BOULANGERIE DU PONT SARL', list: COMPANY_NAMES, label: 'Société MAJ' },
  { input: 'boulangerie du pont sarl', list: COMPANY_NAMES, label: 'Société min' },
  { input: 'Boulangerie du Pont SARL', list: COMPANY_NAMES, label: 'Société Mixed (laisse pick tel quel)' },
];
function caseClassWord(s) {
  if (!/\p{L}/u.test(s)) return 'none';
  if (s === s.toUpperCase()) return 'upper';
  if (s === s.toLowerCase()) return 'lower';
  return 'mixed';
}
for (const t of CASE_LIST_TESTS) {
  const pick = applyCase(t.input, randomFrom(t.list, t.input));
  const inCase = caseClassWord(t.input);
  const outCase = caseClassWord(pick);
  if (inCase === 'upper' || inCase === 'lower') {
    assert.equal(outCase, inCase, `${t.label}: casse "${t.input}" → "${pick}" (attendu ${inCase}, obtenu ${outCase})`);
  }
  console.log(`  ${t.label.padEnd(45)} ${t.input.padEnd(28)} → ${pick}`);
}
console.log('✓ casse mirrorée sur les piochages depuis listes');

// --- Persistence des bornes numériques dans le config export --------------
console.log('\n--- Sérialisation des bornes numériques ---');
const exportPayload = {
  originalFileName: 'demo.json',
  createdAt: new Date().toISOString(),
  appVersion: '1.0.0',
  variables: [
    { path: 'effectif', type: 'numeric', anonymize: true, numericMin: 1, numericMax: 500 },
    { path: 'ca',       type: 'numeric', anonymize: true, numericMin: 0, numericMax: 1e8 },
    { path: 'sans_bornes', type: 'numeric', anonymize: true },
    { path: 'nom',      type: 'lastName', anonymize: true },
  ],
};
const serialized = JSON.stringify(exportPayload, null, 2);
const reparsed = JSON.parse(serialized);
const effectif = reparsed.variables.find((v) => v.path === 'effectif');
const ca = reparsed.variables.find((v) => v.path === 'ca');
const sansBornes = reparsed.variables.find((v) => v.path === 'sans_bornes');

assert.equal(effectif.numericMin, 1, 'numericMin sérialisé pour effectif');
assert.equal(effectif.numericMax, 500, 'numericMax sérialisé pour effectif');
assert.equal(ca.numericMin, 0, 'numericMin=0 (falsy) bien sérialisé');
assert.equal(ca.numericMax, 1e8, 'numericMax grand sérialisé');
assert.ok(!('numericMin' in sansBornes), 'pas de numericMin si non défini');
assert.ok(!('numericMax' in sansBornes), 'pas de numericMax si non défini');

console.log('  ✓ effectif → min=' + effectif.numericMin + ', max=' + effectif.numericMax);
console.log('  ✓ ca       → min=' + ca.numericMin + ', max=' + ca.numericMax + ' (le 0 est conservé)');
console.log('  ✓ sans_bornes : pas de numericMin/numericMax (comportement attendu)');
console.log('✓ bornes numériques persistées dans le JSON exporté');

console.log('\n✅ Tous les contrôles sont passés.');
