'use client';

import { createElement, type ReactNode } from 'react';
import {
  extractFrontierScientificArtifacts,
  parseFrontierMath,
  tokenizeFrontierCode,
  type FrontierMathNode,
  type FrontierScientificArtifact,
} from '@/lib/frontier/synthesis/scientificArtifacts';
import styles from './frontier-scientific-artifacts.module.css';

// This project deliberately keeps a narrow JSX intrinsic surface. Chromium,
// Firefox, and Safari support native MathML even though the current React JSX
// declarations here do not enumerate MathML tags. Build those elements through
// React itself rather than weakening types globally or injecting HTML strings.
const createMathElement = createElement as unknown as (
  type: string,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => ReactNode;

function mathRow(children: ReactNode[], key?: string): ReactNode {
  return createMathElement('mrow', key ? { key } : null, ...children);
}

function mathNodes(nodes: FrontierMathNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.kind === 'identifier') return createMathElement('mi', { key }, node.value);
    if (node.kind === 'number') return createMathElement('mn', { key }, node.value);
    if (node.kind === 'operator') return createMathElement('mo', { key }, node.value);
    if (node.kind === 'text') return createMathElement('mtext', { key }, node.value);
    if (node.kind === 'group') return mathRow(mathNodes(node.children, key), key);
    if (node.kind === 'fraction') {
      return createMathElement(
        'mfrac',
        { key },
        mathRow(mathNodes(node.numerator, `${key}-n`)),
        mathRow(mathNodes(node.denominator, `${key}-d`)),
      );
    }
    const base = mathRow(mathNodes([node.base], `${key}-b`));
    if (node.superscript && node.subscript) {
      return createMathElement(
        'msubsup',
        { key },
        base,
        mathRow(mathNodes(node.subscript, `${key}-s`)),
        mathRow(mathNodes(node.superscript, `${key}-p`)),
      );
    }
    if (node.superscript) {
      return createMathElement(
        'msup',
        { key },
        base,
        mathRow(mathNodes(node.superscript, `${key}-p`)),
      );
    }
    return createMathElement(
      'msub',
      { key },
      base,
      mathRow(mathNodes(node.subscript ?? [], `${key}-s`)),
    );
  });
}

function MathPlane({ artifact }: { artifact: FrontierScientificArtifact }) {
  const nodes = parseFrontierMath(artifact.sourceText);
  const math = createMathElement(
    'math',
    { display: 'block', 'aria-label': artifact.sourceText },
    mathRow(mathNodes(nodes, `math-${artifact.start}`)),
  );
  return (
    <figure className={styles.mathPlane} data-frontier-scientific-artifact="math">
      <figcaption>Equation · source extract</figcaption>
      <div className={styles.mathViewport}>{math}</div>
      <code className={styles.mathSource}>{artifact.sourceText}</code>
    </figure>
  );
}

function CodePlane({ artifact }: { artifact: FrontierScientificArtifact }) {
  const tokens = tokenizeFrontierCode(artifact.sourceText);
  return (
    <figure
      className={`${styles.codePlane} ${artifact.display === 'inline' ? styles.inlineCode : ''}`}
      data-frontier-scientific-artifact="code"
    >
      <figcaption>{artifact.language || 'code'} · source extract</figcaption>
      <pre tabIndex={0} aria-label={`${artifact.language || 'Code'} source extract`}>
        <code>
          {tokens.map((token, index) => (
            <span key={`${artifact.start}-${index}`} className={styles[token.kind]}>{token.value}</span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export function FrontierScientificArtifactPlanes({ text }: { text: string }) {
  const artifacts = extractFrontierScientificArtifacts(text);
  if (!artifacts.length) return null;
  return (
    <section className={styles.planes} aria-label="Scientific source artifacts">
      <div className={styles.label}>Scientific planes</div>
      {artifacts.map((artifact) => artifact.kind === 'math'
        ? <MathPlane key={`math-${artifact.start}`} artifact={artifact} />
        : <CodePlane key={`code-${artifact.start}`} artifact={artifact} />)}
    </section>
  );
}
