import type { OutboxOperation, OutboxEntity, OutboxAction } from "./storage";

export function coalesceOutboxOperation(
  operations: OutboxOperation[],
  input: {
    entity: OutboxEntity;
    entityId: string;
    action: OutboxAction;
    payload?: Record<string, unknown>;
  },
  createOperation: () => OutboxOperation
): OutboxOperation[];
