import { MetadataRoute } from 'next';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { getCaseStudySlugs } from '@/lib/content/load-case-studies';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sidsneural.net';

export default function sitemap(): MetadataRoute.Sitemap {
  const graph = NeuralGraphSchema.parse(graphData);

  // Static pages
  const staticPages = [
    '',
    '/neural-net',
    '/projects',
    '/code',
    '/resume',
    '/publications',
    '/archive',
    '/photography',
    '/ideas',
    '/timeline',
    '/case-studies',
    '/about',
    '/contact',
    '/life',
    '/field-notes',
    '/learning-trails',
  ];

  const staticEntries = staticPages.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Project pages
  const projects = graph.nodes.filter((n) => n.type === 'project');
  const projectEntries = projects.map((project) => ({
    url: `${BASE_URL}/projects/${project.slug}`,
    lastModified: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Case study pages
  const caseStudySlugs = getCaseStudySlugs();
  const caseStudyEntries = caseStudySlugs.map((slug) => ({
    url: `${BASE_URL}/case-studies/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...projectEntries, ...caseStudyEntries];
}
