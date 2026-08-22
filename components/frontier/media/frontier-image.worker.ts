type DecodeRequest = {
  id: string;
  url: string;
  width: number;
  height: number;
};

type DecodeSuccess = {
  id: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  decodeMs: number;
};

type DecodeFailure = {
  id: string;
  error: string;
};

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, url, width, height } = event.data;
  const started = performance.now();
  try {
    const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image ${response.status}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: Math.max(1, Math.round(width)),
      resizeHeight: Math.max(1, Math.round(height)),
      resizeQuality: 'high',
      imageOrientation: 'from-image',
      premultiplyAlpha: 'premultiply',
    });
    const payload: DecodeSuccess = {
      id,
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      decodeMs: performance.now() - started,
    };
    self.postMessage(payload, [bitmap]);
  } catch (error) {
    const payload: DecodeFailure = {
      id,
      error: error instanceof Error ? error.message : 'image decode failed',
    };
    self.postMessage(payload);
  }
};

export {};
