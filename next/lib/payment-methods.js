const PAYMENT_METHODS = ["bank", "cash", "splitwise"];
const PAYMENT_METHOD_SET = new Set(PAYMENT_METHODS);

export function parsePaymentMethods(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((method) => PAYMENT_METHOD_SET.has(method)))
  );
}

export function requirePaymentMethods(value) {
  const methods = parsePaymentMethods(value);
  if (methods.length === 0) {
    throw new Error("At least one payment method must remain enabled");
  }
  return methods;
}

export function withDefaultPaymentMethod(value) {
  const methods = parsePaymentMethods(value);
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
