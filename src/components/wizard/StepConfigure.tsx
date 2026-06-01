import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Building2,
  Contact,
  FileUp,
  Filter,
  Hash,
  Layers,
  MapPin,
  Quote,
  Search,
  Shuffle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  UserRound,
  Users,
  Wand2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { VARIABLE_TYPE_DESCRIPTIONS, VARIABLE_TYPE_LABELS } from '@/lib/anonymizer';
import { cn, formatNumber } from '@/lib/utils';
import { useWizardStore } from '@/store/wizardStore';
import type { DetectedKind, VariableInfo, VariableType } from '@/types';

const KIND_LABELS: Record<DetectedKind, { label: string; icon: typeof Hash }> = {
  string: { label: 'Texte', icon: Quote },
  number: { label: 'Nombre', icon: Hash },
  boolean: { label: 'Booléen', icon: ToggleRight },
  null: { label: 'Null', icon: ToggleLeft },
  mixed: { label: 'Mixte', icon: Layers },
};

const TYPE_ICONS: Record<VariableType, typeof Hash> = {
  numeric: Hash,
  companyName: Building2,
  firstName: UserRound,
  lastName: Users,
  fullName: Contact,
  email: AtSign,
  city: MapPin,
  other: Shuffle,
};

type AnonFilter = 'all' | 'on' | 'off';

const TYPE_ORDER: VariableType[] = [
  'numeric',
  'companyName',
  'firstName',
  'lastName',
  'fullName',
  'email',
  'city',
  'other',
];

export function StepConfigure() {
  const variables = useWizardStore((s) => s.variables);
  const configs = useWizardStore((s) => s.configs);
  const setType = useWizardStore((s) => s.setVariableType);
  const setAnonymize = useWizardStore((s) => s.setVariableAnonymize);
  const setNumericBound = useWizardStore((s) => s.setVariableNumericBound);
  const applyObservedBoundsToAll = useWizardStore((s) => s.applyObservedBoundsToAll);
  const setAllAnonymize = useWizardStore((s) => s.setAllAnonymize);
  const importConfigFile = useWizardStore((s) => s.importConfigFile);
  const startProcessing = useWizardStore((s) => s.startProcessing);
  const goToStep = useWizardStore((s) => s.goToStep);
  const file = useWizardStore((s) => s.file);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AnonFilter>('all');
  const configInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = (): void => {
    configInputRef.current?.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const report = await importConfigFile(picked);
    if (!report) {
      const err = useWizardStore.getState().error;
      if (err) toast.error('Configuration non importée', { description: err });
      return;
    }
    const parts: string[] = [];
    parts.push(`${report.applied} variable${report.applied > 1 ? 's' : ''} appliquée${report.applied > 1 ? 's' : ''}`);
    if (report.unchangedRemaining > 0) parts.push(`${report.unchangedRemaining} non couverte${report.unchangedRemaining > 1 ? 's' : ''} (paramétrage conservé)`);
    if (report.unknown > 0) parts.push(`${report.unknown} chemin${report.unknown > 1 ? 's' : ''} ignoré${report.unknown > 1 ? 's' : ''} (absent du JSON)`);
    if (report.invalid > 0) parts.push(`${report.invalid} entrée${report.invalid > 1 ? 's' : ''} invalide${report.invalid > 1 ? 's' : ''}`);
    if (report.applied === 0) {
      toast.warning('Configuration importée — aucune variable correspondante', {
        description: parts.join(' · '),
      });
    } else {
      toast.success('Configuration importée', { description: parts.join(' · ') });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return variables.filter((v) => {
      const cfg = configs[v.path];
      if (filter === 'on' && !cfg?.anonymize) return false;
      if (filter === 'off' && cfg?.anonymize) return false;
      if (q && !v.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [variables, configs, query, filter]);

  const totalAnon = useMemo(
    () => Object.values(configs).filter((c) => c.anonymize).length,
    [configs],
  );
  const totalVars = variables.length;
  const ratio = totalVars === 0 ? 0 : Math.round((totalAnon / totalVars) * 100);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Étape 2 sur 4 — Paramétrage
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight md:text-2xl">
              Configurez vos variables
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
              {file ? (
                <>
                  Fichier&nbsp;: <span className="font-medium text-foreground">{file.name}</span>
                  {' · '}
                  {formatNumber(totalVars)} variables détectées
                </>
              ) : (
                <>{formatNumber(totalVars)} variables détectées</>
              )}
            </p>
            {file?.encodingFallback && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50/70 px-2.5 py-1 text-[11px] text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Fichier décodé en <strong className="font-semibold">Windows‑1252</strong> (pas
                d’UTF‑8 valide détecté). Vérifiez les accents avant export.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1">
                <strong className="text-foreground">{formatNumber(totalAnon)}</strong> sur{' '}
                <strong className="text-foreground">{formatNumber(totalVars)}</strong> à anonymiser
                <span className="ml-1 text-muted-foreground">({ratio}%)</span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep('upload')}>
              <ArrowLeft className="h-4 w-4" />
              Changer de fichier
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un chemin de variable…"
                className="h-9 pl-9"
              />
            </div>
            <FilterGroup value={filter} onChange={setFilter} />
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleImportClick}>
                  <FileUp className="h-4 w-4" />
                  Importer une configuration
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Réutilisez un fichier <code className="font-mono">.config.json</code> exporté
                précédemment.
              </TooltipContent>
            </Tooltip>
            <input
              ref={configInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportChange}
            />
            <span className="hidden h-5 w-px bg-border md:inline-block" aria-hidden />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const applied = applyObservedBoundsToAll();
                    if (applied === 0) {
                      toast.info('Aucune variable numérique éligible', {
                        description: 'Aucune borne observée n’a pu être appliquée.',
                      });
                    } else {
                      toast.success('Bornes observées appliquées', {
                        description: `${applied} variable${applied > 1 ? 's' : ''} numérique${applied > 1 ? 's' : ''} pré-remplie${applied > 1 ? 's' : ''}.`,
                      });
                    }
                  }}
                >
                  <Wand2 className="h-4 w-4" />
                  Bornes auto
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Pré‑remplit min/max de toutes les variables numériques avec les valeurs
                observées dans le JSON.
              </TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={() => setAllAnonymize(true)}>
              <Sparkles className="h-4 w-4" />
              Tout anonymiser
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllAnonymize(false)}>
              Tout désactiver
            </Button>
          </div>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center text-sm text-muted-foreground">
              Aucune variable ne correspond à la recherche.
            </div>
          ) : (
            <ul className="space-y-2 px-1">
              {filtered.map((v, idx) => {
                const cfg = configs[v.path];
                if (!cfg) return null;
                const kind = KIND_LABELS[v.detectedKind];
                const KindIcon = kind.icon;
                const TypeIcon = TYPE_ICONS[cfg.type];

                return (
                  <motion.li
                    key={v.path}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.01, 0.2) }}
                    className={cn(
                      'group rounded-xl border bg-card/70 p-3 transition-colors',
                      cfg.anonymize
                        ? 'border-brand-300/50 ring-1 ring-brand-200/30 dark:border-brand-400/30 dark:ring-brand-400/10'
                        : 'border-border/60',
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    {/* Identité de la variable */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
                          {v.path}
                        </code>
                        <Badge variant="outline" className="gap-1">
                          <KindIcon className="h-3 w-3" />
                          {kind.label}
                        </Badge>
                        {v.occurrences > 1 && (
                          <Badge variant="secondary" className="text-[10px]">
                            ×{formatNumber(v.occurrences)}
                          </Badge>
                        )}
                      </div>
                      {v.samples.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span className="text-[10px] uppercase tracking-wider">Exemples</span>
                          {v.samples.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="truncate rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 font-mono"
                              title={s}
                            >
                              {s.length > 32 ? `${s.slice(0, 32)}…` : s}
                            </span>
                          ))}
                          {v.samples.length > 3 && (
                            <span className="text-[10px]">+{v.samples.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sélecteur de type */}
                    <div className="md:w-[300px] md:shrink-0">
                      <Select
                        value={cfg.type}
                        onValueChange={(value) => setType(v.path, value as VariableType)}
                        disabled={!cfg.anonymize}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-9 w-full transition-opacity',
                            !cfg.anonymize && 'opacity-50',
                          )}
                        >
                          <SelectValue>
                            <span className="inline-flex items-center gap-2 truncate">
                              <TypeIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
                              {VARIABLE_TYPE_LABELS[cfg.type]}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[22rem]">
                          {TYPE_ORDER.map((t) => {
                            const Icon = TYPE_ICONS[t];
                            return (
                              <SelectItem key={t} value={t}>
                                <div className="flex items-start gap-2.5 pr-2">
                                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                                  <div className="flex min-w-0 flex-col">
                                    <span className="text-sm font-medium">
                                      {VARIABLE_TYPE_LABELS[t]}
                                    </span>
                                    <span className="whitespace-normal text-[11px] leading-snug text-muted-foreground">
                                      {VARIABLE_TYPE_DESCRIPTIONS[t]}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Toggle anonymisation */}
                    <div className="flex shrink-0 items-center justify-end gap-2 md:w-[170px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="flex cursor-pointer items-center gap-2 select-none">
                            <span
                              className={cn(
                                'hidden text-xs font-medium md:inline',
                                cfg.anonymize
                                  ? 'text-brand-700 dark:text-brand-300'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {cfg.anonymize ? 'Anonymiser' : 'Conserver'}
                            </span>
                            <Switch
                              checked={cfg.anonymize}
                              onCheckedChange={(v2) => setAnonymize(v.path, v2)}
                            />
                          </label>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {cfg.anonymize
                            ? 'Désactiver pour conserver la valeur d’origine.'
                            : 'Activer pour anonymiser cette variable.'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    </div>

                    {cfg.anonymize && cfg.type === 'numeric' && (
                      <NumericBoundsRow
                        cfg={cfg}
                        variable={v}
                        onChange={(bound, value) => setNumericBound(v.path, bound, value)}
                      />
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            <Shuffle className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            L’anonymisation est aléatoire à chaque lancement. Les types et choix sont enregistrés
            dans le fichier de configuration final.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => goToStep('upload')}>
              Précédent
            </Button>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => void startProcessing()}
              disabled={totalAnon === 0}
            >
              <Sparkles className="h-4 w-4" />
              Lancer l’anonymisation
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

interface NumericBoundsRowProps {
  cfg: {
    numericMin?: number;
    numericMax?: number;
  };
  variable: VariableInfo;
  onChange: (bound: 'min' | 'max', value: number | undefined) => void;
}

function NumericBoundsRow({ cfg, variable, onChange }: NumericBoundsRowProps) {
  const min = cfg.numericMin;
  const max = cfg.numericMax;
  const invalid = min !== undefined && max !== undefined && min > max;

  const hasObserved =
    variable.observedMin !== undefined && variable.observedMax !== undefined;
  const matchesObserved =
    hasObserved && min === variable.observedMin && max === variable.observedMax;

  const handle = (bound: 'min' | 'max') =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const raw = e.target.value;
      if (raw === '') {
        onChange(bound, undefined);
        return;
      }
      const num = Number(raw);
      onChange(bound, Number.isFinite(num) ? num : undefined);
    };

  const useObserved = (): void => {
    if (!hasObserved) return;
    onChange('min', variable.observedMin);
    onChange('max', variable.observedMax);
  };

  const clear = (): void => {
    onChange('min', undefined);
    onChange('max', undefined);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2.5 text-xs">
      <span className="font-medium text-muted-foreground">Bornes&nbsp;:</span>
      <label className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">min</span>
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={min ?? ''}
          onChange={handle('min')}
          placeholder={
            variable.observedMin !== undefined ? formatNumber(variable.observedMin) : '—'
          }
          className={cn(
            'h-7 w-28 px-2 py-1 text-xs',
            invalid && 'border-destructive/60 focus-visible:ring-destructive/40',
          )}
        />
      </label>
      <span className="text-muted-foreground">→</span>
      <label className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">max</span>
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={max ?? ''}
          onChange={handle('max')}
          placeholder={
            variable.observedMax !== undefined ? formatNumber(variable.observedMax) : '—'
          }
          className={cn(
            'h-7 w-28 px-2 py-1 text-xs',
            invalid && 'border-destructive/60 focus-visible:ring-destructive/40',
          )}
        />
      </label>

      {hasObserved && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={useObserved}
              disabled={matchesObserved}
            >
              <Wand2 className="h-3 w-3" />
              {matchesObserved ? 'Bornes observées' : 'Utiliser l’observé'}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Observé sur {formatNumber(variable.numericCount ?? 0)} valeur
            {(variable.numericCount ?? 0) > 1 ? 's' : ''} :{' '}
            <strong>{formatNumber(variable.observedMin!)}</strong> →{' '}
            <strong>{formatNumber(variable.observedMax!)}</strong>
          </TooltipContent>
        </Tooltip>
      )}

      {invalid ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" />
          min &gt; max (les valeurs seront échangées)
        </span>
      ) : hasObserved ? (
        <span className="text-[11px] text-muted-foreground">
          Observé&nbsp;:{' '}
          <span className="font-mono text-foreground">{formatNumber(variable.observedMin!)}</span>{' '}
          →{' '}
          <span className="font-mono text-foreground">{formatNumber(variable.observedMax!)}</span>
          {variable.numericCount && variable.numericCount > 1 && (
            <span className="ml-1 text-muted-foreground/70">
              sur {formatNumber(variable.numericCount)} valeurs
            </span>
          )}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">
          Laissez vide pour conserver le même format que l’original.
        </span>
      )}

      {(min !== undefined || max !== undefined) && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={clear}>
          Effacer
        </Button>
      )}
    </div>
  );
}

interface FilterGroupProps {
  value: AnonFilter;
  onChange: (v: AnonFilter) => void;
}

function FilterGroup({ value, onChange }: FilterGroupProps) {
  const options: Array<{ id: AnonFilter; label: string }> = [
    { id: 'all', label: 'Toutes' },
    { id: 'on', label: 'À anonymiser' },
    { id: 'off', label: 'Conservées' },
  ];
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background p-0.5 text-xs">
      <Filter className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded px-2.5 py-1 font-medium transition-colors',
            value === o.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
