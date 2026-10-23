export function parseTransactionDraft({ amount, description, category, type, paymentMethod, date }) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(amount).trim()) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 1e12) throw new Error('Enter a positive amount with up to two decimal places.');
  if (!['income', 'expense'].includes(type) || !['bank', 'cash', 'splitwise'].includes(paymentMethod)) throw new Error('Choose a transaction type and payment method.');
  if (!String(category).trim()) throw new Error('Choose or enter a category.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter the date as YYYY-MM-DD.');
  const parsed = new Date(`${date}T12:00:00+05:30`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Enter a valid calendar date.');
  return { amount: Number(amount), description: String(description).trim(), category: String(category).trim(), type, paymentMethod, date: parsed.toISOString() };
}
