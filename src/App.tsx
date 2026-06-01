import { Lock, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { Wizard } from '@/components/wizard/Wizard';
import { useTheme } from '@/hooks/useTheme';

export default function App() {
  // Mount the theme hook once so the system listener stays active app-wide.
  useTheme();

  return (
    <div className="relative flex min-h-full flex-col">
      {/* Background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-radial-spotlight"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)] dark:opacity-20"
      />

      <header className="border-b border-border/50 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-700 md:inline-flex dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Aucune donnée envoyée
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <Lock className="h-3.5 w-3.5" />
              Traitement local
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-stretch justify-center px-4 py-5 md:px-6 md:py-6">
        <div className="flex w-full max-w-[1400px] flex-col">
          <Wizard />
        </div>
      </main>

      <footer className="border-t border-border/50 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 px-6 py-3 text-xs text-muted-foreground sm:flex-row">
          <span>
            JSON Anonymizer · Conçu pour anonymiser rapidement vos jeux de données de test.
          </span>
          <span>
            Toutes les opérations restent dans votre navigateur.
          </span>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
