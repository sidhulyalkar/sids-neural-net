/// <reference lib="webworker" />
import { deriveFaceFeatures, deriveHandFeatures, type Landmark } from './visionFeatures';
const VERSION = '0.10.17';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
type BlendshapeCategory = { categoryName?: string; displayName?: string; score: number };
type DetectorResult = { landmarks?: Landmark[][]; facialTransformationMatrixes?: Array<{ data: number[] }>; faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }> };
type Detector = { detectForVideo(image: ImageBitmap, timestamp: number): DetectorResult; close(): void };
const EMPTY_HANDS = { active: false, count: 0, x: 0, y: 0, speed: 0, pinch: 0, separation: 0, symmetry: 0 };
const EMPTY_FACE = { active: false, yaw: 0, pitch: 0, roll: 0, activity: 0, stillness: 0, expressions: { smile: 0, browRaise: 0, browFurrow: 0, eyeWide: 0, eyeSquint: 0, jawOpen: 0, mouthPress: 0 } };
let hand: Detector | null; let face: Detector | null; let useHands = true; let useFace = true; let previousPalms: Landmark[] = []; let previousTime = 0; let previousActivity = 0;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === 'init') {
    try { const vision = await import('@mediapipe/tasks-vision'); const files = await vision.FilesetResolver.forVisionTasks(WASM); useHands = event.data.hands !== false; useFace = event.data.face !== false;
      hand = useHands ? await vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 }) as unknown as Detector : null;
      face = useFace ? await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true }) as unknown as Detector : null;
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Vision models failed to load.' }); }
  }
  if (event.data.type === 'frame') {
    const bitmap = event.data.bitmap as ImageBitmap; const now = event.data.timestamp as number;
    try {
      if ((useHands && !hand) || (useFace && !face)) throw new Error('Vision models are not ready.');
      const handsResult = hand ? hand.detectForVideo(bitmap, now) : undefined;
      const faceResult = face ? face.detectForVideo(bitmap, now) : undefined;
      const landmarks = handsResult?.landmarks ?? [];
      const palms = landmarks.map((points) => [0, 5, 9, 13, 17].map((id) => points[id]).reduce((sum, p) => ({ x: sum.x + p.x / 5, y: sum.y + p.y / 5, z: sum.z + p.z / 5 }), { x: 0, y: 0, z: 0 }));
      const handFeatures = useHands ? deriveHandFeatures(landmarks, previousPalms, (now - previousTime) / 1000) : EMPTY_HANDS; previousPalms = palms; previousTime = now;
      const matrix = faceResult?.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
      const blendshapes = Object.fromEntries((faceResult?.faceBlendshapes?.[0]?.categories ?? [])
        .map((item) => [item.categoryName || item.displayName || '', item.score] as const)
        .filter(([name]) => Boolean(name)));
      const faceFeatures = useFace ? deriveFaceFeatures(matrix, blendshapes, previousActivity) : EMPTY_FACE; previousActivity = faceFeatures.activity;
      self.postMessage({ type: 'features', hands: handFeatures, face: faceFeatures });
    } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Vision inference failed.' }); }
    finally { bitmap.close(); self.postMessage({ type: 'consumed' }); }
  }
  if (event.data.type === 'close') { hand?.close(); face?.close(); hand = null; face = null; }
};