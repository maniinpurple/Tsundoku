export interface Box {
  type: string;
  start: number;
  end: number;
  /** Offset of the box payload (after size and type). */
  body: number;
}

export function readBoxes(bytes: Uint8Array, start = 0, end = bytes.length): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: Box[] = [];
  for (let p = start; p + 8 <= end; ) {
    let size = view.getUint32(p);
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header) break;
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    boxes.push({ type, start: p, end: p + size, body: p + header });
    p += size;
  }
  return boxes;
}

export function childBoxes(bytes: Uint8Array, box: Box): Box[] {
  return readBoxes(bytes, box.body, box.end);
}

export function findBox(boxes: Box[], type: string): Box | undefined {
  return boxes.find((box) => box.type === type);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);
  const out = new Uint8Array(8 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  return out;
}

export function fullBox(type: string, version: number, flags: number, ...payload: Uint8Array[]): Uint8Array {
  return box(type, u32((version << 24) | flags), ...payload);
}

export function u32(...values: number[]): Uint8Array {
  return u32Array(values);
}

export function u32Array(values: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setUint32(i * 4, values[i]! >>> 0);
  return out;
}

export function u64(...values: number[]): Uint8Array {
  return u64Array(values);
}

export function u64Array(values: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(values.length * 8);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setBigUint64(i * 8, BigInt(values[i]!));
  return out;
}

export function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}
