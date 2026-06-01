import * as Dialog from '@radix-ui/react-dialog';
import { Download, GitCompareArrows, Link as LinkIcon, Unlink, X } from 'lucide-react';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { saveArchive } from '@/lib/zipExporter';
import { cn, formatNumber } from '@/lib/utils';
import { useWizardStore } from '@/store/wizardStore';
import type { JsonValue } from '@/types';

const LINE_HEIGHT = 18; // matches text-[12px] leading-[18px]
const CHAR_WIDTH = 7.3; // approx px for the JetBrains-like mono stack at 12px
const OVERSCAN = 12;

function stringify(value: JsonValue | null): string {
  if (value == null) return '';
  return JSON.stringify(value, null, 2);
}

interface ComparisonData {
  originalLines: string[];
  anonLines: string[];
  flags: Uint8Array;
  total: number;
  changes: number;
  maxLen: number;
}

function buildComparison(raw: JsonValue | null, anonymized: JsonValue | null): ComparisonData {
  const originalText = stringify(raw);
  const anonText = stringify(anonymized);
  const originalLines = originalText ? originalText.split('\n') : [];
  const anonLines = anonText ? anonText.split('\n') : [];
  const total = Math.max(originalLines.length, anonLines.length);
  const flags = new Uint8Array(total);
  let changes = 0;
  let maxLen = 8;
  for (let i = 0; i < total; i += 1) {
    const a = originalLines[i];
    const b = anonLines[i];
    if (a !== b) {
      flags[i] = 1;
      changes += 1;
    }
    if (a && a.length > maxLen) maxLen = a.length;
    if (b && b.length > maxLen) maxLen = b.length;
  }
  return { originalLines, anonLines, flags, total, changes, maxLen };
}

interface JsonCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JsonCompareModal({ open, onOpenChange }: JsonCompareModalProps) {
  const raw = useWizardStore((s) => s.raw);
  const anonymized = useWizardStore((s) => s.anonymized);
  const file = useWizardStore((s) => s.file);
  const archive = useWizardStore((s) => s.archive);

  const [syncScroll, setSyncScroll] = useState(true);
  const [data, setData] = useState<ComparisonData | null>(null);

  // Defer the (potentially heavy) split + diff until the modal opens,
  // and run it asynchronously so the open animation is not blocked.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const cic = (
      window as unknown as { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;
    const handle = (cb: () => void): number =>
      typeof ric === 'function' ? ric(cb, { timeout: 200 }) : window.setTimeout(cb, 0);
    const cancel = (id: number): void => {
      if (typeof cic === 'function') cic(id);
      else window.clearTimeout(id);
    };
    const id = handle(() => {
      const computed = buildComparison(raw, anonymized);
      if (!cancelled) setData(computed);
    });
    return () => {
      cancelled = true;
      cancel(id);
    };
  }, [open, raw, anonymized]);

  // Synchronized scrolling: cache refs + use rAF to coalesce updates.
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const makeScrollHandler = (which: 'left' | 'right') => (e: UIEvent<HTMLDivElement>): void => {
    if (!syncScroll) return;
    if (syncing.current) return;
    syncing.current = true;
    const source = e.currentTarget;
    const target = which === 'left' ? rightRef.current : leftRef.current;
    if (target) {
      const top = source.scrollTop;
      const left = source.scrollLeft;
      if (target.scrollTop !== top) target.scrollTop = top;
      if (target.scrollLeft !== left) target.scrollLeft = left;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const handleDownload = (): void => {
    if (archive) saveArchive(archive);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl outline-none backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 md:inset-6"
        >
          <header className="flex items-center justify-between gap-4 border-b border-border/60 bg-card/80 px-5 py-3 backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
                <GitCompareArrows className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-base font-semibold tracking-tight">
                  Comparaison avant / après
                </Dialog.Title>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {file && <span className="truncate font-mono">{file.name}</span>}
                  {data ? (
                    <Badge variant="outline" className="gap-1">
                      {formatNumber(data.changes)} ligne{data.changes > 1 ? 's' : ''} modifiée
                      {data.changes > 1 ? 's' : ''} sur {formatNumber(data.total)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      Analyse…
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSyncScroll((v) => !v)}
                aria-pressed={syncScroll}
                title={
                  syncScroll ? 'Désactiver le scroll synchronisé' : 'Activer le scroll synchronisé'
                }
              >
                {syncScroll ? (
                  <>
                    <LinkIcon className="h-3.5 w-3.5" />
                    Scroll lié
                  </>
                ) : (
                  <>
                    <Unlink className="h-3.5 w-3.5" />
                    Scroll libre
                  </>
                )}
              </Button>
              {archive && (
                <Button variant="gradient" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </Button>
              )}
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Fermer la comparaison">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-border/60">
            {data ? (
              <>
                <VirtualPane
                  ref={leftRef}
                  side="left"
                  title="Original"
                  subtitle="Avant anonymisation"
                  lines={data.originalLines}
                  diffFlags={data.flags}
                  totalRows={data.total}
                  maxLen={data.maxLen}
                  onScroll={makeScrollHandler('left')}
                />
                <VirtualPane
                  ref={rightRef}
                  side="right"
                  title="Anonymisé"
                  subtitle="Après traitement"
                  lines={data.anonLines}
                  diffFlags={data.flags}
                  totalRows={data.total}
                  maxLen={data.maxLen}
                  onScroll={makeScrollHandler('right')}
                />
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center bg-background text-sm text-muted-foreground">
                Préparation de la comparaison…
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-card/80 px-5 py-2.5 text-xs text-muted-foreground backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-300/60 ring-1 ring-amber-500/40" />
                Valeur d’origine
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-300/60 ring-1 ring-emerald-500/40" />
                Valeur anonymisée
              </span>
            </div>
            <span>
              Rendu virtualisé&nbsp;: seules les lignes visibles sont peintes — confortable même
              pour de très gros fichiers.
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------------- */
/* Virtualized pane                                                        */
/* ----------------------------------------------------------------------- */

interface VirtualPaneProps {
  side: 'left' | 'right';
  title: string;
  subtitle: string;
  lines: readonly string[];
  diffFlags: Uint8Array;
  totalRows: number;
  maxLen: number;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  ref: React.Ref<HTMLDivElement>;
}

function VirtualPane({
  side,
  title,
  subtitle,
  lines,
  diffFlags,
  totalRows,
  maxLen,
  onScroll,
  ref,
}: VirtualPaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Bridge our internal ref to the external one (React 19 supports prop refs).
  const setRefs = (node: HTMLDivElement | null): void => {
    scrollContainerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);

  // Listen for resize to recompute how many lines fit.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lineNumWidth = Math.max(2, String(totalRows).length);
  const contentWidth = Math.max(
    600,
    Math.ceil((lineNumWidth + 2 + maxLen + 2) * CHAR_WIDTH + 32),
  );

  const startIdx = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(containerHeight / LINE_HEIGHT) + 2 * OVERSCAN;
  const endIdx = Math.min(totalRows, startIdx + visibleCount);

  const rafScroll = useRef<number | null>(null);
  const handleScroll = (e: UIEvent<HTMLDivElement>): void => {
    const top = e.currentTarget.scrollTop;
    if (rafScroll.current != null) cancelAnimationFrame(rafScroll.current);
    rafScroll.current = requestAnimationFrame(() => {
      setScrollTop(top);
    });
    onScroll(e);
  };

  const items = [];
  for (let i = startIdx; i < endIdx; i += 1) {
    const text = lines[i];
    items.push(
      <LineRow
        key={i}
        lineNumber={i + 1}
        text={text ?? ''}
        changed={diffFlags[i] === 1}
        side={side}
        lineNumWidth={lineNumWidth}
        empty={text === undefined}
      />,
    );
  }

  return (
    <section className="relative flex min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-card/50 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {side === 'left' ? '◀ ' : ''}
            {title}
            {side === 'right' ? ' ▶' : ''}
          </span>
          <span className="text-muted-foreground">— {subtitle}</span>
        </div>
        <span className="font-mono text-muted-foreground">
          {formatNumber(lines.length)} lignes
        </span>
      </div>
      <div
        ref={setRefs}
        onScroll={handleScroll}
        className="relative flex-1 overflow-auto font-mono text-[12px] tabular-nums scrollbar-thin"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      >
        <div
          style={{
            height: totalRows * LINE_HEIGHT,
            width: contentWidth,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: startIdx * LINE_HEIGHT,
              left: 0,
              width: contentWidth,
            }}
          >
            {items}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* One row                                                                 */
/* ----------------------------------------------------------------------- */

interface LineRowProps {
  lineNumber: number;
  text: string;
  changed: boolean;
  side: 'left' | 'right';
  lineNumWidth: number;
  empty: boolean;
}

const LineRow = memo(function LineRow({
  lineNumber,
  text,
  changed,
  side,
  lineNumWidth,
  empty,
}: LineRowProps) {
  const rowBg = changed
    ? side === 'left'
      ? 'bg-amber-300/20 dark:bg-amber-400/10'
      : 'bg-emerald-300/20 dark:bg-emerald-400/10'
    : '';
  const gutterBg = changed
    ? side === 'left'
      ? 'bg-amber-300/40 dark:bg-amber-400/25 text-foreground/80'
      : 'bg-emerald-300/40 dark:bg-emerald-400/25 text-foreground/80'
    : '';
  return (
    <div
      className={cn('flex items-stretch', rowBg)}
      style={{ height: LINE_HEIGHT }}
    >
      <span
        className={cn(
          'sticky left-0 z-10 inline-flex shrink-0 select-none items-center justify-end border-r border-border/40 bg-card/85 px-3 text-[11px] text-muted-foreground/70 backdrop-blur-sm',
          gutterBg,
        )}
        style={{
          minWidth: `${lineNumWidth + 2}ch`,
          height: LINE_HEIGHT,
        }}
      >
        {empty ? '' : lineNumber}
      </span>
      <span
        className="flex-1 whitespace-pre px-4"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      >
        {empty ? <span className="text-muted-foreground/40">⋯</span> : highlightJson(text)}
      </span>
    </div>
  );
});

/**
 * Lightweight JSON syntax highlighter for a single line. Tokenises strings
 * (and keys, when followed by a colon), numbers, booleans, and `null`.
 */
function highlightJson(line: string): React.ReactNode {
  if (line.length === 0) return null;
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const len = line.length;
  while (i < len) {
    const ch = line[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < len) {
        const c = line[j];
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === '"') break;
        j += 1;
      }
      const str = line.slice(i, Math.min(j + 1, len));
      let k = j + 1;
      while (k < len && (line[k] === ' ' || line[k] === '\t')) k += 1;
      const isKey = line[k] === ':';
      out.push(
        <span
          key={key++}
          className={
            isKey
              ? 'text-violet-700 dark:text-violet-300'
              : 'text-emerald-700 dark:text-emerald-300'
          }
        >
          {str}
        </span>,
      );
      i = j + 1;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      i += 1;
      while (i < len && /[0-9eE+\-.]/.test(line[i])) i += 1;
      out.push(
        <span key={key++} className="text-amber-700 dark:text-amber-300">
          {line.slice(start, i)}
        </span>,
      );
      continue;
    }
    if (line.startsWith('true', i) || line.startsWith('false', i)) {
      const segLen = line.startsWith('true', i) ? 4 : 5;
      out.push(
        <span key={key++} className="text-sky-700 dark:text-sky-300">
          {line.slice(i, i + segLen)}
        </span>,
      );
      i += segLen;
      continue;
    }
    if (line.startsWith('null', i)) {
      out.push(
        <span key={key++} className="text-pink-700 dark:text-pink-300">
          null
        </span>,
      );
      i += 4;
      continue;
    }
    const start = i;
    while (i < len) {
      const c = line[i];
      if (c === '"' || c === '-' || (c >= '0' && c <= '9')) break;
      if (
        line.startsWith('true', i) ||
        line.startsWith('false', i) ||
        line.startsWith('null', i)
      ) {
        break;
      }
      i += 1;
    }
    out.push(
      <span key={key++} className="text-muted-foreground/90">
        {line.slice(start, i)}
      </span>,
    );
  }
  return out;
}
