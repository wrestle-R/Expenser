import type { CreateTransactionPayload, PaymentMethod, TransactionType } from '../expo/lib/types';
export function parseTransactionDraft(draft: { amount: string; description: string; category: string; type: TransactionType; paymentMethod: PaymentMethod; date: string }): CreateTransactionPayload;
