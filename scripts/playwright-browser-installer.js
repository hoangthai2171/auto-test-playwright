function buildBrowserInstallCommand({platform, nodePath, resolvePlaywrightCli}) {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/c", "npx", "playwright", "install", "chromium"],
    };
  }

  return {
    command: nodePath,
    args: [resolvePlaywrightCli(), "install", "chromium"],
  };
}

module.exports = {buildBrowserInstallCommand};
