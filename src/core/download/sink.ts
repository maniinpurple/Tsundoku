export interface Sink {
  readonly position: number;
  write(data: Uint8Array): Promise<void>;
  writeAt(position: number, data: Uint8Array): Promise<void>;
  close(): Promise<File>;
  discard(): Promise<void>;
}

const DIRECTORY = "downloads";

async function directory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY, { create: true });
}

/**
 * A file in the extension's private storage (OPFS), so a 1 GB episode never sits in RAM.
 * `keepBytes` reopens an existing file and continues after that many bytes (resume).
 */
export async function createOpfsSink(name: string, keepBytes = 0): Promise<Sink> {
  const dir = await directory();
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable({ keepExistingData: keepBytes > 0 });
  await writable.truncate(keepBytes);
  let position = keepBytes;
  let closed = false;

  return {
    get position() {
      return position;
    },
    async write(data) {
      await writable.write({ type: "write", position, data: data as Uint8Array<ArrayBuffer> });
      position += data.length;
    },
    async writeAt(at, data) {
      await writable.write({ type: "write", position: at, data: data as Uint8Array<ArrayBuffer> });
    },
    async close() {
      closed = true;
      await writable.close();
      return handle.getFile();
    },
    async discard() {
      if (!closed) await writable.abort().catch(() => {});
      await dir.removeEntry(name).catch(() => {});
    },
  };
}

export async function storedFileSize(name: string): Promise<number> {
  try {
    return (await (await (await directory()).getFileHandle(name)).getFile()).size;
  } catch {
    return 0;
  }
}

export async function readStoredFile(name: string): Promise<File> {
  return (await (await directory()).getFileHandle(name)).getFile();
}

export async function removeStoredFile(name: string): Promise<void> {
  await (await directory()).removeEntry(name).catch(() => {});
}

export async function listStoredFiles(): Promise<string[]> {
  const names: string[] = [];
  for await (const name of (await directory()).keys()) names.push(name);
  return names;
}
