export type FrontierMediaTelemetrySnapshot = {
  imageDecodeCount: number;
  imageDecodeMsTotal: number;
  textureUploadCount: number;
  textureUploadMsTotal: number;
  residentTextureBytes: number;
  residentTextures: number;
  mediaRequestsCancelled: number;
  videoStartCount: number;
  videoStartMsTotal: number;
  videoRebufferCount: number;
  presentedFrames: number;
  droppedFrames: number;
};

const state: FrontierMediaTelemetrySnapshot = {
  imageDecodeCount: 0,
  imageDecodeMsTotal: 0,
  textureUploadCount: 0,
  textureUploadMsTotal: 0,
  residentTextureBytes: 0,
  residentTextures: 0,
  mediaRequestsCancelled: 0,
  videoStartCount: 0,
  videoStartMsTotal: 0,
  videoRebufferCount: 0,
  presentedFrames: 0,
  droppedFrames: 0,
};

export const frontierMediaTelemetry = {
  imageDecoded(ms: number) {
    state.imageDecodeCount += 1;
    state.imageDecodeMsTotal += Math.max(0, ms);
  },
  textureUploaded(ms: number, bytes: number) {
    state.textureUploadCount += 1;
    state.textureUploadMsTotal += Math.max(0, ms);
    state.residentTextureBytes += Math.max(0, bytes);
    state.residentTextures += 1;
  },
  textureReleased(bytes: number) {
    state.residentTextureBytes = Math.max(0, state.residentTextureBytes - Math.max(0, bytes));
    state.residentTextures = Math.max(0, state.residentTextures - 1);
  },
  requestCancelled() {
    state.mediaRequestsCancelled += 1;
  },
  videoStarted(ms: number) {
    state.videoStartCount += 1;
    state.videoStartMsTotal += Math.max(0, ms);
  },
  rebuffer() {
    state.videoRebufferCount += 1;
  },
  playbackFrames(total: number, dropped: number) {
    state.presentedFrames += Math.max(0, total);
    state.droppedFrames += Math.max(0, dropped);
  },
  snapshot(): FrontierMediaTelemetrySnapshot {
    return { ...state };
  },
};
