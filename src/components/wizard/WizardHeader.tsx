import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WizardStep } from '@/store/wizardStore';

interface StepDef {
  id: WizardStep;
  label: string;
  description: string;
}

const STEPS: StepDef[] = [
  { id: 'upload', label: 'Charger', description: 'Déposez votre JSON' },
  { id: 'configure', label: 'Paramétrer', description: 'Choisissez les variables' },
  { id: 'process', label: 'Anonymiser', description: 'Traitement automatique' },
  { id: 'download', label: 'Télécharger', description: 'Récupérez l’archive' },
];

interface WizardHeaderProps {
  current: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  highestReached: WizardStep;
}

const ORDER: WizardStep[] = ['upload', 'configure', 'process', 'download'];

function indexOf(step: WizardStep): number {
  return ORDER.indexOf(step);
}

export function WizardHeader({ current, onStepClick, highestReached }: WizardHeaderProps) {
  const currentIdx = indexOf(current);
  const reachedIdx = indexOf(highestReached);

  return (
    <nav aria-label="Progression" className="w-full">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((step, idx) => {
          const status: 'done' | 'current' | 'upcoming' =
            idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
          const navigable = idx <= reachedIdx && onStepClick && idx !== currentIdx;

          return (
            <li key={step.id} className="relative">
              <button
                type="button"
                disabled={!navigable}
                onClick={() => navigable && onStepClick?.(step.id)}
                className={cn(
                  'group w-full rounded-xl border bg-card/60 px-3 py-2.5 text-left transition-all backdrop-blur-sm',
                  status === 'current' &&
                    'border-brand-400/70 shadow-glow ring-2 ring-brand-200/50 dark:ring-brand-400/20',
                  status === 'done' &&
                    'border-brand-200/70 bg-brand-50/40 dark:border-brand-400/30 dark:bg-brand-500/10',
                  status === 'upcoming' && 'border-border/60 opacity-70',
                  navigable &&
                    'cursor-pointer hover:border-brand-300/80 hover:bg-brand-50/60 dark:hover:bg-brand-500/10',
                  !navigable && 'cursor-default',
                )}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
                        status === 'done' &&
                          'bg-brand-600 text-white dark:bg-brand-500',
                        status === 'current' &&
                          'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow',
                        status === 'upcoming' && 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {status === 'done' ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    {status === 'current' && (
                      <motion.span
                        className="absolute inset-0 rounded-lg ring-2 ring-brand-300 dark:ring-brand-400"
                        initial={{ opacity: 0.3, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        'text-sm font-semibold leading-tight',
                        status === 'upcoming' && 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
