const PAYMENT_METHODS = ["bank", "cash", "splitwise"];
const PAYMENT_METHOD_SET = new Set(PAYMENT_METHODS);

export function withDefaultPaymentMethod(value) {
  if (!Array.isArray(value)) return ["bank"];
  const methods = Array.from(
    new Set(value.filter((method) => PAYMENT_METHOD_SET.has(method)))
  );
  return methods.length > 0 ? methods : ["bank"];
}

export function toggleRequiredPaymentMethod(methods, method) {
  const current = withDefaultPaymentMethod(methods);
  if (current.includes(method)) {
    if (current.length === 1) {
      return { methods: current, blocked: true };
    }
    return {
      methods: current.filter((item) => item !== method),
      blocked: false,
    };
  }
  if (!PAYMENT_METHOD_SET.has(method)) {
    return { methods: current, blocked: true };
  }
  return { methods: [...current, method], blocked: false };
}
