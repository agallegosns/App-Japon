import { NihonDB } from '../storage/db';

let counter = 0;

export function freshDb(): NihonDB {
  counter++;
  return new NihonDB(`test-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`);
}

export function bytesBlob(bytes: number[], type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}
