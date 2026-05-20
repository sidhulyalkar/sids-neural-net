import { Metadata } from 'next';
import { BookOpen, ExternalLink, FileText, Github, Globe2, Linkedin, Mail, MapPin, Mountain, Gamepad2, Dog, Utensils, Tv, PawPrint } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Sidharth Hulyalkar for neuroscience data infrastructure, multimodal ML, BCI systems, applied AI, and creative technical collaborations.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact | Sids Neural Net',
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
    value: 'research profile',
    href: 'https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en',
    external: true,
    tone: 'amber' as const,
    icon: BookOpen,
  },
  {
    label: 'Resume',
    value: 'experience',
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
      <div className="grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {socialLinks.map((link) => {
          const Icon = link.icon;
          const content = (
            <div className="flex min-h-24 items-center gap-5">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-current/25 bg-white/[0.025] transition-colors group-hover:bg-white/[0.045]">
                <Icon className="h-7 w-7" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-sm uppercase tracking-normal">{link.label}</div>
                <div className="mt-1 truncate text-base text-text-secondary">{link.value}</div>
              </div>
            </div>
          );

          const baseClass = `group block border bg-white/[0.025] p-5 transition-colors hover:bg-white/[0.045] sm:p-6 ${toneClasses[link.tone]}`;

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

      {/* About Me Section */}
      <section className="mt-12 max-w-6xl border border-white/10 bg-black/[0.18] p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-normal text-violet/70">about me</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-secondary">
          I&apos;m drawn to systems that move — brains, trails, teams, oceans, codebases, conversations. Outside of work,
          you&apos;ll usually find me chasing motion, flavor, story, or some strange little side quest. Whether I&apos;m building
          neural data pipelines or exploring a new trail with my husky Shasta, I love problems that span scales and
          reward curiosity. I&apos;m happiest when I&apos;m learning something new, moving through nature, or geeking out
          over a great show with friends.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <Dog className="h-5 w-5 text-rose/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-rose/70">Shasta</span>
            </div>
            <p className="text-sm text-text-muted">My husky and best adventure buddy. Trail scout, snow goblin, morale engineer, and unofficial co-founder of every outdoor plan.</p>
          </div>

          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <PawPrint className="h-5 w-5 text-amber/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-amber/70">Animals</span>
            </div>
            <p className="text-sm text-text-muted">Shasta&apos;s the best, but I love all animals. Always stopping to watch wildlife on trails or say hi to every dog I meet.</p>
          </div>

          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <Mountain className="h-5 w-5 text-green/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-green/70">Adventure</span>
            </div>
            <p className="text-sm text-text-muted">Mountain biking, rock climbing, hiking, skiing, snowboarding, surfing, disc golf — if it gets me outside and moving, I&apos;m in.</p>
          </div>

          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <Gamepad2 className="h-5 w-5 text-violet/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-violet/70">Gaming</span>
            </div>
            <p className="text-sm text-text-muted">PC gaming is my go-to unwind. Love competitive shooters and getting lost in story-driven RPGs.</p>
          </div>

          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <Tv className="h-5 w-5 text-cyan/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-cyan/70">Shows & Anime</span>
            </div>
            <p className="text-sm text-text-muted">Big fan of anime and well-crafted TV. Always down to discuss a great series or trade recommendations.</p>
          </div>

          <div className="border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
              <Utensils className="h-5 w-5 text-orange-400/70" strokeWidth={1.6} />
              <span className="font-mono text-xs uppercase tracking-normal text-orange-400/70">Food</span>
            </div>
            <p className="text-sm text-text-muted">Exploring cuisines, experimenting in the kitchen, and hunting down the best local spots wherever I go.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {['soccer', 'basketball', 'ultimate frisbee', 'skateboarding', 'snorkeling', 'trail running', 'beach walks', 'photography'].map((tag) => (
            <span key={tag} className="border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-white/40">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Location Section - Compact */}
      <section className="mt-6 max-w-6xl border border-white/10 bg-black/[0.18] p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-normal text-cyan/70">location</p>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Based in Los Gatos at the foot of the Santa Cruz Mountains. Always exploring trails
              and coastline with Shasta, or heading up to SF.
            </p>
            <a
              href="https://earth.google.com/web/search/Los+Gatos,+California"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 border border-cyan/25 bg-cyan/10 px-3 py-1.5 font-mono text-xs uppercase tracking-normal text-cyan transition-colors hover:border-cyan/50 hover:bg-cyan/[0.14]"
            >
              <Globe2 className="h-4 w-4" strokeWidth={1.6} />
              Earth view
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.7} />
            </a>
          </div>

          <div className="relative min-h-[14rem] overflow-hidden border border-white/10 bg-[#020306]/80">
            <iframe
              title="Map of Los Gatos, California"
              src="https://www.google.com/maps?q=Los%20Gatos%2C%20California&output=embed"
              className="absolute inset-0 h-full w-full grayscale invert-[0.92] hue-rotate-180 saturate-[0.75] contrast-[0.95]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="pointer-events-none absolute inset-0 border border-cyan/10 bg-gradient-to-t from-[#020306]/45 via-transparent to-[#020306]/10" />
            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-[0.65rem] uppercase tracking-normal text-text-secondary backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5 text-cyan" strokeWidth={1.7} />
              Los Gatos, CA
            </div>
          </div>
        </div>
      </section>
    </ComicSectionLayout>
  );
}
