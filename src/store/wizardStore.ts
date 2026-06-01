import { create } from 'zustand';
import { applyAnonymization, computeFileSeed } from '@/lib/anonymizer';
import { analyzeJson, suggestAnonymize, suggestType } from '@/lib/jsonAnalyzer';
import { decodeFile, type DetectedEncoding } from '@/lib/textDecoder';
import { buildArchive, type BuildArchiveResult } from '@/lib/zipExporter';
import type { JsonValue, VariableConfig, VariableInfo, VariableType } from '@/types';

const VALID_TYPES: ReadonlySet<VariableType> = new Set([
  'numeric',
  'companyName',
  'lastName',
  'firstName',
  'fullName',
  'email',
  'city',
  'other',
]);

export interface ImportConfigReport {
  applied: number;
  unknown: number;
  unchangedRemaining: number;
  invalid: number;
}

export type WizardStep = 'upload' | 'configure' | 'process' | 'download';

interface FileMeta {
  name: string;
  size: number;
  encoding: DetectedEncoding;
  encodingFallback: boolean;
}

interface WizardState {
  step: WizardStep;
  file: FileMeta | null;
  raw: JsonValue | null;
  anonymized: JsonValue | null;
  variables: VariableInfo[];
  configs: Record<string, VariableConfig>;
  archive: BuildArchiveResult | null;
  processing: boolean;
  progress: number;
  error: string | null;

  /* Actions */
  loadFile: (file: File) => Promise<void>;
  importConfigFile: (file: File) => Promise<ImportConfigReport | null>;
  goToStep: (step: WizardStep) => void;
  setVariableType: (path: string, type: VariableType) => void;
  setVariableAnonymize: (path: string, anonymize: boolean) => void;
  setVariableNumericBound: (
    path: string,
    bound: 'min' | 'max',
    value: number | undefined,
  ) => void;
  applyObservedBoundsToAll: () => number;
  setAllAnonymize: (value: boolean) => void;
  setAllType: (type: VariableType) => void;
  startProcessing: () => Promise<void>;
  reset: () => void;
  restartFromConfigure: () => void;
}

const INITIAL: Pick<
  WizardState,
  | 'step'
  | 'file'
  | 'raw'
  | 'anonymized'
  | 'variables'
  | 'configs'
  | 'archive'
  | 'processing'
  | 'progress'
  | 'error'
> = {
  step: 'upload',
  file: null,
  raw: null,
  anonymized: null,
  variables: [],
  configs: {},
  archive: null,
  processing: false,
  progress: 0,
  error: null,
};

function buildDefaultConfigs(variables: VariableInfo[]): Record<string, VariableConfig> {
  const map: Record<string, VariableConfig> = {};
  for (const v of variables) {
    map[v.path] = {
      path: v.path,
      type: suggestType(v),
      anonymize: suggestAnonymize(v),
    };
  }
  return map;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useWizardStore = create<WizardState>((set, get) => ({
  ...INITIAL,

  loadFile: async (file: File) => {
    set({ error: null });
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      set({ error: 'Le fichier doit être au format JSON (.json).' });
      return;
    }
    let decoded;
    try {
      decoded = await decodeFile(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: `Impossible de lire le fichier : ${message}` });
      return;
    }
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(decoded.text) as JsonValue;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: `Le fichier ne contient pas du JSON valide : ${message}` });
      return;
    }
    const variables = analyzeJson(parsed);
    const configs = buildDefaultConfigs(variables);
    set({
      file: {
        name: file.name,
        size: file.size,
        encoding: decoded.encoding,
        encodingFallback: decoded.fallbackUsed,
      },
      raw: parsed,
      anonymized: null,
      variables,
      configs,
      archive: null,
      step: 'configure',
      error: null,
    });
  },

  importConfigFile: async (file: File) => {
    set({ error: null });
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      set({ error: 'Le fichier de configuration doit être au format JSON (.json).' });
      return null;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: `Impossible de lire le fichier : ${message}` });
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: `Le fichier de configuration n'est pas du JSON valide : ${message}` });
      return null;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('variables' in parsed) ||
      !Array.isArray((parsed as { variables: unknown }).variables)
    ) {
      set({
        error:
          "Le fichier ne ressemble pas à une configuration JSON Anonymizer (clé 'variables' manquante).",
      });
      return null;
    }
    const incoming = (parsed as { variables: unknown[] }).variables;
    const state = get();
    const next: Record<string, VariableConfig> = { ...state.configs };
    const knownPaths = new Set(state.variables.map((v) => v.path));
    const touchedPaths = new Set<string>();
    let applied = 0;
    let unknown = 0;
    let invalid = 0;

    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') {
        invalid += 1;
        continue;
      }
      const item = raw as Record<string, unknown>;
      const path = typeof item.path === 'string' ? item.path : null;
      const type = item.type as VariableType;
      const anonymize = item.anonymize;
      if (!path || !VALID_TYPES.has(type) || typeof anonymize !== 'boolean') {
        invalid += 1;
        continue;
      }
      if (!knownPaths.has(path)) {
        unknown += 1;
        continue;
      }
      const numericMin =
        typeof item.numericMin === 'number' && Number.isFinite(item.numericMin)
          ? item.numericMin
          : undefined;
      const numericMax =
        typeof item.numericMax === 'number' && Number.isFinite(item.numericMax)
          ? item.numericMax
          : undefined;
      next[path] = { path, type, anonymize, numericMin, numericMax };
      touchedPaths.add(path);
      applied += 1;
    }
    let unchangedRemaining = 0;
    for (const path of knownPaths) if (!touchedPaths.has(path)) unchangedRemaining += 1;

    set({ configs: next, error: null });
    return { applied, unknown, unchangedRemaining, invalid };
  },

  goToStep: (step) => set({ step }),

  setVariableType: (path, type) =>
    set((state) => {
      const current = state.configs[path];
      if (!current) return state;
      return { configs: { ...state.configs, [path]: { ...current, type } } };
    }),

  setVariableAnonymize: (path, anonymize) =>
    set((state) => {
      const current = state.configs[path];
      if (!current) return state;
      return { configs: { ...state.configs, [path]: { ...current, anonymize } } };
    }),

  setVariableNumericBound: (path, bound, value) =>
    set((state) => {
      const current = state.configs[path];
      if (!current) return state;
      const key = bound === 'min' ? 'numericMin' : 'numericMax';
      const next = { ...current, [key]: value };
      return { configs: { ...state.configs, [path]: next } };
    }),

  applyObservedBoundsToAll: () => {
    let applied = 0;
    set((state) => {
      const next: Record<string, VariableConfig> = {};
      const variablesByPath = new Map(state.variables.map((v) => [v.path, v]));
      for (const [path, cfg] of Object.entries(state.configs)) {
        const variable = variablesByPath.get(path);
        if (
          cfg.type === 'numeric' &&
          variable &&
          variable.observedMin !== undefined &&
          variable.observedMax !== undefined
        ) {
          next[path] = {
            ...cfg,
            numericMin: variable.observedMin,
            numericMax: variable.observedMax,
          };
          applied += 1;
        } else {
          next[path] = cfg;
        }
      }
      return { configs: next };
    });
    return applied;
  },

  setAllAnonymize: (value) =>
    set((state) => {
      const next: Record<string, VariableConfig> = {};
      for (const [path, cfg] of Object.entries(state.configs)) {
        next[path] = { ...cfg, anonymize: value };
      }
      return { configs: next };
    }),

  setAllType: (type) =>
    set((state) => {
      const next: Record<string, VariableConfig> = {};
      for (const [path, cfg] of Object.entries(state.configs)) {
        next[path] = { ...cfg, type };
      }
      return { configs: next };
    }),

  startProcessing: async () => {
    const { raw, configs, file } = get();
    if (!raw || !file) return;
    set({ processing: true, progress: 5, step: 'process', error: null });
    try {
      // Yield to the browser so the UI can paint the progress bar.
      await delay(150);
      set({ progress: 15 });
      // SHA-256 of the source document — used as the salt that makes the
      // "Other" substitution deterministic but irreversible.
      const fileSeed = await computeFileSeed(JSON.stringify(raw));
      set({ progress: 30 });
      const configList = Object.values(configs);
      const anonymized = applyAnonymization(raw, { configs: configList, fileSeed });
      set({ progress: 65, anonymized });
      await delay(120);
      const archive = await buildArchive({
        originalFileName: file.name,
        anonymized,
        config: { originalFileName: file.name, variables: configList },
      });
      set({ progress: 95 });
      await delay(180);
      set({ archive, progress: 100, processing: false, step: 'download' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({
        error: `Une erreur est survenue pendant l'anonymisation : ${message}`,
        processing: false,
      });
    }
  },

  restartFromConfigure: () => {
    set({ step: 'configure', archive: null, error: null });
  },

  reset: () => set({ ...INITIAL }),
}));
