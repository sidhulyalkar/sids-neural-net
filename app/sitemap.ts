import { MetadataRoute } from 'next';
import graphData from '@/data/generated/neural-graph.json';
import { NeuralGraphSchema } from '@/lib/data/schemas';
import { getCaseStudySlugs } from '@/lib/content/load-case-studies';
import { arcadeGames } from '@/src/data/arcadeGames';
import { canonicalSiteUrl } from '@/lib/siteAuthority';

export default function sitemap(): MetadataRoute.Sitemap {
  const graph = NeuralGraphSchema.parse(graphData);

  const staticPages = [
    '',
    '/frontier',
    '/neural-net',
    '/projects',
    '/code',
    '/resume',
    '/publications',
    '/archive',
    '/photography',
    '/ideas',
    '/physiology',
    '/timeline',
    '/case-studies',
    '/about',
    '/contact',
    '/life',
    '/field-notes',
    '/learning-trails',
    '/arcade',
  ];

  const staticEntries = staticPages.map((route) => ({
    url: canonicalSiteUrl(route),
    lastModified: new Date(),
    changeFrequency: route === '/frontier' ? 'daily' as const : 'weekly' as const,
    priority: route === '' ? 1 : route === '/frontier' ? 0.9 : 0.8,
  }));

  const projects = graph.nodes.filter((n) => n.type === 'project');
  const projectEntries = projects.map((project) => ({
    url: canonicalSiteUrl(`/projects/${project.slug}`),
    lastModified: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const caseStudySlugs = getCaseStudySlugs();
  const caseStudyEntries = caseStudySlugs.map((slug) => ({
    url: canonicalSiteUrl(`/case-studies/${slug}`),
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const arcadeEntries = arcadeGames.map((game) => ({
    url: canonicalSiteUrl(`/arcade/${game.slug}`),
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...projectEntries, ...caseStudyEntries, ...arcadeEntries];
}
