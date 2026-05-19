import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeuralBackground } from '@/components/neural-atlas/NeuralBackground';

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden pt-16', className)}>
      <NeuralBackground />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, intro, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="max-w-3xl">
        {eyebrow && <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-cyan/70">{eyebrow}</p>}
        <h1 className="mt-2 font-mono text-lg font-normal lowercase leading-tight tracking-[0.04em] text-text-primary sm:text-xl">
          {title}
        </h1>
        {intro && <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary/80">{intro}</p>}
        {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {meta && <div className="sr-only">{meta}</div>}
    </header>
  );
}

type SectionShellProps = {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  className?: string;
};

export function SectionShell({ children, title, eyebrow, className }: SectionShellProps) {
  return (
    <section className={cn('my-10', className)}>
      {(title || eyebrow) && (
        <div className="mb-4">
          {eyebrow && <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-cyan/60">{eyebrow}</p>}
          {title && <h2 className="mt-1 font-mono text-base font-normal lowercase tracking-[0.02em] text-text-primary sm:text-lg">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

type ExternalLinkChipProps = {
  href: string;
  children: React.ReactNode;
  external?: boolean;
};

export function ExternalLinkChip({ href, children, external = true }: ExternalLinkChipProps) {
  const className =
    'inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-cyan/35 hover:text-cyan';

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <ArrowUpRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export function BackToAtlasButton() {
  return null;
}

type EmptyStateProps = {
  title: string;
  copy: string;
};

export function EmptyState({ title, copy }: EmptyStateProps) {
  return (
    <div className="node-shell flex min-h-[16rem] items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h2 className="text-2xl font-black text-text-primary">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{copy}</p>
      </div>
    </div>
  );
}
