function encodePowerShellCommand(command) {
    return Buffer.from(command, "utf16le").toString("base64");
}

function createMacOsScript(filePath, content) {
    const encoded = Buffer.from(content, "utf8").toString("base64");
    const target = filePath.replace(/'/gu, "'\\\"'\\\"'");
    return `do shell script "/bin/echo ${encoded} | /usr/bin/base64 -D > '${target}'" with administrator privileges`;
}

function createWindowsCommand(filePath, content) {
    const encodedContent = Buffer.from(content, "utf8").toString("base64");
    const elevatedCommand = `$bytes=[Convert]::FromBase64String('${encodedContent}'); [IO.File]::WriteAllBytes('${filePath.replace(/'/gu, "''")}', $bytes)`;
    const encodedElevatedCommand = encodePowerShellCommand(elevatedCommand);
    return `$process=Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-NonInteractive','-EncodedCommand','${encodedElevatedCommand}'); exit $process.ExitCode`;
}

function runCommand(spawn, command, args) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(command, args, {stdio: ["ignore", "ignore", "ignore"]});
        } catch {
            resolve(false);
            return;
        }
        child.once("error", () => resolve(false));
        child.once("exit", (code) => resolve(code === 0));
    });
}

function createElevatedHostsFileWriter({platform = process.platform, spawn} = {}) {
    if (typeof spawn !== "function") return null;
    if (platform === "darwin") {
        return (filePath, content) => runCommand(spawn, "/usr/bin/osascript", ["-e", createMacOsScript(filePath, content)]);
    }
    if (platform === "win32") {
        return (filePath, content) => runCommand(spawn, "powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            createWindowsCommand(filePath, content),
        ]);
    }
    return null;
}

module.exports = {encodePowerShellCommand, createMacOsScript, createWindowsCommand, createElevatedHostsFileWriter};
