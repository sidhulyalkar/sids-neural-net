import { frontierMediaTelemetry } from './telemetry';

type TextureEntry = {
  texture: WebGLTexture;
  width: number;
  height: number;
  bytes: number;
  lastUsed: number;
};

export class FrontierTextureCache {
  private readonly entries = new Map<string, TextureEntry>();
  private bytes = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private budgetBytes: number
  ) {}

  setBudget(bytes: number): void {
    this.budgetBytes = Math.max(8 * 1024 * 1024, bytes);
    this.evictToBudget();
  }

  put(id: string, bitmap: ImageBitmap): TextureEntry {
    this.remove(id);
    const started = performance.now();
    const texture = this.gl.createTexture();
    if (!texture) {
      bitmap.close();
      throw new Error('Unable to allocate WebGL texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      bitmap
    );

    const bytes = bitmap.width * bitmap.height * 4;
    const entry: TextureEntry = {
      texture,
      width: bitmap.width,
      height: bitmap.height,
      bytes,
      lastUsed: performance.now(),
    };
    bitmap.close();

    this.entries.set(id, entry);
    this.bytes += bytes;
    frontierMediaTelemetry.textureUploaded(performance.now() - started, bytes);
    this.evictToBudget();
    return entry;
  }

  get(id: string): TextureEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) entry.lastUsed = performance.now();
    return entry;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.gl.deleteTexture(entry.texture);
    this.entries.delete(id);
    this.bytes = Math.max(0, this.bytes - entry.bytes);
    frontierMediaTelemetry.textureReleased(entry.bytes);
  }

  destroy(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
  }

  residentBytes(): number {
    return this.bytes;
  }

  residentCount(): number {
    return this.entries.size;
  }

  private evictToBudget(): void {
    if (this.bytes <= this.budgetBytes) return;
    const oldest = [...this.entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id] of oldest) {
      this.remove(id);
      if (this.bytes <= this.budgetBytes) break;
    }
  }
}
