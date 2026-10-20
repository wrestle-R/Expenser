export function coalesceOutboxOperation(operations, input, createOperation) {
  const index = operations.findIndex(
    (operation) =>
      !operation.inFlight &&
      operation.entity === input.entity && operation.entityId === input.entityId
  );
  if (index < 0) return [...operations, createOperation()];

  const next = [...operations];
  const existing = next[index];
  const payload = input.payload ?? {};

  if (existing.action === "create" && input.action === "delete") {
    next.splice(index, 1);
  } else if (existing.action === "create") {
    next[index] = {
      ...existing,
      payload: { ...existing.payload, ...payload },
    };
  } else if (input.action === "delete") {
    next[index] = { ...existing, action: "delete", payload: {} };
  } else {
    next[index] = {
      ...existing,
      action: "update",
      payload: { ...existing.payload, ...payload },
    };
  }

  return next;
}

export function acknowledgeOutboxOperation(operations, completed, serverId) {
  return operations.filter((operation) => operation.id !== completed.id).map((operation) => {
    if (!serverId || serverId === completed.entityId) return operation;
    return {
      ...operation,
      entityId: operation.entity === completed.entity && operation.entityId === completed.entityId
        ? serverId : operation.entityId,
      payload: operation.payload.exchangeExpenseId === completed.entityId
        ? { ...operation.payload, exchangeExpenseId: serverId } : operation.payload,
    };
  });
}
