const path = require("node:path");
const net = require("node:net");
const {createElevatedHostsFileWriter} = require("./hosts-file-elevation");

const DEFAULT_HOST_ENTRY = "172.16.240.254 html5stage.mytv.vn";

function resolveHostsFilePath({platform = process.platform, env = process.env} = {}) {
    if (platform === "win32") {
        const windowsRoot = env.SystemRoot || env.windir || "C:\\Windows";
        return path.win32.join(windowsRoot, "System32", "drivers", "etc", "hosts");
    }
    return "/etc/hosts";
}

function normalizeHostEntry(value) {
    const entry = String(value ?? "").trim().replace(/\s+/gu, " ");
    if (!entry || entry.includes("\n") || entry.includes("\r")) {
        const error = new Error("DNS Host must contain an IP address and hostname.");
        error.code = "INVALID_ENTRY";
        throw error;
    }

    const parts = entry.split(" ");
    if (parts.length !== 2 || !net.isIP(parts[0]) || !/^[a-z0-9.-]+$/iu.test(parts[1])) {
        const error = new Error("DNS Host must contain one IP address and one hostname.");
        error.code = "INVALID_ENTRY";
        throw error;
    }
    return entry;
}

function normalizeLine(value) {
    return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function createHostsFileService({fs, platform = process.platform, env = process.env, hostsFilePath, spawn} = {}) {
    if (!fs?.readFile || !fs?.writeFile) throw new Error("A promise-based fs implementation is required.");
    const filePath = hostsFilePath || resolveHostsFilePath({platform, env});
    const elevatedWrite = createElevatedHostsFileWriter({platform, spawn});

    async function readFile() {
        try {
            return await fs.readFile(filePath, "utf8");
        } catch (error) {
            if (error?.code === "ENOENT") return "";
            throw error;
        }
    }

    function result(entry, content) {
        const exists = content.split(/\r?\n/u).some((line) => normalizeLine(line) === entry);
        return {ok: true, exists, entry, path: filePath};
    }

    async function getStatus(value = DEFAULT_HOST_ENTRY) {
        let entry;
        try {
            entry = normalizeHostEntry(value);
            return result(entry, await readFile());
        } catch (error) {
            return {ok: false, status: error?.code === "INVALID_ENTRY" ? "INVALID_ENTRY" : "HOSTS_FILE_READ_FAILED", message: error.message, entry, path: filePath};
        }
    }

    async function update(value, shouldAdd) {
        let entry;
        try {
            entry = normalizeHostEntry(value);
            const content = await readFile();
            const current = result(entry, content);
            if (shouldAdd && current.exists) return {...current, status: "ALREADY_PRESENT"};
            if (!shouldAdd && !current.exists) return {...current, status: "NOT_PRESENT"};

            const eol = content.includes("\r\n") ? "\r\n" : "\n";
            const lines = content.split(/\r?\n/u);
            let nextContent;
            if (shouldAdd) {
                const prefix = content && !content.endsWith(eol) ? `${content}${eol}` : content;
                nextContent = `${prefix}${entry}${eol}`;
            } else {
                nextContent = lines.filter((line) => normalizeLine(line) !== entry).join(eol);
            }
            try {
                await fs.writeFile(filePath, nextContent, "utf8");
            } catch (error) {
                if (!elevatedWrite || (error?.code !== "EACCES" && error?.code !== "EPERM")) throw error;
                const elevated = await elevatedWrite(filePath, nextContent);
                if (!elevated) {
                    const permissionError = new Error("Administrator permission was not granted to update the hosts file.");
                    permissionError.code = "PERMISSION_DENIED";
                    throw permissionError;
                }
            }
            return result(entry, nextContent);
        } catch (error) {
            let status = "HOSTS_FILE_UPDATE_FAILED";
            if (error?.code === "INVALID_ENTRY") status = "INVALID_ENTRY";
            else if (error?.code === "PERMISSION_DENIED" || error?.code === "EACCES" || error?.code === "EPERM") status = "PERMISSION_DENIED";
            return {
                ok: false,
                status,
                message: error.message,
                entry,
                path: filePath,
            };
        }
    }

    return {
        getStatus,
        add: (value = DEFAULT_HOST_ENTRY) => update(value, true),
        remove: (value = DEFAULT_HOST_ENTRY) => update(value, false),
        path: filePath,
    };
}

module.exports = {DEFAULT_HOST_ENTRY, resolveHostsFilePath, normalizeHostEntry, createHostsFileService};
