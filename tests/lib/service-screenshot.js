const SERVICE_SCREENSHOT_SETTLE_MS = 2000;

async function waitForServiceScreenImages(page, result) {
  const serviceOpened = (result?.steps || []).some((step) => {
    const service = step?.result;
    return service?.type === "service" && service?.route && service?.rowCount > 0;
  });
  if (!serviceOpened) return false;

  await page.waitForTimeout(SERVICE_SCREENSHOT_SETTLE_MS);
  return true;
}

module.exports = {
  SERVICE_SCREENSHOT_SETTLE_MS,
  waitForServiceScreenImages,
};
