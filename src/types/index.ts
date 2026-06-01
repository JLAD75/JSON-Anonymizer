export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type VariableType =
  | 'numeric'
  | 'companyName'
  | 'lastName'
  | 'firstName'
  | 'fullName'
  | 'email'
  | 'city'
  | 'other';

export type DetectedKind = 'string' | 'number' | 'boolean' | 'null' | 'mixed';

export interface VariableInfo {
  /** Generic path with `[]` for arrays, e.g. `client.factures[].montant`. */
  path: string;
  /** Detected primitive kind across all occurrences. */
  detectedKind: DetectedKind;
  /** Number of leaf occurrences for this path. */
  occurrences: number;
  /** Up to 5 sample values (strings truncated). */
  samples: string[];
  /** Lowest finite number observed across all occurrences (numbers only). */
  observedMin?: number;
  /** Highest finite number observed across all occurrences (numbers only). */
  observedMax?: number;
  /** Number of numeric occurrences actually observed (may differ from `occurrences`). */
  numericCount?: number;
}

export interface VariableConfig {
  path: string;
  type: VariableType;
  anonymize: boolean;
  /** Optional lower bound when `type === 'numeric'`. */
  numericMin?: number;
  /** Optional upper bound when `type === 'numeric'`. */
  numericMax?: number;
}

export interface ExportConfig {
  originalFileName: string;
  createdAt: string;
  appVersion: string;
  variables: VariableConfig[];
}
