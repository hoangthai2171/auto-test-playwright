"use strict";

const path = require("node:path");

const PROGRESS_CODES = new Set([
  "preparing",
  "downloading-node",
  "verifying-node",
  "extracting-node",
  "installing-appium",
  "verifying-lg-driver",
  "downloading-chromedriver",
  "verifying-chromedriver-archive",
  "extracting-chromedriver",
  "activating",
  "complete",
]);
const FAILURE_STATUSES = new Set([
  "INSTALL_INPUT_INVALID",
  "DOWNLOAD_FAILED",
  "CHECKSUM_MISMATCH",
  "EXTRACTION_FAILED",
  "DEPENDENCY_INSTALL_FAILED",
  "VERIFICATION_FAILED",
  "ACTIVATION_FAILED",
  "INSTALL_FAILED",
]);

async function exists(fs, targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function validInput(bundle, npmClosure, includeChromeDriver) {
  const managedBundleIsValid = Boolean(
    bundle?.components?.node?.url
    && bundle.components.node?.sha256
    && npmClosure?.lockfileVersion === 3
    && npmClosure?.packages?.[""]?.dependencies?.appium
    && npmClosure.packages[""]?.dependencies?.["appium-lg-webos-driver"],
  );
  return managedBundleIsValid && (!includeChromeDriver || Boolean(
    bundle.components?.chromedriver?.url
    && bundle.components.chromedriver?.sha256,
  ));
}

function createLgManagedInstallOperations({platform, managedRoot, fs, download, hashFile, extractNode, installNpmClosure, verify, downloadChromeDriver, extractChromeDriver, verifyChromeDriver} = {}) {
  if (!new Set(["darwin", "win32"]).has(platform)) throw new Error("LG toolchain setup supports only macOS and Windows.");
  if (typeof managedRoot !== "string" || !managedRoot) throw new Error("An LG managed toolchain root is required.");
  if (!fs || ["stat", "mkdir", "rm", "cp", "rename", "writeFile"].some((method) => typeof fs[method] !== "function")) {
    throw new Error("A filesystem with staged-install methods is required.");
  }
  if ([download, hashFile, extractNode, installNpmClosure, verify].some((operation) => typeof operation !== "function")) {
    throw new Error("LG managed-install dependencies are required.");
  }

  const stagingRoot = `${managedRoot}.auto.staging`;
  const previousRoot = `${managedRoot}.auto.previous`;

  async function rewriteStagedAppiumRegistry() {
    if (typeof fs.readFile !== "function") return;
    const registryPath = path.join(stagingRoot, "appium", "node_modules", ".cache", "appium", "extensions.yaml");
    let registry;
    try {
      registry = await fs.readFile(registryPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    const stagingBase = path.basename(stagingRoot);
    const managedBase = path.basename(managedRoot);
    const current = String(registry);
    const next = current
      .split(stagingRoot).join(managedRoot)
      .split(stagingBase).join(managedBase);
    if (next !== current) await fs.writeFile(registryPath, next, "utf8");
  }

  async function activateStaging() {
    const hasCurrentInstall = await exists(fs, managedRoot);
    let movedPrevious = false;
    let activated = false;
    await fs.rm(previousRoot, {recursive: true, force: true});
    try {
      if (hasCurrentInstall) {
        await fs.rename(managedRoot, previousRoot);
        movedPrevious = true;
      }
      await fs.rename(stagingRoot, managedRoot);
      activated = true;
    } catch (error) {
      if (movedPrevious && !activated) {
        try {
          await fs.rename(previousRoot, managedRoot);
        } catch {
          // Preserve the classified installation failure without exposing local paths.
        }
      }
      throw error;
    }
    if (movedPrevious) {
      try {
        await fs.rm(previousRoot, {recursive: true, force: true});
      } catch {
        // A retained app-managed backup is safer than rolling back a verified activation.
      }
    }
  }

  return {
    async install({bundle, npmClosure, includeChromeDriver = false, onProgress} = {}) {
      if (!validInput(bundle, npmClosure, includeChromeDriver)) return {ok: false, status: "INSTALL_INPUT_INVALID"};
      function emit(code, status) {
        if (typeof onProgress !== "function") return;
        const event = code === "failed"
          ? FAILURE_STATUSES.has(status) ? {code, status} : null
          : PROGRESS_CODES.has(code) ? {code} : null;
        if (!event) return;
        try {
          onProgress(event);
        } catch {
          // Progress observers are advisory and cannot change installation behavior.
        }
      }
      function failed(status, verification) {
        emit("failed", status);
        return {ok: false, status, ...(verification ? {verification} : {})};
      }
      let stage = "preparing";
      try {
        emit("preparing");
        await fs.rm(stagingRoot, {recursive: true, force: true});
        if (await exists(fs, managedRoot)) {
          await fs.cp(managedRoot, stagingRoot, {recursive: true});
        } else {
          await fs.mkdir(stagingRoot, {recursive: true});
        }

        const nodeRoot = path.join(stagingRoot, "node");
        const appiumRoot = path.join(stagingRoot, "appium");
        await fs.rm(nodeRoot, {recursive: true, force: true});
        await fs.mkdir(nodeRoot, {recursive: true});
        stage = "downloading";
        emit("downloading-node");
        const archivePath = await download({artifact: bundle.components.node, destination: stagingRoot});
        emit("verifying-node");
        if (typeof archivePath !== "string" || !archivePath || String(await hashFile(archivePath)).toLowerCase() !== bundle.components.node.sha256) {
          return failed("CHECKSUM_MISMATCH");
        }
        stage = "extracting";
        emit("extracting-node");
        await extractNode({artifact: bundle.components.node, archivePath, destination: nodeRoot, platform});
        await fs.rm(archivePath, {force: true});
        await fs.rm(appiumRoot, {recursive: true, force: true});
        await fs.mkdir(appiumRoot, {recursive: true});
        stage = "installing-dependencies";
        emit("installing-appium");
        await installNpmClosure({npmClosure, nodeRoot, destination: appiumRoot, platform});
        stage = "verifying";
        emit("verifying-lg-driver");
        const verificationResult = await verify({nodeRoot, appiumRoot, platform});
        if (!(verificationResult === true || verificationResult?.ok === true)) {
          const verification = ["NODE_UNVERIFIED", "APPIUM_UNVERIFIED", "LG_DRIVER_UNVERIFIED"].includes(verificationResult?.verification)
            ? verificationResult.verification
            : undefined;
          return failed("VERIFICATION_FAILED", verification);
        }
        if (includeChromeDriver) {
          if ([downloadChromeDriver, extractChromeDriver, verifyChromeDriver].some((operation) => typeof operation !== "function")) {
            return failed("INSTALL_INPUT_INVALID");
          }
          const chromedriverRoot = path.join(stagingRoot, "chromedriver");
          await fs.rm(chromedriverRoot, {recursive: true, force: true});
          await fs.mkdir(chromedriverRoot, {recursive: true});
          stage = "downloading-chromedriver";
          emit("downloading-chromedriver");
          const archivePath = await downloadChromeDriver({artifact: bundle.components.chromedriver, destination: stagingRoot});
          emit("verifying-chromedriver-archive");
          if (typeof archivePath !== "string" || !archivePath || String(await hashFile(archivePath)).toLowerCase() !== bundle.components.chromedriver.sha256) {
            return failed("CHECKSUM_MISMATCH");
          }
          stage = "extracting-chromedriver";
          emit("extracting-chromedriver");
          await extractChromeDriver({archivePath, destination: chromedriverRoot, platform});
          await fs.rm(archivePath, {force: true});
          emit("verifying-chromedriver");
          if (await verifyChromeDriver({
            chromedriverRoot,
            platform,
            version: bundle.components.chromedriver.version,
          }) !== true) {
            return failed("VERIFICATION_FAILED", "CHROMEDRIVER_UNVERIFIED");
          }
          await fs.writeFile(
            path.join(chromedriverRoot, "metadata.json"),
            `${JSON.stringify({version: bundle.components.chromedriver.version})}\n`,
            {encoding: "utf8", mode: 0o600},
          );
        }
        stage = "activating";
        emit("activating");
        await rewriteStagedAppiumRegistry();
        await activateStaging();
        emit("complete");
        return {ok: true, status: "LG_TOOLCHAIN_INSTALLED"};
      } catch {
        const status = stage === "downloading" || stage === "downloading-chromedriver"
          ? "DOWNLOAD_FAILED"
          : stage === "extracting" || stage === "extracting-chromedriver"
            ? "EXTRACTION_FAILED"
            : stage === "installing-dependencies"
              ? "DEPENDENCY_INSTALL_FAILED"
              : stage === "activating"
                ? "ACTIVATION_FAILED"
                : "INSTALL_FAILED";
        return failed(status);
      } finally {
        try {
          await fs.rm(stagingRoot, {recursive: true, force: true});
        } catch {
          // Staging cleanup is best effort and never exposes local filesystem details.
        }
      }
    },
  };
}

module.exports = {createLgManagedInstallOperations};
