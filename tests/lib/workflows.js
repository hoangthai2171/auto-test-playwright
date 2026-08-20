const {test, expect} = require("playwright/test");
const {normalizeVietnameseText, containsTextPattern} = require("./text-utils");
const navigation = require("./navigation");
const contentRows = require("./content-rows");
const playback = require("./playback");
const artifacts = require("./artifacts");
const selectorValidation = require("./selector-validation");
const waits = require("./waits");
const {createScopedDomScanner} = require("./dom-scan");
const {createBatchBudget} = require("./batch-budget");
const {acceptDeviceLimitPopupIfVisible, acceptUserConsentPopupIfVisible} = require("./login-popups");
const {applyAppEnvironment} = require("./app-environment");

const {remotePress, remoteFocusById, remoteFocusBySelector, remoteFocusByText, enterWithVirtualKeyboard, searchKeyboardInput, getFocusedState, expectFocusedText, expectFocusedElementToLookOrange} = navigation;
const {
    collectVisibleContentRows,
    focusRequestedContentRow,
    findVisibleContentItemByName,
    collectFirstRowPlayableItems,
    focusFirstRowStart,
    expectFocusedContent,
    isFocusedContentItem,
    isFocusedOnContentItem,
    isFocusedOnRowItems,
    getFocusedContentMetadata,
    getFocusedViewMoreMetadata,
    contentItemSignature,
    isFocusedNearRow,
    moveToNextFirstRowContent,
    returnToFirstRowContent,
    openFocusedContentForPlayback,
    getFocusedListPagePosition,
    getFocusedListPageMetadata,
    expectFocusedListPageContent,
    focusListPageGridStart,
    focusChannelListGridStart,
    activateFocusedChannelListItem,
    moveToNextListPageContent,
    returnToListPageContent,
} = contentRows;
const {getPlayerState, inspectPlaybackAfterWait, PLAYER_PLAYBACK_WAIT_SECONDS} = playback;
const {runStep, attachCurrentAppScreenshot, attachMovieSearchFailureArtifacts, attachSearchNoResultArtifacts, attachFailureArtifacts, attachPlaybackBatchReport, attachFirstRowPlaybackReport, renderPlaybackResultsHtml, renderPlaybackErrorCell, imageDataUrl, safeArtifactName} = artifacts;
const {activateVerifiedTarget, assertSelectorHealth, getContractLocator, resolveContractLocatorId} = selectorValidation;
const {waitForFocusState, waitForContentVisible} = waits;

const DEFAULT_OPTIONS = {
    APP_URL: "https://html5stage.mytv.vn/",
    USERNAME: "ts1",
    PASSWORD: "111222",
    CHANNEL_NAME: "VTV1 HD",
    CHANNEL_PLAY_MODE: "by_name",
    CHANNEL_CATE_NAME: "",
    CHANNEL_CATE_LIMIT: "0",
    MOVIE_PLAY_MODE: "first",
    MOVIE_NAME: "",
    MOVIE_CATE_NAME: "",
    MOVIE_CATE_LIMIT: "0",
    SEARCH_KEYWORD: "",
};

const CLOSE_POPUP_TEXT = /^(Đóng|Huỷ|Hủy|Quay về|Quay về trang chủ)$/i;
const WELCOME_LOGIN_BUTTON_SELECTOR = '#welcome-button [data-btn-type="1"]';

function getTestOptions() {
    const options = {
        APP_URL: process.env.APP_URL || DEFAULT_OPTIONS.APP_URL,
        USERNAME: process.env.USERNAME || DEFAULT_OPTIONS.USERNAME,
        PASSWORD: process.env.PASSWORD || DEFAULT_OPTIONS.PASSWORD,
        CHANNEL_NAME: process.env.CHANNEL_NAME || DEFAULT_OPTIONS.CHANNEL_NAME,
        CHANNEL_PLAY_MODE: process.env.CHANNEL_PLAY_MODE || DEFAULT_OPTIONS.CHANNEL_PLAY_MODE,
        CHANNEL_CATE_NAME: process.env.CHANNEL_CATE_NAME || DEFAULT_OPTIONS.CHANNEL_CATE_NAME,
        CHANNEL_CATE_LIMIT: process.env.CHANNEL_CATE_LIMIT || DEFAULT_OPTIONS.CHANNEL_CATE_LIMIT,
        MOVIE_PLAY_MODE: process.env.MOVIE_PLAY_MODE || DEFAULT_OPTIONS.MOVIE_PLAY_MODE,
        MOVIE_NAME: process.env.MOVIE_NAME || DEFAULT_OPTIONS.MOVIE_NAME,
        MOVIE_CATE_NAME: process.env.MOVIE_CATE_NAME || DEFAULT_OPTIONS.MOVIE_CATE_NAME,
        MOVIE_CATE_LIMIT: process.env.MOVIE_CATE_LIMIT || DEFAULT_OPTIONS.MOVIE_CATE_LIMIT,
        SEARCH_KEYWORD: process.env.SEARCH_KEYWORD || DEFAULT_OPTIONS.SEARCH_KEYWORD,
    };

    return {
        ...options,
        MOVIE_NAME_PATTERN: options.MOVIE_NAME ? containsTextPattern(options.MOVIE_NAME) : null,
        SEARCH_KEYWORD_PATTERN: options.SEARCH_KEYWORD ? containsTextPattern(options.SEARCH_KEYWORD) : null,
    };
}
async function prepareAppEnvironment(page, options, testInfo) {
    await gotoApp(page, options.APP_URL);
    const result = await applyAppEnvironment(page, options.APP_ENVIRONMENT);
    await waitForAppReady(page, testInfo);
    return result;
}

async function openAppAndEnterLoginPage(page, options, testInfo, {skipNavigation = false} = {}) {
    if (!skipNavigation) await gotoApp(page, options.APP_URL);
    await waitForAppReady(page, testInfo);

    const isLoginTabsVisible = await page
        .locator("#login-tabs")
        .isVisible()
        .catch(() => false);

    if (!isLoginTabsVisible && (getSubpage(page.url()) === "welcomePage" || (await isWelcomeScreen(page)))) {
        await expect(page.locator(WELCOME_LOGIN_BUTTON_SELECTOR)).toBeVisible();
        await remoteFocusBySelector(page, WELCOME_LOGIN_BUTTON_SELECTOR, 80);
        await expectFocusedElementToLookOrange(page).catch(() => {});
        await remotePress(page, "Enter", 2000);
    }

    await expect(page.locator("#login-tabs")).toBeVisible();
}

async function loginWithAccount(page, options, testInfo) {
    await remoteFocusById(page, "remote-login-method");
    await activateVerifiedTarget(page, {testInfo, name: "login-method", contractName: "menuItem", expectedId: "remote-login-method", delay: 1500});
    await acceptUserConsentPopupIfVisible(page, testInfo);

    await expect(page.locator("#new_ui_login_input_label")).toContainText("Nhập số điện thoại / Tài khoản MyTV");
    await enterWithVirtualKeyboard(page, options.USERNAME);

    await remoteFocusById(page, "new_ui_login_btn_ok");
    await activateVerifiedTarget(page, {testInfo, name: "login-username-submit", contractName: "menuItem", expectedId: "new_ui_login_btn_ok", delay: 2000});

    await expect(page.locator("#new_ui_login_input_label")).toContainText("Nhập mật khẩu");
    await enterWithVirtualKeyboard(page, options.PASSWORD);

    await remoteFocusById(page, "new_ui_login_btn_ok");
    await activateVerifiedTarget(page, {testInfo, name: "login-password-submit", contractName: "menuItem", expectedId: "new_ui_login_btn_ok", delay: 5000});

    await expect(page.locator("body")).not.toContainText("Nhập mật khẩu", {
        timeout: 30000,
    });
}

async function chooseFirstProfileAndEnterHome(page, testInfo) {
    // The device-limit dialog can arrive asynchronously while the app is
    // transitioning from password submission to profile selection. Monitor
    // that transition here, immediately before the profile is focused, so a
    // delayed modal cannot block waitForProfileSelection indefinitely.
    await acceptDeviceLimitPopupIfVisible(page, testInfo);
    await waitForProfileSelection(page);
    await remoteFocusById(page, "item_0");
    await activateVerifiedTarget(page, {testInfo, name: "profile-selection", contractName: "contentItem", expectedId: "item_0"});

    await waitForHomeReady(page, testInfo);
}

async function closeHomePopupsAndVerifyHome(page, testInfo) {
    await closeHomePopups(page, testInfo);
    await expectFocusedText(page, /^Xem ngay$/i);
    await assertSelectorHealth(page, {testInfo});
}

async function openTelevisionFromLeftMenu(page, testInfo) {
    await openLeftMenuFromHome(page);
    await focusLeftMenuItem(page, /^Truyền hình$/i, testInfo);
    await activateVerifiedTarget(page, {testInfo, name: "open-television", contractName: "menuItem", expectedLabel: "Truyền hình", delay: 3000});
}

async function openMovieFromLeftMenu(page, testInfo) {
    await openLeftMenuFromHome(page);
    await focusLeftMenuItem(page, /^Phim truyện$/i, testInfo);
    await activateVerifiedTarget(page, {testInfo, name: "open-movie", contractName: "menuItem", expectedLabel: "Phim truyện", delay: 3000});
}

async function openSettingFromLeftMenu(page, testInfo) {
    await openLeftMenuFromHome(page);
    await focusLeftMenuItem(page, /^Cài đặt$/i, testInfo);
    await activateVerifiedTarget(page, {testInfo, name: "open-settings", contractName: "menuItem", expectedLabel: "Cài đặt", delay: 3000});
    await expect(page.locator("body")).toContainText(/Thông tin tài khoản/i, {timeout: 10000});
}

async function openSearchFromLeftMenu(page, testInfo) {
    await openLeftMenuFromHome(page);
    await focusSearchMenuItem(page, testInfo);
    await activateVerifiedTarget(page, {testInfo, name: "open-search", contractName: "menuItem", expectedLabel: "Tìm kiếm", delay: 2000});
    await expect(page.locator("body")).toContainText(/Tìm kiếm/i, {timeout: 10000});
}

async function searchContentByName(page, options, testInfo) {
    const keyword = String(options?.name || "").trim();
    const type = options?.type || "content";
    expect(keyword, "Content name is required for search_content").toBeTruthy();

    await enterWithVirtualKeyboard(page, searchKeyboardInput(keyword));
    await submitSearchFromVirtualKeyboard(page, testInfo, {afterSubmitWaitMs: 3000});

    const result = await findBestSearchResult(page, keyword, type);
    if (!result) {
        await attachSearchNoResultArtifacts(page, testInfo, keyword);
        throw new Error(`Không tìm thấy nội dung "${keyword}"`);
    }

    if (testInfo?.attach) {
        await testInfo.attach(`${safeArtifactName(`search-${keyword}-selected-result`)}.json`, {
            body: JSON.stringify(result, null, 2),
            contentType: "application/json",
        });
    }

    await focusStableSearchResult(page, result);
    return result;
}

async function openServiceFromLeftMenuOrAllServices(page, serviceName, testInfo, options = {}) {
    const activationDelay = Number(options.activationDelay ?? 3000);
    const serviceNames = getServiceSearchNames(serviceName);
    await openLeftMenuFromHome(page);

    let leftMenuItemId = "";
    let matchedServiceName = serviceNames[0] || serviceName;
    for (const candidate of serviceNames) {
        leftMenuItemId = await findLeftMenuItemIdByFuzzyText(page, candidate).catch(() => "");
        if (leftMenuItemId) {
            matchedServiceName = candidate;
            break;
        }
    }

    if (leftMenuItemId) {
        await remoteFocusById(page, leftMenuItemId, 100);
        await activateVerifiedTarget(page, {testInfo, name: `open-service-${serviceName}`, contractName: "menuItem", expectedId: leftMenuItemId, expectedLabel: matchedServiceName, delay: activationDelay});
        return;
    }

    const allServicesId = await findLeftMenuItemIdByFuzzyText(page, "Tất cả dịch vụ").catch(() => "");
    expect(allServicesId, "Left menu should contain Tat ca dich vu fallback").toBeTruthy();

    await remoteFocusById(page, allServicesId, 100);
    await activateVerifiedTarget(page, {testInfo, name: "open-all-services", contractName: "menuItem", expectedId: allServicesId, expectedLabel: "Tất cả dịch vụ", delay: 2500});

    const serviceId = await findServiceIdInAllServices(page, serviceNames);
    await remoteFocusById(page, serviceId, 120);
    await activateVerifiedTarget(page, {testInfo, name: `open-service-${serviceName}-fallback`, contractName: "menuItem", expectedId: serviceId, expectedLabel: matchedServiceName, delay: activationDelay});
}

async function assertServiceOpened(page, {service, testInfo, timeout = 30000, polling = 100} = {}) {
    const deadline = Date.now() + timeout;
    let observation = null;

    while (Date.now() <= deadline) {
        observation = await observeServiceOpenState(page);
        if (observation.failure) {
            await attachServiceOpenFailure(page, testInfo, service, observation);
            throw serviceOpenError(service, observation);
        }

        if (observation.routeValue && observation.routeValue !== "homeNewUI" && !observation.home.visible && observation.content.visible) {
            return {
                type: "service",
                service: String(service || "").trim(),
                route: observation.routeValue,
                rowCount: observation.content.rowCount,
                visibleCount: observation.content.visibleCount,
                verified: "Service opened to a non-Home screen with visible content rows",
            };
        }

        await page.waitForTimeout(Math.min(polling, Math.max(0, deadline - Date.now())));
    }

    await attachServiceOpenFailure(page, testInfo, service, observation);
    throw serviceOpenError(service, observation, "did not reach a non-Home screen with visible content rows");
}

async function assertViewMoreOpened(page, {rowName, label, testInfo, timeout = 30000, polling = 100} = {}) {
    const targetLabel = String(label || "view more").trim();
    const serviceLabel = [String(rowName || "").trim(), targetLabel].filter(Boolean).join(" - ");
    const result = await assertServiceOpened(page, {
        service: serviceLabel || targetLabel,
        testInfo,
        timeout,
        polling,
    });

    return {
        type: "view_more",
        label: targetLabel,
        rowName: String(rowName || "").trim(),
        route: result.route,
        rowCount: result.rowCount,
        visibleCount: result.visibleCount,
        verified: "View-more poster opened to a non-Home screen with visible content rows",
    };
}

async function observeServiceOpenState(page) {
    const [rows, destinationContent, popup, toast, home] = await Promise.all([
        collectVisibleContentRows(page).catch(() => []),
        observeServiceDestinationContent(page).catch(() => ({visible: false, visibleCount: 0, rowCount: 0})),
        getVisibleServicePopup(page).catch(() => []),
        getVisibleServiceToast(page).catch(() => null),
        observeVisibleHomeScreen(page).catch(() => ({visible: false})),
    ]);
    const routeValue = getSubpageSafe(page?.url?.());
    const failedPopup = popup.find((candidate) => isServiceFailurePopup(candidate.text));
    const failure = toast || (failedPopup ? {kind: "popup", text: failedPopup.text} : null);

    return {
        routeValue,
        content: destinationContent.visible
            ? destinationContent
            : {
                  visible: rows.length > 0,
                  visibleCount: rows.reduce((count, row) => count + row.items.length, 0),
                  rowCount: rows.length,
                  kind: "content-rows",
              },
        popup,
        toast,
        home,
        failure,
    };
}

async function observeVisibleHomeScreen(page) {
    return page.evaluate(() => {
        const homeMarkers = Array.from(document.querySelectorAll("[id^='homePage2_']"));
        const visible = homeMarkers.some((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
        });
        return {visible};
    });
}

async function observeServiceDestinationContent(page) {
    return page.evaluate(() => {
        const visible = (element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
        };
        const tvod = Array.from(document.querySelectorAll(".tvod_container")).find(visible);
        if (!tvod) return {visible: false, visibleCount: 0, rowCount: 0};

        const items = Array.from(tvod.querySelectorAll(".lw_r_item")).filter(visible);
        return {
            visible: items.length > 0,
            visibleCount: items.length,
            rowCount: items.length > 0 ? 1 : 0,
            kind: "tvod-schedule",
        };
    });
}

async function getVisibleServicePopup(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll("body *"))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const marker = `${element.id || ""} ${element.className || ""} ${element.getAttribute("role") || ""}`.toLowerCase();
                return {
                    marker,
                    text: (element.textContent || "").replace(/\s+/g, " ").trim(),
                    visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
                };
            })
            .filter((item) => item.visible && /popup|modal|dialog|alert/.test(item.marker))
            .slice(0, 20),
    );
}

async function getVisibleServiceToast(page) {
    return page.evaluate(() => {
        const candidate = Array.from(document.querySelectorAll("body *"))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const marker = `${element.id || ""} ${element.className || ""} ${element.getAttribute("role") || ""}`.toLowerCase();
                return {
                    marker,
                    text: (element.textContent || "").replace(/\s+/g, " ").trim(),
                    visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
                };
            })
            .find((item) => item.visible && /toast|tooltip|notification|snackbar/.test(item.marker));

        return candidate ? {kind: "toast", text: candidate.text, marker: candidate.marker} : null;
    });
}

function isServiceFailurePopup(text) {
    const normalized = normalizeVietnameseText(text);
    return /(?:khong co|chua co)\s+(?:du lieu|noi dung)|khong the|that bai|xin loi|\bloi\b|vui long thu lai/u.test(normalized);
}

function getSubpageSafe(url) {
    try {
        return getSubpage(String(url || ""));
    } catch (_) {
        return "";
    }
}

function serviceOpenError(service, observation, fallbackReason = "showed service failure feedback") {
    const failure = observation?.failure;
    const reason = failure?.text || fallbackReason;
    const error = new Error(`Dịch vụ "${service}" không mở thành công: ${reason}`);
    error.details = observation || null;
    return error;
}

async function attachServiceOpenFailure(page, testInfo, service, observation) {
    if (!testInfo?.attach) return;
    await testInfo.attach(`${safeArtifactName(service || "service")}-service-open.json`, {
        body: JSON.stringify({service, observation}, null, 2),
        contentType: "application/json",
    });
    if (typeof page?.screenshot === "function") {
        await testInfo.attach(`${safeArtifactName(service || "service")}-service-open.png`, {
            body: await page.screenshot({fullPage: false}),
            contentType: "image/png",
        });
    }
}

function getServiceSearchNames(serviceName) {
    const requestedName = String(serviceName || "").trim();
    if (normalizeVietnameseText(requestedName) !== "kenh") return [requestedName];
    return ["Truyền hình", requestedName];
}

async function openChannel(page, options, testInfo) {
    await expect.poll(() => getSubpage(page.url()), {timeout: 30000}).toMatch(/^(channel|tv|television|listChannel|liveTV|homeLiveTV)$/i);

    const channelId = await findChannelIdByName(page, options.CHANNEL_NAME);
    await remoteFocusById(page, channelId, 120);
    await activateVerifiedTarget(page, {testInfo, name: `open-channel-${options.CHANNEL_NAME}`, contractName: "channel", expectedId: channelId, expectedLabel: options.CHANNEL_NAME, delay: 6000});
}

async function openFirstMovieContent(page, testInfo) {
    await waitForFocusState(page, {
        name: "first-movie-focus",
        timeout: 15000,
        testInfo,
        getFocusedState,
        isReady: ({observation}) => isValidFocusedState(observation),
        reason: "visible focus was not ready before opening the first movie",
    });
    await activateVerifiedTarget(page, {testInfo, name: "open-first-movie", contractName: "contentItem", delay: 6000});
}

async function playAllItemsInFirstRow(page, testInfo, options = {}) {
    const waitSeconds = Number(options.waitSeconds || PLAYER_PLAYBACK_WAIT_SECONDS);
    const rowName = options.rowName || "";
    const rowIndex = Number.isInteger(options.rowIndex) ? options.rowIndex : undefined;
    const rowPosition = options.rowPosition || "";
    await waitForContentVisible(page, {
        name: "first-row-content",
        testInfo,
        getContentState: observeVisibleContentRows,
        getFocusedState,
        reason: "no visible playable content row was ready before first-row navigation",
    });

    const targetRow = await focusRequestedContentRow(page, {
        rowName,
        rowIndex,
        rowPosition,
    });
    const items = targetRow.items;
    expect(items.length, "First row should contain playable items").toBeGreaterThan(0);

    // The row container id identifies the row for every later membership
    // check; firstRowY only backs screens that expose no row container.
    const firstRowId = targetRow.rowId || "";
    const firstRowY = (await getFocusedContentMetadata(page)).rect?.y || targetRow.rowY || items[0].rect.y;
    const batchBudget = createBatchBudget({
        itemLimit: options.itemLimit,
        maxItems: options.maxItems,
        runtimeBudgetMs: options.unlimitedRuntime === true && options.runtimeBudgetMs === undefined ? Number.POSITIVE_INFINITY : options.runtimeBudgetMs,
    });

    const results = [];
    const seenItems = new Set();
    let attempted = 0;
    let stopReason = "row-exhausted";
    let budgetLimited = false;
    for (let index = 0; ; index++) {
        const focusedItem = await getFocusedContentMetadata(page);
        const viewMoreSkip = await skipFocusedViewMorePoster(page, {
            focusedItem,
            rowId: firstRowId,
            rowY: firstRowY,
        });
        if (viewMoreSkip.skipped) {
            if (!viewMoreSkip.movedToNext) {
                stopReason = "row-exhausted";
                break;
            }
            continue;
        }

        await expectFocusedContent(page);
        const item = focusedItem.id ? focusedItem : items[index] || focusedItem;
        const signature = contentItemSignature(item);

        if (seenItems.has(signature)) {
            break;
        }

        const startDecision = batchBudget.canStart({
            completed: results.length,
            attempted,
            estimatedDurationMs: waitSeconds * 1000,
        });
        if (!startDecision.allowed) {
            stopReason = startDecision.reason;
            budgetLimited = true;
            break;
        }

        attempted += 1;
        seenItems.add(signature);
        const label = item.title || `Item ${index + 1}`;

        await test.step(`Play first-row item ${index + 1}: ${label}`, async () => {
            const contentId = getContentId(item);
            const result = {
                index: index + 1,
                id: item.id || "",
                contentId,
                name: label,
                title: label,
                poster: item.poster || "",
                status: "unknown",
                result: "fail",
                errorPopup: "",
                screenshot: "",
                screenshotDataUrl: "",
            };
            let cleanupError = null;

            try {
                await expectFocusedContent(page);
                await testInfo.attach(`${safeArtifactName(`first-row-${index + 1}-focused-item`)}.json`, {
                    body: JSON.stringify(item, null, 2),
                    contentType: "application/json",
                });
                await openFocusedContentForPlayback(page, testInfo, item);

                const playback = await inspectPlaybackAfterWait(page, waitSeconds);
                result.status = playback.ok ? "playable" : "failed";
                result.result = playback.ok ? "pass" : "fail";
                result.errorPopup = playback.popup?.text || playback.playerState?.reason || "";
                result.playerState = playback.playerState;

                // Keep evidence for successful players as well as failures.  For a
                // poster that never opened a player this is the error/popup state,
                // which is the most useful diagnostic available for that item.
                await captureRowPlaybackScreenshot(page, testInfo, result, label);
            } catch (error) {
                result.status = "failed";
                result.result = "fail";
                result.errorPopup = error?.message || String(error);
                await captureRowPlaybackScreenshot(page, testInfo, result, label, "error");
            }

            try {
                await returnToFirstRowContent(page, {
                    item,
                    rowId: firstRowId,
                    rowY: firstRowY,
                });
            } catch (error) {
                // A poster-level failure must not erase the evidence already
                // collected or abort the rest of the row.  The row-return helper
                // dismisses recognized playback error dialogs; this catch records an
                // unrecognized cleanup problem and lets the caller decide whether
                // the row is still safely recoverable.
                cleanupError = error;
                result.status = "failed";
                result.result = "fail";
                result.cleanupError = error?.message || String(error);
                if (!result.errorPopup) result.errorPopup = result.cleanupError;
                if (!result.screenshotDataUrl) {
                    await captureRowPlaybackScreenshot(page, testInfo, result, label, "cleanup-error");
                }
            }

            result.result = result.status === "playable" ? "pass" : "fail";
            results.push(result);
        });

        const movedToNext = await moveToNextFirstRowContent(page, {
            previousSignature: signature,
            rowId: firstRowId,
            rowY: firstRowY,
        });

        if (!movedToNext) {
            stopReason = "row-exhausted";
            break;
        }
    }

    const budgetReport = batchBudget.report({
        completed: results.length,
        attempted,
        reason: stopReason,
        budgetLimited,
    });
    await testInfo.attach("first-row-playback-budget.json", {
        body: JSON.stringify(budgetReport, null, 2),
        contentType: "application/json",
    });
    await attachFirstRowPlaybackReport(testInfo, results);

    const playableCount = results.filter((item) => item.status === "playable").length;
    const failedItems = results.filter((item) => item.status === "failed");
    const failedCount = failedItems.length;
    if (failedCount > 0 || playableCount === 0) {
        const failureSummary = formatRowPlaybackFailureSummary(failedItems);
        const error = new Error(failedCount > 0 ? failedCount + " row content item(s) failed to play:\n" + failureSummary : "At least one row content item should play successfully");
        error.details = {
            results,
            failedItems,
            budget: budgetReport,
            exhaustive: options.unlimitedRuntime === true,
        };
        throw error;
    }
    return {type: "play_row", results, budget: budgetReport};
}

function formatRowPlaybackFailureSummary(items) {
    return items
        .map((item, index) => {
            const contentId = getContentId(item) || "unknown content id";
            const name = String(item?.name || item?.title || "Unknown item").trim();
            return `${index + 1}. ${contentId} - ${name}`;
        })
        .join("\n");
}

async function playItemsInRow(page, testInfo, options = {}) {
    const rowIndex = normalizePlayRowIndex(options.rowIndex);
    const count = options.count === undefined ? 0 : options.count;

    return playAllItemsInFirstRow(page, testInfo, {
        ...options,
        rowIndex,
        itemLimit: count,
        unlimitedRuntime: options.count === undefined && options.runtimeBudgetMs === undefined,
    });
}

// Content-list pages reached from a "Xem tất cả" poster. The channel list is a
// different widget - its own row/item classes and an `is_focus` attribute
// instead of the shared focus class - so it is handled by a scoped profile in
// content-rows rather than by widening the global focus contract.
const CHANNEL_LIST_ROUTE = "channel-list";
const LIST_PAGE_CONTENT_ROUTES = Object.freeze([
    "specialModuleList",
    "specialModuleListV2",
    "shortHome",
    CHANNEL_LIST_ROUTE,
]);

function assertSupportedListPageRoute(route) {
    const routeValue = String(route || "").trim();
    if (LIST_PAGE_CONTENT_ROUTES.includes(routeValue)) return routeValue;

    throw new Error(
        "play_all_contents phải chạy trên trang danh sách nội dung " +
            `(${LIST_PAGE_CONTENT_ROUTES.join(", ")}); màn hình hiện tại là ` +
            `"${routeValue || "không xác định"}"`
    );
}

async function playAllListPageContents(page, testInfo, options = {}) {
    const waitSeconds = Number(options.waitSeconds || PLAYER_PLAYBACK_WAIT_SECONDS);
    const route = assertSupportedListPageRoute(getSubpageSafe(page?.url?.()));
    const rowLimit = Number.isInteger(options.rowCount) && options.rowCount > 0
        ? options.rowCount
        : undefined;

    await waitForContentVisible(page, {
        name: "list-page-content",
        testInfo,
        getContentState: observeVisibleContentRows,
        getFocusedState,
        reason: "no visible list-page content row was ready before list playback",
    });

    const batchBudget = createBatchBudget({
        itemLimit: options.count === undefined ? 0 : options.count,
        // The requested scope is the bound here - a poster count, a row count, or
        // the whole list.  A wall-clock budget would silently truncate what the
        // case asked for, so it only applies when a caller sets one explicitly.
        runtimeBudgetMs: options.runtimeBudgetMs === undefined
            ? Number.POSITIVE_INFINITY
            : options.runtimeBudgetMs,
    });

    const results = [];
    const seenItems = new Set();
    let attempted = 0;
    let stopReason = "list-exhausted";
    let budgetLimited = false;
    const isChannelList = route === CHANNEL_LIST_ROUTE;
    let position = isChannelList
        ? await focusChannelListGridStart(page)
        : await focusListPageGridStart(page);

    for (let index = 0; position; index += 1) {
        if (rowLimit !== undefined && position.row >= rowLimit) {
            stopReason = "row-limit";
            break;
        }

        const focusedItem = isChannelList
            ? await getFocusedListPageMetadata(page)
            : await getFocusedContentMetadata(page);
        const focusedViewMore = isChannelList
            ? null
            : await getFocusedViewMoreMetadata(page, {
                rowId: position.rowId,
                rowY: position.rect?.y,
            }).catch(() => null);
        if (focusedViewMore) {
            // A view-more poster navigates to another list; it is not content, so
            // it is stepped over without ever being activated.
            position = await advanceListPagePosition(page, position);
            continue;
        }

        await expectFocusedListPageContent(page);
        const item = focusedItem.id ? focusedItem : {id: position.id, title: "", poster: ""};
        const signature = contentItemSignature(item);

        if (seenItems.has(signature)) {
            stopReason = "duplicate-item";
            break;
        }

        const startDecision = batchBudget.canStart({
            completed: results.length,
            attempted,
            estimatedDurationMs: waitSeconds * 1000,
        });
        if (!startDecision.allowed) {
            stopReason = startDecision.reason;
            budgetLimited = true;
            break;
        }

        attempted += 1;
        seenItems.add(signature);
        const label = item.title || `Item ${index + 1}`;
        const rowNumber = position.row + 1;
        const columnNumber = position.col + 1;

        await test.step(`Play list item ${index + 1} (dòng ${rowNumber}, poster ${columnNumber}): ${label}`, async () => {
            const result = {
                index: index + 1,
                id: item.id || "",
                contentId: getContentId(item),
                name: label,
                title: label,
                poster: item.poster || "",
                rowNumber,
                columnNumber,
                ...(item.channelNumber ? {channelNumber: item.channelNumber} : {}),
                status: "unknown",
                result: "fail",
                errorPopup: "",
                screenshot: "",
                screenshotDataUrl: "",
            };

            try {
                await expectFocusedListPageContent(page);
                await testInfo.attach(`${safeArtifactName(`list-page-${index + 1}-focused-item`)}.json`, {
                    body: JSON.stringify({item, position}, null, 2),
                    contentType: "application/json",
                });
                if (isChannelList) {
                    await activateFocusedChannelListItem(page, item.id);
                } else {
                    await openFocusedContentForPlayback(page, testInfo, item);
                }

                const playback = await inspectPlaybackAfterWait(page, waitSeconds);
                result.status = playback.ok ? "playable" : "failed";
                result.result = playback.ok ? "pass" : "fail";
                result.errorPopup = playback.popup?.text || playback.playerState?.reason || "";
                result.playerState = playback.playerState;

                await captureRowPlaybackScreenshot(page, testInfo, result, label, "player", "list-page");
            } catch (error) {
                result.status = "failed";
                result.result = "fail";
                result.errorPopup = error?.message || String(error);
                await captureRowPlaybackScreenshot(page, testInfo, result, label, "error", "list-page");
            }

            try {
                await returnToListPageContent(page, {
                    item,
                    routes: LIST_PAGE_CONTENT_ROUTES,
                    profile: position.profile,
                });
            } catch (error) {
                // One poster must not erase the evidence already collected or abort
                // the rest of the list.  The return helper dismisses recognized
                // playback dialogs; anything else is recorded here and the caller
                // decides whether the list is still safely recoverable.
                result.status = "failed";
                result.result = "fail";
                result.cleanupError = error?.message || String(error);
                if (!result.errorPopup) result.errorPopup = result.cleanupError;
                if (!result.screenshotDataUrl) {
                    await captureRowPlaybackScreenshot(page, testInfo, result, label, "cleanup-error", "list-page");
                }
            }

            result.result = result.status === "playable" ? "pass" : "fail";
            results.push(result);
        });

        position = await advanceListPagePosition(page, position);
    }

    const budgetReport = batchBudget.report({
        completed: results.length,
        attempted,
        reason: stopReason,
        budgetLimited,
    });
    await testInfo.attach("list-page-playback-budget.json", {
        body: JSON.stringify({route, rowLimit: rowLimit ?? null, ...budgetReport}, null, 2),
        contentType: "application/json",
    });
    await attachPlaybackBatchReport(testInfo, results, {
        prefix: "list-page-playback",
        heading: "List-page playback results",
        includeScreenshot: true,
        screenshotHeading: "Player/error screenshot",
    });

    const playableCount = results.filter((item) => item.status === "playable").length;
    const failedItems = results.filter((item) => item.status === "failed");
    if (failedItems.length > 0 || playableCount === 0) {
        const failureSummary = formatRowPlaybackFailureSummary(failedItems);
        const error = new Error(
            failedItems.length > 0
                ? failedItems.length + " list content item(s) failed to play:\n" + failureSummary
                : "At least one list content item should play successfully"
        );
        error.details = {
            route,
            results,
            failedItems,
            budget: budgetReport,
            exhaustive: options.count === undefined && rowLimit === undefined,
        };
        throw error;
    }

    return {type: "play_all_contents", route, results, budget: budgetReport};
}

// After a player closes, the list page rebuilds its rows and restores its own
// row/column.  Stepping from the live focus keeps traversal aligned with what the
// page actually restored instead of a position captured before playback.
async function advanceListPagePosition(page, previousPosition) {
    const livePosition = await getFocusedListPagePosition(page).catch(() => null);
    return moveToNextListPageContent(page, livePosition || previousPosition);
}

async function skipFocusedViewMorePoster(page, {focusedItem, rowY, rowId}) {
    const focusedViewMore = await getFocusedViewMoreMetadata(page, {rowId, rowY}).catch(() => null);
    if (!focusedViewMore) return {skipped: false, movedToNext: false};

    // View-more is a navigation poster, not row content. Use the existing
    // trusted marker detector and advance without sending Enter, so play_row
    // never opens the category/service screen.
    return {
        skipped: true,
        movedToNext: await moveToNextFirstRowContent(page, {
            previousSignature: contentItemSignature(focusedItem),
            rowId,
            rowY,
        }),
    };
}

function normalizePlayRowIndex(rowIndex) {
    return Number.isInteger(rowIndex) ? rowIndex - 1 : undefined;
}

function getContentId(item) {
    return String(item?.contentId || item?.attributes?.content_id || item?.attributes?.["content-id"] || item?.attributes?.["data-content-id"] || "").trim();
}

async function captureRowPlaybackScreenshot(page, testInfo, result, label, suffix = "player", prefix = "first-row") {
    if (result.screenshotDataUrl) return;

    try {
        const screenshotName = `${safeArtifactName(`${prefix}-${result.index}-${label}-${suffix}`)}.png`;
        const screenshot = await page.screenshot({fullPage: false});
        if (testInfo?.attach) {
            await testInfo.attach(screenshotName, {
                body: screenshot,
                contentType: "image/png",
            });
        }
        result.screenshot = screenshotName;
        result.screenshotDataUrl = imageDataUrl(screenshot);
    } catch (error) {
        result.screenshotError = error?.message || String(error);
        result.status = "failed";
        result.result = "fail";
        if (!result.errorPopup) result.errorPopup = result.screenshotError;
    }
}

async function playVisibleContentByName(page, testInfo, options = {}) {
    const name = String(options.name || "").trim();
    const type = options.type || "content";
    expect(name, "Content name is required for play_content").toBeTruthy();

    await waitForContentVisible(page, {
        name: "named-content",
        testInfo,
        getContentState: observeVisibleContentRows,
        getFocusedState,
        reason: "no visible content row was ready before named-content playback",
    });

    const match = await findVisibleContentItemByName(page, name, {type});
    return playFocusedContent(page, testInfo, {
        name: match.item.title || name,
        type,
        poster: match.item.poster || "",
        waitSeconds: options.waitSeconds,
    });
}

async function playFocusedSearchResult(page, testInfo, options = {}) {
    const focused = await getFocusedContentMetadata(page).catch(() => ({title: "", poster: ""}));
    return playFocusedContent(page, testInfo, {
        name: focused.title || "search result",
        type: options.type || "content",
        poster: focused.poster || "",
        artifactPrefix: "search-content",
        waitSeconds: options.waitSeconds,
    });
}

async function playFocusedContent(page, testInfo, {name, type = "content", poster = "", artifactPrefix = "content", waitSeconds} = {}) {
    const itemName = String(name || "focused content").trim();
    await openFocusedContentForPlayback(page, testInfo);

    const playback = await inspectPlaybackAfterWait(page, Number(waitSeconds) > 0 ? Number(waitSeconds) : PLAYER_PLAYBACK_WAIT_SECONDS);
    const result = {
        name: itemName,
        title: itemName,
        poster,
        status: playback.ok ? "playable" : "failed",
        errorPopup: playback.popup?.text || playback.playerState?.reason || "",
        playerState: playback.playerState,
    };

    if (testInfo?.attach) {
        await testInfo.attach(`${artifactPrefix}-playback-result.json`, {
            body: JSON.stringify(result, null, 2),
            contentType: "application/json",
        });
    }

    if (!playback.ok) {
        if (testInfo?.attach) {
            const screenshot = await page.screenshot({fullPage: false});
            result.screenshotDataUrl = imageDataUrl(screenshot);
            await testInfo.attach(`${artifactPrefix}-playback-failure.png`, {
                body: screenshot,
                contentType: "image/png",
            });
        }

        const error = new Error(`Không phát được ${type} "${name}". ` + `Tên nội dung: "${itemName}"; poster: "${poster}"; ` + `lỗi: ${result.errorPopup || "trạng thái phát không hợp lệ"}`);
        error.details = result;
        throw error;
    }

    return result;
}

async function openMovieContent(page, options, testInfo) {
    if (options.MOVIE_PLAY_MODE === "by_name" && options.MOVIE_NAME) {
        await openMovieContentByName(page, options, testInfo);
        return;
    }

    await openFirstMovieContent(page, testInfo);
}

async function openMovieContentByName(page, options, testInfo) {
    await page.waitForTimeout(3000);

    let movieId;
    try {
        movieId = await findMovieContentIdByName(page, options.MOVIE_NAME, options.MOVIE_NAME_PATTERN);
    } catch (error) {
        if (testInfo) {
            await attachMovieSearchFailureArtifacts(page, testInfo, options.MOVIE_NAME, error);
        }

        const searchError = new Error(`Không tìm thấy phim "${options.MOVIE_NAME}" trên trang Phim truyện. ` + "Xem attachment movie-search-*-not-found.json/png trong report để biết các phim đang hiển thị và trạng thái màn hình.");
        searchError.stack = `${searchError.stack}\n\nOriginal error:\n${error?.stack || error}`;
        throw searchError;
    }

    await remoteFocusById(page, movieId, 160);
    await activateVerifiedTarget(page, {testInfo, name: `open-movie-${options.MOVIE_NAME}`, contractName: "contentItem", expectedId: movieId, expectedLabel: options.MOVIE_NAME, delay: 6000});
}

async function searchAndOpenBestContent(page, options, testInfo) {
    const keyword = options.SEARCH_KEYWORD?.trim();
    expect(keyword, "SEARCH_KEYWORD is required for search-content-mytv").toBeTruthy();

    const keyboardKeyword = searchKeyboardInput(keyword);
    await enterWithVirtualKeyboard(page, keyboardKeyword);
    await submitSearchFromVirtualKeyboard(page, testInfo);
    await page.waitForTimeout(5000);

    const result = await findBestSearchResult(page, keyword);
    if (!result) {
        await attachSearchNoResultArtifacts(page, testInfo, keyword);
        return false;
    }

    await testInfo.attach(`${safeArtifactName(`search-${keyword}-selected-result`)}.json`, {
        body: JSON.stringify(result, null, 2),
        contentType: "application/json",
    });

    await focusStableSearchResult(page, result);
    await activateVerifiedTarget(page, {testInfo, name: `open-search-result-${result.id}`, contractName: "contentItem", expectedId: result.id, expectedLabel: result.label || result.normalizedLabel, delay: 6000});
    return true;
}

async function focusStableSearchResult(page, result) {
    await focusSearchResult(page, result);
    await page.waitForTimeout(2000);

    if (await isFocusedOnSearchResult(page, result.id)) return;

    await focusSearchResult(page, result);
    await page.waitForTimeout(500);
    expect(await isFocusedOnSearchResult(page, result.id), `Search result "${result.id}" should be focused before Enter`).toBe(true);
}

async function isFocusedOnSearchResult(page, id) {
    return page.evaluate((targetId) => {
        const target = document.getElementById(targetId);
        const focused = document.querySelector(".focused");
        if (!target || !focused) return false;
        return target === focused || target.contains(focused) || focused.contains(target);
    }, id);
}

async function focusSearchResult(page, result) {
    if (!/^searchRow_\d+_\d+$/.test(result.id)) {
        await remoteFocusById(page, result.id, 180);
        return;
    }

    if (await focusSearchRowItemByPosition(page, result.id)) return;

    let focusError;
    try {
        await remoteFocusById(page, result.id, 120);
        return;
    } catch (error) {
        focusError = error;
    }

    if (await focusSearchRowItemByPosition(page, result.id)) return;
    throw focusError;
}

async function focusSearchRowItemByPosition(page, targetId, maxMoves = 80) {
    const target = parseSearchRowId(targetId);
    if (!target) return false;

    for (let attempt = 0; attempt < maxMoves; attempt++) {
        const state = await getFocusedState(page);
        if (state.id === targetId) return true;

        const current = parseSearchRowId(state.id);
        if (!current) return false;

        if (current.row !== target.row) {
            await remotePress(page, current.row > target.row ? "ArrowUp" : "ArrowDown", 220);
            continue;
        }

        if (current.col !== target.col) {
            await remotePress(page, current.col > target.col ? "ArrowLeft" : "ArrowRight", 220);
            continue;
        }

        return false;
    }

    return (await getFocusedState(page)).id === targetId;
}

function parseSearchRowId(id) {
    const match = /^searchRow_(\d+)_(\d+)$/.exec(id || "");
    if (!match) return null;
    return {
        row: Number(match[1]),
        col: Number(match[2]),
    };
}

async function submitSearchFromVirtualKeyboard(page, testInfo, {afterSubmitWaitMs = 2000} = {}) {
    const resolved = await resolveContractLocatorId(page, {
        contractName: "searchAction",
        fallback: () =>
            page.evaluate(() => {
                const button = document.querySelector("#keyboard_btn_wr #callSearch, #callSearch");
                if (!button?.id) return "";
                const rect = button.getBoundingClientRect();
                const style = getComputedStyle(button);
                return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 ? button.id : "";
            }),
    });
    await attachLocatorContractMiss(testInfo, resolved, "search-action");
    const searchButtonId = resolved.id;

    await remoteFocusById(page, searchButtonId, 80);
    await activateVerifiedTarget(page, {testInfo, name: "submit-search", contractName: "searchAction", expectedId: searchButtonId, delay: 2500});
    await page.waitForTimeout(afterSubmitWaitMs);
}

async function waitForAppReady(page, testInfo, waitOptions = {}) {
    await page.waitForLoadState("domcontentloaded");
    return waitForFocusState(page, {
        ...waitOptions,
        name: "app-ready",
        testInfo,
        getFocusedState: observeAppReadyState,
        isReady: ({observation}) => Boolean(observation?.marker && isValidFocusedState(observation.focused)),
        reason: "recognized login, welcome, or authenticated-home marker plus visible focus was not observed",
    });
}

async function waitForHomeReady(page, testInfo, waitOptions = {}) {
    return waitForContentVisible(page, {
        ...waitOptions,
        name: "home-ready",
        testInfo,
        getContentState: observeHomeReadyState,
        getFocusedState,
        isReady: ({observation}) => Boolean(observation?.route && observation?.menu && observation?.content && isValidFocusedState(observation?.focused)),
        reason: "home route, visible left menu, content row, and focused state were not all ready",
    });
}

async function observeAppReadyState(page) {
    const screen = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        const hash = location.hash || "";
        const visible = (element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return Boolean(rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
        };
        const login = visible(document.querySelector("#login-tabs")) || /Nhập số điện thoại|Nhập mật khẩu/i.test(text);
        const welcome = /welcomePage/i.test(hash) || visible(document.querySelector("#welcome-button"));
        const home = /homeNewUI/i.test(hash);

        return {
            marker: login ? "login" : welcome ? "welcome" : home ? "home" : "",
            hash,
            login,
            welcome,
            home,
        };
    });
    const focused = await getFocusedState(page);
    return {...screen, focused};
}

async function observeHomeReadyState(page) {
    const [routeState, rows, focused] = await Promise.all([
        page.evaluate(() => {
            const visible = (element) => {
                if (!element) return false;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return Boolean(rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
            };
            const menu = document.querySelector("#menu_text_dynamic_menu_1") || document.querySelector('[id^="menu_text_"]');
            return {
                routeValue: location.hash.replace(/^#/, "").split("?")[0],
                menu: visible(menu),
            };
        }),
        collectVisibleContentRows(page),
        getFocusedState(page),
    ]);

    return {
        route: routeState.routeValue === "homeNewUI",
        routeValue: routeState.routeValue,
        menu: routeState.menu,
        content: rows.length > 0,
        contentCount: rows.reduce((count, row) => count + row.items.length, 0),
        rowCount: rows.length,
        focused,
    };
}

async function observeVisibleContentRows(page) {
    const rows = await collectVisibleContentRows(page);
    return {
        visible: rows.length > 0,
        visibleCount: rows.reduce((count, row) => count + row.items.length, 0),
        rowCount: rows.length,
    };
}

async function scopedScanRecords(page, options = {}) {
    const scanner = createScopedDomScanner(page);
    const result = await scanner.scan(options);
    return result.records;
}

function isValidFocusedState(state) {
    return Boolean(state && state.rect && state.rect.width > 0 && state.rect.height > 0 && (state.id || state.text || state.label));
}

async function gotoApp(page, appUrl) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await page.goto(appUrl, {
                waitUntil: "domcontentloaded",
                timeout: 90000,
            });
            return;
        } catch (error) {
            lastError = error;
            if (attempt === 3) break;
            await page.waitForTimeout(5000);
        }
    }

    throw lastError;
}

function getSubpage(url) {
    return new URL(url).hash.replace(/^#/, "").split("?")[0];
}

async function hasVisibleText(page, text) {
    return page
        .getByText(text)
        .first()
        .isVisible()
        .catch(() => false);
}

async function isWelcomeScreen(page) {
    return page.evaluate(() => {
        const container = document.querySelector("#welcome-button");
        const loginButton = container?.querySelector('[data-btn-type="1"]');
        const experienceButton = container?.querySelector('[data-btn-type="2"]');
        return isVisible(container) && isVisible(loginButton) && isVisible(experienceButton);

        function isVisible(element) {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
        }
    });
}

async function waitForProfileSelection(page) {
    await page.waitForFunction(() => location.hash.includes("chooseProfile") || document.body?.innerText?.includes("Những ai đang xem?"), null, {timeout: 30000});
    await expect(page.locator("#item_0")).toBeVisible();
}

async function closeHomePopups(page, testInfo) {
    for (let attempt = 0; attempt < 8; attempt++) {
        await page.waitForTimeout(1500);

        if (await closeAdvertisePopupIfVisible(page)) {
            continue;
        }

        const focused = await getFocusedState(page);
        if (/^Xem ngay$/i.test(focused.text) || /^Xem ngay$/i.test(focused.label)) {
            return;
        }

        if (CLOSE_POPUP_TEXT.test(focused.text) || CLOSE_POPUP_TEXT.test(focused.label)) {
            await activateVerifiedTarget(page, {testInfo, name: "close-home-popup-focused", contractName: "menuItem", expectedId: focused.id, expectedLabel: focused.text, delay: 2500});
            continue;
        }

        if (await hasVisibleText(page, CLOSE_POPUP_TEXT)) {
            await remoteFocusByText(page, CLOSE_POPUP_TEXT, 80);
            const closeTarget = await getFocusedState(page);
            await activateVerifiedTarget(page, {testInfo, name: "close-home-popup-search", contractName: "menuItem", expectedId: closeTarget.id, expectedLabel: closeTarget.text, delay: 2500});
            continue;
        }

        break;
    }
}

async function closeAdvertisePopupIfVisible(page) {
    const closeButton = page.locator('#advertise-popup:visible #advertise-popup-container .advertise-btn[type-button="0"]').first();

    if (!(await closeButton.isVisible().catch(() => false))) {
        return false;
    }

    await closeButton.evaluate((element) => element.click());
    await page
        .locator("#advertise-popup")
        .waitFor({state: "hidden", timeout: 5000})
        .catch(() => {});
    await page.waitForTimeout(1500);
    return true;
}

async function openLeftMenuFromHome(page) {
    for (let attempt = 0; attempt < 4; attempt++) {
        await remotePress(page, "ArrowLeft", 1000);
        if (await isLeftMenuOpen(page)) return;

        await remotePress(page, "Backspace", 2500);
        if (await isLeftMenuOpen(page)) return;

        await remotePress(page, "Escape", 1500);
        if (await isLeftMenuOpen(page)) return;
    }

    await expect(page.getByText(/^Truyền hình$/i).first()).toBeVisible({timeout: 10000});
}

async function focusLeftMenuItem(page, text, testInfo) {
    await expect(getContractLocator(page, "leftMenu", {hasText: text}).first()).toBeVisible({timeout: 10000});
    const menuItemId = await findLeftMenuItemIdByText(page, text, testInfo);
    await remoteFocusById(page, menuItemId, 80);
}

async function focusSearchMenuItem(page, testInfo) {
    await expect(getContractLocator(page, "leftMenu", {hasText: /^Tìm kiếm$/i}).first()).toBeVisible({timeout: 10000});
    const searchMenuItemId = await findLeftMenuItemIdByText(page, /^Tìm kiếm$/i, testInfo);
    await remoteFocusById(page, searchMenuItemId || "menu_item_search", 80);
}

async function findLeftMenuItemIdByText(page, text, testInfo) {
    const pattern = text instanceof RegExp ? text : new RegExp(String(text), "i");
    const resolved = await resolveContractLocatorId(page, {
        contractName: "leftMenu",
        hasText: pattern,
        fallback: () =>
            page.evaluate(
                ({source, flags}) => {
                    const matcher = new RegExp(source, flags);
                    const textElement = Array.from(document.querySelectorAll('[id^="menu_text_"]')).find((element) => matcher.test((element.textContent || "").replace(/\s+/g, " ").trim()));
                    return textElement?.id ? textElement.id.replace(/^menu_text_/, "menu_item_") : "";
                },
                {source: pattern.source, flags: pattern.flags || "i"},
            ),
    });
    await attachLocatorContractMiss(testInfo, resolved, "left-menu");
    const menuItemId = resolved.id.replace(/^menu_text_/, "menu_item_");
    expect(menuItemId, `Left menu item ${text} should have id`).toBeTruthy();
    return menuItemId;
}

async function attachLocatorContractMiss(testInfo, result, name) {
    if (!result?.contractMiss || !testInfo?.attach) return;
    await testInfo.attach(`${safeArtifactName(`${name}-locator-contract-miss`)}.json`, {
        body: JSON.stringify(result.diagnostics, null, 2),
        contentType: "application/json",
    });
}

async function findLeftMenuItemIdByFuzzyText(page, text) {
    const itemId = await page.waitForFunction(
        (targetText) => {
            const normalizedTarget = normalizeText(targetText);
            const targetTokens = tokenize(normalizedTarget);
            const candidates = Array.from(document.querySelectorAll('[id^="menu_text_"]'))
                .map((element) => {
                    const label = (element.textContent || "").replace(/\s+/g, " ").trim();
                    return {
                        id: element.id.replace(/^menu_text_/, "menu_item_"),
                        label,
                        score: scoreMatch(normalizeText(label)),
                    };
                })
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score);

            return candidates[0]?.id || "";

            function scoreMatch(normalizedLabel) {
                if (normalizedLabel === normalizedTarget) return 100;
                if (normalizedLabel.includes(normalizedTarget)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!targetTokens.length || !labelTokens.length) return 0;
                const matchedTokens = targetTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token)));
                const coverage = matchedTokens.length / targetTokens.length;
                return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }
        },
        text,
        {timeout: 5000},
    );

    const id = await itemId.jsonValue();
    expect(id, `Left menu item similar to "${text}" should have id`).toBeTruthy();
    return id;
}

async function findServiceIdInAllServices(page, serviceName) {
    const serviceNames = Array.isArray(serviceName) ? serviceName : getServiceSearchNames(serviceName);
    await page.waitForTimeout(800);

    for (let attempt = 0; attempt < 18; attempt++) {
        let serviceId = "";
        for (const candidate of serviceNames) {
            serviceId =
                (await findVisibleServiceIdByTitleAttributeScoped(page, candidate).catch(() => "")) ||
                (await findVisibleElementIdByFuzzyLabelScoped(page, candidate, {
                    minWidth: 60,
                    minHeight: 30,
                    maxWidth: 460,
                    maxHeight: 280,
                    excludeIdPrefixes: ["menu_"],
                    timeout: 1200,
                }).catch(() => ""));
            if (serviceId) break;
        }

        if (serviceId) {
            return serviceId;
        }

        await remotePress(page, attempt % 5 === 4 ? "ArrowRight" : "ArrowDown", 500);
    }

    const visibleServices = await collectVisibleAllServiceLabelsScoped(page);
    throw new Error(`Không tìm thấy dịch vụ "${serviceNames[0] || serviceName}" trong Tất cả dịch vụ. Các mục đang thấy: ${visibleServices.join(", ")}`);
}

async function findVisibleServiceIdByTitleAttribute(page, serviceName) {
    const serviceId = await page.waitForFunction(
        (targetServiceName) => {
            const normalizedTarget = normalizeText(targetServiceName);
            const targetTokens = tokenize(normalizedTarget);
            const rowElements = Array.from(document.querySelectorAll('[id^="dropdown_service_items_row"]'));
            const serviceElements = rowElements.flatMap((row) =>
                Array.from(row.querySelectorAll("[service_title]")).map((element) => ({
                    row,
                    element,
                })),
            );

            const candidates = serviceElements
                .map(({row, element}) => {
                    const rect = element.getBoundingClientRect();
                    const rowId = row.id || "";
                    const style = getComputedStyle(element);
                    const label = (element.getAttribute("service_title") || "").replace(/\s+/g, " ").trim();
                    const normalizedLabel = normalizeText(label);

                    return {
                        id: element.id || "",
                        rowId,
                        label,
                        normalizedLabel,
                        rect,
                        score: scoreMatch(normalizedLabel),
                        visible: rect.width >= 40 && rect.height >= 30 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
                    };
                })
                .filter((item) => item.id && item.visible && item.label && item.score > 0)
                .sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;
                    const rowDiff = getRowIndex(a.rowId) - getRowIndex(b.rowId);
                    if (rowDiff !== 0) return rowDiff;
                    return a.rect.x - b.rect.x;
                });

            return candidates[0]?.id || "";

            function scoreMatch(normalizedLabel) {
                if (!normalizedTarget) return 0;
                if (normalizedLabel === normalizedTarget) return 100;
                if (normalizedLabel.includes(normalizedTarget) || normalizedTarget.includes(normalizedLabel)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!targetTokens.length || !labelTokens.length) return 0;
                const matchedTokens = targetTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken)));
                const coverage = matchedTokens.length / targetTokens.length;
                return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
            }

            function getRowIndex(rowId) {
                const match = rowId.match(/dropdown_service_items_row(\d+)/);
                return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/["'“”‘’]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }
        },
        serviceName,
        {timeout: 1200},
    );

    const id = await serviceId.jsonValue();
    expect(id, `Service with service_title similar to "${serviceName}" should have id`).toBeTruthy();
    return id;
}

async function collectVisibleAllServiceLabels(page) {
    return page.evaluate(() => {
        const titleLabels = Array.from(document.querySelectorAll('[id^="dropdown_service_items_row"] [service_title]'))
            .map((element) => (element.getAttribute("service_title") || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);

        const fallbackLabels = Array.from(document.querySelectorAll("[id]"))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const label = [
                    element.textContent || "",
                    element.getAttribute("title") || "",
                    element.getAttribute("title_text") || "",
                    element.getAttribute("service_title") || "",
                    element.getAttribute("service_name") || "",
                    element.getAttribute("menu_name") || "",
                    element.getAttribute("alt") || "",
                ]
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();

                return {
                    label,
                    rect,
                    visible: label && rect.width >= 60 && rect.height >= 30 && rect.width <= 460 && rect.height <= 280 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !element.id.startsWith("menu_"),
                };
            })
            .filter((item) => item.visible)
            .map((item) => item.label)
            .filter((label, index, labels) => labels.indexOf(label) === index)
            .slice(0, 30);

        return [...titleLabels, ...fallbackLabels].filter((label, index, labels) => labels.indexOf(label) === index).slice(0, 30);
    });
}

async function isLeftMenuOpen(page) {
    return page
        .locator("#menu_text_dynamic_menu_1")
        .filter({hasText: /^Truyền hình$/i})
        .isVisible()
        .catch(() => false);
}

async function findFirstPlayableContentId(page) {
    const contentId = await page.waitForFunction(
        () => {
            const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân)$/i;
            const candidates = Array.from(document.querySelectorAll("[id]"))
                .filter((element) => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    const text = (element.textContent || "").replace(/\s+/g, " ").trim();

                    return rect.width >= 120 && rect.height >= 90 && rect.x >= 180 && rect.y >= 80 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !element.id.startsWith("menu_item_") && !menuText.test(text);
                })
                .sort((a, b) => {
                    const aFirstItem = /(^specialModuleID_0_0$|_0_0$)/.test(a.id);
                    const bFirstItem = /(^specialModuleID_0_0$|_0_0$)/.test(b.id);
                    if (aFirstItem !== bFirstItem) return aFirstItem ? -1 : 1;

                    const aRect = a.getBoundingClientRect();
                    const bRect = b.getBoundingClientRect();
                    if (Math.abs(aRect.y - bRect.y) > 40) return aRect.y - bRect.y;
                    return aRect.x - bRect.x;
                });

            return candidates[0]?.id || "";
        },
        null,
        {timeout: 20000},
    );

    const id = await contentId.jsonValue();
    expect(id, "First playable movie content should have id").toBeTruthy();
    return id;
}

async function findVisibleElementIdByFuzzyLabel(page, text, filters = {}) {
    const elementId = await page.waitForFunction(
        ({targetText, minWidth, minHeight, maxWidth, maxHeight, excludeIdPrefixes}) => {
            const normalizedTarget = normalizeText(targetText);
            const targetTokens = tokenize(normalizedTarget);
            const candidates = Array.from(document.querySelectorAll("[id]"))
                .map((element) => {
                    const style = getComputedStyle(element);
                    const label = [element.textContent || "", element.getAttribute("title") || "", element.getAttribute("title_text") || "", element.getAttribute("service_name") || "", element.getAttribute("menu_name") || "", element.getAttribute("alt") || ""].join(" ").replace(/\s+/g, " ").trim();
                    const normalizedLabel = normalizeText(label);
                    const target = findNavigationTarget(element);
                    const rect = target ? target.getBoundingClientRect() : element.getBoundingClientRect();

                    return {
                        id: target?.id || element.id,
                        label,
                        rect,
                        score: scoreMatch(normalizedLabel),
                        visible:
                            Boolean(target) &&
                            rect.width >= minWidth &&
                            rect.height >= minHeight &&
                            rect.width <= maxWidth &&
                            rect.height <= maxHeight &&
                            style.display !== "none" &&
                            style.visibility !== "hidden" &&
                            Number(style.opacity) !== 0 &&
                            !excludeIdPrefixes.some((prefix) => element.id.startsWith(prefix)),
                    };
                })
                .filter((item) => item.visible && item.label && item.score > 0)
                .sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;
                    const aArea = a.rect.width * a.rect.height;
                    const bArea = b.rect.width * b.rect.height;
                    return aArea - bArea;
                });

            return candidates[0]?.id || "";

            function findNavigationTarget(element) {
                let current = element;
                let candidate = null;
                while (current && current !== document.body) {
                    const rect = current.getBoundingClientRect();
                    const style = getComputedStyle(current);
                    const id = current.id || "";
                    const visible =
                        id && rect.width >= minWidth && rect.height >= minHeight && rect.width <= maxWidth && rect.height <= maxHeight && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !excludeIdPrefixes.some((prefix) => id.startsWith(prefix));

                    if (visible) {
                        candidate = current;
                    }
                    current = current.parentElement;
                }

                return candidate;
            }

            function scoreMatch(normalizedLabel) {
                if (normalizedLabel === normalizedTarget) return 100;
                if (normalizedLabel.includes(normalizedTarget)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!targetTokens.length || !labelTokens.length) return 0;
                const matchedTokens = targetTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token)));
                const coverage = matchedTokens.length / targetTokens.length;
                return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/["'“”‘’]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }
        },
        {
            targetText: text,
            minWidth: filters.minWidth || 1,
            minHeight: filters.minHeight || 1,
            maxWidth: filters.maxWidth || Number.MAX_SAFE_INTEGER,
            maxHeight: filters.maxHeight || Number.MAX_SAFE_INTEGER,
            excludeIdPrefixes: filters.excludeIdPrefixes || [],
        },
        {timeout: filters.timeout || 15000},
    );

    const id = await elementId.jsonValue();
    expect(id, `Visible element similar to "${text}" should have id`).toBeTruthy();
    return id;
}

async function findChannelIdByName(page, channelName) {
    const channelId = await page.waitForFunction(
        (name) => {
            const normalizedName = normalizeText(name);
            const searchTokens = tokenize(normalizedName);
            const candidates = Array.from(document.querySelectorAll("[channel_name]"))
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    const label = (element.getAttribute("channel_name") || "").replace(/\s+/g, " ").trim();
                    const normalizedLabel = normalizeText(label);

                    return {
                        element,
                        label,
                        normalizedLabel,
                        score: scoreMatch(normalizedLabel),
                        visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
                    };
                })
                .filter((item) => item.visible && item.label && item.score > 0)
                .sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;
                    return a.normalizedLabel.length - b.normalizedLabel.length;
                });

            return candidates[0]?.element.id || "";

            function scoreMatch(normalizedLabel) {
                if (!normalizedName) return 0;
                if (normalizedLabel === normalizedName) return 100;
                if (normalizedLabel.includes(normalizedName)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!searchTokens.length || !labelTokens.length) return 0;

                const matchedTokens = searchTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token)));
                const coverage = matchedTokens.length / searchTokens.length;
                if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
                if (searchTokens.length >= 2 && coverage >= 0.75) return Math.round(60 + coverage * 10);
                return 0;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }
        },
        channelName,
        {timeout: 20000},
    );

    const id = await channelId.jsonValue();
    expect(id, `Channel with channel_name similar to "${channelName}" should have id`).toBeTruthy();
    return id;
}

async function findMovieContentIdByName(page, movieName, movieNamePattern) {
    const movieId = await page.waitForFunction(
        ({name, source}) => {
            const pattern = new RegExp(source, "i");
            const normalizedName = normalizeText(name);
            const searchTokens = tokenize(normalizedName);

            const candidates = Array.from(document.querySelectorAll("[id]"))
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    const label = [
                        element.textContent || "",
                        element.getAttribute("title") || "",
                        element.getAttribute("title_text") || "",
                        element.getAttribute("movie_name") || "",
                        element.getAttribute("vod_name") || "",
                        element.getAttribute("content_name") || "",
                        element.getAttribute("channel_name") || "",
                        element.getAttribute("alt") || "",
                    ]
                        .join(" ")
                        .replace(/\s+/g, " ")
                        .trim();

                    return {
                        element,
                        rect,
                        label,
                        normalizedLabel: normalizeText(label),
                        score: scoreMatch(label, normalizeText(label)),
                        visible: rect.width >= 120 && rect.height >= 80 && rect.x >= 80 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !element.id.startsWith("menu_"),
                    };
                })
                .filter((item) => {
                    if (!item.visible || !item.label) return false;
                    return item.score > 0;
                })
                .sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;

                    const aExact = a.normalizedLabel === normalizedName;
                    const bExact = b.normalizedLabel === normalizedName;
                    if (aExact !== bExact) return aExact ? -1 : 1;

                    const aArea = a.rect.width * a.rect.height;
                    const bArea = b.rect.width * b.rect.height;
                    if (Math.abs(aArea - bArea) > 1000) return aArea - bArea;

                    if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
                    return a.rect.x - b.rect.x;
                });

            return candidates[0]?.element.id || "";

            function scoreMatch(label, normalizedLabel) {
                if (pattern.test(label)) return 100;
                if (normalizedLabel === normalizedName) return 95;
                if (normalizedLabel.includes(normalizedName)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!searchTokens.length || !labelTokens.length) return 0;

                const matchedTokens = searchTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token)));
                const coverage = matchedTokens.length / searchTokens.length;
                if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
                if (searchTokens.length >= 3 && coverage >= 0.75) return Math.round(60 + coverage * 10);

                return 0;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }
        },
        {name: movieName, source: movieNamePattern.source},
        {timeout: 20000},
    );

    const id = await movieId.jsonValue();
    expect(id, `Movie content matching "${movieName}" should have id`).toBeTruthy();
    return id;
}

async function findBestSearchResult(page, keyword, type = "content") {
    await page.waitForFunction(
        () => {
            const bodyText = document.body?.innerText || "";
            if (/không tìm thấy|không có kết quả|không có nội dung/i.test(bodyText)) return true;

            const resultRoot = Array.from(document.querySelectorAll("#clip_search_content #clip_item_row #clip_item_row_move_grid_ver_container")).find((candidate) => isVisibleSearchResultRoot(candidate));
            if (!resultRoot) return false;

            return (resultRoot.textContent || "").trim().length > 0;

            function isVisibleSearchResultRoot(element) {
                if (!(element.textContent || "").trim()) return false;

                let current = element;
                while (current) {
                    const style = getComputedStyle(current);
                    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
                    current = current.parentElement;
                }

                const rect = element.getBoundingClientRect();
                if (rect.width >= 1 && rect.height >= 1) return true;

                return Array.from(element.querySelectorAll("*")).some((child) => {
                    const childRect = child.getBoundingClientRect();
                    return childRect.width >= 120 && childRect.height >= 80;
                });
            }
        },
        null,
        {timeout: 20000},
    );

    const results = await collectSearchResultCandidates(page, keyword, type);
    const normalizedKeyword = normalizeVietnameseText(keyword);
    const bestResult =
        results.find((item) => item.id === "searchRow_0_0" && item.normalizedLabel === normalizedKeyword) ||
        results.find((item) => item.row === 0 && item.normalizedLabel === normalizedKeyword) ||
        results.find((item) => item.normalizedLabel === normalizedKeyword) ||
        results.find((item) => item.row === 0 && item.score >= 90) ||
        results[0] ||
        null;

    return bestResult && bestResult.score >= 70 ? bestResult : null;
}

async function collectSearchResultCandidates(page, keyword, type = "content") {
    return page.evaluate(
        ({searchKeyword, requestedType}) => {
            const normalizedKeyword = normalizeText(searchKeyword);
            const searchTokens = tokenize(normalizedKeyword);
            const resultRoot = Array.from(document.querySelectorAll("#clip_search_content #clip_item_row #clip_item_row_move_grid_ver_container")).find((candidate) => isVisibleSearchResultRoot(candidate));
            if (!resultRoot) return [];

            return Array.from(resultRoot.querySelectorAll("[id]"))
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    const labelParts = {
                        text: (element.textContent || "").replace(/\s+/g, " ").trim(),
                        title: element.getAttribute("title") || "",
                        titleText: element.getAttribute("title_text") || "",
                        movieName: element.getAttribute("movie_name") || "",
                        vodName: element.getAttribute("vod_name") || "",
                        contentName: element.getAttribute("content_name") || "",
                        channelName: element.getAttribute("channel_name") || "",
                        alt: element.getAttribute("alt") || "",
                    };
                    const label = Object.values(labelParts).join(" ").replace(/\s+/g, " ").trim();
                    const normalizedLabel = normalizeText(label);
                    const detectedType = labelParts.channelName ? "channel" : labelParts.movieName || labelParts.vodName ? "movie" : "";

                    return {
                        id: element.id,
                        ...parseSearchRowId(element.id),
                        label,
                        labelParts,
                        normalizedLabel,
                        type: detectedType,
                        score: scoreMatch(label, normalizedLabel),
                        rect: {
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                        },
                        visible: rect.width >= 120 && rect.height >= 80 && rect.x >= 0 && rect.y >= 80 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !element.id.startsWith("key-") && !element.id.startsWith("menu_") && !element.id.includes("keyboard"),
                    };
                })
                .filter((item) => item.visible && item.label && item.score > 0 && (item.isSearchRow || item.score >= 80) && (requestedType === "content" || item.type === requestedType || (!item.type && item.score >= 80)))
                .sort((a, b) => {
                    if (a.row !== b.row) return a.row - b.row;
                    if (a.score !== b.score) return b.score - a.score;
                    const aArea = a.rect.width * a.rect.height;
                    const bArea = b.rect.width * b.rect.height;
                    if (Math.abs(aArea - bArea) > 1000) return aArea - bArea;
                    if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
                    return a.rect.x - b.rect.x;
                })
                .slice(0, 40);

            function parseSearchRowId(id) {
                const match = /^searchRow_(\d+)_(\d+)$/.exec(id || "");
                return {
                    isSearchRow: Boolean(match),
                    row: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
                    col: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
                };
            }

            function scoreMatch(label, normalizedLabel) {
                if (!normalizedKeyword) return 0;
                if (normalizedLabel === normalizedKeyword) return 100;
                if (normalizedLabel.includes(normalizedKeyword)) return 90;

                const labelTokens = tokenize(normalizedLabel);
                if (!searchTokens.length || !labelTokens.length) return 0;

                const matchedTokens = searchTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token)));
                const coverage = matchedTokens.length / searchTokens.length;
                if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
                if (searchTokens.length >= 3 && coverage >= 0.75) return Math.round(60 + coverage * 10);
                return 0;
            }

            function normalizeText(value) {
                return value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/đ/g, "d")
                    .replace(/Đ/g, "D")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            function tokenize(value) {
                return value
                    .replace(/[^a-z0-9]+/g, " ")
                    .split(" ")
                    .map((token) => token.trim())
                    .filter((token) => token.length >= 2);
            }

            function isVisibleSearchResultRoot(element) {
                if (!(element.textContent || "").trim()) return false;

                let current = element;
                while (current) {
                    const style = getComputedStyle(current);
                    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
                    current = current.parentElement;
                }

                const rect = element.getBoundingClientRect();
                if (rect.width >= 1 && rect.height >= 1) return true;

                return Array.from(element.querySelectorAll("*")).some((child) => {
                    const childRect = child.getBoundingClientRect();
                    return childRect.width >= 120 && childRect.height >= 80;
                });
            }
        },
        {searchKeyword: keyword, requestedType: type},
    );
}

async function collectMovieSearchCandidates(page) {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll("[id]"))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const labelParts = {
                    text: (element.textContent || "").replace(/\s+/g, " ").trim(),
                    title: element.getAttribute("title") || "",
                    titleText: element.getAttribute("title_text") || "",
                    movieName: element.getAttribute("movie_name") || "",
                    vodName: element.getAttribute("vod_name") || "",
                    contentName: element.getAttribute("content_name") || "",
                    alt: element.getAttribute("alt") || "",
                };
                const label = Object.values(labelParts).join(" ").replace(/\s+/g, " ").trim();

                return {
                    id: element.id,
                    label,
                    labelParts,
                    normalizedLabel: normalizeText(label),
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    },
                    visible: rect.width >= 120 && rect.height >= 80 && rect.x >= 80 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && !element.id.startsWith("menu_"),
                };
            })
            .filter((item) => item.visible && item.label)
            .sort((a, b) => {
                if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
                return a.rect.x - b.rect.x;
            })
            .slice(0, 80);

        function normalizeText(value) {
            return value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
        }
    });
}

contentRows.configureContentRows({remotePress, remoteFocusById, remoteFocusByText, getFocusedState, getPlayerState, hasVisibleText, expectFocusedText, activateVerifiedTarget, observePlayerOrDetailState: playback.observePlayerOrDetailState});
artifacts.configureArtifacts({getFocusedState, collectMovieSearchCandidates, collectSearchResultCandidates});

async function findVisibleServiceIdByTitleAttributeScoped(page, serviceName) {
    const normalizedTarget = normalizeVietnameseText(serviceName);
    const serviceId = await waitForScopedCandidate(
        page,
        {
            contractName: "serviceContainer",
            candidateSelector: "[service_title]",
            attributeNames: ["service_title"],
            geometry: {minWidth: 40, minHeight: 30, maxWidth: 460, maxHeight: 280},
            excludeIdPrefixes: ["menu_"],
        },
        (records) =>
            records
                .map((record, index) => {
                    const label = (record.attrs.service_title || record.text || "").replace(/\s+/g, " ").trim();
                    return {id: record.id, label, score: scoreWorkflowText(normalizeVietnameseText(label), normalizedTarget), index};
                })
                .filter((item) => item.id && item.label && item.score > 0)
                .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.id || "",
        1200,
    );

    expect(serviceId, `Service with service_title similar to "${serviceName}" should have id`).toBeTruthy();
    return serviceId;
}

async function collectVisibleAllServiceLabelsScoped(page) {
    const records = await scopedScanRecords(page, {
        contractName: "serviceContainer",
        candidateSelector: "[id]",
        attributeNames: ["title", "title_text", "service_title", "service_name", "menu_name", "alt"],
        geometry: {minWidth: 60, minHeight: 30, maxWidth: 460, maxHeight: 280},
        excludeIdPrefixes: ["menu_"],
    });

    return records
        .filter((record) => record.visible)
        .map((record) => [record.text, ...Object.values(record.attrs || {})].join(" ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .filter((label, index, labels) => labels.indexOf(label) === index)
        .slice(0, 30);
}

async function findVisibleElementIdByFuzzyLabelScoped(page, text, filters = {}) {
    const normalizedTarget = normalizeVietnameseText(text);
    const elementId = await waitForScopedCandidate(
        page,
        {
            contractName: filters.contractName || "contentContainer",
            candidateSelector: "[id]",
            attributeNames: ["title", "title_text", "service_title", "service_name", "menu_name", "alt"],
            geometry: {
                minWidth: filters.minWidth || 1,
                minHeight: filters.minHeight || 1,
                maxWidth: filters.maxWidth || Number.MAX_SAFE_INTEGER,
                maxHeight: filters.maxHeight || Number.MAX_SAFE_INTEGER,
                minX: filters.minX || 0,
                minY: filters.minY || 0,
            },
            excludeIdPrefixes: filters.excludeIdPrefixes || [],
        },
        (records) =>
            records
                .map((record, index) => {
                    const label = [record.text, ...Object.values(record.attrs || {})].join(" ").replace(/\s+/g, " ").trim();
                    return {id: record.id, label, score: scoreWorkflowText(normalizeVietnameseText(label), normalizedTarget), index};
                })
                .filter((item) => item.id && item.label && item.score > 0)
                .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.id || "",
        filters.timeout || 15000,
    );

    expect(elementId, `Visible element similar to "${text}" should have id`).toBeTruthy();
    return elementId;
}

async function waitForScopedCandidate(page, options, pick, timeout) {
    const deadline = Date.now() + timeout;
    let lastRecords = [];
    while (Date.now() <= deadline) {
        lastRecords = await scopedScanRecords(page, options).catch(() => []);
        const candidate = pick(lastRecords);
        if (candidate) return candidate;
        await page.waitForTimeout(Math.min(150, Math.max(25, deadline - Date.now())));
    }
    return pick(lastRecords) || "";
}

function scoreWorkflowText(label, target) {
    if (!label || !target) return 0;
    if (label === target) return 100;
    if (label.includes(target) || target.includes(label)) return 90;

    const labelTokens = label.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
    const targetTokens = target.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
    if (!labelTokens.length || !targetTokens.length) return 0;
    const matchedTokens = targetTokens.filter((token) => labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken)));
    const coverage = matchedTokens.length / targetTokens.length;
    if (coverage === 1) return 80;
    if (targetTokens.length >= 2 && coverage >= 0.6) return Math.round(50 + coverage * 20);
    return 0;
}

module.exports = {
    getTestOptions,
    runStep,
    prepareAppEnvironment,
    openAppAndEnterLoginPage,
    loginWithAccount,
    chooseFirstProfileAndEnterHome,
    closeHomePopupsAndVerifyHome,
    openSearchFromLeftMenu,
    searchContentByName,
    openTelevisionFromLeftMenu,
    openMovieFromLeftMenu,
    openSettingFromLeftMenu,
    openServiceFromLeftMenuOrAllServices,
    assertServiceOpened,
    assertViewMoreOpened,
    openChannel,
    searchAndOpenBestContent,
    openMovieContent,
    openFirstMovieContent,
    playAllItemsInFirstRow,
    playItemsInRow,
    playAllListPageContents,
    playVisibleContentByName,
    playFocusedSearchResult,
    assertChannelPlayback: playback.assertChannelPlayback,
    assertMoviePlayback: playback.assertMoviePlayback,
    assertSearchContentPlayback: playback.assertSearchContentPlayback,
    attachCurrentAppScreenshot,
    __internal: {
        focusFirstRowStart,
        findServiceIdInAllServices,
        getServiceSearchNames,
        closeAdvertisePopupIfVisible,
        getVisiblePopup: playback.getVisiblePopup,
        observeServiceOpenState,
        observeServiceDestinationContent,
        isWelcomeScreen,
        WELCOME_LOGIN_BUTTON_SELECTOR,
        observeVisibleHomeScreen,
        getVisibleServicePopup,
        getVisibleServiceToast,
        chooseDirection: navigation.__internal.chooseDirection,
        waitForAppReady,
        waitForHomeReady,
        observeAppReadyState,
        observeHomeReadyState,
        observeVisibleContentRows,
        isValidFocusedState,
        formatRowPlaybackFailureSummary,
        normalizePlayRowIndex,
        skipFocusedViewMorePoster,
        assertSupportedListPageRoute,
        advanceListPagePosition,
        LIST_PAGE_CONTENT_ROUTES,
    },
};
