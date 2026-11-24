import type { Language } from "../languages";
import type { Cue } from "../subtitles";
import { ascii, box, fullBox, u32, u32Array, u64 } from "./boxes";

export interface TextTrackInput {
  language: Language;
  cues: Cue[];
  /** Shown by default; players pick it when subtitles are on. */
  isDefault: boolean;
}

const TIMESCALE = 1000;
const SUBTITLE_GROUP = 2;

// tx3g sample description as ffmpeg writes it: centred, bottom, white Arial on transparent.
const TX3G = hex("00000000000000010000000001ff000000ff00000000000000000000000000010010ffffffff00000012667461620001000105417269616c");

/** QuickTime-compatible "mov_text" samples: a 16-bit length then UTF-8 text. Gaps become empty samples. */
export function textSamples(cues: Cue[]): { samples: Uint8Array[]; durations: number[] } {
  const samples: Uint8Array[] = [];
  const durations: number[] = [];
  const encoder = new TextEncoder();
  let time = 0;
  for (const cue of cues) {
    const start = Math.max(cue.start, time);
    if (cue.end <= start) continue;
    if (start > time) {
      samples.push(new Uint8Array(2));
      durations.push(start - time);
    }
    const text = encoder.encode(cue.text);
    const sample = new Uint8Array(2 + text.length);
    new DataView(sample.buffer).setUint16(0, text.length);
    sample.set(text, 2);
    samples.push(sample);
    durations.push(cue.end - start);
    time = cue.end;
  }
  return { samples, durations };
}

export function textTrak(options: {
  id: number;
  input: TextTrackInput;
  sizes: number[];
  durations: number[];
  chunkOffset: number;
  movieTimescale: number;
  dinf: Uint8Array;
}): Uint8Array {
  const { id, input, sizes, durations, chunkOffset, movieTimescale, dinf } = options;
  const mediaDuration = durations.reduce((a, b) => a + b, 0);
  const movieDuration = Math.round((mediaDuration / TIMESCALE) * movieTimescale);
  const matrix = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);

  const tkhd = fullBox(
    "tkhd",
    0,
    input.isDefault ? 3 : 2,
    u32(0, 0, id, 0, movieDuration, 0, 0, SUBTITLE_GROUP, 0),
    matrix,
    u32(0, 0),
  );
  const mdhd = fullBox("mdhd", 0, 0, u32(0, 0, TIMESCALE, mediaDuration, packLanguage(input.language.iso3) << 16));
  const hdlr = fullBox("hdlr", 0, 0, u32(0), ascii("sbtl"), u32(0, 0, 0), ascii("SubtitleHandler\0"));
  const elng = input.language.code.includes("-") ? [fullBox("elng", 0, 0, ascii(`${input.language.code}\0`))] : [];

  const stbl = box(
    "stbl",
    fullBox("stsd", 0, 0, u32(1), box("tx3g", TX3G)),
    fullBox("stts", 0, 0, u32(durations.length), u32Array(durations.flatMap((d) => [1, d]))),
    fullBox("stsc", 0, 0, u32(1, 1, sizes.length, 1)),
    fullBox("stsz", 0, 0, u32(0, sizes.length), u32Array(sizes)),
    fullBox("co64", 0, 0, u32(1), u64(chunkOffset)),
  );
  return box("trak", tkhd, box("mdia", mdhd, ...elng, hdlr, box("minf", fullBox("nmhd", 0, 0), dinf, stbl)));
}

function packLanguage(iso3: string): number {
  const [a, b, c] = [...iso3.padEnd(3, "d")].map((char) => char.charCodeAt(0) - 0x60);
  return (a! << 10) | (b! << 5) | c!;
}

function hex(text: string): Uint8Array {
  return Uint8Array.from(text.match(/../g)!, (byte) => Number.parseInt(byte, 16));
}
