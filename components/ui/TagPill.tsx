import { cn } from '@/lib/utils';

type TagColor = 'cyan' | 'violet' | 'amber' | 'green' | 'rose' | 'blue' | 'default';

interface TagPillProps {
  children: React.ReactNode;
  color?: TagColor;
  size?: 'sm' | 'md';
  className?: string;
  wrap?: boolean;
}

const colorClasses: Record<TagColor, string> = {
  cyan: 'bg-cyan/10 text-cyan border-cyan/20',
  violet: 'bg-violet/10 text-violet border-violet/20',
  amber: 'bg-amber/10 text-amber border-amber/20',
  green: 'bg-green/10 text-green border-green/20',
  rose: 'bg-rose/10 text-rose border-rose/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  default: 'bg-white/5 text-text-secondary border-white/10',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function TagPill({
  children,
  color = 'default',
  size = 'sm',
  className,
  wrap = false,
}: TagPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border font-medium leading-tight',
        colorClasses[color],
        sizeClasses[size],
        wrap && 'whitespace-normal',
        className
      )}
    >
      <span className={cn('min-w-0', wrap ? 'break-words [overflow-wrap:anywhere]' : 'truncate')}>
        {children}
      </span>
    </span>
  );
}

// Helper to get color based on tag name
export function getTagColor(tag: string): TagColor {
  const tagLower = tag.toLowerCase();

  if (tagLower.includes('datajoint') || tagLower.includes('infrastructure')) {
    return 'cyan';
  }
  if (tagLower.includes('neuroscience') || tagLower.includes('research') || tagLower.includes('publication')) {
    return 'violet';
  }
  if (tagLower.includes('aws') || tagLower.includes('docker') || tagLower.includes('cloud')) {
    return 'green';
  }
  if (tagLower.includes('bci') || tagLower.includes('real-time')) {
    return 'amber';
  }
  if (tagLower.includes('personal') || tagLower.includes('shasta')) {
    return 'rose';
  }

  return 'default';
}
