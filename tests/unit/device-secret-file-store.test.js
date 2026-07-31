const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceSecretFileStore} = require("../../app/device-secret-file-store");

function createMemoryFs() {
  const files = new Map();
  const calls = [];
  return {
    files,
    calls,
    async readFile(filePath) {
      if (!files.has(filePath)) {
        const error = new Error(`ENOENT: ${filePath}`);
        error.code = "ENOENT";
        throw error;
      }
      return files.get(filePath);
    },
    async writeFile(filePath, contents) {
      calls.push(["writeFile", filePath]);
      files.set(filePath, contents);
    },
    async rename(sourcePath, destinationPath) {
      calls.push(["rename", sourcePath, destinationPath]);
      files.set(destinationPath, files.get(sourcePath));
      files.delete(sourcePath);
    },
  };
}

test("persists an encrypted buffer in a versioned atomic envelope", async () => {
  const fs = createMemoryFs();
  const store = createDeviceSecretFileStore({filePath: "/secrets.json", fs});

  await store.set("device-a:host", Buffer.from("ciphertext"));

  assert.deepEqual(await store.get("device-a:host"), Buffer.from("ciphertext"));
  assert.deepEqual(JSON.parse(fs.files.get("/secrets.json")), {
    version: 1,
    secrets: {"device-a:host": Buffer.from("ciphertext").toString("base64")},
  });
  assert.deepEqual(fs.calls, [
    ["writeFile", "/secrets.json.tmp"],
    ["rename", "/secrets.json.tmp", "/secrets.json"],
  ]);
});
