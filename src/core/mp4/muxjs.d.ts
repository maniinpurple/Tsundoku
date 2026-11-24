declare module "mux.js/lib/mp4/transmuxer" {
  export class Transmuxer {
    constructor(options?: { remux?: boolean; keepOriginalTimestamps?: boolean });
    on(event: "data", listener: (segment: { initSegment: Uint8Array; data: Uint8Array }) => void): void;
    on(event: "done", listener: () => void): void;
    push(bytes: Uint8Array): void;
    flush(): void;
    dispose(): void;
  }
}
