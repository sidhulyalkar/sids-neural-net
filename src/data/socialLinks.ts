import { BookOpen, FileText, Github, Linkedin, Mail, MapPin } from 'lucide-react';

export type SocialLink = {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  tone: 'cyan' | 'violet' | 'blue' | 'green' | 'amber';
  icon: typeof Mail;
};

export const socialLinks: SocialLink[] = [
  {
    label: 'Email',
    value: 'sidsoccer21@gmail.com',
    href: 'mailto:sidsoccer21@gmail.com',
    tone: 'cyan',
    icon: Mail,
  },
  {
    label: 'GitHub',
    value: '@sidhulyalkar',
    href: 'https://github.com/sidhulyalkar',
    external: true,
    tone: 'violet',
    icon: Github,
  },
  {
    label: 'LinkedIn',
    value: 'sidharth-hulyalkar',
    href: 'https://www.linkedin.com/in/sidharth-hulyalkar/',
    external: true,
    tone: 'blue',
    icon: Linkedin,
  },
  {
    label: 'Google Scholar',
    value: 'citations',
    href: 'https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en',
    external: true,
    tone: 'amber',
    icon: BookOpen,
  },
  {
    label: 'Resume',
    value: 'Current PDF',
    href: '/resume/SidharthHulyalkar_Resume.pdf',
    external: true,
    tone: 'green',
    icon: FileText,
  },
  {
    label: 'Location',
    value: 'Los Gatos, California',
    tone: 'green',
    icon: MapPin,
  },
];
