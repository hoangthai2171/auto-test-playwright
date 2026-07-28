const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceLock} = require("../../app/device-lock");

test("blocks a second lease for the same device with DEVICE_LOCKED", () => {
  const lock = createDeviceLock();
  const lease = lock.acquire("living-room");

  assert.equal(lock.isLocked("living-room"), true);
  assert.throws(() => lock.acquire("living-room"), (error) => error.code === "DEVICE_LOCKED");
  lease.release();
});

test("releases leases idempotently and does not unlock other devices", () => {
  const lock = createDeviceLock();
  const livingRoom = lock.acquire("living-room");
  const bedroom = lock.acquire("bedroom");

  livingRoom.release();
  livingRoom.release();
  assert.equal(lock.isLocked("living-room"), false);
  assert.equal(lock.isLocked("bedroom"), true);
  bedroom.release();
  assert.equal(lock.isLocked("bedroom"), false);
});
