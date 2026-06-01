import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useWizardStore } from '@/store/wizardStore';

const PHASES = [
  { from: 0, label: 'Préparation des données…' },
  { from: 20, label: 'Anonymisation des valeurs…' },
  { from: 60, label: 'Construction du JSON de sortie…' },
  { from: 85, label: 'Création de l’archive ZIP…' },
];

function phaseLabel(progress: number): string {
  let label = PHASES[0].label;
  for (const p of PHASES) {
    if (progress >= p.from) label = p.label;
  }
  return label;
}

export function StepProcess() {
  const progress = useWizardStore((s) => s.progress);
  const error = useWizardStore((s) => s.error);

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-7 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative inline-flex h-24 w-24 items-center justify-center"
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-200/60 via-brand-100/30 to-transparent blur-xl dark:from-brand-500/30 dark:via-brand-700/20"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-brand-200 bg-white shadow-glow dark:border-brand-400/40 dark:bg-card">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="h-8 w-8 text-brand-600 dark:text-brand-300" />
          </motion.div>
        </div>
      </motion.div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Étape 3 sur 4 — Traitement
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Anonymisation en cours
        </h1>
        <p className="text-sm text-muted-foreground">
          Tout se passe localement, dans votre navigateur. Aucune donnée n’est envoyée.
        </p>
      </div>

      <div className="w-full space-y-3">
        <Progress value={progress} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {phaseLabel(progress)}
          </span>
          <span className="font-mono">{Math.round(progress)} %</span>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        Traitement chiffré côté client — votre fichier ne quitte pas votre poste.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
