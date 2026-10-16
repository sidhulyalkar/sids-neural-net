import type { ReactNode } from 'react';

type NodeDetailPanelProps = {
  label: string;
  title: string;
  children: ReactNode;
  tone?: 'cyan' | 'violet' | 'green' | 'rose' | 'amber' | 'blue';
  className?: string;
};

const toneClasses = {
  cyan: 'border-cyan/25 from-cyan/[0.09]',
  violet: 'border-violet/25 from-violet/[0.09]',
  green: 'border-green/25 from-green/[0.09]',
  rose: 'border-rose/25 from-rose/[0.09]',
  amber: 'border-amber/25 from-amber/[0.09]',
  blue: 'border-blue-500/25 from-blue-500/[0.09]',
};

export function NodeDetailPanel({
  label,
  title,
  children,
  tone = 'cyan',
  className = '',
}: NodeDetailPanelProps) {
  return (
    <section className={`comic-panel bg-gradient-to-br ${toneClasses[tone]} to-white/[0.025] p-5 ${className}`}>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <h2 className="mt-3 text-2xl font-black leading-tight text-text-primary">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-text-secondary">{children}</div>
    </section>
  );
}
