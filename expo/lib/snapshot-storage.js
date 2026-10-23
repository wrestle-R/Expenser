const MAX_PART_CHARS = 96_000;
export async function readSnapshot(storage, key) {
  const value = await storage.getItem(key);
  if (!value) return [];
  const saved = JSON.parse(value);
  if (Array.isArray(saved)) return saved; // Existing installs migrate on their next write.
  if (saved?.version !== 3 || !Number.isInteger(saved.parts) || saved.parts < 0 || saved.parts > 10000) throw new Error('Invalid saved snapshot');
  const keys = Array.from({ length: saved.parts }, (_, i) => `${key}:part:${i}`);
  const parts = await storage.multiGet(keys);
  const rows = [];
  for (const [partKey, data] of parts) {
    if (!data) throw new Error(`Saved snapshot part is missing: ${partKey}`);
    const items = JSON.parse(data);
    if (!Array.isArray(items)) throw new Error('Invalid saved snapshot part');
    rows.push(...items);
  }
  if (rows.length !== saved.count) throw new Error('Saved snapshot is incomplete');
  return rows;
}
export function encodeSnapshot(key, rows) {
  const parts = [];
  let values = [], length = 2;
  for (const row of rows) {
    const value = JSON.stringify(row);
    if (value.length > MAX_PART_CHARS) throw new Error('A single saved record is too large.');
    if (length + value.length + 1 > MAX_PART_CHARS) { parts.push(`[${values.join(',')}]`); values = []; length = 2; }
    values.push(value); length += value.length + 1;
  }
  if (values.length) parts.push(`[${values.join(',')}]`);
  // Small histories retain the original format for simple backwards compatibility.
  if (parts.length <= 1) return [[key, parts[0] ?? '[]']];
  return [[key, JSON.stringify({ version: 3, parts: parts.length, count: rows.length })], ...parts.map((part, i) => [`${key}:part:${i}`, part])];
}
export async function writeSnapshots(storage, snapshots) {
  const obsolete = [];
  const encoded = snapshots.map(([key, rows]) => encodeSnapshot(key, rows));
  const pairs = encoded.flat();
  for (let index = 0; index < snapshots.length; index++) {
    const [key] = snapshots[index];
    const previous = JSON.parse(await storage.getItem(key) ?? '[]');
    const nextParts = encoded[index].length - 1;
    if (previous?.version === 3) for (let i = nextParts; i < previous.parts; i++) obsolete.push(`${key}:part:${i}`);
  }
  // AsyncStorage Android implements multiSet as one SQLite transaction.
  await storage.multiSet(pairs);
  // A failed cleanup only leaves unused chunks; the committed manifest is valid.
  if (obsolete.length) await storage.multiRemove(obsolete).catch(() => {});
}
