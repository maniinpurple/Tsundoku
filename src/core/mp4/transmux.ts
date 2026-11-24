import { Transmuxer } from "mux.js/lib/mp4/transmuxer";

export interface Fragment {
  initSegment: Uint8Array;
  data: Uint8Array;
}

/** Feed whole HLS segments in order: flushing in the middle of a segment makes mux.js repeat frames. */
export function createTransmuxer() {
  const transmuxer = new Transmuxer({ remux: true });
  let output: Fragment[] = [];
  transmuxer.on("data", (fragment: Fragment) => output.push(fragment));

  return {
    push(segment: Uint8Array): Fragment[] {
      transmuxer.push(segment);
      transmuxer.flush();
      const result = output;
      output = [];
      return result;
    },
  };
}
