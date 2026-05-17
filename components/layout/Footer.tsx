import Link from 'next/link';
import { Github, Linkedin, Mail, Brain } from 'lucide-react';

const footerLinks = {
  explore: [
    { href: '/neural-net', label: 'Neural Net' },
    { href: '/projects', label: 'Projects' },
    { href: '/publications', label: 'Publications' },
    { href: '/case-studies', label: 'Case Studies' },
  ],
  learn: [
    { href: '/timeline', label: 'Timeline' },
    { href: '/field-notes', label: 'Field Notes' },
    { href: '/learning-trails', label: 'Learning Trails' },
  ],
  connect: [
    { href: '/about', label: 'About' },
    { href: '/life', label: 'Life' },
    { href: '/contact', label: 'Contact' },
  ],
};

const socialLinks = [
  {
    href: 'https://github.com/sidhulyalkar',
    label: 'GitHub',
    icon: Github,
  },
  {
    href: 'https://linkedin.com/in/sidhulyalkar',
    label: 'LinkedIn',
    icon: Linkedin,
  },
  {
    href: 'mailto:sidhulyalkar@gmail.com',
    label: 'Email',
    icon: Mail,
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-bg-panel/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-cyan" />
              <span className="text-lg font-bold">
                <span className="text-text-primary">Sid&apos;s</span>{' '}
                <span className="bg-gradient-to-r from-cyan to-violet bg-clip-text text-transparent">
                  Neural Net
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm text-text-muted">
              A living atlas of projects, publications, systems, experiments,
              interests, and ideas spanning neuroscience, ML, and applied AI.
            </p>
            <div className="mt-6 flex gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-cyan"
                  aria-label={link.label}
                >
                  <link.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Explore</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.explore.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors hover:text-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary">Learn</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.learn.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors hover:text-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary">Connect</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.connect.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors hover:text-cyan"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} Sidharth Hulyalkar. All rights reserved.
            </p>
            <p className="text-sm text-text-muted">
              Built with Next.js, TypeScript, and curiosity.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
