import { z } from 'zod';

// Node types
export const NodeTypeEnum = z.enum([
  'project',
  'publication',
  'role',
  'organization',
  'skill',
  'technology',
  'concept',
  'case-study',
  'field-note',
  'learning-trail',
  'personal-interest',
  'milestone',
]);

export type NodeType = z.infer<typeof NodeTypeEnum>;

// View modes
export const ViewModeEnum = z.enum([
  'recruiter',
  'researcher',
  'builder',
  'full-brain',
  'personal',
]);

export type ViewMode = z.infer<typeof ViewModeEnum>;

// Status
export const StatusEnum = z.enum([
  'active',
  'complete',
  'archived',
  'experimental',
  'learning',
]);

export type Status = z.infer<typeof StatusEnum>;

// Source
export const SourceEnum = z.enum([
  'github',
  'manual',
  'publication-api',
  'mdx',
  'resume',
  'context-doc',
]);

export type Source = z.infer<typeof SourceEnum>;

// Edge relation types
export const EdgeRelationEnum = z.enum([
  'built-with',
  'inspired-by',
  'contributed-to',
  'published-in',
  'uses',
  'extends',
  'belongs-to',
  'learned-from',
  'connected-to',
  'personal-context',
  'milestone-for',
  'worked-at',
]);

export type EdgeRelation = z.infer<typeof EdgeRelationEnum>;

// GitHub metadata
export const GitHubMetaSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  stars: z.number().optional(),
  forks: z.number().optional(),
  language: z.string().nullable().optional(),
  isFork: z.boolean().optional(),
  pushedAt: z.string().optional(),
  createdAt: z.string().optional(),
  topics: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
  url: z.string().optional(),
});

export type GitHubMeta = z.infer<typeof GitHubMetaSchema>;

// Publication metadata
export const PublicationMetaSchema = z.object({
  authors: z.array(z.string()).default([]),
  venue: z.string().optional(),
  year: z.number().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  citationCount: z.number().optional(),
  abstract: z.string().optional(),
  summary: z.string().optional(),
  myContribution: z.string().optional(),
  whyItMatters: z.string().optional(),
  methods: z.array(z.string()).default([]),
  keyFindings: z.array(z.string()).default([]),
  localPdfPath: z.string().optional(),
  externalLinks: z
    .array(
      z.object({
        label: z.string(),
        href: z.string().url(),
      })
    )
    .default([]),
  relatedProjects: z.array(z.string()).default([]),
});

export type PublicationMeta = z.infer<typeof PublicationMetaSchema>;

// Neural Node schema
export const NeuralNodeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  type: NodeTypeEnum,
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  importance: z.number().min(0).max(100).default(50),
  recencyScore: z.number().min(0).max(100).default(50),
  credibilityScore: z.number().min(0).max(100).default(50),
  visualWeight: z.number().min(1).max(10).default(3),
  status: StatusEnum.default('active'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  updatedAt: z.string().optional(),
  source: SourceEnum.default('manual'),
  sourceUrl: z.string().url().optional().nullable(),
  featured: z.boolean().default(false),
  modeVisibility: z.array(ViewModeEnum).default(['full-brain']),
  cluster: z.string().optional(),
  github: GitHubMetaSchema.optional(),
  publication: PublicationMetaSchema.optional(),
  // Computed at graph build time
  computedImportance: z.number().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export type NeuralNode = z.infer<typeof NeuralNodeSchema>;

// Neural Edge schema
export const NeuralEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relation: EdgeRelationEnum,
  weight: z.number().min(1).max(10).default(3),
  label: z.string().optional(),
});

export type NeuralEdge = z.infer<typeof NeuralEdgeSchema>;

// Neural Graph schema
export const NeuralGraphSchema = z.object({
  nodes: z.array(NeuralNodeSchema),
  edges: z.array(NeuralEdgeSchema),
  metadata: z.object({
    generatedAt: z.string(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    version: z.string(),
  }),
});

export type NeuralGraph = z.infer<typeof NeuralGraphSchema>;

// Timeline event schema
export const TimelineEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  category: z.enum([
    'career',
    'research',
    'project',
    'publication',
    'learning',
    'life',
    'milestone',
  ]),
  summary: z.string(),
  importance: z.number().min(0).max(100).default(50),
  links: z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      })
    )
    .default([]),
  relatedNodeIds: z.array(z.string()).default([]),
  modeVisibility: z.array(ViewModeEnum).default(['full-brain']),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// Manual override schema for projects
export const ProjectOverrideSchema = z.object({
  slug: z.string(),
  importance: z.number().min(0).max(100).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  modeVisibility: z.array(ViewModeEnum).optional(),
  cluster: z.string().optional(),
  status: StatusEnum.optional(),
});

export type ProjectOverride = z.infer<typeof ProjectOverrideSchema>;
