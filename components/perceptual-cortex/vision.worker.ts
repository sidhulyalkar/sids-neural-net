/// <reference lib="webworker" />
import { deriveFaceFeatures, deriveHandFeatures, type Landmark } from './visionFeatures';
const VERSION = '0.10.17';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
type Detector = { detectForVideo(image: ImageBitmap, timestamp: number): { landmarks?: Landmark[][]; facialTransformationMatrixes?: Array<{ data: number[] }>; faceBlendshapes?: Array<{ categories: Array<{ score: number }> }> }; close(): void };
let hand: Detector | null; let face: Detector | null; let previousPalms: Landmark[] = []; let previousTime = 0; let previousActivity = 0;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === 'init') {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const files = await vision.FilesetResolver.forVisionTasks(WASM);
      const wantsHands = event.data.hands !== false;
      hand = wantsHands
        ? await vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 }) as unknown as Detector
        : null;
      face = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true }) as unknown as Detector;
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Vision models failed to load.' });
    }
  }
  if (event.data.type === 'frame') {
    const bitmap = event.data.bitmap as ImageBitmap;
    const now = event.data.timestamp as number;
    try {
      if (!face) throw new Error('Vision models are not ready.');
      const handsResult = hand?.detectForVideo(bitmap, now) ?? { landmarks: [] };
      const faceResult = face.detectForVideo(bitmap, now);
      const landmarks = handsResult.landmarks ?? [];
      const palms = landmarks.map((points) => [0, 5, 9, 13, 17].map((id) => points[id]).reduce((sum, p) => ({ x: sum.x + p.x / 5, y: sum.y + p.y / 5, z: sum.z + p.z / 5 }), { x: 0, y: 0, z: 0 }));
      const handFeatures = deriveHandFeatures(landmarks, previousPalms, (now - previousTime) / 1000);
      previousPalms = palms;
      previousTime = now;
      const matrix = faceResult.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
      const scores = (faceResult.faceBlendshapes?.[0]?.categories ?? []).map((item: { score: number }) => item.score);
      const faceFeatures = deriveFaceFeatures(matrix, scores, previousActivity);
      previousActivity = faceFeatures.activity;
      self.postMessage({ type: 'features', hands: handFeatures, face: faceFeatures });
    } catch (error) {
      self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Vision inference failed.' });
    } finally {
      bitmap.close();
      self.postMessage({ type: 'consumed' });
    }
  }
  if (event.data.type === 'close') {
    hand?.close();
    face?.close();
    hand = null;
    face = null;
    previousPalms = [];
    previousTime = 0;
    previousActivity = 0;
  }
};