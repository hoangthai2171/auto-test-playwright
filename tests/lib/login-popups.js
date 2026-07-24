const {expect} = require("playwright/test");
const navigation = require("./navigation");
const {POPUP_FOCUS_DIALOG_IDS} = require("./selectors");

const DEVICE_LIMIT_POPUP_TEXT = /vượt quá số lượng thiết bị cho phép|xóa thiết bị cũ nhất/i;
const CONTINUE_TEXT = /^tiếp tục$/i;
const DEVICE_LIMIT_DIALOG_ID = "dialog_confirm_v2";
const DEVICE_LIMIT_CONTINUE_ID = "btn_confirm_v2_ok";

async function defaultHasVisibleText(page, pattern) {
  return page
    .getByText(pattern)
    .first()
    .isVisible()
    .catch(() => false);
}

async function defaultGetVisiblePopupState(page) {
  return page.evaluate((dialogIds) => {
    for (const dialogId of dialogIds) {
      const dialog = document.getElementById(dialogId);
      if (!dialog || !isVisible(dialog)) continue;

      const activeButton = Array.from(dialog.querySelectorAll(".active"))
        .filter(isVisible)
        .find(isButtonLike);

      return {
        dialogId,
        activeButtonId: activeButton?.id || "",
        activeButtonText: textOf(activeButton),
      };
    }

    return null;

    function isButtonLike(element) {
      return element.tagName === "BUTTON" ||
        element.getAttribute("role") === "button" ||
        /^btn[_-]/i.test(element.id || "") ||
        /button|btn/i.test(element.className || "");
    }

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" &&
        Number(style.opacity) !== 0;
    }

    function textOf(element) {
      return (element?.textContent || "").replace(/\s+/g, " ").trim();
    }
  }, POPUP_FOCUS_DIALOG_IDS);
}

async function acceptDeviceLimitPopupIfVisible(page, testInfo, dependencies = {}) {
  const hasVisibleText = dependencies.hasVisibleText || defaultHasVisibleText;
  const getVisiblePopupState = dependencies.getVisiblePopupState || defaultGetVisiblePopupState;
  const remoteFocusById = dependencies.remoteFocusById || navigation.remoteFocusById;
  const remoteFocusByText = dependencies.remoteFocusByText || navigation.remoteFocusByText;
  const remotePress = dependencies.remotePress || navigation.remotePress;
  const getFocusedState = dependencies.getFocusedState || navigation.getFocusedState;

  const popup = await getVisiblePopupState(page).catch(() => null);
  if (!popup) return false;
  if (!(await hasVisibleText(page, DEVICE_LIMIT_POPUP_TEXT).catch(() => false))) return false;

  if (popup.dialogId === DEVICE_LIMIT_DIALOG_ID) {
    // The v2 confirmation buttons use `.active`, not `.focused`. If the app
    // opened on Bỏ qua, navigate to the known OK button and verify that it is
    // the active button before sending the remote Enter key.
    if (popup.activeButtonId !== DEVICE_LIMIT_CONTINUE_ID) {
      await remoteFocusById(page, DEVICE_LIMIT_CONTINUE_ID, 80);
    }

    const activePopup = await getVisiblePopupState(page);
    const focused = await getFocusedState(page);
    const focusedLabel = [focused.text, focused.label].filter(Boolean).join(" ");
    const isContinueActive = activePopup?.activeButtonId === DEVICE_LIMIT_CONTINUE_ID;
    const isContinueFocused = focused.id === DEVICE_LIMIT_CONTINUE_ID ||
      CONTINUE_TEXT.test(focused.text || "") || CONTINUE_TEXT.test(focused.label || "");

    if (!isContinueActive || !isContinueFocused) {
      throw new Error(`Could not focus device-limit popup action "Tiếp tục": ${JSON.stringify({activePopup, focused: focusedLabel})}`);
    }
  } else {
    // Other supported dialog families also expose their current button through
    // `.active`; navigation.getFocusedState() now reads that state first.
    await remoteFocusByText(page, CONTINUE_TEXT, 80);
    const focused = await getFocusedState(page);
    if (!CONTINUE_TEXT.test(focused.text || "") && !CONTINUE_TEXT.test(focused.label || "")) {
      throw new Error(`Could not focus popup action "Tiếp tục": ${[focused.text, focused.label].filter(Boolean).join(" ")}`);
    }
  }

  await remotePress(page, "Enter", 2500);

  await expect
    .poll(() => getVisiblePopupState(page).then(Boolean).catch(() => false), {
      timeout: 10000,
      intervals: [250],
    })
    .toBe(false);

  return true;
}

module.exports = {
  DEVICE_LIMIT_POPUP_TEXT,
  DEVICE_LIMIT_DIALOG_ID,
  DEVICE_LIMIT_CONTINUE_ID,
  defaultGetVisiblePopupState,
  acceptDeviceLimitPopupIfVisible,
};
