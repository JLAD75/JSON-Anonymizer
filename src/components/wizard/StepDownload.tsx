import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  FileJson,
  FileText,
  GitCompareArrows,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { saveArchive } from '@/lib/zipExporter';
import { formatBytes, formatNumber } from '@/lib/utils';
import { useWizardStore } from '@/store/wizardStore';
import { JsonCompareModal } from './JsonCompareModal';

export function StepDownload() {
  const archive = useWizardStore((s) => s.archive);
  const file = useWizardStore((s) => s.file);
  const configs = useWizardStore((s) => s.configs);
  const variables = useWizardStore((s) => s.variables);
  const anonymized = useWizardStore((s) => s.anonymized);
  const restart = useWizardStore((s) => s.reset);
  const back = useWizardStore((s) => s.restartFromConfigure);
  const [compareOpen, setCompareOpen] = useState(false);

  const stats = useMemo(() => {
    const anon = Object.values(configs).filter((c) => c.anonymize).length;
    return { total: variables.length, anon };
  }, [configs, variables]);

  if (!archive) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Préparation de l’archive…
      </div>
    );
  }

  const handleDownload = (): void => {
    saveArchive(archive);
    toast.success('Archive téléchargée', {
      description: archive.archiveName,
    });
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        className="relative inline-flex h-20 w-20 items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full bg-emerald-100/70 blur-xl dark:bg-emerald-500/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-glow">
          <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Étape 4 sur 4 — Téléchargement
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Votre archive est prête !
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {file
            ? `Le fichier ${file.name} a été anonymisé selon votre configuration.`
            : 'Votre fichier a été anonymisé selon votre configuration.'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="w-full rounded-2xl border border-border/60 bg-card/70 p-5 text-left backdrop-blur-sm"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white shadow-glow">
            <FileArchive className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="font-mono text-sm font-semibold">{archive.archiveName}</div>
              <Badge variant="info">{formatBytes(archive.blob.size)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Contient le JSON anonymisé et son fichier de configuration.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              <li className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                <FileJson className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
                <span className="font-mono">{archive.jsonFileName}</span>
              </li>
              <li className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
                <span className="font-mono">{archive.configFileName}</span>
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{formatNumber(stats.anon)}</strong> variable
                {stats.anon > 1 ? 's' : ''} anonymisée{stats.anon > 1 ? 's' : ''} sur{' '}
                <strong className="text-foreground">{formatNumber(stats.total)}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setCompareOpen(true)}
            disabled={!anonymized}
          >
            <GitCompareArrows className="h-4 w-4" />
            Comparer avant / après
          </Button>
          <Button variant="gradient" size="lg" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Télécharger l’archive ZIP
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={back}>
          <ArrowLeft className="h-4 w-4" />
          Revoir le paramétrage
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            restart();
            toast.message('Nouvelle session', {
              description: 'Vous pouvez déposer un autre fichier JSON.',
            });
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Anonymiser un autre fichier
        </Button>
      </div>

      <JsonCompareModal open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
