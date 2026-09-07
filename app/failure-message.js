// Turns raw runner errors (Playwright assertion dumps, timeout traces, TV
// failure codes) into one sentence a QA reader can act on. The raw text is kept
// separately as a technical detail so debugging does not lose anything.

// Playwright colours its assertion dumps; the escape sequences survive into
// the JSON result file, and a log copied out of a terminal keeps the bracket
// codes without the escape character, so both shapes are removed.
const ANSI_ESCAPE_PATTERN = /\u001B\[[0-9;]*m/gu;
const ANSI_LEFTOVER_PATTERN = /\[[0-9]{1,3}(?:;[0-9]{1,3})*m/gu;

const ACTION_LABELS = {
    login: "Đăng nhập",
    open_home: "Mở trang chủ",
    focus_row: "Chọn hàng nội dung",
    focus_row_first_item: "Chọn nội dung đầu tiên của hàng",
    focus_text: "Chọn mục trên màn hình",
    press_ok: "Nhấn OK",
    open_service: "Mở dịch vụ",
    open_search: "Mở tìm kiếm",
    search_content: "Tìm kiếm nội dung",
    play_content: "Phát nội dung",
    play_search_result: "Phát kết quả tìm kiếm",
    play_row: "Phát các nội dung trong hàng",
    play_all_contents: "Phát các nội dung trong danh sách",
    play_home_trailers: "Phát trailer trang chủ",
    player_seek: "Tua trong trình phát",
    player_toggle_play: "Phát/tạm dừng trình phát",
    player_focus_related: "Chọn nội dung liên quan trong trình phát",
    player_open_episodes: "Mở danh sách tập",
    player_focus_episode: "Chọn tập",
    assert_screen: "Kiểm tra nội dung hiển thị",
    press_back: "Nhấn Back",
    wait_for_ready: "Chờ màn hình sẵn sàng",
    compile: "Biên dịch các bước của test case",
    expected_result: "Kiểm tra kết quả mong đợi",
};

// What each action is actually waiting for on screen, used to say which element
// never appeared instead of repeating "phần tử".
const ACTION_SUBJECTS = {
    login: "màn hình đăng nhập",
    open_home: "trang chủ",
    focus_row: "hàng nội dung cần chọn",
    focus_row_first_item: "nội dung đầu tiên của hàng",
    focus_text: "mục cần chọn",
    open_service: "dịch vụ cần mở",
    open_search: "màn hình tìm kiếm",
    search_content: "kết quả tìm kiếm",
    play_content: "nội dung cần phát",
    play_search_result: "kết quả tìm kiếm cần phát",
    play_row: "nội dung trong hàng cần phát",
    play_all_contents: "danh sách nội dung cần phát",
    play_home_trailers: "trailer trên trang chủ",
    player_seek: "thanh tua của trình phát",
    player_toggle_play: "nút phát/tạm dừng của trình phát",
    player_focus_related: "hàng nội dung liên quan trong trình phát",
    player_open_episodes: "danh sách tập của phim",
    player_focus_episode: "tập cần chọn",
    assert_screen: "nội dung cần kiểm tra",
    press_back: "màn hình trước đó",
    wait_for_ready: "màn hình cần chờ",
    expected_result: "màn hình kết quả mong đợi",
};

// Messages the helpers raise in English, often with a state dump appended. The
// meaning is rewritten in Vietnamese and the dump stays in the technical detail.
// `text` may be a function that receives the regexp match.
const ASSERTION_MEANINGS = [
    {
        pattern: /playback failed with popup:\s*(.+)$/iu,
        text: (match) => `ứng dụng báo lỗi khi phát nội dung: "${match[1].trim()}"`,
    },
    {
        pattern: /Could not focus the player play\/pause button/iu,
        text: "không chọn được nút phát/tạm dừng trên thanh điều khiển của trình phát",
    },
    {
        pattern: /Could not focus related-content item (\d+)/iu,
        text: (match) => `không chọn được nội dung liên quan số ${match[1]} trong trình phát`,
    },
    {
        pattern: /Could not focus the player control button "([^"]+)"/iu,
        text: (match) => `không chọn được nút "${match[1]}" trên thanh điều khiển của trình phát`,
    },
    {
        pattern: /Could not focus episode (\d+)/iu,
        text: (match) => `không chọn được tập ${match[1]} trong danh sách tập`,
    },
    {
        pattern: /Could not focus row item "([^"]+)"/iu,
        text: (match) => `không chọn được nội dung "${match[1]}" trong hàng`,
    },
    {
        pattern: /Could not focus popup action "([^"]+)"/iu,
        text: (match) => `không chọn được nút "${match[1]}" trên popup`,
    },
    {
        pattern: /Could not focus target with remote keys/iu,
        text: "không đưa được con trỏ tới mục cần chọn bằng phím điều hướng",
    },
    {
        pattern: /Consent checkbox did not become checked/iu,
        text: "không tích được ô đồng ý điều khoản trên popup",
    },
    {
        pattern: /User-consent popup did not close/iu,
        text: "popup điều khoản người dùng không đóng sau khi bấm đồng ý",
    },
    {
        pattern: /Device-limit popup did not close/iu,
        text: 'popup giới hạn thiết bị không đóng sau khi bấm "Tiếp tục"',
    },
    {
        pattern: /Player video element should exist/iu,
        text: "trình phát không tạo được video (không có thẻ video trên màn hình)",
    },
    {
        pattern: /Player should be playing normally/iu,
        text: "trình phát mở lên nhưng video không chạy (đứng hình hoặc chưa bắt đầu phát)",
    },
    {
        pattern: /should have id/iu,
        text: "không tìm thấy mục cần thao tác trên màn hình",
    },
    {
        pattern: /Left menu should contain/iu,
        text: 'không tìm thấy mục "Tất cả dịch vụ" trong menu bên trái',
    },
    {
        pattern: /(?:Content name|SEARCH_KEYWORD) is required/iu,
        text: "test case thiếu tên nội dung cần tìm/phát",
    },
];

// Failure codes reported by the LG webOS runner.
const FAILURE_CODE_MESSAGES = {
    ACTION_ASSERTION_FAILED: "Bước kiểm tra trên TV không đạt kết quả mong đợi.",
    CONTENT_NOT_FOUND: "Không tìm thấy nội dung cần thao tác trên TV.",
    FOCUS_NOT_FOUND: "Không đưa được con trỏ tới mục cần thao tác trên TV.",
    PLAYER_ASSERTION_FAILED: "Trình phát trên TV không chạy đúng như mong đợi.",
    SCREEN_ASSERTION_FAILED: "Màn hình TV không hiển thị nội dung như mong đợi.",
    APP_IDENTITY_MISMATCH: "Ứng dụng đang mở trên TV không phải ứng dụng MyTV cần kiểm thử.",
    APPIUM_BASE_URL_INVALID: "Cấu hình kết nối tới TV không hợp lệ.",
    APPIUM_CLIENT_UNAVAILABLE: "Không kết nối được tới dịch vụ điều khiển TV (Appium).",
    DOM_INSPECTION_UNAVAILABLE: "Không đọc được nội dung màn hình của ứng dụng trên TV.",
    DOM_STATE_PREDICATE_FAILED: "Màn hình trên TV không chuyển sang trạng thái mong đợi.",
    DOM_STATE_TIMEOUT: "Quá thời gian chờ màn hình TV chuyển sang trạng thái mong đợi.",
    PAIRING_REQUIRED: "TV chưa được ghép nối (pairing) với máy chạy test.",
    REMOTE_CONTROL_UNAVAILABLE: "Không gửi được lệnh điều khiển từ xa tới TV.",
    RESET_UNAVAILABLE: "Không đưa được ứng dụng trên TV về trạng thái ban đầu.",
    SESSION_CLOSE_FAILED: "Không đóng được phiên điều khiển TV sau khi chạy.",
    SESSION_CLOSED: "Phiên điều khiển TV bị đóng giữa chừng.",
    SESSION_UNAVAILABLE: "Không mở được phiên điều khiển TV.",
    TV_CLEANUP_FAILED: "Không dọn dẹp được trạng thái trên TV sau khi chạy.",
    VISUAL_CAPTURE_UNAVAILABLE: "Không chụp được màn hình của TV.",
    TV_TECHNICAL_UNKNOWN: "Phiên chạy trên TV gặp lỗi kỹ thuật không xác định.",
};

const SLOW_APP_HINT = "Ứng dụng tải chậm hoặc màn hình không hiển thị mục này.";

// A popup's text is read straight off the dialog, so it carries the dialog's own
// chrome: the "Thông báo" heading, the build stamp the app prints under it, and
// the label of the button that closes it. None of that is the message a reader
// needs, so it is trimmed off and only the sentence is kept.
const POPUP_HEADING_PATTERN = /^(?:thông báo|thong bao|notice|notification|error|lỗi)\b[\s:.\-]*/iu;
const POPUP_BUILD_STAMP_PATTERN = /\((?=[^)]*\bver\b)[^)]*\)/giu;
const POPUP_CLOSE_LABEL_PATTERN = /\s*(?:Đồng ý|Đóng|Huỷ|Hủy|Bỏ qua|Tiếp tục|Thử lại|Quay về(?: trang chủ)?|OK|Close|Cancel|Retry)\s*$/iu;

function stripAnsi(value) {
    return String(value ?? "")
        .replace(ANSI_ESCAPE_PATTERN, "")
        .replace(ANSI_LEFTOVER_PATTERN, "");
}

function normalizeWhitespace(value) {
    return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function toSeconds(milliseconds) {
    const seconds = Number(milliseconds) / 1000;
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1).replace(/\.0$/u, "");
}

function parseTimeoutMs(message) {
    const testTimeout = /Test timeout of (\d+(?:\.\d+)?)ms exceeded/iu.exec(message);
    if (testTimeout) return Number(testTimeout[1]);
    const exceeded = /Timeout (\d+(?:\.\d+)?)ms exceeded/iu.exec(message);
    if (exceeded) return Number(exceeded[1]);
    const waiting = /Timed out (\d+(?:\.\d+)?)ms waiting/iu.exec(message);
    if (waiting) return Number(waiting[1]);
    return null;
}

function waitedFor(seconds) {
    return seconds ? ` sau ${seconds} giây chờ` : "";
}

// The sentence a popup was actually showing, or "" when there was no popup.
function describePopupMessage(popupText) {
    let message = normalizeWhitespace(stripAnsi(popupText)).replace(POPUP_BUILD_STAMP_PATTERN, " ");
    message = normalizeWhitespace(message).replace(POPUP_HEADING_PATTERN, "");
    // A dialog can stack several buttons, so the labels are trimmed one by one.
    for (let previous = ""; previous !== message; ) {
        previous = message;
        message = normalizeWhitespace(message.replace(POPUP_CLOSE_LABEL_PATTERN, ""));
    }
    return message;
}

function assertionMeaning(message) {
    for (const {pattern, text} of ASSERTION_MEANINGS) {
        const match = pattern.exec(message);
        if (match) return typeof text === "function" ? text(match) : text;
    }
    return "";
}

function actionLabel(action) {
    const name = String(action ?? "").trim();
    if (!name) return "";
    return ACTION_LABELS[name] || name;
}

function actionSubject(action) {
    const name = String(action ?? "").trim();
    return ACTION_SUBJECTS[name] || "mục cần thao tác";
}

// The value a step was aimed at (service name, content name, row…) so the report
// says which item failed. Login is skipped on purpose: the account must not leak
// into a report that is shared or sent to the server.
function describeActionTarget(action) {
    if (!action || typeof action !== "object") return "";
    const value = (key) => String(action[key] ?? "").trim();

    switch (action.action) {
        case "open_service":
            return value("service");
        case "focus_text":
        case "assert_screen":
            return value("text");
        case "search_content":
        case "play_content":
            return value("name");
        case "focus_row":
            return value("rowName");
        case "play_row":
            return value("rowName") || (Number.isInteger(action.rowIndex) ? `hàng ${action.rowIndex}` : "");
        case "wait_for_ready":
            return value("name");
        case "player_focus_episode":
            return Number.isInteger(action.episode) ? `tập ${action.episode}` : "";
        case "player_focus_related":
            return Number.isInteger(action.itemIndex) ? `mục liên quan ${action.itemIndex}` : "";
        case "player_seek":
            if (action.direction === "backward") return "tua lùi";
            if (action.direction === "forward") return "tua tới";
            return "";
        default:
            return "";
    }
}

// The human reason, without the step prefix. Returns "" when the raw message is
// already a readable sentence and should simply be reused.
function describeFailureReason(message, action) {
    const raw = normalizeWhitespace(stripAnsi(message));
    if (!raw) return "";

    const timeoutSeconds = toSeconds(parseTimeoutMs(raw));

    if (/Test timeout of \d+(?:\.\d+)?ms exceeded/iu.test(raw)) {
        return `Test case chạy quá thời gian tối đa${timeoutSeconds ? ` (${timeoutSeconds} giây)` : ""} và bị dừng giữa chừng.`;
    }

    if (/Target (?:page|closed)|(?:page|context|browser) has been closed|Browser has been closed/iu.test(raw)) {
        return "Trình duyệt/phiên chạy bị đóng trước khi bước này hoàn tất (test bị dừng hoặc trình duyệt gặp sự cố).";
    }

    if (/net::ERR_|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/iu.test(raw)) {
        return "Không kết nối được tới máy chủ của ứng dụng (mạng hoặc DNS không truy cập được).";
    }

    if (/page\.goto|browser\.newPage|browserType\.launch/iu.test(raw) && timeoutSeconds) {
        return `Không mở được ứng dụng trên trình duyệt${waitedFor(timeoutSeconds)}. Máy chủ phản hồi chậm hoặc không truy cập được.`;
    }

    if (/waitForFunction|waitForSelector|waitForLoadState|waitForURL|expect\.poll|Timed out .*waiting for/iu.test(raw)) {
        return `Không tìm thấy ${actionSubject(action)} trên màn hình${waitedFor(timeoutSeconds)}. ${SLOW_APP_HINT}`;
    }

    if (/locator\.[a-zA-Z]+:? *Timeout/iu.test(raw) || (timeoutSeconds && /Timeout \d+(?:\.\d+)?ms exceeded/iu.test(raw))) {
        return `Không thao tác được với ${actionSubject(action)}${waitedFor(timeoutSeconds)}. ${SLOW_APP_HINT}`;
    }

    const meaning = assertionMeaning(raw);
    if (meaning) return `${meaning[0].toUpperCase()}${meaning.slice(1)}.`;

    // An empty value from a lookup means the element was never found, whichever
    // matcher reported it.
    if (
        /toBeTruthy|toBeDefined|toBeNull/iu.test(raw) ||
        /Received:\s*(?:null|undefined|""|'')/iu.test(raw)
    ) {
        return `Không tìm thấy ${actionSubject(action)} trên màn hình (ứng dụng chưa hiển thị hoặc nội dung không tồn tại).`;
    }

    if (/expect\(/iu.test(raw) || /Expected:[\s\S]*Received:/iu.test(raw)) {
        return `Màn hình không ở trạng thái mong đợi khi kiểm tra ${actionSubject(action)}.`;
    }

    return "";
}

// Playwright puts an expect() label on its own line before the assertion dump;
// keep it out of the technical detail's first line so the detail stays short.
function technicalDetail(message) {
    return normalizeWhitespace(stripAnsi(message));
}

// The step number alone tells a reader nothing, so a prefix is only added when
// the step names the action it was running. Compilation is not a step of the
// case, and its message already names the line it choked on.
function stepPrefix({stepIndex, action, target} = {}) {
    if (String(action ?? "").trim() === "compile") return "";
    const label = actionLabel(action);
    if (!label) return "";
    const parts = [];
    if (Number.isInteger(stepIndex) && stepIndex >= 0) parts.push(`Bước ${stepIndex + 1}`);
    parts.push(label);
    const prefix = parts.join(" – ");
    const named = String(target ?? "").trim();
    if (!prefix) return "";
    return named ? `${prefix} "${named}"` : prefix;
}

// One readable sentence for a single failed step. When the app had a popup up at
// the moment of failure, that popup is the failure a reader cares about: the
// assertion that tripped is only how the runner noticed it.
function describeStepFailure({message, action, target, stepIndex, popupText} = {}) {
    const detail = technicalDetail(message);
    const popupMessage = describePopupMessage(popupText);
    const reason = popupMessage
        ? `Ứng dụng hiển thị thông báo "${popupMessage}".`
        : describeFailureReason(detail, action);
    const readable = reason || detail;
    const prefix = stepPrefix({stepIndex, action, target});
    const summary = prefix && readable ? `${prefix}: ${readable}` : readable || prefix;

    return {
        summary,
        popupMessage,
        detail: reason && detail !== reason ? detail : "",
    };
}

function describeFailureCode(code) {
    const key = String(code ?? "").trim();
    if (!key) return "";
    return FAILURE_CODE_MESSAGES[key] || "";
}

// The report-facing failure of a whole case: the first failed step, falling back
// to whatever the runner reported when no step was recorded.
function describeCaseFailure(caseResult, fallbackMessage = "") {
    const steps = Array.isArray(caseResult?.steps) ? caseResult.steps : [];
    const failedStep = steps.find((step) => step?.status === "failed" && step?.message);

    if (failedStep) {
        return {
            ...describeStepFailure({
                message: failedStep.message,
                action: failedStep.action,
                target: failedStep.target,
                stepIndex: Number.isInteger(failedStep.index) ? failedStep.index : steps.indexOf(failedStep),
                popupText: failedStep.popupText,
            }),
            // The screen as it looked at the moment the step failed.
            screenshot: String(failedStep.failureScreenshotDataUrl || ""),
        };
    }

    const fallback = technicalDetail(fallbackMessage);
    if (!fallback) return {summary: "", popupMessage: "", detail: "", screenshot: ""};

    const coded = describeFailureCode(fallback);
    if (coded) return {summary: coded, popupMessage: "", detail: fallback, screenshot: ""};

    const reason = describeFailureReason(fallback, "");
    return {
        summary: reason || fallback,
        popupMessage: "",
        detail: reason ? fallback : "",
        screenshot: "",
    };
}

const failureMessage = Object.freeze({
    ACTION_LABELS,
    FAILURE_CODE_MESSAGES,
    describeActionTarget,
    describeCaseFailure,
    describeFailureCode,
    describeFailureReason,
    describePopupMessage,
    describeStepFailure,
    stripAnsi,
});

if (typeof globalThis !== "undefined") globalThis.MYTV_FAILURE_MESSAGE = failureMessage;
if (typeof module !== "undefined" && module.exports) module.exports = failureMessage;
