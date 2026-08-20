function shellDoubleQuote(value) {
    return `"${String(value ?? "").replace(/(["\\$`])/g, "\\$1")}"`;
}

function shellSingleQuote(value) {
    return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
}

function stringifyCurlBody(body) {
    if (typeof body === "string") return body;
    try {
        return JSON.stringify(body);
    } catch {
        return "";
    }
}

function buildCurlCommand(request) {
    if (!request || typeof request !== "object") return "";
    const url = String(request.url ?? "").trim();
    if (!url) return "";

    const method = String(request.method ?? "GET").trim().toUpperCase() || "GET";
    const parts = [`curl -X ${method} ${shellDoubleQuote(url)}`];
    const headers = request.headers && typeof request.headers === "object" ? request.headers : {};
    Object.entries(headers).forEach(([name, value]) => {
        const headerName = String(name ?? "").trim();
        if (!headerName) return;
        parts.push(`-H ${shellDoubleQuote(`${headerName}: ${String(value ?? "")}`)}`);
    });

    if (request.body !== undefined && request.body !== null) {
        const body = stringifyCurlBody(request.body);
        if (body) parts.push(`--data-binary ${shellSingleQuote(body)}`);
    }

    return parts.join(" \\\n  ");
}

function collectCurlRequests(source) {
    if (Array.isArray(source)) return source.flatMap((item) => collectCurlRequests(item));
    if (!source || typeof source !== "object") return [];
    if (typeof source.url === "string" && source.url.trim()) return [source];
    if (source.request) return collectCurlRequests(source.request);
    return [];
}

function buildCurlCommands(source) {
    return collectCurlRequests(source)
        .map((request) => buildCurlCommand(request))
        .filter(Boolean)
        .join("\n\n");
}

const apiCurl = Object.freeze({buildCurlCommand, buildCurlCommands});

if (typeof globalThis !== "undefined") globalThis.MYTV_API_CURL = apiCurl;
if (typeof module !== "undefined" && module.exports) module.exports = apiCurl;
