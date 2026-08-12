const navigation = require("./navigation");
const {POPUP_FOCUS_DIALOG_IDS} = require("./selectors");

const DEVICE_LIMIT_POPUP_TEXT = /vượt quá số lượng thiết bị cho phép|xóa thiết bị cũ nhất/i;
const CONTINUE_TEXT = /^tiếp tục$/i;
const DEVICE_LIMIT_DIALOG_ID = "dialog_confirm_v2";
const DEVICE_LIMIT_CONTINUE_ID = "btn_confirm_v2_ok";
const DEVICE_LIMIT_TRANSITION_TIMEOUT_MS = 15000;
const DEVICE_LIMIT_TRANSITION_POLL_MS = 250;
const DEVICE_LIMIT_PROFILE_GRACE_MS = 3500;
const DEVICE_LIMIT_FOCUS_TIMEOUT_MS = 5000;
const DEVICE_LIMIT_DISMISS_TIMEOUT_MS = 10000;

const USER_CONSENT_ACCEPT_ALL_ID = "user-consent-popup-accept-all-checkbox";
const USER_CONSENT_FOOTER_ID = "user-consent-popup-footer-checkbox";
const USER_CONSENT_SUBMIT_ID = "user-consent-btn-submit";
const USER_CONSENT_USERNAME_LABEL_ID = "new_ui_login_input_label";
const USER_CONSENT_TRANSITION_TIMEOUT_MS = 8000;
const USER_CONSENT_TRANSITION_POLL_MS = 150;
const USER_CONSENT_FOCUS_TIMEOUT_MS = 5000;
const USER_CONSENT_DISMISS_TIMEOUT_MS = 10000;

async function defaultHasVisibleText(page, pattern) {
  return page
    .getByText(pattern)
    .first()
    .isVisible()
    .catch(() => false);
}

async function defaultHasVisibleElement(page, id) {
  return page
    .locator(`#${id}`)
    .isVisible()
    .catch(() => false);
}

async function defaultReadConsentCheckboxState(page, id) {
  return page.evaluate((targetId) => {
    const element = document.getElementById(targetId);
    if (!element) return null;
    if ("checked" in element) return Boolean(element.checked);

    const ariaChecked = element.getAttribute("aria-checked");
    if (ariaChecked !== null) return ariaChecked === "true";

    const dataChecked = element.getAttribute("data-checked");
    if (dataChecked !== null) return dataChecked === "true";

    const classNames = String(element.className || "").toLowerCase();
    if (/\b(?:checked|selected|ticked)\b/u.test(classNames)) return true;
    return null;
  }, id).catch(() => null);
}

async function waitForUserConsentPopup(page, {
  hasVisibleElement = defaultHasVisibleElement,
  timeout = USER_CONSENT_TRANSITION_TIMEOUT_MS,
  polling = USER_CONSENT_TRANSITION_POLL_MS,
} = {}) {
  const deadline = Date.now() + timeout;

  while (Date.now() <= deadline) {
    const popupVisible = await hasVisibleElement(page, USER_CONSENT_ACCEPT_ALL_ID).catch(() => false) ||
      await hasVisibleElement(page, USER_CONSENT_SUBMIT_ID).catch(() => false);
    if (popupVisible) return true;

    // Preserve compatibility with deployments that do not show the consent
    // page: once the username keyboard is already visible, there is no modal
    // to handle and the normal login flow can continue immediately.
    if (await hasVisibleElement(page, USER_CONSENT_USERNAME_LABEL_ID).catch(() => false)) return false;
    if (typeof page.waitForTimeout !== "function") return false;
    await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
  }

  return false;
}

async function waitForUserConsentCheckboxChecked(page, id, {
  readCheckboxState = defaultReadConsentCheckboxState,
  timeout = USER_CONSENT_FOCUS_TIMEOUT_MS,
  polling = USER_CONSENT_TRANSITION_POLL_MS,
} = {}) {
  const deadline = Date.now() + timeout;
  let observedState = null;

  while (Date.now() <= deadline) {
    observedState = await readCheckboxState(page, id).catch(() => null);
    // Some TV builds expose only a focusable wrapper rather than a checked
    // property. The remote Enter action is still authoritative in that case.
    if (observedState === null || observedState === true) return;
    if (typeof page.waitForTimeout !== "function") break;
    await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
  }

  throw new Error(`Consent checkbox did not become checked: ${id} (observed=${String(observedState)})`);
}

async function waitForUserConsentPopupDismissed(page, {
  hasVisibleElement = defaultHasVisibleElement,
  timeout = USER_CONSENT_DISMISS_TIMEOUT_MS,
  polling = USER_CONSENT_TRANSITION_POLL_MS,
} = {}) {
  const deadline = Date.now() + timeout;
  let visibleIds = [];

  while (Date.now() <= deadline) {
    visibleIds = [];
    for (const id of [USER_CONSENT_ACCEPT_ALL_ID, USER_CONSENT_FOOTER_ID, USER_CONSENT_SUBMIT_ID]) {
      if (await hasVisibleElement(page, id).catch(() => false)) visibleIds.push(id);
    }
    if (!visibleIds.length) return;
    if (typeof page.waitForTimeout !== "function") break;
    await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
  }

  throw new Error(`User-consent popup did not close after activating "${USER_CONSENT_SUBMIT_ID}": ${visibleIds.join(", ")}`);
}

async function acceptUserConsentPopupIfVisible(page, testInfo, dependencies = {}) {
  const hasVisibleElement = dependencies.hasVisibleElement || defaultHasVisibleElement;
  const readCheckboxState = dependencies.readCheckboxState || defaultReadConsentCheckboxState;
  const remoteFocusById = dependencies.remoteFocusById || navigation.remoteFocusById;
  const remotePress = dependencies.remotePress || navigation.remotePress;
  const visible = await waitForUserConsentPopup(page, {
    hasVisibleElement,
    timeout: dependencies.transitionTimeout ?? USER_CONSENT_TRANSITION_TIMEOUT_MS,
    polling: dependencies.transitionPolling ?? USER_CONSENT_TRANSITION_POLL_MS,
  });
  if (!visible) return false;

  await remoteFocusById(page, USER_CONSENT_ACCEPT_ALL_ID, 100, {preferredDirection: "ArrowUp"});
  await remotePress(page, "Enter", 300);
  await waitForUserConsentCheckboxChecked(page, USER_CONSENT_ACCEPT_ALL_ID, {
    readCheckboxState,
    timeout: dependencies.focusTimeout ?? USER_CONSENT_FOCUS_TIMEOUT_MS,
    polling: dependencies.transitionPolling ?? USER_CONSENT_TRANSITION_POLL_MS,
  });

  await remoteFocusById(page, USER_CONSENT_FOOTER_ID, 100, {preferredDirection: "ArrowDown"});
  await remotePress(page, "Enter", 300);
  await waitForUserConsentCheckboxChecked(page, USER_CONSENT_FOOTER_ID, {
    readCheckboxState,
    timeout: dependencies.focusTimeout ?? USER_CONSENT_FOCUS_TIMEOUT_MS,
    polling: dependencies.transitionPolling ?? USER_CONSENT_TRANSITION_POLL_MS,
  });

  await remoteFocusById(page, USER_CONSENT_SUBMIT_ID, 100);
  await remotePress(page, "Enter", 1500);
  await waitForUserConsentPopupDismissed(page, {
    hasVisibleElement,
    timeout: dependencies.dismissTimeout ?? USER_CONSENT_DISMISS_TIMEOUT_MS,
    polling: dependencies.transitionPolling ?? USER_CONSENT_TRANSITION_POLL_MS,
  });

  return true;
}

async function defaultHasProfileSelection(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const routeReady = location.hash.includes("chooseProfile") || text.includes("Những ai đang xem?");
    const item = document.querySelector("#item_0");
    if (!routeReady || !item) return false;

    const rect = item.getBoundingClientRect();
    const style = getComputedStyle(item);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  }).catch(() => false);
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
  const hasProfileSelection = dependencies.hasProfileSelection || defaultHasProfileSelection;
  const remoteFocusById = dependencies.remoteFocusById || navigation.remoteFocusById;
  const remoteFocusByText = dependencies.remoteFocusByText || navigation.remoteFocusByText;
  const remotePress = dependencies.remotePress || navigation.remotePress;
  const getFocusedState = dependencies.getFocusedState || navigation.getFocusedState;

  const popup = await waitForDeviceLimitPopupOrProfile(page, {
    getVisiblePopupState,
    hasVisibleText,
    hasProfileSelection,
    timeout: dependencies.transitionTimeout ?? DEVICE_LIMIT_TRANSITION_TIMEOUT_MS,
    polling: dependencies.transitionPolling ?? DEVICE_LIMIT_TRANSITION_POLL_MS,
    profileGrace: dependencies.profileGrace ?? DEVICE_LIMIT_PROFILE_GRACE_MS,
  });
  if (!popup) return false;

  if (popup.dialogId === DEVICE_LIMIT_DIALOG_ID) {
    // The v2 confirmation buttons use `.active`, not `.focused`. If the app
    // opened on Bỏ qua, navigate to the known OK button and verify that it is
    // the active button before sending the remote Enter key.
    if (popup.activeButtonId !== DEVICE_LIMIT_CONTINUE_ID) {
      await remoteFocusById(page, DEVICE_LIMIT_CONTINUE_ID, 80);
    }

    await waitForContinueFocus(page, {getVisiblePopupState, getFocusedState, hasVisibleText, timeout: dependencies.focusTimeout ?? DEVICE_LIMIT_FOCUS_TIMEOUT_MS});
  } else {
    // Other supported dialog families also expose their current button through
    // `.active`; navigation.getFocusedState() now reads that state first.
    await remoteFocusByText(page, CONTINUE_TEXT, 80);
    await waitForContinueFocus(page, {getVisiblePopupState, getFocusedState, hasVisibleText, timeout: dependencies.focusTimeout ?? DEVICE_LIMIT_FOCUS_TIMEOUT_MS, requireContinueId: false});
  }

  await remotePress(page, "Enter", 2500);
  await waitForDeviceLimitPopupDismissed(page, {
    getVisiblePopupState,
    hasVisibleText,
    timeout: dependencies.dismissTimeout ?? DEVICE_LIMIT_DISMISS_TIMEOUT_MS,
    polling: dependencies.dismissPolling ?? DEVICE_LIMIT_TRANSITION_POLL_MS,
  });

  return true;
}

async function waitForDeviceLimitPopupOrProfile(page, {
  getVisiblePopupState,
  hasVisibleText,
  hasProfileSelection,
  timeout,
  polling,
  profileGrace,
}) {
  const deadline = Date.now() + timeout;
  let profileReadyAt = 0;

  while (Date.now() <= deadline) {
    const popup = await getVisiblePopupState(page).catch(() => null);
    if (popup && await hasVisibleText(page, DEVICE_LIMIT_POPUP_TEXT).catch(() => false)) {
      return popup;
    }

    if (await hasProfileSelection(page).catch(() => false)) {
      if (!profileReadyAt) profileReadyAt = Date.now();
      if (Date.now() - profileReadyAt >= profileGrace) return null;
    } else {
      profileReadyAt = 0;
    }

    if (typeof page.waitForTimeout !== "function") return null;
    await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
  }

  return null;
}

async function waitForContinueFocus(page, {getVisiblePopupState, getFocusedState, hasVisibleText, timeout, requireContinueId = true}) {
  const deadline = Date.now() + timeout;
  let lastState = {popup: null, focused: null};

  while (Date.now() <= deadline) {
    const popup = await getVisiblePopupState(page).catch(() => null);
    const focused = await getFocusedState(page).catch(() => ({id: "", text: "", label: ""}));
    lastState = {popup, focused};
    const isContinueActive = requireContinueId
      ? popup?.activeButtonId === DEVICE_LIMIT_CONTINUE_ID
      : Boolean(popup);
    const isContinueFocused = focused.id === DEVICE_LIMIT_CONTINUE_ID ||
      CONTINUE_TEXT.test(focused.text || "") || CONTINUE_TEXT.test(focused.label || "");
    const isDevicePopup = popup && await hasVisibleText(page, DEVICE_LIMIT_POPUP_TEXT).catch(() => false);

    if (isDevicePopup && isContinueActive && isContinueFocused) return;
    if (typeof page.waitForTimeout !== "function") break;
    await page.waitForTimeout(100);
  }

  const focusedLabel = [lastState.focused?.text, lastState.focused?.label].filter(Boolean).join(" ");
  throw new Error(`Could not focus popup action "Tiếp tục": ${JSON.stringify({activePopup: lastState.popup, focused: focusedLabel})}`);
}

async function waitForDeviceLimitPopupDismissed(page, {getVisiblePopupState, hasVisibleText, timeout, polling}) {
  const deadline = Date.now() + timeout;
  let lastPopup = null;

  while (Date.now() <= deadline) {
    lastPopup = await getVisiblePopupState(page).catch(() => null);
    const stillVisible = lastPopup && await hasVisibleText(page, DEVICE_LIMIT_POPUP_TEXT).catch(() => false);
    if (!stillVisible) return;
    if (typeof page.waitForTimeout !== "function") break;
    await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
  }

  throw new Error(`Device-limit popup did not close after activating "Tiếp tục": ${JSON.stringify(lastPopup)}`);
}

module.exports = {
  DEVICE_LIMIT_POPUP_TEXT,
  DEVICE_LIMIT_DIALOG_ID,
  DEVICE_LIMIT_CONTINUE_ID,
  DEVICE_LIMIT_TRANSITION_TIMEOUT_MS,
  DEVICE_LIMIT_PROFILE_GRACE_MS,
  defaultGetVisiblePopupState,
  acceptDeviceLimitPopupIfVisible,
  USER_CONSENT_ACCEPT_ALL_ID,
  USER_CONSENT_FOOTER_ID,
  USER_CONSENT_SUBMIT_ID,
  USER_CONSENT_TRANSITION_TIMEOUT_MS,
  acceptUserConsentPopupIfVisible,
};
