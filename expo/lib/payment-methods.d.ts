import type { PaymentMethod } from "./types";

export function withDefaultPaymentMethod(value: unknown): PaymentMethod[];
export function toggleRequiredPaymentMethod(
  methods: unknown,
  method: string
): { methods: PaymentMethod[]; blocked: boolean };
