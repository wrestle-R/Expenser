import type { PaymentMethod } from "./db";

export function parsePaymentMethods(value: unknown): PaymentMethod[];
export function requirePaymentMethods(value: unknown): PaymentMethod[];
export function withDefaultPaymentMethod(value: unknown): PaymentMethod[];
export function toggleRequiredPaymentMethod(
  methods: unknown,
  method: string
): { methods: PaymentMethod[]; blocked: boolean };
