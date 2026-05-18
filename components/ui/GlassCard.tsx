'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: 'cyan' | 'violet' | 'amber' | 'green' | 'rose' | 'none';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const glowColors = {
  cyan: 'hover:shadow-glow-cyan',
  violet: 'hover:shadow-glow-violet',
  amber: 'hover:shadow-glow-amber',
  green: 'hover:shadow-glow-green',
  rose: 'hover:shadow-glow-rose',
  none: '',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, glow = 'none', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-white/10 bg-bg-panel/70 backdrop-blur-xl',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_30px_rgba(0,0,0,0.3)]',
          hover && 'transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_40px_rgba(0,0,0,0.4)]',
          glow !== 'none' && glowColors[glow],
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// Motion version
interface MotionGlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  hover?: boolean;
  glow?: 'cyan' | 'violet' | 'amber' | 'green' | 'rose' | 'none';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const MotionGlassCard = forwardRef<HTMLDivElement, MotionGlassCardProps>(
  ({ className, hover = true, glow = 'cyan', padding = 'md', children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-lg border border-white/10 bg-bg-panel/70 backdrop-blur-xl',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_30px_rgba(0,0,0,0.3)]',
          hover && 'transition-shadow duration-300 hover:border-white/20',
          glow !== 'none' && glowColors[glow],
          paddingClasses[padding],
          className
        )}
        whileHover={hover ? { y: -4 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

MotionGlassCard.displayName = 'MotionGlassCard';
