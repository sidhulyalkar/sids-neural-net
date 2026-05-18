import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  accentColor?: 'cyan' | 'violet' | 'amber' | 'green' | 'rose';
  className?: string;
}

const accentColors = {
  cyan: 'from-cyan/50 via-cyan to-cyan/50',
  violet: 'from-violet/50 via-violet to-violet/50',
  amber: 'from-amber/50 via-amber to-amber/50',
  green: 'from-green/50 via-green to-green/50',
  rose: 'from-rose/50 via-rose to-rose/50',
};

export function SectionHeader({
  title,
  subtitle,
  align = 'center',
  accentColor = 'cyan',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-12',
        align === 'center' && 'text-center',
        className
      )}
    >
      <div className={cn('mb-4 flex items-center gap-3', align === 'center' && 'justify-center')}>
        <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-glow-cyan" />
        <span className="technical-label">Signal Layer</span>
        <span
          className={cn(
            'h-px bg-gradient-to-r',
            accentColors[accentColor],
            align === 'center' ? 'w-20' : 'w-16'
          )}
        />
      </div>

      <h2 className="text-3xl font-black tracking-tight text-text-primary md:text-5xl">
        {title}
      </h2>

      {subtitle && (
        <p className={cn('mt-4 text-base text-text-secondary md:text-lg', align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-3xl')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
