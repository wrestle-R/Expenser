// Keyset pagination preserves PostgreSQL's full timestamp precision in the cursor.
export function parseTransactionPage(searchParams) {
  if (!searchParams.has('limit')) return null; // Existing web/older clients keep their response shape.
  const limit = Number(searchParams.get('limit'));
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be between 1 and 500');
  const encoded = searchParams.get('cursor');
  let cursor = null;
  if (encoded) {
    if (encoded.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid transaction cursor');
    try { cursor = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { throw new Error('Invalid transaction cursor'); }
    if (!cursor || typeof cursor.date !== 'string' || typeof cursor.createdAt !== 'string' || !Number.isFinite(Date.parse(cursor.date)) || !Number.isFinite(Date.parse(cursor.createdAt)) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cursor.id)) throw new Error('Invalid transaction cursor');
  }
  return { limit, cursor };
}
export function transactionPageCursor(row) {
  return Buffer.from(JSON.stringify({ date: row.cursor_date, createdAt: row.cursor_created_at, id: row.id })).toString('base64url');
}
