const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceRegistry} = require("../../app/device-registry");

function createMemoryFs(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  const calls = [];
  return {
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

const livingRoom = {
  id: "living-room",
  label: "Living room LG",
  platform: "lg",
  appId: "com.mytvb2c.app",
  model: "OLED55C4",
  modelYear: "2024",
};

test("lists an empty registry when its file has not been created", async () => {
  const registry = createDeviceRegistry({filePath: "/devices.json", fs: createMemoryFs()});

  assert.deepEqual(await registry.list(), []);
});

test("saves valid LG profiles atomically and replaces only the matching profile", async () => {
  const fs = createMemoryFs({
    "/devices.json": JSON.stringify([{...livingRoom, label: "Old label"}, {...livingRoom, id: "bedroom", label: "Bedroom"}]),
  });
  const registry = createDeviceRegistry({filePath: "/devices.json", fs});

  assert.deepEqual(await registry.save(livingRoom), livingRoom);
  assert.deepEqual(await registry.list(), [livingRoom, {...livingRoom, id: "bedroom", label: "Bedroom"}]);
  assert.deepEqual(fs.calls, [
    ["writeFile", "/devices.json.tmp"],
    ["rename", "/devices.json.tmp", "/devices.json"],
  ]);
});

test("removes one profile without changing the remaining profiles", async () => {
  const fs = createMemoryFs({
    "/devices.json": JSON.stringify([livingRoom, {...livingRoom, id: "bedroom", label: "Bedroom"}]),
  });
  const registry = createDeviceRegistry({filePath: "/devices.json", fs});

  assert.equal(await registry.remove("living-room"), true);
  assert.deepEqual(await registry.list(), [{...livingRoom, id: "bedroom", label: "Bedroom"}]);
  assert.equal(await registry.remove("missing"), false);
});

test("rejects profiles with unsupported platforms, app IDs, unknown fields, or secrets", async () => {
  const registry = createDeviceRegistry({filePath: "/devices.json", fs: createMemoryFs()});

  await assert.rejects(
    registry.save({...livingRoom, platform: "samsung"}),
    /unsupported.*lg|lg.*supported/i,
  );
  await assert.rejects(
    registry.save({...livingRoom, appId: "org.tizen.mytv"}),
    /ineligible|unsupported.*app/i,
  );
  await assert.rejects(registry.save({...livingRoom, officeHost: "https://office.example"}), /unknown|not allowed/i);
  await assert.rejects(registry.save({...livingRoom, password: "private"}), /secret|unknown|not allowed/i);
  await assert.rejects(registry.save({id: "missing-fields"}), /missing|required/i);
});

test("never returns a persisted office host field", async () => {
  const fs = createMemoryFs({
    "/devices.json": JSON.stringify([{...livingRoom, officeHost: "https://office.example"}]),
  });
  const registry = createDeviceRegistry({filePath: "/devices.json", fs});

  await assert.rejects(registry.list(), /unknown|not allowed/i);
});
