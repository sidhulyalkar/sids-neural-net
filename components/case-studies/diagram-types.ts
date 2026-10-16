// Shared types for case-study SystemDiagram variants.

export type DiagramTone = 'cyan' | 'violet' | 'green' | 'amber' | 'rose';

export type DiagramNode = {
  title: string;
  subtitle: string;
  tone?: DiagramTone;
};

export type DiagramSwimlane = {
  label: string;
  nodes: DiagramNode[];
};

export type DiagramDefinition = {
  eyebrow: string;
  title: string;
  summary: string;
  lanes: DiagramSwimlane[];
  outputs: string[];
};
