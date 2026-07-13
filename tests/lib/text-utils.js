function normalizeVietnameseText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTextPattern(value) {
  return new RegExp(escapeRegExp(value), "i");
}

function fuzzyMatch(value, target) {
  const normalizedValue = normalizeVietnameseText(value);
  const normalizedTarget = normalizeVietnameseText(target);
  if (!normalizedValue || !normalizedTarget) return false;
  if (normalizedValue === normalizedTarget || normalizedValue.includes(normalizedTarget)) return true;

  const valueTokens = normalizedValue.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  const targetTokens = normalizedTarget.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  if (!valueTokens.length || !targetTokens.length) return false;

  return targetTokens.every((token) =>
    valueTokens.some((valueToken) => valueToken === token || valueToken.includes(token) || token.includes(valueToken))
  );
}

module.exports = {
  normalizeVietnameseText,
  fuzzyMatch,
  containsTextPattern,
  escapeRegExp,
};
