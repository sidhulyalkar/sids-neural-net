import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { parseFrontmatter } from './frontmatter';

export const CaseStudyFrontmatterSchema = z.object({
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  role: z.string().optional(),
  scope: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  date: z.string(),
  tags: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  importance: z.number().min(0).max(100).default(70),
  relatedProjects: z.array(z.string()).default([]),
  modeVisibility: z
    .array(z.enum(['recruiter', 'researcher', 'builder', 'full-brain', 'personal']))
    .default(['full-brain']),
});

export type CaseStudyFrontmatter = z.infer<typeof CaseStudyFrontmatterSchema>;

export interface CaseStudy {
  frontmatter: CaseStudyFrontmatter;
  content: string;
  slug: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content/case-studies');

export function getCaseStudySlugs(): string[] {
  try {
    if (!fs.existsSync(CONTENT_DIR)) return [];
    return fs.readdirSync(CONTENT_DIR)
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => file.replace(/\.mdx$/, ''));
  } catch {
    return [];
  }
}

export function getCaseStudyBySlug(slug: string): CaseStudy | null {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
    if (!fs.existsSync(filePath)) return null;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = parseFrontmatter(fileContent);
    const frontmatter = CaseStudyFrontmatterSchema.parse({ ...data, slug });
    return { frontmatter, content, slug };
  } catch (error) {
    console.error(`Error loading case study ${slug}:`, error);
    return null;
  }
}

export function getAllCaseStudies(): CaseStudy[] {
  return getCaseStudySlugs()
    .map((slug) => getCaseStudyBySlug(slug))
    .filter((caseStudy): caseStudy is CaseStudy => caseStudy !== null)
    .sort((a, b) => {
      const dateCompare = new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.frontmatter.importance - a.frontmatter.importance;
    });
}

export function getFeaturedCaseStudies(limit = 4): CaseStudy[] {
  return getAllCaseStudies().filter((caseStudy) => caseStudy.frontmatter.featured).slice(0, limit);
}
