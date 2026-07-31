"use strict";

const path = require("node:path");
const {validateLgCompatibilityCatalog} = require("./lg-compatibility-catalog");

function createLgCompatibilityCatalogStore({filePath, fs, now = () => new Date().toISOString()} = {}) {
  if (!filePath || !fs?.readFile || !fs?.writeFile || !fs?.rename || !fs?.mkdir) {
    throw new Error("A compatibility catalog file store is required.");
  }

  async function read() {
    try {
      const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || typeof envelope.refreshedAt !== "string") {
        return null;
      }
      return {refreshedAt: envelope.refreshedAt, catalog: validateLgCompatibilityCatalog(envelope.catalog)};
    } catch {
      return null;
    }
  }

  async function replace(catalog) {
    const validatedCatalog = validateLgCompatibilityCatalog(catalog);
    const envelope = {refreshedAt: now(), catalog: validatedCatalog};
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm?.(temporaryPath, {force: true}).catch(() => {});
      throw error;
    }
    return envelope;
  }

  return Object.freeze({read, replace});
}

module.exports = {createLgCompatibilityCatalogStore};
