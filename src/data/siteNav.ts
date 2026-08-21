export type SiteNavItem = {
  href: string;
  label: string;
  description: string;
  section: 'atlas' | 'portfolio' | 'research' | 'personal' | 'system';
};

export const siteNavItems: SiteNavItem[] = [
  {
    href: '/',
    label: 'Home',
    description: 'Return to the home dendrite.',
    section: 'atlas',
  },
  {
    href: '/about',
    label: 'Core',
    description: 'Background, working style, and technical focus.',
    section: 'portfolio',
  },
  {
    href: '/projects',
    label: 'Builds',
    description: 'Active builds, repositories, and experiments.',
    section: 'portfolio',
  },
  {
    href: '/case-studies',
    label: 'Deployed Systems',
    description: 'Infrastructure, deployments, and system maps.',
    section: 'portfolio',
  },
  {
    href: '/arcade',
    label: 'Game Network',
    description: 'Playable browser games connected through the neural portfolio.',
    section: 'portfolio',
  },
  {
    href: '/code',
    label: 'Code',
    description: 'GitHub repositories, infrastructure, and code systems.',
    section: 'portfolio',
  },
  {
    href: '/resume',
    label: 'Resume',
    description: 'Current resume PDF and professional summary.',
    section: 'portfolio',
  },
  {
    href: '/publications',
    label: 'Paper Archive',
    description: 'Peer-reviewed papers and research references.',
    section: 'research',
  },
  {
    href: '/archive',
    label: 'Archive',
    description: 'Extended papers, case studies, notes, and older signals.',
    section: 'research',
  },
  {
    href: '/photography',
    label: 'Visual Cortex',
    description: 'Curated field imagery, motion studies, and visual records.',
    section: 'personal',
  },
  {
    href: '/field-notes',
    label: 'Field Notes',
    description: 'Experimental writing, prototypes, and research sketches.',
    section: 'personal',
  },
  {
    href: '/life',
    label: 'Life',
    description: 'Interests, field attention, and life outside the lab.',
    section: 'personal',
  },
  {
    href: '/ideas',
    label: 'Research',
    description: 'Research sketches around brain dynamics and AI tools.',
    section: 'research',
  },
  {
    href: '/physiology',
    label: 'PhysioPersona',
    description: 'Evidence-first WiFi physiology experiments and a playful 3D persona.',
    section: 'research',
  },
  {
    href: '/timeline',
    label: 'Timeline',
    description: 'Career, research, project, publication, and life events.',
    section: 'portfolio',
  },
  {
    href: '/learning-trails',
    label: 'Learning Trails',
    description: 'Structured paths for current study and skill-building.',
    section: 'research',
  },
  {
    href: '/contact',
    label: 'Contact',
    description: 'Email, GitHub, LinkedIn, and collaboration links.',
    section: 'portfolio',
  },
  {
    href: '/neural-net',
    label: 'Graph Archive',
    description: 'Power-user graph archive for the whole portfolio dataset.',
    section: 'system',
  },
];

export const primaryNavItems = siteNavItems.filter((item) =>
  ['/', '/about', '/projects', '/arcade', '/code', '/resume', '/publications', '/photography', '/contact'].includes(item.href)
);
