export async function fetchTransactionHistory(fetcher = fetch) {
  const rows = new Map(), cursors = new Set();
  let cursor = null;
  do {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(`/api/transactions?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not load transactions');
      if (!Array.isArray(data.transactions)) throw new Error('Invalid transaction history response');
      for (const row of data.transactions) rows.set(row._id, row);
      cursor = data.nextCursor ?? null;
      if (cursor && cursors.has(cursor)) throw new Error('The server repeated a history page. Please retry.');
      if (cursor) cursors.add(cursor);
    } finally { clearTimeout(timeout); }
  } while (cursor);
  return { transactions: [...rows.values()] };
}
