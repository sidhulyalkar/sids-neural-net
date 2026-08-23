export const FRONTIER_WEBLLM_RUNTIME_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.84';
export const FRONTIER_LOCAL_MODEL_F16 = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const FRONTIER_LOCAL_MODEL_F32 = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

export type FrontierSynthesisEvidence = {
  sourceId: string;
  sourceLabel: string;
  title: string;
  excerpt: string;
};

export type FrontierSynthesisRequest = {
  type: 'synthesize';
  requestId: string;
  evidence: FrontierSynthesisEvidence[];
};

export type FrontierSynthesisDisposeRequest = {
  type: 'dispose';
};

export type FrontierSynthesisWorkerRequest = FrontierSynthesisRequest | FrontierSynthesisDisposeRequest;

export type FrontierSynthesisWorkerResponse =
  | { type: 'progress'; requestId: string; progress: number; text: string; model: string }
  | { type: 'result'; requestId: string; model: string; raw: string }
  | { type: 'unsupported'; requestId: string; reason: string }
  | { type: 'error'; requestId: string; reason: string; recoverable: boolean };

const WORKER_SOURCE = String.raw`
const RUNTIME_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.84';
const MODEL_F16 = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const MODEL_F32 = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
const SYSTEM_PROMPT = [
  'You are FRONTIER Local Synthesis, a local-only technical comparison assistant.',
  'Use only the supplied source evidence. Never invent benchmarks, methods, claims, releases, or recommendations.',
  'Return valid JSON only in the exact shape {"bullets":["...","...","..."]}.',
  'Return exactly three concise technical bullets. Every bullet must cite at least one supplied source marker such as [S1].',
  'Compare what converges, what differs, and what remains uncertain or unsupported. Preserve disagreements instead of averaging them away.',
  'Each bullet must be under 240 characters. Do not include markdown fences, headings, or prose outside the JSON object.'
].join(' ');

let engine;
let activeModel;

function reason(error) {
  if (error instanceof Error) return error.message || error.name;
  return String(error || 'Unknown local inference failure');
}

function looksLikeDeviceLoss(error) {
  const message = reason(error).toLowerCase();
  return message.includes('device') && (message.includes('lost') || message.includes('destroy'))
    || message.includes('webgpu') && message.includes('lost');
}

async function selectModel() {
  const gpu = self.navigator && self.navigator.gpu;
  if (!gpu) return undefined;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return undefined;
    return adapter.features && adapter.features.has('shader-f16') ? MODEL_F16 : MODEL_F32;
  } catch {
    return MODEL_F32;
  }
}

async function unload() {
  const current = engine;
  engine = undefined;
  activeModel = undefined;
  try {
    if (current && typeof current.unload === 'function') await current.unload();
  } catch {}
}

async function ensureEngine(requestId) {
  if (engine) return engine;
  if (!self.navigator || !self.navigator.gpu) {
    self.postMessage({ type: 'unsupported', requestId, reason: 'WebGPU is unavailable in this browser.' });
    return undefined;
  }

  const model = await selectModel();
  if (!model) {
    self.postMessage({ type: 'unsupported', requestId, reason: 'No compatible WebGPU adapter is available.' });
    return undefined;
  }
  activeModel = model;

  try {
    const webllm = await import(RUNTIME_URL);
    const options = {
      initProgressCallback: (report) => {
        const progress = Number.isFinite(report && report.progress) ? Math.max(0, Math.min(1, report.progress)) : 0;
        const text = report && typeof report.text === 'string' ? report.text : 'Preparing local model';
        self.postMessage({ type: 'progress', requestId, progress, text, model });
      },
    };
    engine = await webllm.CreateMLCEngine(model, options);
    return engine;
  } catch (error) {
    await unload();
    throw error;
  }
}

function evidencePrompt(evidence) {
  const rows = evidence.map((entry, index) => {
    const marker = '[S' + (index + 1) + ']';
    return marker + ' ' + entry.sourceLabel + ' — ' + entry.title + '\n' + entry.excerpt;
  });
  return 'Compare the following independently sourced evidence:\n\n' + rows.join('\n\n');
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'dispose') {
    await unload();
    self.close();
    return;
  }
  if (message.type !== 'synthesize') return;

  const requestId = String(message.requestId || 'unknown');
  try {
    const localEngine = await ensureEngine(requestId);
    if (!localEngine) return;
    const response = await localEngine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: evidencePrompt(message.evidence || []) },
      ],
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 220,
    });
    const raw = response && response.choices && response.choices[0]
      && response.choices[0].message && typeof response.choices[0].message.content === 'string'
      ? response.choices[0].message.content
      : '';
    self.postMessage({ type: 'result', requestId, model: activeModel || 'local-webgpu', raw });
  } catch (error) {
    const lost = looksLikeDeviceLoss(error);
    if (lost) await unload();
    self.postMessage({
      type: 'error',
      requestId,
      reason: lost ? 'The WebGPU device was lost. Grounded sources remain available; retry to create a fresh local session.' : reason(error),
      recoverable: true,
    });
  }
};

self.addEventListener('unhandledrejection', async (event) => {
  if (!looksLikeDeviceLoss(event.reason)) return;
  event.preventDefault();
  await unload();
});
`;

export function createFrontierSynthesisWorker(): Worker {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Web Workers are unavailable in this browser.');
  }
  const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url, { type: 'module', name: 'frontier-local-synthesis' });
  URL.revokeObjectURL(url);
  return worker;
}
