const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
  assertVisibleScreenText,
} = require("../lib/test-case-action-runner");
const defaultHelpers = require("../lib/mytv-helpers");
const workflows = require("../lib/workflows");

function createTestInfo() {
  const attachments = [];

  return {
    attachments,
    async attach(name, payload) {
      attachments.push({ name, ...payload });
    },
  };
}

function createHandlerHelpers(overrides = {}) {
  return {
    openAppAndEnterLoginPage: async () => {},
    loginWithAccount: async () => {},
    chooseFirstProfileAndEnterHome: async () => {},
    closeHomePopupsAndVerifyHome: async () => {},
    focusRequestedContentRow: async () => {},
    focusFirstItemInCurrentContentRow: async () => {},
    focusServiceCategoryItem: async () => {},
    focusViewMorePosterInCurrentRow: async () => ({
      isViewMore: true,
      id: "view-more",
      title: "",
    }),
    remoteFocusById: async () => {},
    remoteFocusByText: async () => {},
    remotePress: async () => {},
    closePlayerOrDetail: async (page, options = {}) => {
      const press = options.remotePress || (async () => {});
      await press(page, "Backspace");
    },
    openServiceFromLeftMenuOrAllServices: async () => {},
    assertServiceOpened: async () => ({
      type: "service",
      service: "Service",
      route: "service",
      rowCount: 1,
      visibleCount: 1,
      verified: "Service opened to a non-Home screen with visible content rows",
    }),
    assertViewMoreOpened: async () => ({
      type: "view_more",
      label: "Xem tất cả",
      rowName: "Phim mới nhất",
      route: "view-more",
      rowCount: 1,
      visibleCount: 6,
      verified: "View-more poster opened to a non-Home screen with visible content rows",
    }),
    openSearchFromLeftMenu: async () => {},
    searchContentByName: async () => {},
    playVisibleContentByName: async () => {},
    playFocusedSearchResult: async () => {},
    playItemsInRow: async () => {},
    playAllHomeTrailers: async () => {},
    waitForContentVisible: async () => {},
    waitForPlayerReady: async () => {},
    getFocusedState: async () => ({ id: "focused" }),
    getPlayerState: async () => ({
      hasVideo: true,
      isProbablyPlaying: true,
    }),
    __internal: {
      getVisiblePopup: async () => null,
    },
    ...overrides,
  };
}

function replaceWorkflowInternals(overrides) {
  const originals = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, workflows.__internal[key]])
  );
  Object.assign(workflows.__internal, overrides);

  return () => Object.assign(workflows.__internal, originals);
}

test("runs each declared action through its handler in order", async () => {
  const events = [];
  const page = { id: "page" };
  const testInfo = createTestInfo();
  const testCase = {
    id: "12066",
    name: "Vào phim truyện",
    actions: [
      { action: "open_home" },
      { action: "open_service", service: "Phim truyện" },
    ],
  };
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async (context) => {
        events.push(`handler:${context.action.action}`);
        assert.equal(context.page, page);
        assert.equal(context.testInfo, testInfo);
        assert.equal(context.testCase.name, testCase.name);
        assert.deepEqual(context.options, { source: "server" });
      },
      open_service: async ({ action }) => {
        events.push(`handler:${action.action}:${action.service}`);
      },
    },
    stepRunner: async (_page, _testInfo, label, callback) => {
      events.push(`step:${label}`);
      return callback();
    },
  });

  const result = await runTestCase(page, testInfo, testCase, {
    source: "server",
  });

  assert.deepEqual(events, [
    "step:open_home",
    "handler:open_home",
    "step:open_service",
    "handler:open_service:Phim truyện",
  ]);
  assert.equal(result.testCaseId, "12066");
  assert.equal(result.status, "passed");
  assert.equal(result.source, "server");
  assert.deepEqual(result.steps.map(({ index, action, status, message }) => ({
    index,
    action,
    status,
    message,
  })), [
    { index: 0, action: "open_home", status: "passed", message: "" },
    { index: 1, action: "open_service", status: "passed", message: "" },
  ]);
});

test("retains a service verification result when the step wrapper does not return the callback value", async () => {
  const runner = createActionRunner({
    handlers: {
      press_ok: async () => ({
        type: "service",
        service: "TV Xem lại",
        route: "tvod",
        rowCount: 1,
        visibleCount: 12,
      }),
    },
    stepRunner: async (_page, _testInfo, _label, callback) => {
      await callback();
    },
  });

  const result = await runner({id: "page"}, createTestInfo(), {
    id: "preserve-service-result",
    name: "Preserve service result",
    actions: [{action: "press_ok"}],
  });

  assert.deepEqual(result.steps[0].result, {
    type: "service",
    service: "TV Xem lại",
    route: "tvod",
    rowCount: 1,
    visibleCount: 12,
  });
});

test("fails before execution when an action handler is missing", async () => {
  const events = [];
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async () => events.push("handler:open_home"),
    },
    stepRunner: async (_page, _testInfo, label, callback) => {
      events.push(`step:${label}`);
      return callback();
    },
  });

  await assert.rejects(
    () =>
      runTestCase(
        {},
        createTestInfo(),
        {
          id: "missing-handler",
          name: "Missing handler",
          actions: [
            { action: "open_home" },
            { action: "open_service", service: "Phim truyện" },
          ],
        }
      ),
    /open_service/
  );
  assert.deepEqual(events, []);
});

test("records and attaches a failed step before rethrowing the original error", async () => {
  const error = new Error("service navigation failed");
  const testInfo = createTestInfo();
  const time = [100, 107];
  const originalDateNow = Date.now;
  Date.now = () => time.shift();

  try {
    const runTestCase = createActionRunner({
      handlers: {
        open_service: async () => {
          throw error;
        },
      },
      stepRunner: async (page, receivedTestInfo, label, callback) => {
        assert.deepEqual([page, receivedTestInfo, label], [
          { id: "page" },
          testInfo,
          "open_service",
        ]);
        return callback();
      },
    });

    let caught;
    try {
      await runTestCase(
        { id: "page" },
        testInfo,
        {
          id: "failure-case",
          name: "Failure case",
          actions: [{ action: "open_service", service: "Phim truyện" }],
        }
      );
    } catch (caughtError) {
      caught = caughtError;
    }

    assert.strictEqual(caught, error);
    const resultAttachment = testInfo.attachments.find(
      ({ name }) => name === "test-case-result.json"
    );
    assert.ok(resultAttachment);
    assert.deepEqual(JSON.parse(resultAttachment.body), {
      testCaseId: "failure-case",
      name: "Failure case",
      status: "failed",
      source: "local",
      steps: [{
        index: 0,
        action: "open_service",
        status: "failed",
        durationMs: 7,
        message: "service navigation failed",
      }],
      expectedResult: "",
    });
  } finally {
    Date.now = originalDateNow;
  }
});

test("attaches the original case and compiled action payloads", async () => {
  const testInfo = createTestInfo();
  const originalCase = {
    id: 12066,
    name: "Compiled home case",
    qaDescription: "B1. Vào trang chủ",
    expectedResult: "Home is visible",
  };
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async () => {},
    },
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  const result = await runTestCase({}, testInfo, originalCase);

  assert.equal(result.expectedResult, "Home is visible");
  assert.deepEqual(
    JSON.parse(testInfo.attachments.find(({ name }) => name === "test-case.json").body),
    originalCase
  );
  assert.deepEqual(
    JSON.parse(
      testInfo.attachments.find(({ name }) => name === "normalized-actions.json").body
    ),
    [{ action: "open_home" }]
  );
  assert.deepEqual(
    JSON.parse(
      testInfo.attachments.find(({ name }) => name === "test-case-result.json").body
    ),
    {
      testCaseId: "12066",
      name: "Compiled home case",
      status: "passed",
      source: "local",
      steps: [{
        index: 0,
        action: "open_home",
        status: "passed",
        durationMs: 0,
        message: "",
      }],
      expectedResult: "Home is visible",
    }
  );
  assert.equal(testInfo.attachments[0].contentType, "application/json");
  assert.equal(testInfo.attachments[1].contentType, "application/json");
});

test("creates exactly the default handlers and logs in with action credentials in helper order", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const options = {
    APP_URL: "https://example.test/",
    USERNAME: "environment-user",
    PASSWORD: "environment-password",
    source: "server",
  };
  const action = {
    action: "login",
    username: "case-user",
    password: "case-password",
  };
  const helpers = createHandlerHelpers({
    openAppAndEnterLoginPage: async (...args) => {
      calls.push(["openAppAndEnterLoginPage", ...args]);
    },
    loginWithAccount: async (...args) => {
      calls.push(["loginWithAccount", ...args]);
    },
    chooseFirstProfileAndEnterHome: async (...args) => {
      calls.push(["chooseFirstProfileAndEnterHome", ...args]);
    },
    closeHomePopupsAndVerifyHome: async (...args) => {
      calls.push(["closeHomePopupsAndVerifyHome", ...args]);
    },
  });
  const handlers = createDefaultActionHandlers({ helpers });
  const account = {
    ...options,
    USERNAME: action.username,
    PASSWORD: action.password,
  };

  assert.deepEqual(Object.keys(handlers).sort(), [
    "assert_screen",
    "focus_row",
    "focus_row_first_item",
    "focus_text",
    "login",
    "open_home",
    "open_search",
    "open_service",
    "play_content",
    "play_home_trailers",
    "play_row",
    "play_search_result",
    "press_back",
    "press_ok",
    "search_content",
    "wait_for_ready",
  ]);

  await handlers.login({ page, testInfo, action, options });

  assert.deepEqual(calls, [
    ["openAppAndEnterLoginPage", page, account, testInfo],
    ["loginWithAccount", page, account, testInfo],
    ["chooseFirstProfileAndEnterHome", page, testInfo],
    ["closeHomePopupsAndVerifyHome", page, testInfo],
  ]);
});

test("verifies a playback expectedResult after all actions complete", async () => {
  const waits = [];
  let playerReadyCalls = 0;
  const page = {
    id: "page",
    waitForTimeout: async (durationMs) => waits.push(durationMs),
  };
  const testInfo = createTestInfo();
  const helpers = createHandlerHelpers({
    waitForPlayerReady: async () => {
      playerReadyCalls += 1;
    },
  });

  const result = await runTestCase(page, testInfo, {
    id: "expected-player",
    name: "Expected player",
    expectedResult: "Phát phim thành công",
    actions: [{action: "open_home"}],
  }, {
    helpers,
    handlers: {open_home: async () => {}},
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.equal(playerReadyCalls, 0);
  assert.deepEqual(waits, [6000, 2000]);
  assert.equal(result.steps.at(-1).action, "expected_result");
  assert.deepEqual(result.steps.at(-1).result, {
    type: "player",
    verified: "Player is open and playing normally",
  });
});

test("treats a successful exhaustive play_row as the playback expected result", async () => {
  const result = await runTestCase({id: "page"}, createTestInfo(), {
    id: "expected-row-player",
    name: "Expected row playback",
    expectedResult: "Play bình thường",
    actions: [{action: "play_row", rowIndex: 2}],
  }, {
    helpers: createHandlerHelpers(),
    handlers: {
      play_row: async () => ({
        type: "play_row",
        results: [
          {index: 1, status: "playable"},
          {index: 2, status: "playable"},
        ],
      }),
    },
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(result.steps.at(-1).result, {
    type: "row_playback",
    verified: "All selected row posters were checked and returned to the row",
    itemCount: 2,
  });
});

test("uses a configured timeout for a playback expectedResult", async () => {
  const waits = [];
  const page = {
    waitForTimeout: async (durationMs) => waits.push(durationMs),
  };
  const result = await runTestCase(page, createTestInfo(), {
    id: "configured-player",
    name: "Configured player",
    expectedResult: "Phát phim thành công",
    actions: [{action: "open_home"}],
  }, {
    playerCheckTimeoutSeconds: 9,
    helpers: createHandlerHelpers(),
    handlers: {open_home: async () => {}},
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(waits, [9000, 2000]);
  assert.equal(result.steps.at(-1).status, "passed");
});

test("captures the player before returning after a player expected-result check", async () => {
  const events = [];
  const page = {
    waitForTimeout: async (durationMs) => events.push(`wait:${durationMs}`),
    screenshot: async () => Buffer.from("player-screen"),
  };
  const testInfo = createTestInfo();
  const helpers = createHandlerHelpers({
    remotePress: async (_page, key) => events.push(`press:${key}`),
  });

  const result = await runTestCase(page, testInfo, {
    id: "player-screenshot",
    name: "Player screenshot",
    expectedResult: "Phát phim thành công",
    actions: [{action: "open_home"}],
  }, {
    helpers,
    handlers: {open_home: async () => {}},
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(events, ["wait:6000", "press:Backspace", "wait:2000"]);
  assert.equal(result.completionScreenshotDataUrl, "data:image/png;base64,cGxheWVyLXNjcmVlbg==");
  assert.ok(testInfo.attachments.some((attachment) => attachment.name === "expected-player-check.png"));
});

test("returns from a completed player action before a non-player next step", async () => {
  const events = [];
  const page = {
    waitForTimeout: async (durationMs) => events.push(`wait:${durationMs}`),
  };
  const helpers = createHandlerHelpers({
    remotePress: async (_page, key) => events.push(`press:${key}`),
  });

  await runTestCase(page, createTestInfo(), {
    id: "player-action-return",
    name: "Player action returns",
    actions: [
      {action: "play_content", name: "VTV1 HD", type: "channel"},
      {action: "open_home"},
    ],
  }, {
    helpers,
    handlers: {
      play_content: async () => events.push("play"),
      open_home: async () => events.push("home"),
    },
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(events, ["play", "press:Backspace", "home"]);
});

test("returns from a final player action before waiting for the player session cleanup", async () => {
  const events = [];
  const page = {
    waitForTimeout: async (durationMs) => events.push(`wait:${durationMs}`),
  };
  const helpers = createHandlerHelpers({
    remotePress: async (_page, key) => events.push(`press:${key}`),
  });

  await runTestCase(page, createTestInfo(), {
    id: "final-player-action-return",
    name: "Final player action returns",
    actions: [{action: "play_content", name: "VTV1 HD", type: "channel"}],
  }, {
    helpers,
    handlers: {play_content: async () => events.push("play")},
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(events, ["play", "press:Backspace", "wait:2000"]);
});

test("accepts a verified service expectedResult after a successful service action", async () => {
  const helpers = createHandlerHelpers({
    assertServiceOpened: async () => ({
      type: "service",
      service: "Phim truyện",
      route: "movie",
      rowCount: 2,
      visibleCount: 8,
      verified: "Service opened to a non-Home screen with visible content rows",
    }),
  });
  const result = await runTestCase({id: "page"}, createTestInfo(), {
    id: "expected-service",
    name: "Expected service",
    expectedResult: "Vào màn hình dịch vụ phim truyện thành công",
    actions: [{action: "open_service", service: "Phim truyện"}],
  }, {
    helpers,
    handlers: createDefaultActionHandlers({helpers}),
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.equal(result.steps.at(-1).action, "expected_result");
  assert.deepEqual(result.steps.at(-1).result, {
    type: "service",
    service: "Phim truyện",
    route: "movie",
    rowCount: 2,
    visibleCount: 8,
    verified: "Service opened to a non-Home screen with visible content rows",
  });
});

test("accepts a service expectedResult after entering through the home Thể loại row", async () => {
  const helpers = createHandlerHelpers({
    focusRequestedContentRow: async () => ({title: "Thể loại", items: []}),
    assertServiceOpened: async () => ({
      type: "service",
      service: "Truyền hình",
      route: "television",
      rowCount: 3,
      visibleCount: 12,
      verified: "Service opened to a non-Home screen with visible content rows",
    }),
  });
  const result = await runTestCase({id: "page"}, createTestInfo(), {
    id: "expected-home-row-service",
    name: "Expected home-row service",
    expectedResult: "Vào chuyên mục Truyền hình bình thường",
    actions: [
      {action: "focus_row", rowName: "Thể loại"},
      {action: "focus_text", text: "Truyền hình"},
      {action: "press_ok"},
    ],
  }, {
    helpers,
    handlers: createDefaultActionHandlers({helpers}),
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.equal(result.steps.at(-1).action, "expected_result");
  assert.deepEqual(result.steps.at(-1).result, {
    type: "service",
    service: "Truyền hình",
    route: "television",
    rowCount: 3,
    visibleCount: 12,
    verified: "Service opened to a non-Home screen with visible content rows",
  });
});

test("accepts a view-more expectedResult only after the destination check", async () => {
  const calls = [];
  const testInfo = createTestInfo();
  const row = {
    title: "Phim mới nhất",
    rowY: 500,
    items: [{id: "movie-1", title: "Movie 1"}],
  };
  const viewMoreResult = {
    type: "view_more",
    label: "Xem tất cả",
    rowName: "Phim mới nhất",
    route: "movie-grid",
    rowCount: 2,
    visibleCount: 12,
    verified: "View-more poster opened to a non-Home screen with visible content rows",
  };
  const helpers = createHandlerHelpers({
    focusRequestedContentRow: async (...args) => {
      calls.push(["row", ...args]);
      return row;
    },
    focusViewMorePosterInCurrentRow: async (...args) => {
      calls.push(["focus", ...args]);
      return {isViewMore: true, id: "view-more", title: ""};
    },
    assertViewMoreOpened: async (...args) => {
      calls.push(["verify", ...args]);
      return viewMoreResult;
    },
  });
  const result = await runTestCase({id: "page"}, testInfo, {
    id: "expected-view-more",
    name: "Expected view-more destination",
    expectedResult: "Vào item \"Xem tất cả\" bình thường",
    actions: [
      {action: "focus_row", rowName: "Phim mới nhất"},
      {action: "focus_text", text: "Xem tất cả"},
      {action: "press_ok"},
    ],
  }, {
    helpers,
    handlers: createDefaultActionHandlers({helpers}),
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  assert.deepEqual(calls, [
    ["row", {id: "page"}, {rowName: "Phim mới nhất"}],
    ["focus", {id: "page"}, row, {targetLabel: "Xem tất cả"}],
    ["verify", {id: "page"}, {rowName: "Phim mới nhất", label: "Xem tất cả", testInfo}],
  ]);
  assert.equal(result.steps.at(-1).action, "expected_result");
  assert.deepEqual(result.steps.at(-1).result, viewMoreResult);
});

test("records a failed expectedResult when the player is not ready", async () => {
  let error;
  try {
    await runTestCase({id: "page", waitForTimeout: async () => {}}, createTestInfo(), {
      id: "expected-player-failure",
      name: "Expected player failure",
      expectedResult: "Play bình thường",
      actions: [{action: "open_home"}],
    }, {
      helpers: createHandlerHelpers({
        getPlayerState: async () => ({
          hasVideo: true,
          isProbablyPlaying: false,
          reason: "player did not start",
        }),
      }),
      handlers: {open_home: async () => {}},
      stepRunner: async (_page, _testInfo, _label, callback) => callback(),
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.match(error.message, /Player check failed after 6 seconds: player state was not healthy: player did not start/);
  assert.equal(error.testCaseResult.status, "failed");
  assert.equal(error.testCaseResult.steps.at(-1).action, "expected_result");
  assert.equal(error.testCaseResult.steps.at(-1).message, error.message);
});

test("captures the failed player screen before returning to the previous screen", async () => {
  const events = [];
  const page = {
    waitForTimeout: async (durationMs) => events.push(`wait:${durationMs}`),
    screenshot: async () => Buffer.from("failed-player-screen"),
  };
  const testInfo = createTestInfo();
  const helpers = createHandlerHelpers({
    getPlayerState: async () => ({
      hasVideo: true,
      isProbablyPlaying: false,
      reason: "player popup remained visible",
    }),
    remotePress: async (_page, key) => events.push(`press:${key}`),
  });
  let error;

  try {
    await runTestCase(page, testInfo, {
      id: "expected-player-failure-screenshot",
      name: "Expected player failure screenshot",
      expectedResult: "Play bình thường",
      actions: [{action: "open_home"}],
    }, {
      helpers,
      handlers: {open_home: async () => {}},
      stepRunner: async (_page, _testInfo, _label, callback) => callback(),
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.match(error.message, /Player check failed after 6 seconds: player state was not healthy: player popup remained visible/);
  assert.deepEqual(events, ["wait:6000", "press:Backspace", "wait:2000"]);
  assert.equal(
    error.testCaseResult.completionScreenshotDataUrl,
    "data:image/png;base64,ZmFpbGVkLXBsYXllci1zY3JlZW4="
  );
  assert.ok(testInfo.attachments.some((attachment) => attachment.name === "expected-player-check.png"));
});

test("attaches the requested parser failure reason to the failed case result", async () => {
  let error;
  try {
    await runTestCase({}, createTestInfo(), {
      id: "unknown-step",
      name: "Unknown step",
      qaDescription: "B1. Làm một thao tác không được hỗ trợ",
    }, {
      helpers: createHandlerHelpers(),
      stepRunner: async (_page, _testInfo, _label, callback) => callback(),
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.match(error.message, /Không thể parse được bước: B1\. Làm một thao tác không được hỗ trợ/);
  assert.equal(error.testCaseResult.steps[0].action, "compile");
  assert.equal(
    error.testCaseResult.steps[0].message,
    "Không thể parse được bước: B1. Làm một thao tác không được hỗ trợ"
  );
});

test("focuses a requested visible text target through remote navigation", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      remoteFocusByText: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};

  await handlers.focus_text({
    page,
    action: {action: "focus_text", text: "Xem ngay"},
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], page);
  assert.equal(calls[0][1].test("Xem ngay"), true);
  assert.equal(calls[0][1].test("Xem ngay now"), false);
});

test("focuses each supported view-more label through the selected row marker", async () => {
  for (const label of ["Xem tất cả", "Xem thêm", "View more"]) {
    const calls = [];
    const page = {id: "page"};
    const testInfo = {id: "test-info"};
    const row = {
      title: "Phim mới nhất",
      rowY: 500,
      items: [{id: "movie-1", title: "Movie 1"}],
    };
    const helpers = createHandlerHelpers({
      focusRequestedContentRow: async (...args) => {
        calls.push(["row", ...args]);
        return row;
      },
      focusViewMorePosterInCurrentRow: async (...args) => {
        calls.push(["view-more", ...args]);
        return {isViewMore: true, id: "view-more", title: ""};
      },
      remoteFocusByText: async (...args) => calls.push(["text", ...args]),
      remotePress: async (...args) => calls.push(["press", ...args]),
      assertViewMoreOpened: async (...args) => {
        calls.push(["verify", ...args]);
        return {
          type: "view_more",
          label,
          rowName: row.title,
          route: "view-more",
          rowCount: 1,
          visibleCount: 6,
        };
      },
    });
    const handlers = createDefaultActionHandlers({helpers});

    await handlers.focus_row({page, action: {action: "focus_row", rowName: row.title}});
    await handlers.focus_text({page, action: {action: "focus_text", text: label}});
    await handlers.press_ok({page, testInfo, action: {action: "press_ok"}});

    assert.equal(calls.some(([kind]) => kind === "text"), false);
    assert.deepEqual(calls.map(([kind, ...args]) => [kind, ...args]), [
      ["row", page, {rowName: row.title}],
      ["view-more", page, row, {targetLabel: label}],
      ["press", page, "Enter"],
      ["verify", page, {rowName: row.title, label, testInfo}],
    ]);
  }
});

test("fails closed when a view-more label is requested without a focused row", async () => {
  let viewMoreCalls = 0;
  let textCalls = 0;
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusViewMorePosterInCurrentRow: async () => {
        viewMoreCalls += 1;
      },
      remoteFocusByText: async () => {
        textCalls += 1;
      },
    }),
  });

  await assert.rejects(
    () => handlers.focus_text({page: {id: "page"}, action: {action: "focus_text", text: "Xem thêm"}}),
    /Không thể focus poster view more "Xem thêm": cần focus_row trước/
  );
  assert.equal(viewMoreCalls, 0);
  assert.equal(textCalls, 0);
});

test("propagates a failed view-more destination check after Enter", async () => {
  const destinationError = new Error("View-more poster failed: tooltip shown");
  const row = {
    title: "Phim mới nhất",
    items: [{id: "movie-1", title: "Movie 1"}],
  };
  let pressCount = 0;
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusRequestedContentRow: async () => row,
      focusViewMorePosterInCurrentRow: async () => ({isViewMore: true, id: "view-more"}),
      remotePress: async () => {
        pressCount += 1;
      },
      assertViewMoreOpened: async () => {
        throw destinationError;
      },
    }),
  });
  const page = {id: "page"};

  await handlers.focus_row({page, action: {action: "focus_row", rowName: row.title}});
  await handlers.focus_text({page, action: {action: "focus_text", text: "Xem tất cả"}});

  await assert.rejects(
    () => handlers.press_ok({page, testInfo: createTestInfo(), action: {action: "press_ok"}}),
    destinationError
  );
  assert.equal(pressCount, 1);
});

test("focuses the first poster in the requested content row", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusRequestedContentRow: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};

  await handlers.focus_row({
    page,
    action: {action: "focus_row", rowName: "Thịnh hành"},
  });

  assert.deepEqual(calls, [[page, {rowName: "Thịnh hành"}]]);
});

test("scans the selected Thể loại row for a requested service before the left menu", async () => {
  const calls = [];
  const page = {id: "page"};
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusRequestedContentRow: async () => ({
        title: "Thể loại",
        items: [
          {id: "service-world-cup", title: "World Cup 2026"},
        ],
      }),
      focusServiceCategoryItem: async (...args) => calls.push(["category", ...args]),
      remoteFocusById: async (...args) => calls.push(["id", ...args]),
      remoteFocusByText: async (...args) => calls.push(["text", ...args]),
    }),
  });

  await handlers.focus_row({page, action: {action: "focus_row", rowName: "Thể loại"}});
  await handlers.focus_text({page, action: {action: "focus_text", text: "Thiếu nhi"}});

  assert.deepEqual(calls, [["category", page, "Thiếu nhi", {
    initialRow: {
      title: "Thể loại",
      items: [{id: "service-world-cup", title: "World Cup 2026"}],
    },
  }]]);
});

test("focuses a requested numbered poster in the named content row", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusRequestedContentRow: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};

  await handlers.focus_row({
    page,
    action: {action: "focus_row", rowName: "HTV", itemIndex: 4},
  });

  assert.deepEqual(calls, [[page, {rowName: "HTV", itemIndex: 4}]]);
});

test("focuses the first item in the currently active row", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      focusFirstItemInCurrentContentRow: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};

  await handlers.focus_row_first_item({
    page,
    action: {action: "focus_row_first_item"},
  });

  assert.deepEqual(calls, [[page]]);
});

test("presses remote OK through the shared remote key primitive", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      remotePress: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};

  await handlers.press_ok({page, action: {action: "press_ok"}});

  assert.deepEqual(calls, [[page, "Enter"]]);
});

test("opens a service with the action service and test context", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const helpers = createHandlerHelpers({
    openServiceFromLeftMenuOrAllServices: async (...args) => {
      calls.push(args);
    },
  });
  const handlers = createDefaultActionHandlers({ helpers });

  await handlers.open_service({
    page,
    testInfo,
    action: { action: "open_service", service: "Phim truyện" },
  });

  assert.deepEqual(calls, [[page, "Phim truyện", testInfo, {activationDelay: 0}]]);
});

test("checks that a clicked service opened content rather than only accepting the Enter press", async () => {
  const calls = [];
  const page = {id: "page"};
  const testInfo = {id: "test-info"};
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      openServiceFromLeftMenuOrAllServices: async (...args) => calls.push(["open", ...args]),
      assertServiceOpened: async (...args) => calls.push(["verify", ...args]),
    }),
  });

  await handlers.open_service({
    page,
    testInfo,
    action: {action: "open_service", service: "Phim truyện"},
  });

  assert.deepEqual(calls, [
    ["open", page, "Phim truyện", testInfo, {activationDelay: 0}],
    ["verify", page, {service: "Phim truyện", testInfo}],
  ]);
});

test("reports the requested service name when service navigation fails", async () => {
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      openServiceFromLeftMenuOrAllServices: async () => {
        throw new Error("Could not focus target with remote keys");
      },
    }),
  });

  await assert.rejects(
    handlers.open_service({
      page: {id: "page"},
      testInfo: {id: "test-info"},
      action: {action: "open_service", service: "kênh"},
    }),
    /Không thể tìm thấy dịch vụ kênh/u
  );
});

test("maps kênh service requests to the Truyền hình service alias", () => {
  assert.deepEqual(workflows.__internal.getServiceSearchNames("kênh"), [
    "Truyền hình",
    "kênh",
  ]);
  assert.deepEqual(workflows.__internal.getServiceSearchNames("Phim truyện"), [
    "Phim truyện",
  ]);
});

test("opens search and searches content through the default handlers", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      openSearchFromLeftMenu: async (...args) => calls.push(["open", ...args]),
      searchContentByName: async (...args) => calls.push(["search", ...args]),
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  await handlers.open_search({page, testInfo, action: {action: "open_search"}});
  await handlers.search_content({
    page,
    testInfo,
    action: {action: "search_content", name: "Căn phòng tử thần", type: "movie"},
  });

  assert.deepEqual(calls, [
    ["open", page, testInfo],
    ["search", page, {name: "Căn phòng tử thần", type: "movie"}, testInfo],
  ]);
});

test("plays the focused search result through the default handler", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      playFocusedSearchResult: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  await handlers.play_search_result({
    page,
    testInfo,
    action: {action: "play_search_result", type: "movie"},
  });

  assert.deepEqual(calls, [[page, testInfo, {type: "movie"}]]);
});

test("plays a named visible content item with its type", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      playVisibleContentByName: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  await handlers.play_content({
    page,
    testInfo,
    action: {action: "play_content", name: "VTV1 HD", type: "channel"},
  });

  assert.deepEqual(calls, [[page, testInfo, {name: "VTV1 HD", type: "channel"}]]);
});

test("plays a requested row using either its 1-based index or name", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers({
      playItemsInRow: async (...args) => calls.push(args),
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  await handlers.play_row({
    page,
    testInfo,
    action: {action: "play_row", rowIndex: 2, count: 3},
  });
  await handlers.play_row({
    page,
    testInfo,
    action: {action: "play_row", rowName: "VTV"},
  });

  assert.deepEqual(calls, [
    [page, testInfo, {rowIndex: 2, rowName: undefined, count: 3}],
    [page, testInfo, {rowIndex: undefined, rowName: "VTV", count: undefined}],
  ]);
});

test("formats row playback failures with content IDs and names", () => {
  const summary = workflows.__internal.formatRowPlaybackFailureSummary([
    {contentId: "158218", name: "Ăn Chạy Yêu"},
    {attributes: {content_id: "155230"}, title: "Yêu Em"},
  ]);

  assert.equal(summary, "1. 158218 - Ăn Chạy Yêu\n2. 155230 - Yêu Em");
});

test("plays every Home trailer through the helper and preserves its result", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    playerCheckTimeoutSeconds: 9,
    helpers: createHandlerHelpers({
      playAllHomeTrailers: async (...args) => {
        calls.push(args);
        return {results: [{name: "Trailer A", status: "playable"}]};
      },
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  const stepResult = await handlers.play_home_trailers({page, testInfo, action: {action: "play_home_trailers"}});

  assert.deepEqual(calls, [[page, testInfo, {waitSeconds: 9}]]);
  assert.deepEqual(stepResult, {results: [{name: "Trailer A", status: "playable"}]});
});

test("passes the configured player timeout to every Browser playback action", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    playerCheckTimeoutSeconds: 11,
    helpers: createHandlerHelpers({
      playFocusedSearchResult: async (...args) => calls.push(["search", ...args]),
      playVisibleContentByName: async (...args) => calls.push(["content", ...args]),
      playItemsInRow: async (...args) => calls.push(["row", ...args]),
      playAllHomeTrailers: async (...args) => calls.push(["home-trailers", ...args]),
    }),
  });
  const page = {id: "page"};
  const testInfo = {id: "test-info"};

  await handlers.play_search_result({page, testInfo, action: {action: "play_search_result", type: "movie"}});
  await handlers.play_content({page, testInfo, action: {action: "play_content", name: "VTV1 HD", type: "channel"}});
  await handlers.play_row({page, testInfo, action: {action: "play_row", rowIndex: 1}});
  await handlers.play_home_trailers({page, testInfo, action: {action: "play_home_trailers"}});

  assert.deepEqual(calls, [
    ["search", page, testInfo, {type: "movie", waitSeconds: 11}],
    ["content", page, testInfo, {name: "VTV1 HD", type: "channel", waitSeconds: 11}],
    ["row", page, testInfo, {rowIndex: 1, rowName: undefined, count: undefined, waitSeconds: 11}],
    ["home-trailers", page, testInfo, {waitSeconds: 11}],
  ]);
});

test("presses Backspace sequentially for every requested back press", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    keyboard: {
      async press(key) {
        events.push(`start:${key}`);
        await Promise.resolve();
        events.push(`end:${key}`);
      },
    },
  };

  await handlers.press_back({
    page,
    action: { action: "press_back", count: 3 },
  });

  assert.deepEqual(events, [
    "start:Backspace",
    "end:Backspace",
    "start:Backspace",
    "end:Backspace",
    "start:Backspace",
    "end:Backspace",
  ]);
});

test("presses Backspace once when the action count is omitted", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    keyboard: {
      async press(key) {
        events.push(key);
      },
    },
  };

  await handlers.press_back({
    page,
    action: { action: "press_back" },
  });

  assert.deepEqual(events, ["Backspace"]);
});

test("does not press Backspace when the action count is zero", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({helpers: createHandlerHelpers()});
  await handlers.press_back({
    page: {keyboard: {press: async (key) => events.push(key)}},
    action: {action: "press_back", count: 0},
  });
  assert.deepEqual(events, []);
});

test("asserts that the page body contains the requested screen text", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    async evaluate(callback, expected) {
      calls.push([callback, expected]);
      return true;
    },
  };

  await handlers.assert_screen({
    page,
    action: { action: "assert_screen", text: "Trang chủ" },
  });

  assert.equal(typeof calls[0][0], "function");
  assert.equal(calls[0][1], "trang chu");
});

test("rejects screen text that exists only in hidden content", async () => {
  const page = {
    async evaluate() {
      return false;
    },
  };

  await assert.rejects(
    () => assertVisibleScreenText(page, "Trang chủ", {timeoutMs: 1, pollIntervalMs: 1}),
    /Timeout.*predicate|Expected: true/s
  );
});

test("retries screen assertions while the page becomes ready", async () => {
  let evaluations = 0;
  const page = {
    async evaluate() {
      evaluations += 1;
      return evaluations > 1;
    },
  };

  await assertVisibleScreenText(page, "Trang chủ", {timeoutMs: 1000, pollIntervalMs: 1});
  assert.ok(evaluations > 1);
});

test("retries screen assertions after a transient navigation evaluation error", async () => {
  let evaluations = 0;
  const page = {
    async evaluate() {
      evaluations += 1;
      if (evaluations === 1) throw new Error("Execution context was destroyed");
      return true;
    },
  };

  await assertVisibleScreenText(page, "Trang chủ", {timeoutMs: 1000, pollIntervalMs: 1});
  assert.ok(evaluations > 1);
});

test("waits for app readiness through the workflow helper", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const restore = replaceWorkflowInternals({
    waitForAppReady: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({
      helpers: createHandlerHelpers(),
    });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "app" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, testInfo]]);
});

test("waits for home readiness through the workflow helper", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const restore = replaceWorkflowInternals({
    waitForHomeReady: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({
      helpers: createHandlerHelpers(),
    });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "home" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, testInfo]]);
});

test("waits for content readiness with the visible-content observer", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const getContentState = async () => ({ visible: true });
  const restore = replaceWorkflowInternals({ observeVisibleContentRows: getContentState });
  const helpers = createHandlerHelpers({
    waitForContentVisible: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({ helpers });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "content" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, {
    name: "action-content-ready",
    testInfo,
    getContentState,
    getFocusedState: helpers.getFocusedState,
  }]]);
});

test("waits for player readiness with MyTV popup and player observers", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const getVisiblePopup = async () => null;
  const getPlayerState = async () => ({
    hasVideo: true,
    isProbablyPlaying: true,
  });
  const helpers = createHandlerHelpers({
    waitForPlayerReady: async (...args) => {
      calls.push(args);
    },
    getPlayerState,
    __internal: { getVisiblePopup },
  });
  const handlers = createDefaultActionHandlers({ helpers });

  await handlers.wait_for_ready({
    page,
    testInfo,
    action: { action: "wait_for_ready", name: "player" },
  });

  assert.deepEqual(calls, [[page, {
    name: "action-player-ready",
    testInfo,
    getVisiblePopup,
    getPlayerState,
  }]]);
});

test("rejects unsupported readiness targets", async () => {
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });

  await assert.rejects(
    () =>
      handlers.wait_for_ready({
        action: { action: "wait_for_ready", name: "unknown" },
      }),
    /Unsupported readiness target: unknown/
  );
});

test("runTestCase uses default handlers through the existing helpers.runStep", async () => {
  const events = [];
  const page = { id: "page" };
  const testInfo = createTestInfo();
  const originalRunStep = defaultHelpers.runStep;
  const restore = replaceWorkflowInternals({
    waitForHomeReady: async (...args) => {
      events.push(["waitForHomeReady", ...args]);
    },
  });
  defaultHelpers.runStep = async (_page, _testInfo, label, callback) => {
    events.push(["runStep", _page, _testInfo, label]);
    return callback();
  };

  try {
    const result = await runTestCase(page, testInfo, {
      id: "default-runner",
      name: "Default runner",
      actions: [{ action: "open_home" }],
    });

    assert.deepEqual(events, [
      ["runStep", page, testInfo, "open_home"],
      ["waitForHomeReady", page, testInfo],
    ]);
    assert.equal(result.status, "passed");
  } finally {
    defaultHelpers.runStep = originalRunStep;
    restore();
  }
});
