function toIsoString(value) {
  if (value == null || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toRequiredIsoString(value) {
  return toIsoString(value) ?? new Date(0).toISOString();
}

module.exports = { toIsoString, toRequiredIsoString };
