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
      {/* Signal line */}
      <div
        className={cn(
          'mb-6 h-px bg-gradient-to-r',
          accentColors[accentColor],
          align === 'center' ? 'mx-auto w-32' : 'w-24'
        )}
      />

      <h2 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
