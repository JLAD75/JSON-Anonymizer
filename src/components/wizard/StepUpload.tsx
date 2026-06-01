import { motion } from 'framer-motion';
import { FileJson, Lock, ShieldCheck, Upload, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useWizardStore } from '@/store/wizardStore';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const HIGHLIGHTS = [
  {
    icon: Lock,
    title: '100 % local',
    body: 'Votre fichier ne quitte jamais votre navigateur, aucun envoi serveur.',
  },
  {
    icon: ShieldCheck,
    title: 'Variables typées',
    body: 'Nom, prénom, raison sociale, valeurs numériques ou champs libres.',
  },
  {
    icon: Zap,
    title: 'Archive prête à l’emploi',
    body: 'Un ZIP contenant le JSON anonymisé et la configuration appliquée.',
  },
];

export function StepUpload() {
  const loadFile = useWizardStore((s) => s.loadFile);
  const error = useWizardStore((s) => s.error);
  const [isLoading, setLoading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setLoading(true);
      await loadFile(file);
      setLoading(false);
      const state = useWizardStore.getState();
      if (state.error) return;
      const meta = state.file;
      toast.success('Fichier analysé', {
        description: `${file.name} — ${formatBytes(file.size)}`,
      });
      if (meta?.encodingFallback) {
        toast.warning('Fichier non‑UTF‑8 détecté', {
          description:
            'Encodage Windows‑1252 / Latin‑1 utilisé en repli. Pour de meilleurs résultats, exportez vos JSON en UTF‑8 (par ex. en R : write(jsonlite::toJSON(x), file = "f.json", useBytes = TRUE) après conversion enc2utf8).',
          duration: 8000,
        });
      }
    },
    [loadFile],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
      {/* Left: dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        {...getRootProps({
          className: cn(
            'group relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-card/60 px-6 py-8 text-center transition-all',
            'border-border hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/5',
            isDragActive && 'border-brand-500 bg-brand-50/70 dark:bg-brand-500/10 shadow-glow scale-[1.005]',
            isDragReject && 'border-destructive/60 bg-destructive/5',
          ),
        })}
      >
        <input {...getInputProps()} />
        <div className="pointer-events-none absolute inset-0 bg-radial-spotlight opacity-50 transition-opacity group-hover:opacity-80 dark:opacity-30" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200/70 dark:from-brand-500/20 dark:to-brand-700/20"
              animate={{ scale: isDragActive ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 1.2, repeat: isDragActive ? Infinity : 0 }}
            />
            <div className="relative rounded-2xl bg-white p-3.5 shadow-md ring-1 ring-brand-100 dark:bg-card dark:ring-brand-500/30">
              <FileJson className="h-7 w-7 text-brand-600 dark:text-brand-300" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold">
              {isDragActive
                ? 'Relâchez pour déposer votre fichier'
                : 'Glissez‑déposez votre fichier JSON ici'}
            </div>
            <div className="text-sm text-muted-foreground">
              ou cliquez sur le bouton ci‑dessous pour parcourir
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button
              type="button"
              variant="gradient"
              size="lg"
              onClick={open}
              disabled={isLoading}
            >
              <Upload className="h-4 w-4" />
              {isLoading ? 'Analyse en cours…' : 'Choisir un fichier'}
            </Button>
            <span className="text-xs text-muted-foreground">
              Formats acceptés :{' '}
              <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono">.json</code>
            </span>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Right: pitch + highlights */}
      <div className="flex h-full flex-col justify-between gap-5">
        <header className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative flex justify-center py-2"
          >
            {/* Halo lumineux qui pulse doucement derrière le lockup */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <motion.span
                animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.8, 0.55] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="block h-60 w-[36rem] rounded-full bg-brand-400/65 blur-3xl dark:h-32 dark:w-72 dark:bg-brand-400/45"
              />
              <motion.span
                animate={{ scale: [1.05, 1, 1.05], opacity: [0.35, 0.5, 0.35] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute block h-48 w-96 -translate-x-28 rounded-full bg-fuchsia-400/50 blur-3xl dark:h-24 dark:w-48 dark:-translate-x-10 dark:bg-fuchsia-500/35"
              />
              <motion.span
                animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.45, 0.3] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute block h-48 w-96 translate-x-32 rounded-full bg-sky-400/45 blur-3xl dark:h-24 dark:w-48 dark:translate-x-12 dark:bg-sky-400/30"
              />
            </div>
            <Logo
              variant="lockup"
              className="relative h-20 w-auto drop-shadow-[0_8px_24px_oklch(0.55_0.2_285/0.35)] md:h-24"
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mx-auto max-w-prose text-center text-sm leading-relaxed text-muted-foreground md:text-base"
          >
            Anonymisez vos jeux de données <span className="font-mono text-foreground">.json</span>{' '}
            sans rien envoyer&nbsp;: <span className="font-medium text-foreground">déposez votre fichier</span>,
            choisissez les variables à transformer, récupérez une archive ZIP prête à partager.
          </motion.p>
        </header>

        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
          {HIGHLIGHTS.map((h, idx) => (
            <motion.li
              key={h.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + idx * 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm"
            >
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100/80 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <h.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{h.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
