const BODY_TEXT_LIMIT = 12_000;
const FIELD_LIMIT = 2_000;
const REDACTED = "••••••";
const SENSITIVE_FIELD = /^(?:password|token|authorization|cookie|pairing[-_ ]?key)$/i;
const SENSITIVE_ASSIGNMENT = /(\b(?:password|token|authorization|cookie|pairing[-_ ]?key)\b\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi;

function redact(value, secrets) {
  let result = String(value ?? "").replace(SENSITIVE_ASSIGNMENT, `$1${REDACTED}`);
  const values = [...new Set(secrets.map((secret) => String(secret ?? "")).filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  for (const secret of values) {
    result = result.split(secret).join(REDACTED);
  }
  return result;
}

function normalizeDomState(value, {secrets = []} = {}) {
  const source = value && typeof value === "object" ? value : {};
  const state = {};

  for (const [field, fieldValue] of Object.entries(source)) {
    state[field] = SENSITIVE_FIELD.test(field)
      ? REDACTED
      : redact(fieldValue, secrets).slice(0, field === "bodyText" ? BODY_TEXT_LIMIT : FIELD_LIMIT);
  }

  for (const field of ["bodyText", "focused", "active", "screenUrl"]) {
    if (!(field in state)) state[field] = "";
  }

  return state;
}

module.exports = {normalizeDomState};
