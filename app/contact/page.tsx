import { Metadata } from 'next';
import { BookOpen, FileText, Github, Linkedin, Mail, MapPin } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Sidharth Hulyalkar for neuroscience data infrastructure, multimodal ML, BCI systems, applied AI, and creative technical collaborations.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact | Sid Neural Net',
    description: 'Email, GitHub, LinkedIn, and collaboration channels for Sidharth Hulyalkar.',
    url: '/contact',
  },
};

const toneClasses = {
  cyan: 'border-cyan/25 text-cyan hover:border-cyan/50',
  violet: 'border-violet/25 text-violet hover:border-violet/50',
  blue: 'border-blue-500/25 text-blue-400 hover:border-blue-500/50',
  green: 'border-green/25 text-green hover:border-green/50',
  amber: 'border-amber/25 text-amber hover:border-amber/50',
} as const;

const socialLinks = [
  {
    label: 'Email',
    value: 'sidsoccer21@gmail.com',
    href: 'mailto:sidsoccer21@gmail.com',
    tone: 'cyan' as const,
    icon: Mail,
  },
  {
    label: 'GitHub',
    value: '@sidhulyalkar',
    href: 'https://github.com/sidhulyalkar',
    external: true,
    tone: 'violet' as const,
    icon: Github,
  },
  {
    label: 'LinkedIn',
    value: 'sidharth-hulyalkar',
    href: 'https://www.linkedin.com/in/sidharth-hulyalkar/',
    external: true,
    tone: 'blue' as const,
    icon: Linkedin,
  },
  {
    label: 'Google Scholar',
    value: 'citations',
    href: 'https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en',
    external: true,
    tone: 'amber' as const,
    icon: BookOpen,
  },
  {
    label: 'Resume',
    value: 'Current PDF',
    href: '/resume/SidharthHulyalkar_Resume.pdf',
    external: true,
    tone: 'green' as const,
    icon: FileText,
  },
  {
    label: 'Location',
    value: 'Los Gatos, California',
    tone: 'green' as const,
    icon: MapPin,
  },
];

export default function ContactPage() {
  return (
    <ComicSectionLayout
      eyebrow="contact"
      title="contact"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
        {socialLinks.map((link) => {
          const Icon = link.icon;
          const content = (
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-mono text-xs uppercase tracking-wide">{link.label}</div>
                <div className="truncate text-sm text-text-secondary mt-0.5">{link.value}</div>
              </div>
            </div>
          );

          const baseClass = `group block border bg-white/[0.02] p-4 transition-colors ${toneClasses[link.tone]}`;

          if (!link.href) {
            return (
              <div key={link.label} className={baseClass}>
                {content}
              </div>
            );
          }

          return (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className={baseClass}
            >
              {content}
            </a>
          );
        })}
      </div>
    </ComicSectionLayout>
  );
}
