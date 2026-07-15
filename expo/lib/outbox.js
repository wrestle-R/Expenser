export function coalesceOutboxOperation(operations, input, createOperation) {
  const index = operations.findIndex(
    (operation) =>
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
