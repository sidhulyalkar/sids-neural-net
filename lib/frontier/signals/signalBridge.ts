export type FrontierSignalSink = (values: Float32Array) => void;

export type FrontierLocalSocketOptions = {
  url: string;
  onSamples: FrontierSignalSink;
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void;
};

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
    || normalized === '::1';
}

export function validateLocalSignalSocketUrl(value: string): URL {
  const url = new URL(value);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('signal socket must use ws:// or wss://');
  if (!isLocalHost(url.hostname)) throw new Error('signal socket must target localhost');
  return url;
}

function parseSocketPayload(payload: unknown): Float32Array {
  if (Array.isArray(payload)) return Float32Array.from(payload.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.values)) return Float32Array.from(record.values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));
    if (typeof record.value === 'number' && Number.isFinite(record.value)) return Float32Array.of(record.value);
  }
  return new Float32Array();
}

export function connectLocalSignalSocket(options: FrontierLocalSocketOptions): () => void {
  const url = validateLocalSignalSocketUrl(options.url);
  options.onStatus?.('connecting');
  const socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  socket.onopen = () => options.onStatus?.('open');
  socket.onclose = () => options.onStatus?.('closed');
  socket.onerror = () => options.onStatus?.('error');
  socket.onmessage = (event) => {
    try {
      if (event.data instanceof ArrayBuffer) {
        const values = new Float32Array(event.data);
        if (values.length) options.onSamples(values);
        return;
      }
      if (typeof event.data === 'string') {
        const text = event.data.trim();
        if (!text) return;
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch {
          parsed = text.split(/[\s,]+/).map(Number).filter(Number.isFinite);
        }
        const values = parseSocketPayload(parsed);
        if (values.length) options.onSamples(values);
      }
    } catch {
      // Sensor bridges are best-effort; malformed frames are simply ignored.
    }
  };
  return () => {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close(1000, 'FRONTIER bridge closed');
  };
}

type BluetoothRemoteGATTCharacteristicLike = EventTarget & {
  value?: DataView | null;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
};

type BluetoothRemoteGATTServiceLike = {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
};

type BluetoothRemoteGATTServerLike = {
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTServiceLike>;
  disconnect(): void;
};

type BluetoothDeviceLike = {
  gatt?: { connect(): Promise<BluetoothRemoteGATTServerLike> };
};

type BluetoothLike = {
  requestDevice(options: { filters?: Array<{ services?: string[] }>; optionalServices?: string[]; acceptAllDevices?: boolean }): Promise<BluetoothDeviceLike>;
};

export type FrontierBluetoothSignalOptions = {
  service: string;
  characteristic: string;
  onSamples: FrontierSignalSink;
  decode?: (value: DataView) => Float32Array;
};

function defaultBluetoothDecoder(value: DataView): Float32Array {
  const count = Math.floor(value.byteLength / 4);
  if (!count) return new Float32Array();
  const output = new Float32Array(count);
  for (let index = 0; index < count; index += 1) output[index] = value.getFloat32(index * 4, true);
  return output;
}

/**
 * Must be called from a user gesture. FRONTIER intentionally stays generic:
 * device-specific BLE services and parsers are supplied by the caller rather
 * than hard-coding a medical-device interpretation into the recommendation UI.
 */
export async function connectBluetoothSignal(options: FrontierBluetoothSignalOptions): Promise<() => Promise<void>> {
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
  if (!bluetooth) throw new Error('Web Bluetooth unavailable');
  const device = await bluetooth.requestDevice({ filters: [{ services: [options.service] }] });
  if (!device.gatt) throw new Error('Bluetooth GATT unavailable');
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(options.service);
  const characteristic = await service.getCharacteristic(options.characteristic);
  const decode = options.decode ?? defaultBluetoothDecoder;
  const onValue = (event: Event) => {
    const source = event.currentTarget as BluetoothRemoteGATTCharacteristicLike;
    if (!source.value) return;
    const values = decode(source.value);
    if (values.length) options.onSamples(values);
  };
  characteristic.addEventListener('characteristicvaluechanged', onValue);
  await characteristic.startNotifications();
  return async () => {
    characteristic.removeEventListener('characteristicvaluechanged', onValue);
    try { await characteristic.stopNotifications(); } catch {}
    server.disconnect();
  };
}
