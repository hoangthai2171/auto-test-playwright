const test = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");

const {createAppiumServerManager} = require("../../app/appium-server-manager");

function createChild(pid = 8123) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

function scrub(value) {
  return String(value)
    .replaceAll("192.168.1.9", "[host]")
    .replaceAll("pairing-secret", "[secret]")
    .replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, "[png]");
}

test("starts only a loopback webOS Appium child and returns redacted diagnostics", async () => {
  const child = createChild();
  const spawnCalls = [];
  const manager = createAppiumServerManager({platform: "win32",
    spawn(command, args, options) {
      spawnCalls.push({command, args, options});
      return child;
    },
    async fetch(url) {
      assert.equal(url, "http://127.0.0.1:4725/status");
      child.stdout.emit("data", "proxy 192.168.1.9 pairing-key=pairing-secret data:image/png;base64,iVBORw0KGgoAAA");
      return {ok: true, async json() { return {value: {ready: true}}; }};
    },
    kill() {},
    redact: scrub,
    wait: async () => {},
  });

  const server = await manager.start({port: 4725, appiumBin: "/trusted/appium", appiumHome: "/private/appium-home"});

  assert.deepEqual(spawnCalls[0].args, ["server", "--address", "127.0.0.1", "--port", "4725", "--use-drivers", "webos"]);
  assert.equal(spawnCalls[0].command, "/trusted/appium");
  assert.equal(spawnCalls[0].options.env.APPIUM_HOME, "/private/appium-home");
  assert.equal(server.baseUrl, "http://127.0.0.1:4725");
  assert.match(server.diagnostics.logs.join(""), /\[host\].*pairing-key=\[REDACTED\].*\[png\]/);
  assert.doesNotMatch(JSON.stringify(server.diagnostics), /192\.168\.1\.9|pairing-secret|iVBORw0KGgo/);
});

test("removes inherited TLS bypasses unless this Appium child explicitly opts in", async () => {
  const firstChild = createChild(8123);
  const secondChild = createChild(8124);
  const spawnCalls = [];
  const manager = createAppiumServerManager({platform: "win32",
    spawn(_command, _args, options) {
      spawnCalls.push(options);
      return spawnCalls.length === 1 ? firstChild : secondChild;
    },
    async fetch() { return {ok: true, async json() { return {value: {ready: true}}; }}; },
    kill() {},
    redact: scrub,
    wait: async () => {},
  });

  await manager.start({
    port: 4725,
    appiumHome: "/private/appium-home",
    env: {NODE_TLS_REJECT_UNAUTHORIZED: "0", KEEP_ME: "yes"},
  });
  await manager.start({
    port: 4726,
    appiumHome: "/private/appium-home",
    allowSelfSignedTls: true,
    env: {NODE_TLS_REJECT_UNAUTHORIZED: "1", KEEP_ME: "yes"},
  });

  assert.equal(spawnCalls[0].env.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
  assert.equal(spawnCalls[0].env.KEEP_ME, "yes");
  assert.equal(spawnCalls[1].env.NODE_TLS_REJECT_UNAUTHORIZED, "0");
});

test("redacts client pairing forms and PNG signatures split across log chunks", async () => {
  const child = createChild();
  const manager = createAppiumServerManager({platform: "win32",
    spawn() { return child; },
    async fetch() {
      child.stderr.emit("data", "client-key=client-secret client_key: second-secret key is 'third-secret' {\"client-key\":\"json-client-secret\",\"client_key\":\"json-client-underscore-secret\",\"pairing-key\":\"json-pairing-secret\",\"pairing_key\":\"json-pairing-underscore-secret\"} png=iVBORw");
      child.stderr.emit("data", "0KGgoAAAANSUhEUgAAAAE=");
      return {ok: true, async json() { return {value: {ready: true}}; }};
    },
    kill() {},
    redact: (value) => value,
    wait: async () => {},
  });

  const server = await manager.start({port: 4725, appiumHome: "/private/appium-home"});
  const retained = JSON.stringify(server.diagnostics);

  assert.doesNotMatch(retained, /client-secret|second-secret|third-secret|json-client-secret|json-client-underscore-secret|json-pairing-secret|json-pairing-underscore-secret|iVBORw|0KGgoAAAANSUhEUgAAAAE/);
  assert.match(retained, /client-key=\[REDACTED\].*client_key=\[REDACTED\].*key is '\[REDACTED\]'/);
});

test("removes quoted client and pairing key names as well as their values", async () => {
  const child = createChild();
  const manager = createAppiumServerManager({platform: "win32",
    spawn() { return child; },
    async fetch() {
      child.stderr.emit("data", "{\"client-key\":\"json-client-secret\",\"client_key\":\"json-client-underscore-secret\",\"pairing-key\":\"json-pairing-secret\",\"pairing_key\":\"json-pairing-underscore-secret\"}");
      return {ok: true, async json() { return {value: {ready: true}}; }};
    },
    kill() {},
    redact: (value) => value,
    wait: async () => {},
  });

  const server = await manager.start({port: 4725, appiumHome: "/private/appium-home"});

  assert.doesNotMatch(
    JSON.stringify(server.diagnostics),
    /client-key|client_key|pairing-key|pairing_key|json-client-secret|json-client-underscore-secret|json-pairing-secret|json-pairing-underscore-secret/,
  );
});

test("times out a stalled health request and cleans up only its owned child", {timeout: 100}, async () => {
  const child = createChild(8123);
  const killed = [];
  const signals = [];
  const manager = createAppiumServerManager({platform: "win32",
    spawn() { return child; },
    fetch(_url, {signal} = {}) {
      signals.push(signal);
      return new Promise(() => {});
    },
    kill(pid, signal) { killed.push([pid, signal]); },
    redact: scrub,
    wait: async () => {},
  });

  await assert.rejects(
    manager.start({port: 4725, appiumHome: "/private/appium-home", requestTimeoutMs: 1}),
    (error) => error.code === "APPIUM_UNHEALTHY",
  );
  assert.equal(signals[0].aborted, true);
  assert.deepEqual(killed, [[8123, "SIGTERM"], [8123, "SIGKILL"]]);
});

test("stops only its owned child with an idempotent TERM then KILL lifecycle", async () => {
  const child = createChild(8123);
  const killed = [];
  const manager = createAppiumServerManager({platform: "win32",
    spawn() { return child; },
    async fetch() { return {ok: true, async json() { return {value: {ready: true}}; }}; },
    kill(pid, signal) { killed.push([pid, signal]); },
    redact: scrub,
    wait: async () => {},
  });

  const server = await manager.start({port: 4725, appiumHome: "/private/appium-home"});
  await server.stop();
  await server.stop();

  assert.deepEqual(killed, [[8123, "SIGTERM"], [8123, "SIGKILL"]]);
});

test("cleans up its child and returns redacted diagnostics when health never becomes ready", async () => {
  const child = createChild(8123);
  const killed = [];
  const manager = createAppiumServerManager({platform: "win32",
    spawn() { return child; },
    async fetch() {
      child.stderr.emit("data", "failed proxy to 192.168.1.9 pairing-key=pairing-secret");
      return {ok: true, async json() { return {value: {ready: false}}; }};
    },
    kill(pid, signal) { killed.push([pid, signal]); },
    redact: scrub,
    wait: async () => {},
  });

  await assert.rejects(
    manager.start({port: 4725, appiumHome: "/private/appium-home", timeoutMs: 0}),
    (error) => {
      assert.match(error.message, /Appium server did not become healthy/);
      assert.doesNotMatch(JSON.stringify(error.diagnostics), /192\.168\.1\.9|pairing-secret/);
      return true;
    },
  );
  assert.deepEqual(killed, [[8123, "SIGTERM"], [8123, "SIGKILL"]]);
});

test("does not report a healthy server after its owned child exits", async () => {
  const child = createChild(8123);
  const manager = createAppiumServerManager({
    spawn() { return child; },
    async fetch() {
      child.emit("exit", 1);
      return {ok: true, async json() { return {value: {ready: true}}; }};
    },
    kill() { throw new Error("an exited child must not be killed again"); },
    redact: scrub,
    wait: async () => {},
  });

  await assert.rejects(
    manager.start({port: 4725, appiumHome: "/private/appium-home"}),
    (error) => error.code === "APPIUM_UNHEALTHY" && /child exited/i.test(error.message),
  );
});

test("owns a Unix Appium process group and terminates that group", async () => {
  const child = createChild(8123);
  const spawnCalls = [];
  const killed = [];
  const manager = createAppiumServerManager({
    platform: "darwin",
    spawn(_command, _args, options) { spawnCalls.push(options); return child; },
    async fetch() { return {ok: true, async json() { return {value: {ready: true}}; }}; },
    kill(pid, signal) { killed.push([pid, signal]); },
    redact: scrub,
    wait: async () => {},
  });

  const server = await manager.start({port: 4725, appiumHome: "/private/appium-home"});
  await server.stop();

  assert.equal(spawnCalls[0].detached, true);
  assert.deepEqual(killed, [[-8123, "SIGTERM"], [-8123, "SIGKILL"]]);
});
