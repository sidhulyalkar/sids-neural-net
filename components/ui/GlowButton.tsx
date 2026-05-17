'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  external?: boolean;
  glowColor?: 'cyan' | 'violet' | 'amber' | 'green' | 'rose';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-cyan to-cyan-400 text-bg-deep font-semibold hover:from-cyan-300 hover:to-cyan-400',
  secondary:
    'bg-bg-panel border border-white/20 text-text-primary hover:bg-white/5 hover:border-white/30',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/5',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
};

const glowClasses = {
  cyan: 'hover:shadow-glow-cyan',
  violet: 'hover:shadow-glow-violet',
  amber: 'hover:shadow-glow-amber',
  green: 'hover:shadow-glow-green',
  rose: 'hover:shadow-glow-rose',
};

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      href,
      external = false,
      glowColor = 'cyan',
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[variant],
      sizeClasses[size],
      variant === 'primary' && glowClasses[glowColor],
      className
    );

    if (href) {
      if (external) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes}
          >
            {children}
          </a>
        );
      }
      return (
        <Link href={href} className={classes}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

GlowButton.displayName = 'GlowButton';
