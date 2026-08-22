type DecodeRequest = {
  type: 'decode';
  id: string;
  url: string;
  width: number;
  height: number;
};

type CancelRequest = {
  type: 'cancel';
  id: string;
};

type DecodeSuccess = {
  id: string;
  stage: 'preview' | 'final';
  bitmap: ImageBitmap;
  width: number;
  height: number;
  decodeMs: number;
};

type DecodeFailure = {
  id: string;
  error: string;
};

type WorkerScope = typeof self & {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const scope = self as WorkerScope;
const active = new Map<string, AbortController>();

scope.onmessage = async (event: MessageEvent<DecodeRequest | CancelRequest>) => {
  if (event.data.type === 'cancel') {
    active.get(event.data.id)?.abort();
    active.delete(event.data.id);
    return;
  }

  const { id, url, width, height } = event.data;
  const controller = new AbortController();
  active.get(id)?.abort();
  active.set(id, controller);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      cache: 'force-cache',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Image ${response.status}`);
    const blob = await response.blob();
    if (controller.signal.aborted) return;

    // A tiny first decode gives the GPU a source-authentic soft preview while the
    // display-resolution bitmap is still decoding. This replaces synthetic image
    // placeholders without shipping a BlurHash dependency or decoding the source
    // at its original megapixel size.
    const previewScale = Math.min(1, 48 / Math.max(1, width, height));
    const preview = await createImageBitmap(blob, {
      resizeWidth: Math.max(1, Math.round(width * previewScale)),
      resizeHeight: Math.max(1, Math.round(height * previewScale)),
      resizeQuality: 'low',
      imageOrientation: 'from-image',
      premultiplyAlpha: 'premultiply',
    });
    if (controller.signal.aborted) {
      preview.close();
      return;
    }
    const previewPayload: DecodeSuccess = {
      id,
      stage: 'preview',
      bitmap: preview,
      width: preview.width,
      height: preview.height,
      decodeMs: performance.now() - started,
    };
    scope.postMessage(previewPayload, [preview]);

    const bitmap = await createImageBitmap(blob, {
      resizeWidth: Math.max(1, Math.round(width)),
      resizeHeight: Math.max(1, Math.round(height)),
      resizeQuality: 'high',
      imageOrientation: 'from-image',
      premultiplyAlpha: 'premultiply',
    });
    if (controller.signal.aborted) {
      bitmap.close();
      return;
    }
    const payload: DecodeSuccess = {
      id,
      stage: 'final',
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      decodeMs: performance.now() - started,
    };
    scope.postMessage(payload, [bitmap]);
  } catch (error) {
    if (controller.signal.aborted) return;
    const payload: DecodeFailure = {
      id,
      error: error instanceof Error ? error.message : 'image decode failed',
    };
    scope.postMessage(payload);
  } finally {
    if (active.get(id) === controller) active.delete(id);
  }
};

export {};
