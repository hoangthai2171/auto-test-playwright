const WEBP_DATA_URL_PREFIX = /^data:image\/webp;base64,/iu;

function normalizeResultScreenshots(value) {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";
    if (/^data:/iu.test(raw)) {
        return WEBP_DATA_URL_PREFIX.test(raw) ? normalizeResultScreenshots(raw.replace(WEBP_DATA_URL_PREFIX, "")) : "";
    }
    if (raw.length % 4 !== 0) return "";
    return /^[A-Za-z0-9+/]+={0,2}$/u.test(raw) ? raw : "";
}

module.exports = {normalizeResultScreenshots};
