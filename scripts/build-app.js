// Runs electron-builder with whatever arguments the npm script passes through,
// then reports the size and SHA-256 of each installer it produced.

const path = require("node:path");
const fs = require("node:fs/promises");
const {createReadStream} = require("node:fs");
const {createHash} = require("node:crypto");
const {spawn} = require("node:child_process");
const {
  selectBuiltArtifacts,
  parseBuilderArtifactArchitectures,
  formatArtifactReport,
} = require("./build-artifact-report");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "dist");
const BUILDER_CLI = require.resolve("electron-builder/cli.js");

async function readOutputDirectory() {
  let entries;
  try {
    entries = await fs.readdir(OUTPUT_DIRECTORY, {withFileTypes: true});
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      const stats = await fs.stat(path.join(OUTPUT_DIRECTORY, entry.name));
      files.push({fileName: entry.name, size: stats.size, modifiedAt: stats.mtimeMs});
    } catch {
      // A file that disappeared between listing and stat is simply not reported.
    }
  }
  return files;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

// electron-builder's log carries the architecture of each artifact, so its
// output is captured as well as forwarded - the operator still sees the build
// live, unchanged.
function runBuilder(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BUILDER_CLI, ...args], {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";
    const capture = (stream, target) => {
      if (!stream) return;
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output += chunk;
        target.write(chunk);
      });
    };
    capture(child.stdout, process.stdout);
    capture(child.stderr, process.stderr);
    child.on("error", () => resolve({code: 1, signal: null, output}));
    child.on("close", (code, signal) => resolve({code: code ?? 0, signal, output}));
  });
}

(async () => {
  const args = process.argv.slice(2);
  const before = await readOutputDirectory();
  const {code, signal, output} = await runBuilder(args);

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  if (code !== 0) {
    process.exit(code);
  }

  const artifacts = [];
  for (const entry of selectBuiltArtifacts({before, after: await readOutputDirectory()})) {
    artifacts.push({...entry, sha256: await hashFile(path.join(OUTPUT_DIRECTORY, entry.fileName))});
  }

  const {version} = require(path.join(ROOT, "package.json"));
  console.log("");
  console.log(formatArtifactReport({
    version,
    artifacts,
    builderArchitectures: parseBuilderArtifactArchitectures(output),
    hostArch: process.arch,
  }));
})().catch((error) => {
  console.error(`Could not report the build artifacts: ${error.message}`);
  process.exit(1);
});
