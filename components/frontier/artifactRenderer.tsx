'use client';

import type { ReactNode } from 'react';
import {
  extractFrontierScientificArtifacts,
  parseFrontierMath,
  tokenizeFrontierCode,
  type FrontierMathNode,
  type FrontierScientificArtifact,
} from '@/lib/frontier/synthesis/scientificArtifacts';
import styles from './frontier-scientific-artifacts.module.css';

function mathNodes(nodes: FrontierMathNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.kind === 'identifier') return <mi key={key}>{node.value}</mi>;
    if (node.kind === 'number') return <mn key={key}>{node.value}</mn>;
    if (node.kind === 'operator') return <mo key={key}>{node.value}</mo>;
    if (node.kind === 'text') return <mtext key={key}>{node.value}</mtext>;
    if (node.kind === 'group') return <mrow key={key}>{mathNodes(node.children, key)}</mrow>;
    if (node.kind === 'fraction') {
      return (
        <mfrac key={key}>
          <mrow>{mathNodes(node.numerator, `${key}-n`)}</mrow>
          <mrow>{mathNodes(node.denominator, `${key}-d`)}</mrow>
        </mfrac>
      );
    }
    if (node.superscript && node.subscript) {
      return (
        <msubsup key={key}>
          <mrow>{mathNodes([node.base], `${key}-b`)}</mrow>
          <mrow>{mathNodes(node.subscript, `${key}-s`)}</mrow>
          <mrow>{mathNodes(node.superscript, `${key}-p`)}</mrow>
        </msubsup>
      );
    }
    if (node.superscript) {
      return (
        <msup key={key}>
          <mrow>{mathNodes([node.base], `${key}-b`)}</mrow>
          <mrow>{mathNodes(node.superscript, `${key}-p`)}</mrow>
        </msup>
      );
    }
    return (
      <msub key={key}>
        <mrow>{mathNodes([node.base], `${key}-b`)}</mrow>
        <mrow>{mathNodes(node.subscript ?? [], `${key}-s`)}</mrow>
      </msub>
    );
  });
}

function MathPlane({ artifact }: { artifact: FrontierScientificArtifact }) {
  const nodes = parseFrontierMath(artifact.sourceText);
  return (
    <figure className={styles.mathPlane} data-frontier-scientific-artifact="math">
      <figcaption>Equation · source extract</figcaption>
      <div className={styles.mathViewport}>
        <math display="block" aria-label={artifact.sourceText}>
          <mrow>{mathNodes(nodes, `math-${artifact.start}`)}</mrow>
        </math>
      </div>
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
