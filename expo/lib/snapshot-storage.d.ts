interface Storage {
  getItem(key: string): Promise<string | null>;
  multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
  multiSet(pairs: readonly (readonly [string, string])[]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}
export function readSnapshot<T>(storage: Storage, key: string): Promise<T[]>;
export function encodeSnapshot(key: string, rows: unknown[]): [string, string][];
export function writeSnapshots(storage: Storage, snapshots: [string, unknown[]][]): Promise<void>;
