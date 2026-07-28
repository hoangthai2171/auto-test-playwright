function createDeviceLock() {
  const lockedDeviceIds = new Set();

  return {
    acquire(deviceId) {
      if (typeof deviceId !== "string" || !deviceId) throw new Error("A device id is required to acquire a lock.");
      if (lockedDeviceIds.has(deviceId)) {
        const error = new Error(`Device '${deviceId}' is already locked.`);
        error.code = "DEVICE_LOCKED";
        throw error;
      }
      lockedDeviceIds.add(deviceId);
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          lockedDeviceIds.delete(deviceId);
        },
      };
    },
    isLocked(deviceId) {
      return lockedDeviceIds.has(deviceId);
    },
  };
}

module.exports = {createDeviceLock};
