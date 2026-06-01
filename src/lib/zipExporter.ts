import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ExportConfig, JsonValue } from '@/types';

const APP_VERSION = '1.0.0';

export interface BuildArchiveInput {
  originalFileName: string;
  anonymized: JsonValue;
  config: Omit<ExportConfig, 'createdAt' | 'appVersion'>;
}

export interface BuildArchiveResult {
  blob: Blob;
  jsonFileName: string;
  configFileName: string;
  archiveName: string;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name;
  return name.slice(0, dot);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function buildArchive(input: BuildArchiveInput): Promise<BuildArchiveResult> {
  const base = sanitize(stripExtension(input.originalFileName)) || 'donnees';
  const jsonFileName = `${base}.anonymise.json`;
  const configFileName = `${base}.config.json`;
  const archiveName = `${base}.anonymise.zip`;

  const exportConfig: ExportConfig = {
    ...input.config,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
  };

  const zip = new JSZip();
  zip.file(jsonFileName, JSON.stringify(input.anonymized, null, 2));
  zip.file(configFileName, JSON.stringify(exportConfig, null, 2));
  zip.file(
    'README.txt',
    `JSON Anonymizer — archive générée le ${new Date().toLocaleString('fr-FR')}\n\n` +
      `Cette archive contient :\n` +
      `  • ${jsonFileName} — version anonymisée de votre fichier JSON\n` +
      `  • ${configFileName} — paramétrage que vous avez appliqué (type de chaque variable et indicateur d'anonymisation)\n\n` +
      `Pour réutiliser cette configuration, importez le fichier ${configFileName} dans l'application.\n`,
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { blob, jsonFileName, configFileName, archiveName };
}

export function saveArchive(result: BuildArchiveResult): void {
  saveAs(result.blob, result.archiveName);
}
