import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontierAudioMomentum,
  frontierBandEnergy,
  frontierFrequencyBinRange,
} from '../lib/frontier/audio/audioReactivity';
import { frontierConvergenceExcerpt } from '../lib/frontier/synthesis/convergence';
import {
  extractFrontierScientificArtifacts,
  parseFrontierMath,
  tokenizeFrontierCode,
} from '../lib/frontier/synthesis/scientificArtifacts';
import {
  frontierSynthesisEvidence,
  frontierSynthesisEvidenceChars,
  parseFrontierLocalSynthesis,
} from '../lib/frontier/synthesis/localSynthesis';
import {
  FRONTIER_LOCAL_MODEL_F16,
  FRONTIER_LOCAL_MODEL_F32,
  FRONTIER_WEBLLM_RUNTIME_URL,
} from '../lib/frontier/synthesis/synthesisWorker';
import type { FrontierItem } from '../lib/frontier/types';

function convergenceItem(): FrontierItem {
  return {
    id: 'phase9-representative',
    title: 'Local multimodal convergence',
    summary: 'Representative grounded source summary.',
    url: 'https://example.com/representative',
    source: 'example.com',
    sourceLabel: 'Example',
    sourceKind: 'rss',
    publishedAt: '2026-08-22T00:00:00.000Z',
    lane: 'ai_frontier',
    tags: ['multimodal', 'transformer'],
    baseScore: 0.9,
    importance: 0.9,
    novelty: 0.8,
    quality: 0.9,
    momentum: 0.7,
    convergence: {
      confidence: 0.92,
      windowHours: 72,
      sourceKinds: ['arxiv', 'github', 'rss'],
      members: Array.from({ length: 8 }, (_, index) => ({
        id: `source-${index + 1}`,
        title: `Grounded source ${index + 1}`,
        url: `https://source${index + 1}.example/item`,
        sourceLabel: `Source ${index + 1}`,
        sourceKind: index % 3 === 0 ? 'arxiv' : index % 3 === 1 ? 'github' : 'rss',
        publishedAt: '2026-08-22T00:00:00.000Z',
        excerpt: `${`evidence-${index + 1} `.repeat(180)}terminal fact`,
      })),
    },
  };
}

test('convergence evidence remains verbatim-like and strictly bounded', () => {
  const source = `  ${'technical evidence '.repeat(120)} final clause  `;
  const excerpt = frontierConvergenceExcerpt(source);
  assert(excerpt);
  assert(excerpt.length <= 1_201);
  assert(excerpt.startsWith('technical evidence'));
  assert(!excerpt.includes('  '));
});

test('scientific parser extracts math and code in source order without interpreting code-internal math', () => {
  const text = [
    'A result follows.',
    '$$E = mc^2$$',
    'Implementation:',
    '```python',
    'loss = (pred - target) ** 2  # $$not a math plane$$',
    'return loss.mean()',
    '```',
    'The API call `model.forward(tokens)` is also important.',
  ].join('\n');
  const artifacts = extractFrontierScientificArtifacts(text);
  assert.equal(artifacts.length, 3);
  assert.equal(artifacts[0].kind, 'math');
  assert.equal(artifacts[0].sourceText, 'E = mc^2');
  assert.equal(artifacts[1].kind, 'code');
  assert.equal(artifacts[1].language, 'python');
  assert.match(artifacts[1].sourceText, /not a math plane/);
  assert.equal(artifacts.filter((artifact) => artifact.kind === 'math').length, 1);
  assert.equal(artifacts[2].display, 'inline');
});

test('scientific source extraction is bounded and never evaluates embedded HTML', () => {
  const attack = '<img src=x onerror=globalThis.pwned=true>';
  const artifacts = extractFrontierScientificArtifacts(`\`\`\`html\n${attack}\n\`\`\``);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].sourceText, attack);
  const tokens = tokenizeFrontierCode(artifacts[0].sourceText);
  assert.equal(tokens.map((token) => token.value).join(''), attack);
  assert.equal((globalThis as { pwned?: boolean }).pwned, undefined);
});

test('native MathML AST recognizes fractions Greek operators and scripts', () => {
  const nodes = parseFrontierMath('E_i^2 = \\frac{\\alpha + 1}{N}');
  assert(nodes.some((node) => node.kind === 'script' && node.superscript && node.subscript));
  assert(nodes.some((node) => node.kind === 'fraction'));
  const fraction = nodes.find((node) => node.kind === 'fraction');
  assert(fraction && fraction.kind === 'fraction');
  assert(fraction.numerator.some((node) => node.kind === 'identifier' && node.value === 'α'));
});

test('FFT bin math isolates sub-bass without leaking the DC bin', () => {
  const sub = frontierFrequencyBinRange(48_000, 1_024, 24, 92);
  const lowMid = frontierFrequencyBinRange(48_000, 1_024, 92, 320);
  assert.deepEqual(sub, { start: 1, end: 2 });
  assert.deepEqual(lowMid, { start: 2, end: 7 });
  assert.equal(frontierBandEnergy(new Uint8Array([0, 255, 0]), sub), 1);
});

test('audio momentum is bounded rises quickly and releases more slowly', () => {
  const first = frontierAudioMomentum(0.8, 0.4, 0);
  const second = frontierAudioMomentum(0.8, 0.4, first);
  const release = frontierAudioMomentum(0, 0, second);
  assert(first > 0 && first < 1);
  assert(second > first && second <= 1);
  assert(release < second && release > 0);
  assert.equal(frontierAudioMomentum(99, 99, 1), 1);
});

test('local synthesis evidence is bounded to six real convergence sources and does not mutate the item', () => {
  const item = convergenceItem();
  const before = structuredClone(item);
  const evidence = frontierSynthesisEvidence(item);
  assert.equal(evidence.length, 6);
  assert(evidence.every((entry) => entry.excerpt.length <= 1_200));
  assert(frontierSynthesisEvidenceChars(evidence) <= 8_000);
  assert.deepEqual(item, before);
});

test('local synthesis parser accepts exactly three source-cited bounded bullets', () => {
  const valid = parseFrontierLocalSynthesis(JSON.stringify({
    bullets: [
      'Both sources converge on sparse routing, while [S1] provides the architecture and [S2] the implementation.',
      'The reported evaluation differs: [S2] exposes runtime measurements that [S3] does not reproduce.',
      'No supplied evidence establishes long-horizon robustness, so that remains unresolved [S1][S3].',
    ],
  }), 3);
  assert(valid);
  assert.equal(valid.bullets.length, 3);
  assert.equal(parseFrontierLocalSynthesis('{"bullets":["no citation","[S1] two","[S2] three"]}', 3), undefined);
  assert.equal(parseFrontierLocalSynthesis('{"bullets":["[S9] bad","[S1] two","[S2] three"]}', 3), undefined);
});

test('WebLLM runtime and model choices are pinned browser-sized assets', () => {
  assert.equal(FRONTIER_WEBLLM_RUNTIME_URL, 'https://esm.run/@mlc-ai/web-llm@0.2.84');
  assert.match(FRONTIER_LOCAL_MODEL_F16, /Llama-3\.2-1B-Instruct/);
  assert.match(FRONTIER_LOCAL_MODEL_F32, /Llama-3\.2-1B-Instruct/);
  assert(!FRONTIER_LOCAL_MODEL_F16.includes('8B'));
});
