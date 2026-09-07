const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    describeActionTarget,
    describeCaseFailure,
    describeFailureCode,
    describeStepFailure,
    stripAnsi,
} = require("../../app/failure-message");

const ESC = String.fromCharCode(27);

function coloured(text) {
    return `${ESC}[2m${text}${ESC}[22m`;
}

test("turns a bare toBeTruthy dump into a sentence about the missing content", () => {
    const failure = describeStepFailure({
        message: `${coloured("expect(")}${coloured("received")}${coloured(").")}toBeTruthy()\n\nReceived: ${coloured("null")}`,
        action: "play_content",
        target: "Mai",
        stepIndex: 3,
    });

    assert.equal(
        failure.summary,
        'Bước 4 – Phát nội dung "Mai": Không tìm thấy nội dung cần phát trên màn hình (ứng dụng chưa hiển thị hoặc nội dung không tồn tại).'
    );
    assert.equal(failure.detail, "expect(received).toBeTruthy() Received: null");
});

test("explains a DOM wait timeout with the waited seconds and the missing subject", () => {
    const failure = describeStepFailure({
        message: "page.waitForFunction: Timeout 30000ms exceeded.",
        action: "open_service",
        target: "Phim truyện",
        stepIndex: 1,
    });

    assert.equal(
        failure.summary,
        'Bước 2 – Mở dịch vụ "Phim truyện": Không tìm thấy dịch vụ cần mở trên màn hình sau 30 giây chờ. Ứng dụng tải chậm hoặc màn hình không hiển thị mục này.'
    );
    assert.equal(failure.detail, "page.waitForFunction: Timeout 30000ms exceeded.");
});

test("keeps a message that is already readable and only adds the step context", () => {
    const failure = describeStepFailure({
        message: 'Không tìm thấy dịch vụ "Phim truyện" trong Tất cả dịch vụ.',
        action: "open_service",
        stepIndex: 1,
    });

    assert.equal(
        failure.summary,
        'Bước 2 – Mở dịch vụ: Không tìm thấy dịch vụ "Phim truyện" trong Tất cả dịch vụ.'
    );
    assert.equal(failure.detail, "");
});

test("translates the player assertion labels used by the playback helper", () => {
    assert.equal(
        describeStepFailure({
            message: "Player video element should exist\n\nexpect(received).toBe(expected)\n\nExpected: true\nReceived: false",
            action: "expected_result",
            stepIndex: 5,
        }).summary,
        "Bước 6 – Kiểm tra kết quả mong đợi: Trình phát không tạo được video (không có thẻ video trên màn hình)."
    );

    assert.match(
        describeStepFailure({
            message: 'Player should be playing normally: {"hasVideo":true}\n\nexpect(received).toBe(expected)',
            action: "expected_result",
            stepIndex: 2,
        }).summary,
        /video không chạy/u
    );
});

test("rewrites the helper errors that carry an English label and a state dump", () => {
    assert.equal(
        describeStepFailure({
            message: 'Phát "Mai" playback failed with popup: Nội dung không khả dụng tại khu vực của bạn',
            action: "play_content",
            target: "Mai",
            stepIndex: 2,
        }).summary,
        'Bước 3 – Phát nội dung "Mai": Ứng dụng báo lỗi khi phát nội dung: "Nội dung không khả dụng tại khu vực của bạn".'
    );

    const episode = describeStepFailure({
        message: 'Could not focus episode 12: {"focus":{"id":"partition_1_3"}}',
        action: "player_focus_episode",
        stepIndex: 4,
    });
    assert.equal(episode.summary, "Bước 5 – Chọn tập: Không chọn được tập 12 trong danh sách tập.");
    assert.equal(episode.detail, 'Could not focus episode 12: {"focus":{"id":"partition_1_3"}}');
});

test("names the run-level failures a reader cannot infer from a stack trace", () => {
    assert.match(
        describeStepFailure({message: "Test timeout of 900000ms exceeded.", action: "play_row", stepIndex: 2}).summary,
        /quá thời gian tối đa \(900 giây\)/u
    );
    assert.match(
        describeStepFailure({message: "page.goto: net::ERR_NAME_NOT_RESOLVED at https://html5stage.mytv.vn/", action: "open_home", stepIndex: 0}).summary,
        /Không kết nối được tới máy chủ/u
    );
    assert.match(
        describeStepFailure({message: "Target page, context or browser has been closed", action: "press_ok", stepIndex: 1}).summary,
        /bị đóng trước khi bước này hoàn tất/u
    );
});

test("does not prefix a compile failure with a step number", () => {
    assert.equal(
        describeStepFailure({
            message: "Không thể parse được bước: B3. Làm thao tác lạ",
            action: "compile",
            stepIndex: 0,
        }).summary,
        "Không thể parse được bước: B3. Làm thao tác lạ"
    );
});

test("describes a case through its first failed step", () => {
    const failure = describeCaseFailure({
        steps: [
            {index: 0, action: "open_home", status: "passed", message: ""},
            {index: 1, action: "focus_text", status: "failed", target: "Xem tất cả", message: "page.waitForFunction: Timeout 15000ms exceeded."},
            {index: 2, action: "press_ok", status: "failed", message: "second failure"},
        ],
    });

    assert.equal(
        failure.summary,
        'Bước 2 – Chọn mục trên màn hình "Xem tất cả": Không tìm thấy mục cần chọn trên màn hình sau 15 giây chờ. Ứng dụng tải chậm hoặc màn hình không hiển thị mục này.'
    );
});

test("falls back to the runner message and TV failure codes when no step failed", () => {
    assert.equal(
        describeCaseFailure(null, "DOM_STATE_TIMEOUT").summary,
        "Quá thời gian chờ màn hình TV chuyển sang trạng thái mong đợi."
    );
    assert.equal(describeCaseFailure(null, "").summary, "");
    assert.equal(describeFailureCode("PAIRING_REQUIRED"), "TV chưa được ghép nối (pairing) với máy chạy test.");
    assert.equal(describeFailureCode("SOMETHING_ELSE"), "");
});

test("names the item a failed action was aiming at, except login credentials", () => {
    assert.equal(describeActionTarget({action: "open_service", service: "Phim truyện"}), "Phim truyện");
    assert.equal(describeActionTarget({action: "play_content", name: "Mai", type: "movie"}), "Mai");
    assert.equal(describeActionTarget({action: "play_row", rowIndex: 5}), "hàng 5");
    assert.equal(describeActionTarget({action: "player_focus_episode", episode: 12}), "tập 12");
    assert.equal(describeActionTarget({action: "login", username: "0912345678", password: "secret"}), "");
});

test("removes terminal colour codes with or without the escape character", () => {
    assert.equal(stripAnsi(`${ESC}[31mnull${ESC}[39m`), "null");
    assert.equal(stripAnsi("[2mexpect([22mreceived[39m"), "expect(received");
});

test("the renderer page loads the humanizer before the renderer script", () => {
    // The packaged renderer is context-isolated and has no require(), so it can
    // only reach the humanizer through the global this script tag installs.
    const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");
    const humanizer = html.indexOf('src="../failure-message.js"');
    const renderer = html.indexOf('src="./renderer.js"');

    assert.ok(humanizer > -1, "index.html must load failure-message.js");
    assert.ok(humanizer < renderer, "failure-message.js must load before renderer.js");
});
