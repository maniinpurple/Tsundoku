import { ascii, box, childBoxes, concat, findBox, fullBox, readBoxes, u32, u32Array, u64, u64Array, type Box } from "./boxes";
import type { Sink } from "../download/sink";
import { textSamples, textTrak, type TextTrackInput } from "./text-track";

// mux.js produces fragmented MP4 (moof/mdat pairs). Apple players misread the duration and
// sometimes drop audio in fragmented files, so we rewrite it as a regular MP4:
// ftyp, one big mdat with every sample, then a moov with full sample tables.

interface TrackState {
  id: number;
  timescale: number;
  isVideo: boolean;
  tkhd: Uint8Array;
  mdhd: Uint8Array;
  hdlr: Uint8Array;
  mediaHeader: Uint8Array;
  dinf: Uint8Array;
  stsd: Uint8Array;
  sizes: number[];
  durations: number[];
  ctsOffsets: number[];
  syncSamples: number[];
  chunks: { offset: number; samples: number }[];
}

const MDAT_HEADER = 16;
const TRUN = { dataOffset: 0x1, firstFlags: 0x4, duration: 0x100, size: 0x200, flags: 0x400, cts: 0x800 };
const TFHD = { baseOffset: 0x1, descriptionIndex: 0x2, duration: 0x8, size: 0x10, flags: 0x20 };
const NON_SYNC = 0x10000;

export class Mp4Flattener {
  private tracks = new Map<number, TrackState>();
  private movieHeader?: Uint8Array;
  private movieTimescale = 1000;
  private mdatStart = 0;

  constructor(private sink: Sink) {}

  get hasInit(): boolean {
    return this.movieHeader !== undefined;
  }

  async start(init: Uint8Array): Promise<void> {
    const ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isomiso2avc1mp41"));
    this.mdatStart = ftyp.length;
    await this.sink.write(ftyp);
    await this.sink.write(concat([u32(1), ascii("mdat"), u64(0)]));
    this.readInit(init);
  }

  async addFragments(data: Uint8Array): Promise<void> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (const moof of readBoxes(data).filter((b) => b.type === "moof")) {
      for (const traf of childBoxes(data, moof).filter((b) => b.type === "traf")) {
        await this.addTraf(data, view, moof, traf);
      }
    }
  }

  async finish(textTracks: TextTrackInput[] = []): Promise<void> {
    const texts: Uint8Array[] = [];
    let nextId = Math.max(0, ...this.tracks.keys()) + 1;
    const dinf = [...this.tracks.values()][0]?.dinf;
    for (const input of textTracks) {
      const { samples, durations } = textSamples(input.cues);
      if (samples.length === 0 || !dinf) continue;
      const chunkOffset = this.sink.position;
      await this.sink.write(concat(samples));
      const sizes = samples.map((s) => s.length);
      texts.push(textTrak({ id: nextId++, input, sizes, durations, chunkOffset, movieTimescale: this.movieTimescale, dinf }));
    }
    const end = this.sink.position;
    const moov = this.buildMoov(texts, nextId);
    await this.sink.write(moov);
    await this.sink.writeAt(this.mdatStart + 8, u64(end - this.mdatStart));
  }

  get durationSeconds(): number {
    return Math.max(0, ...[...this.tracks.values()].map((t) => sum(t.durations) / t.timescale));
  }

  private readInit(init: Uint8Array): void {
    const view = new DataView(init.buffer, init.byteOffset, init.byteLength);
    const moov = findBox(readBoxes(init), "moov");
    if (!moov) throw new Error("No moov box in init segment");
    for (const child of childBoxes(init, moov)) {
      if (child.type === "mvhd") {
        this.movieHeader = init.slice(child.start, child.end);
        this.movieTimescale = view.getUint32(child.body + (init[child.body] === 1 ? 20 : 12));
      }
      if (child.type !== "trak") continue;
      const trak = childBoxes(init, child);
      const tkhd = findBox(trak, "tkhd")!;
      const mdia = childBoxes(init, findBox(trak, "mdia")!);
      const mdhd = findBox(mdia, "mdhd")!;
      const minf = childBoxes(init, findBox(mdia, "minf")!);
      const stbl = childBoxes(init, findBox(minf, "stbl")!);
      const mediaHeader = findBox(minf, "vmhd") ?? findBox(minf, "smhd")!;
      const id = view.getUint32(tkhd.body + (init[tkhd.body] === 1 ? 20 : 12));
      this.tracks.set(id, {
        id,
        timescale: view.getUint32(mdhd.body + (init[mdhd.body] === 1 ? 20 : 12)),
        isVideo: mediaHeader.type === "vmhd",
        tkhd: init.slice(tkhd.start, tkhd.end),
        mdhd: init.slice(mdhd.start, mdhd.end),
        hdlr: slice(init, findBox(mdia, "hdlr")!),
        mediaHeader: slice(init, mediaHeader),
        dinf: slice(init, findBox(minf, "dinf")!),
        stsd: slice(init, findBox(stbl, "stsd")!),
        sizes: [],
        durations: [],
        ctsOffsets: [],
        syncSamples: [],
        chunks: [],
      });
    }
  }

  private async addTraf(data: Uint8Array, view: DataView, moof: Box, traf: Box): Promise<void> {
    const children = childBoxes(data, traf);
    const tfhd = findBox(children, "tfhd");
    if (!tfhd) return;
    const tfhdFlags = view.getUint32(tfhd.body) & 0xffffff;
    const track = this.tracks.get(view.getUint32(tfhd.body + 4));
    if (!track) return;

    let p = tfhd.body + 8;
    let base = moof.start;
    if (tfhdFlags & TFHD.baseOffset) (base = Number(view.getBigUint64(p))), (p += 8);
    if (tfhdFlags & TFHD.descriptionIndex) p += 4;
    let defaultDuration = 0;
    let defaultSize = 0;
    let defaultFlags = 0;
    if (tfhdFlags & TFHD.duration) (defaultDuration = view.getUint32(p)), (p += 4);
    if (tfhdFlags & TFHD.size) (defaultSize = view.getUint32(p)), (p += 4);
    if (tfhdFlags & TFHD.flags) defaultFlags = view.getUint32(p);

    for (const trun of children.filter((b) => b.type === "trun")) {
      const version = data[trun.body]!;
      const flags = view.getUint32(trun.body) & 0xffffff;
      const count = view.getUint32(trun.body + 4);
      let q = trun.body + 8;
      let dataOffset = 0;
      let firstFlags: number | undefined;
      if (flags & TRUN.dataOffset) (dataOffset = view.getInt32(q)), (q += 4);
      if (flags & TRUN.firstFlags) (firstFlags = view.getUint32(q)), (q += 4);

      let bytes = 0;
      for (let i = 0; i < count; i++) {
        const duration = flags & TRUN.duration ? view.getUint32((q += 4) - 4) : defaultDuration;
        const size = flags & TRUN.size ? view.getUint32((q += 4) - 4) : defaultSize;
        let sampleFlags = flags & TRUN.flags ? view.getUint32((q += 4) - 4) : defaultFlags;
        if (i === 0 && firstFlags !== undefined) sampleFlags = firstFlags;
        const cts = flags & TRUN.cts ? (version === 0 ? view.getUint32(q) : view.getInt32(q)) : 0;
        if (flags & TRUN.cts) q += 4;

        track.durations.push(duration);
        track.sizes.push(size);
        track.ctsOffsets.push(cts);
        if (!(sampleFlags & NON_SYNC)) track.syncSamples.push(track.sizes.length);
        bytes += size;
      }

      const start = base + dataOffset;
      track.chunks.push({ offset: this.sink.position, samples: count });
      await this.sink.write(data.subarray(start, start + bytes));
    }
  }

  private buildMoov(textTraks: Uint8Array[], nextTrackId: number): Uint8Array {
    const traks = [...this.tracks.values()].filter((t) => t.sizes.length > 0);
    const movieDuration = Math.max(...traks.map((t) => (sum(t.durations) / t.timescale) * this.movieTimescale));
    const mvhd = withDuration(this.movieHeader!, movieDuration);
    new DataView(mvhd.buffer).setUint32(mvhd.length - 4, nextTrackId);
    return box("moov", mvhd, ...traks.map((track) => this.buildTrak(track)), ...textTraks);
  }

  private buildTrak(track: TrackState): Uint8Array {
    const mediaDuration = sum(track.durations);
    const trackDuration = (mediaDuration / track.timescale) * this.movieTimescale;
    const stbl = box(
      "stbl",
      track.stsd,
      stts(track.durations),
      ...(track.ctsOffsets.some((c) => c !== 0) ? [ctts(track.ctsOffsets)] : []),
      ...(track.isVideo && track.syncSamples.length < track.sizes.length ? [stss(track.syncSamples)] : []),
      stsc(track.chunks.map((c) => c.samples)),
      fullBox("stsz", 0, 0, u32(0, track.sizes.length), u32Array(track.sizes)),
      fullBox("co64", 0, 0, u32(track.chunks.length), u64Array(track.chunks.map((c) => c.offset))),
    );
    return box(
      "trak",
      withDuration(track.tkhd, trackDuration),
      box("mdia", withDuration(track.mdhd, mediaDuration), track.hdlr, box("minf", track.mediaHeader, track.dinf, stbl)),
    );
  }
}

function slice(bytes: Uint8Array, b: Box): Uint8Array {
  return bytes.slice(b.start, b.end);
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function withDuration(source: Uint8Array, duration: number): Uint8Array {
  const out = source.slice();
  const view = new DataView(out.buffer);
  const isTkhd = out[4] === 0x74 && out[5] === 0x6b;
  const value = Math.round(duration);
  if (out[8] === 1) view.setBigUint64(isTkhd ? 36 : 32, BigInt(value));
  else view.setUint32(isTkhd ? 28 : 24, value);
  return out;
}

function runs(values: number[]): [count: number, value: number][] {
  const out: [number, number][] = [];
  for (const value of values) {
    const last = out.at(-1);
    if (last && last[1] === value) last[0]++;
    else out.push([1, value]);
  }
  return out;
}

function stts(durations: number[]): Uint8Array {
  const entries = runs(durations);
  return fullBox("stts", 0, 0, u32(entries.length), u32Array(entries.flat()));
}

function ctts(offsets: number[]): Uint8Array {
  const entries = runs(offsets);
  const version = offsets.some((o) => o < 0) ? 1 : 0;
  return fullBox("ctts", version, 0, u32(entries.length), u32Array(entries.flat()));
}

function stss(samples: number[]): Uint8Array {
  return fullBox("stss", 0, 0, u32(samples.length), u32Array(samples));
}

function stsc(samplesPerChunk: number[]): Uint8Array {
  const entries: number[] = [];
  let previous = -1;
  samplesPerChunk.forEach((count, i) => {
    if (count === previous) return;
    entries.push(i + 1, count, 1);
    previous = count;
  });
  return fullBox("stsc", 0, 0, u32(entries.length / 3), u32Array(entries));
}
