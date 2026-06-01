import logoLargeLight from '@/assets/logos/logo-large-light.png';
import logoLargeDark from '@/assets/logos/logo-large-dark.png';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface LogoProps {
  className?: string;
  /** Show only the icon; useful for compact placements. */
  iconOnly?: boolean;
  /** Use the full lockup PNG (icon + wordmark) baked into a single image. */
  variant?: 'header' | 'lockup';
}

export function Logo({ className, iconOnly = false, variant = 'header' }: LogoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'lockup') {
    const src = isDark ? logoLargeDark : logoLargeLight;
    return (
      <img
        src={src}
        alt="JSON Anonymizer"
        className={cn('h-12 w-auto select-none', className)}
        draggable={false}
      />
    );
  }

  // Small icon: kept in /public so it can also serve as favicon. Prefix with the
  // Vite base URL so it resolves under the deployment sub-path (e.g. /JSON-Anonymizer/).
  const iconSrc = `${import.meta.env.BASE_URL}${isDark ? 'logoSmallSombre.png' : 'logoSmallClair.png'}`;
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={iconSrc}
        alt="JSON Anonymizer"
        className="h-10 w-10 select-none rounded-lg"
        width={40}
        height={40}
        draggable={false}
      />
      {!iconOnly && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">JSON Anonymizer</div>
          <div className="text-[11px] text-muted-foreground">Anonymisation 100 % locale</div>
        </div>
      )}
    </div>
  );
}
