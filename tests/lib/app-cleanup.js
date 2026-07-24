async function logoutApp(page) {
  if (!page || (typeof page.isClosed === "function" && page.isClosed())) {
    return {status: "skipped", reason: "page-closed"};
  }

  await page.evaluate(async () => {
    if (typeof window.processLogOut !== "function") {
      throw new Error("window.processLogOut is not available");
    }

    await window.processLogOut();
  });

  return {status: "passed"};
}

module.exports = {logoutApp};
