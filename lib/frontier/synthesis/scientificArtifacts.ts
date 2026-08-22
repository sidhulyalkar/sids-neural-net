export type FrontierScientificArtifact = {
  kind: 'math' | 'code';
  sourceText: string;
  language?: string;
  display: 'block' | 'inline';
  start: number;
};

export type FrontierCodeToken = {
  kind: 'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'function';
  value: string;
};

export type FrontierMathNode =
  | { kind: 'identifier'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'operator'; value: string }
  | { kind: 'text'; value: string }
  | { kind: 'group'; children: FrontierMathNode[] }
  | { kind: 'fraction'; numerator: FrontierMathNode[]; denominator: FrontierMathNode[] }
  | { kind: 'script'; base: FrontierMathNode; superscript?: FrontierMathNode[]; subscript?: FrontierMathNode[] };

const MAX_ARTIFACTS = 3;
const MAX_CODE_CHARS = 1_200;
const MAX_MATH_CHARS = 520;
const MAX_INLINE_CODE_CHARS = 220;

const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'interface', 'lambda',
  'let', 'new', 'None', 'null', 'of', 'pass', 'return', 'static', 'switch', 'this', 'throw', 'true', 'try', 'type',
  'undefined', 'var', 'while', 'with', 'yield',
]);

const COMMANDS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', cdot: '·', times: '×', pm: '±', le: '≤', ge: '≥', neq: '≠',
  approx: '≈', to: '→', infty: '∞', sum: '∑', prod: '∏', partial: '∂', nabla: '∇', in: '∈', notin: '∉',
};

function bounded(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+$/g, '');
}

function overlaps(start: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([left, right]) => start < right && end > left);
}

export function extractFrontierScientificArtifacts(text: string, maxArtifacts = MAX_ARTIFACTS): FrontierScientificArtifact[] {
  if (!text.trim()) return [];
  const candidates: Array<FrontierScientificArtifact & { end: number }> = [];
  const protectedRanges: Array<[number, number]> = [];

  const codeBlock = /```([a-zA-Z0-9_+#.-]{0,24})[ \t]*\n?([\s\S]*?)```/g;
  for (const match of text.matchAll(codeBlock)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const sourceText = bounded((match[2] ?? '').replace(/^\n+|\n+$/g, ''), MAX_CODE_CHARS);
    if (!sourceText.trim()) continue;
    protectedRanges.push([start, end]);
    candidates.push({
      kind: 'code',
      sourceText,
      language: (match[1] || '').toLowerCase() || undefined,
      display: 'block',
      start,
      end,
    });
  }

  const mathBlock = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
  for (const match of text.matchAll(mathBlock)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end, protectedRanges)) continue;
    const sourceText = bounded((match[1] ?? match[2] ?? '').trim(), MAX_MATH_CHARS);
    if (!sourceText) continue;
    protectedRanges.push([start, end]);
    candidates.push({ kind: 'math', sourceText, display: 'block', start, end });
  }

  const inlineCode = /`([^`\n]{12,260})`/g;
  for (const match of text.matchAll(inlineCode)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end, protectedRanges)) continue;
    const sourceText = bounded((match[1] ?? '').trim(), MAX_INLINE_CODE_CHARS);
    if (!/[=(){}[\];<>:]|\b(?:const|let|def|return|class|import|SELECT|FROM)\b/.test(sourceText)) continue;
    candidates.push({ kind: 'code', sourceText, display: 'inline', start, end });
  }

  return candidates
    .sort((left, right) => left.start - right.start)
    .slice(0, Math.max(1, Math.min(5, maxArtifacts)))
    .map(({ end: _end, ...artifact }) => artifact);
}

export function tokenizeFrontierCode(source: string): FrontierCodeToken[] {
  const tokens: FrontierCodeToken[] = [];
  const pattern = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b)|(\b[A-Za-z_$][\w$]*\b)|([\s\S])/g;
  const parts = Array.from(source.matchAll(pattern));

  for (let index = 0; index < parts.length; index += 1) {
    const match = parts[index];
    const value = match[0];
    let kind: FrontierCodeToken['kind'] = 'plain';
    if (match[1]) kind = 'comment';
    else if (match[2]) kind = 'string';
    else if (match[3]) kind = 'number';
    else if (match[4]) {
      if (KEYWORDS.has(value)) kind = 'keyword';
      else {
        const remainder = source.slice((match.index ?? 0) + value.length);
        kind = /^\s*\(/.test(remainder) ? 'function' : 'plain';
      }
    }
    const previous = tokens[tokens.length - 1];
    if (previous?.kind === kind) previous.value += value;
    else tokens.push({ kind, value });
  }
  return tokens;
}

function readGroup(source: string, start: number): { body: string; next: number } | undefined {
  if (source[start] !== '{') return undefined;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return { body: source.slice(start + 1, index), next: index + 1 };
    }
  }
  return undefined;
}

function parseAtom(source: string, start: number): { node: FrontierMathNode; next: number } | undefined {
  const char = source[start];
  if (!char) return undefined;
  if (char === '{') {
    const group = readGroup(source, start);
    if (!group) return { node: { kind: 'text', value: char }, next: start + 1 };
    return { node: { kind: 'group', children: parseFrontierMath(group.body) }, next: group.next };
  }
  if (char === '\\') {
    const command = source.slice(start + 1).match(/^[A-Za-z]+/);
    if (!command) return { node: { kind: 'operator', value: char }, next: start + 1 };
    const name = command[0];
    let next = start + name.length + 1;
    if (name === 'frac') {
      while (/\s/.test(source[next] ?? '')) next += 1;
      const numerator = readGroup(source, next);
      if (!numerator) return { node: { kind: 'text', value: '\\frac' }, next };
      next = numerator.next;
      while (/\s/.test(source[next] ?? '')) next += 1;
      const denominator = readGroup(source, next);
      if (!denominator) return { node: { kind: 'text', value: `\\frac{${numerator.body}}` }, next };
      return {
        node: {
          kind: 'fraction',
          numerator: parseFrontierMath(numerator.body),
          denominator: parseFrontierMath(denominator.body),
        },
        next: denominator.next,
      };
    }
    const mapped = COMMANDS[name];
    if (mapped) {
      const operatorCommands = new Set(['cdot', 'times', 'pm', 'le', 'ge', 'neq', 'approx', 'to', 'sum', 'prod', 'partial', 'nabla', 'in', 'notin']);
      return { node: { kind: operatorCommands.has(name) ? 'operator' : 'identifier', value: mapped }, next };
    }
    return { node: { kind: 'text', value: `\\${name}` }, next };
  }
  const number = source.slice(start).match(/^\d+(?:\.\d+)?/);
  if (number) return { node: { kind: 'number', value: number[0] }, next: start + number[0].length };
  const identifier = source.slice(start).match(/^[A-Za-z]+/);
  if (identifier) return { node: { kind: 'identifier', value: identifier[0] }, next: start + identifier[0].length };
  if (/[-+*/=<>()[\],.:|]/.test(char)) return { node: { kind: 'operator', value: char }, next: start + 1 };
  return { node: { kind: 'text', value: char }, next: start + 1 };
}

function readScript(source: string, start: number): { nodes: FrontierMathNode[]; next: number } | undefined {
  let index = start;
  while (/\s/.test(source[index] ?? '')) index += 1;
  const group = readGroup(source, index);
  if (group) return { nodes: parseFrontierMath(group.body), next: group.next };
  const atom = parseAtom(source, index);
  return atom ? { nodes: [atom.node], next: atom.next } : undefined;
}

export function parseFrontierMath(source: string): FrontierMathNode[] {
  const nodes: FrontierMathNode[] = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    const atom = parseAtom(source, index);
    if (!atom) break;
    index = atom.next;
    let superscript: FrontierMathNode[] | undefined;
    let subscript: FrontierMathNode[] | undefined;
    let scanning = true;
    while (scanning) {
      let cursor = index;
      while (/\s/.test(source[cursor] ?? '')) cursor += 1;
      const marker = source[cursor];
      if (marker !== '^' && marker !== '_') break;
      const script = readScript(source, cursor + 1);
      if (!script) break;
      if (marker === '^') superscript = script.nodes;
      else subscript = script.nodes;
      index = script.next;
      scanning = Boolean(source[index]);
    }
    if (superscript || subscript) nodes.push({ kind: 'script', base: atom.node, superscript, subscript });
    else nodes.push(atom.node);
  }
  return nodes;
}
