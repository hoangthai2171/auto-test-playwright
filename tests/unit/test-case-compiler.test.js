const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compileTestCase,
  compileQaDescription,
} = require("../lib/test-case-compiler");

test("compiles a test case while preserving server metadata and actions", () => {
  const testCase = {
    id: "12066",
    name: "Vào phim truyện",
    qaDescription: "B1. Vào dịch vụ phim truyện",
    actions: [{ action: "open_service", service: "Phim truyện" }],
  };

  const compiled = compileTestCase(testCase);

  assert.equal(compiled.id, testCase.id);
  assert.equal(compiled.name, testCase.name);
  assert.equal(compiled.qaDescription, testCase.qaDescription);
  assert.deepEqual(compiled.actions, testCase.actions);
});

test("compiles login, home, and service Vietnamese steps", () => {
  const result = compileQaDescription(
    "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ\nB3. Vào dịch vụ phim truyện"
  );

  assert.deepEqual(result, [
    { action: "login", username: "ts1", password: "111222" },
    { action: "open_home" },
    { action: "open_service", service: "phim truyện" },
  ]);
});

test("compiles the VIP MAX trailer focus flow from qaDescription", () => {
  assert.deepEqual(
    compileQaDescription(
      "B1. Đăng nhập tài khoản gói VIP MAX: tên TK 0913476477, pass 0913476477\n" +
      "B2. Vào màn hình trang chủ ứng dụng\n" +
      "B3. Di chuyển đến focus vào poster đầu tiên của mục \"Thịnh hành\"\n" +
      "B4. Nhấn chọn OK",
      {caseId: "vip-max-trailer-focus"}
    ),
    [
      {action: "login", username: "0913476477", password: "0913476477"},
      {action: "open_home"},
      {action: "focus_row", rowName: "Thịnh hành"},
      {action: "press_ok"},
    ]
  );
});

test("ignores the OPEN MAX package name in a direct login description", () => {
  assert.deepEqual(
    compileQaDescription("B1. Đăng nhập tài khoản OPEN MAX 0913476477 pass 0913476477"),
    [{action: "login", username: "0913476477", password: "0913476477"}]
  );
});

test("compiles the dòng cate row-focus wording", () => {
  assert.deepEqual(
    compileQaDescription(
      'B3. Di chuyển đến dòng cate: "Kênh đề xuất"\n' +
      "B4. Di chuyển focus đến 1 kênh đầu tiên bên trái"
    ),
    [
      {action: "focus_row", rowName: "Kênh đề xuất"},
      {action: "focus_row_first_item"},
    ]
  );
});

test("focuses a named dòng cate on the current page without requiring a colon", () => {
  assert.deepEqual(
    compileQaDescription('B2. Di chuyển đến dòng cate "Thể loại"'),
    [{action: "focus_row", rowName: "Thể loại"}]
  );
});

test("compiles the view-more focus wording used by row navigation cases", () => {
  assert.deepEqual(
    compileQaDescription(
      "B1. Đăng nhập vào app với tài khoản ts1/111222\n" +
      "B2. Vào trang chủ ứng dụng\n" +
      'B3. Di chuyển đến dòng cate "Phim mới nhất"\n' +
      'B4. Di chuyển và focus vào item "Xem tất cả"\n' +
      "B5. Chọn OK"
    ),
    [
      {action: "login", username: "ts1", password: "111222"},
      {action: "open_home"},
      {action: "focus_row", rowName: "Phim mới nhất"},
      {action: "focus_text", text: "Xem tất cả"},
      {action: "press_ok"},
    ]
  );
});

test("compiles the category-service-subcategory navigation flow", () => {
  assert.deepEqual(
    compileQaDescription(
      'B2. Di chuyển đến dòng cate "Thể loại"\n' +
      'B3. Focus vào mục "Truyền hình"\n' +
      "B4. Bấm chọn OK\n" +
      'B5. Di chuyển đến subcate "HTV"\n' +
      'B6. Di chuyển focus vào poster kênh đầu tiên bên trái của dòng subcate "HTV"\n' +
      "B7. Bấm chọn OK"
    ),
    [
      {action: "focus_row", rowName: "Thể loại"},
      {action: "focus_text", text: "Truyền hình"},
      {action: "press_ok"},
      {action: "focus_row", rowName: "HTV"},
      {action: "focus_row_first_item"},
      {action: "press_ok"},
    ]
  );
});

test("compiles a numbered poster focus in a named subcategory row", () => {
  assert.deepEqual(
    compileQaDescription(
      'B5. Di chuyển đến subcate "HTV"\n' +
      'B6. Di chuyển focus vào poster kênh thứ 4 của dòng subcate "HTV"'
    ),
    [
      {action: "focus_row", rowName: "HTV"},
      {action: "focus_row", rowName: "HTV", itemIndex: 4},
    ]
  );
});

test("compiles all equivalent OK and Enter button phrasings", () => {
  const lines = [
    "B1. Bấm phím OK",
    "B2. Chọn phím OK",
    "B3. Nhấn phím OK",
    "B4. Bấm enter",
    "B5. Chọn enter",
    "B6. Nhấn enter",
  ];

  assert.deepEqual(
    compileQaDescription(lines.join("\n")),
    lines.map(() => ({action: "press_ok"}))
  );
});

test("compiles named content playback steps", () => {
  assert.deepEqual(
    compileQaDescription('B1. Phát kênh "VTV1 HD"\nB2. Phát phim "Dune"\nB3. Phát nội dung "Tin tức"'),
    [
      {action: "play_content", name: "VTV1 HD", type: "channel"},
      {action: "play_content", name: "Dune", type: "movie"},
      {action: "play_content", name: "Tin tức", type: "content"},
    ]
  );
});

test("compiles global search and play-found-content steps", () => {
  assert.deepEqual(
    compileQaDescription(
      'B1. Vào trang tìm kiếm nội dung\n' +
      'B2. Tìm phim "Căn phòng tử thần"\n' +
      'B3. Phát phim tìm được'
    ),
    [
      {action: "open_search"},
      {action: "search_content", name: "Căn phòng tử thần", type: "movie"},
      {action: "play_search_result", type: "movie"},
    ]
  );
});

test("compiles all and limited row playback steps with 1-based row indexes", () => {
  assert.deepEqual(
    compileQaDescription(
      'B1. Phát toàn bộ nội dung của hàng cate thứ 2\n' +
      'B2. Phát 3 nội dung kênh của hàng cate "VTV"\n' +
      'B3. Play 4 nội dung phim của hàng cate thứ 2\n' +
      'B4. Play tất cả nội dung phim của hàng cate "Phim song song"'
    ),
    [
      {action: "play_row", rowIndex: 2},
      {action: "play_row", count: 3, rowName: "VTV"},
      {action: "play_row", count: 4, rowIndex: 2},
      {action: "play_row", rowName: "Phim song song"},
    ]
  );
});

test("compiles list-page playback steps with poster and row bounds", () => {
  assert.deepEqual(
    compileQaDescription(
      "B1. Play toàn bộ nội dung trong danh sách\n" +
      "B2. Phát tất cả nội dung trong trang danh sách\n" +
      "B3. Play 3 dòng đầu tiên trong danh sách\n" +
      "B4. Phát 10 poster đầu tiên trong danh sách\n" +
      "B5. Play 5 nội dung đầu trong danh sách"
    ),
    [
      {action: "play_all_contents"},
      {action: "play_all_contents"},
      {action: "play_all_contents", rowCount: 3},
      {action: "play_all_contents", count: 10},
      {action: "play_all_contents", count: 5},
    ]
  );
});

test("accepts every list content noun for the all and counted forms", () => {
  const nouns = ["nội dung", "poster", "phim", "kênh", "short"];

  assert.deepEqual(
    compileQaDescription(nouns.map((noun) => `Play toàn bộ ${noun} trong danh sách`).join("\n")),
    nouns.map(() => ({action: "play_all_contents"}))
  );
  assert.deepEqual(
    compileQaDescription(nouns.map((noun) => `Play 4 ${noun} đầu tiên trong danh sách`).join("\n")),
    nouns.map(() => ({action: "play_all_contents", count: 4}))
  );
});

test("compiles the view-more list description into focus, OK and list playback", () => {
  assert.deepEqual(
    compileQaDescription(
      "B1. Đăng nhập vào app với tài khoản ts1/111222\n" +
      "B2. Vào trang chủ ứng dụng\n" +
      'B3. Di chuyển đến dòng cate "Thể loại"\n' +
      'B4. Chọn vào item "Phim truyện"\n' +
      "B5. Bấm OK\n" +
      'B6. Di chuyển đến dòng cate "Phim gì tối nay"\n' +
      'B7. Bấm vào poster "Xem tất cả"\n' +
      "B8. Play toàn bộ nội dung trong danh sách",
      {caseId: "list-page-case"}
    ),
    [
      {action: "login", username: "ts1", password: "111222"},
      {action: "open_home"},
      {action: "focus_row", rowName: "Thể loại"},
      {action: "focus_text", text: "Phim truyện"},
      {action: "press_ok"},
      {action: "focus_row", rowName: "Phim gì tối nay"},
      {action: "focus_text", text: "Xem tất cả"},
      {action: "press_ok"},
      {action: "play_all_contents"},
    ]
  );
});

test("never activates a pressed poster twice when the OK step is spelled out", () => {
  assert.deepEqual(
    compileQaDescription(
      'B1. Bấm vào poster "Xem tất cả"\n' +
      "B2. Nhấn OK\n" +
      'B3. Chọn vào item "Phim truyện"'
    ),
    [
      {action: "focus_text", text: "Xem tất cả"},
      {action: "press_ok"},
      {action: "focus_text", text: "Phim truyện"},
      {action: "press_ok"},
    ]
  );
});

test("preserves the original line when list-page wording is incomplete", () => {
  const originalLine = "B1. Play toàn bộ nội dung";

  assert.throws(
    () => compileQaDescription(originalLine, {caseId: "list-page-near-miss"}),
    (error) => error.message.includes(originalLine)
  );
});

test("compiles all Home-trailer wording variants to one action", () => {
  const verbs = ["Chạy", "Phát", "Play"];
  const quantities = ["toàn bộ", "tất cả", "các"];
  const spellings = ["trailer", "trailler"];
  const locations = ["ở trang chủ", "trên trang chủ", "tại Home"];
  const lines = verbs.flatMap((verb) => quantities.flatMap((quantity) =>
    spellings.map((spelling, index) =>
      `${verb} ${quantity} ${spelling} ${locations[index % locations.length]}.`
    )
  ));

  assert.deepEqual(
    compileQaDescription(lines.join("\n")),
    lines.map(() => ({action: "play_home_trailers"}))
  );
});

test("preserves the original line when Home-trailer wording is incomplete", () => {
  const originalLine = "B1. Play tất cả phim ở trang chủ";

  assert.throws(
    () => compileQaDescription(originalLine, {caseId: "home-trailer-near-miss"}),
    /Không thể parse được bước: B1\. Play tất cả phim ở trang chủ/i
  );
});

test("compiles the description when actions is an empty array", () => {
  const result = compileTestCase({
    id: "2",
    name: "Description fallback",
    qaDescription: "B1. Vào trang chủ",
    actions: [],
  });

  assert.deepEqual(result.actions, [{ action: "open_home" }]);
});

test("compiles the description when API actions are null", () => {
  const result = compileTestCase({
    id: "null-actions",
    name: "Description fallback",
    qaDescription: "B1. Vào trang chủ",
    actions: null,
  });

  assert.deepEqual(result.actions, [{ action: "open_home" }]);
});

test("rejects an empty action list without a description using the case id", () => {
  assert.throws(
    () =>
      compileTestCase({
        id: "empty-actions-case",
        name: "Empty actions",
        actions: [],
      }),
    /empty-actions-case.*actions/i
  );
});

test("does not parse a description when explicit actions are present", () => {
  const result = compileTestCase({
    id: "1",
    name: "Explicit",
    qaDescription: "B1. unsupported text",
    actions: [{ action: "open_home" }],
  });

  assert.deepEqual(result.actions, [{ action: "open_home" }]);
});

test("reports the requested parser failure reason and original line", () => {
  assert.throws(
    () =>
      compileTestCase({
        id: "12066",
        name: "Unsupported",
        qaDescription: "B1. Xóa toàn bộ dữ liệu",
      }),
    /Không thể parse được bước: B1\. Xóa toàn bộ dữ liệu/i
  );
});

test("compiles every supported back and readiness form", () => {
  const result = compileQaDescription(
    "B1. Quay lại\nB2. Quay về\nB3. Nhấn back\nB4. Chờ app\nB5. Chờ home\nB6. Chờ content\nB7. Chờ player"
  );

  assert.deepEqual(result, [
    { action: "press_back" },
    { action: "press_back" },
    { action: "press_back" },
    { action: "wait_for_ready", name: "app" },
    { action: "wait_for_ready", name: "home" },
    { action: "wait_for_ready", name: "content" },
    { action: "wait_for_ready", name: "player" },
  ]);
});

test("accepts terminal punctuation for parameterless commands", () => {
  assert.deepEqual(
    compileQaDescription("B1. Vào trang chủ app.\nB2. Quay lại!\nB3. Chờ home?"),
    [
      {action: "open_home"},
      {action: "press_back"},
      {action: "wait_for_ready", name: "home"},
    ]
  );
});

test("preserves literal punctuation in credential and service values", () => {
  const result = compileQaDescription(
    "B1. Đăng nhập app với tài khoản User_Đ/PaSS123.\nB2. Vào dịch vụ VTVcab ON)."
  );

  assert.deepEqual(result, [
    { action: "login", username: "User_Đ", password: "PaSS123." },
    { action: "open_service", service: "VTVcab ON)." },
  ]);
});

test("compiles the provided trang chu app form", () => {
  assert.deepEqual(
    compileQaDescription("B1. Vào trang chủ app", {caseId: "home-grammar-case"}),
    [{action: "open_home"}]
  );
});

test("does not treat command-like words inside a service label as ambiguous", () => {
  assert.deepEqual(
    compileQaDescription("B1. Vào dịch vụ Vào home"),
    [{ action: "open_service", service: "Vào home" }]
  );
});

test("rejects a service step followed by another command", () => {
  const originalLine = "B1. Vào dịch vụ Phim truyện và vào home";

  assert.throws(
    () =>
      compileQaDescription(originalLine, {
        caseId: "trailing-command-case",
      }),
    /trailing-command-case.*ambiguous.*Vào dịch vụ Phim truyện và vào home/i
  );
});

test("rejects service steps followed by connectors or sentence punctuation", () => {
  for (const line of [
    "B1. Vào dịch vụ Phim truyện rồi quay lại",
    "B1. Vào dịch vụ Phim truyện sau đó vào home",
    "B1. Vào dịch vụ Phim truyện, vào home",
    "B1. Vào dịch vụ Phim truyện; vào home",
    "B1. Vào dịch vụ Phim truyện. Quay lại",
    "B1. Vào dịch vụ Phim truyện! Chờ home",
  ]) {
    assert.throws(() => compileQaDescription(line), /ambiguous/i, line);
  }
});

test("rejects a line that matches multiple supported patterns", () => {
  const originalLine = "B1. Vào home và vào dịch vụ phim truyện";

  assert.throws(
    () =>
      compileQaDescription(originalLine, {
        caseId: "ambiguous-case",
      }),
    /ambiguous-case.*ambiguous.*Vào home.*vào dịch vụ phim truyện/i
  );
});

test("compiles the player seek wording into player_seek", () => {
  assert.deepEqual(
    compileQaDescription("B1. Tua tới 5 bước"),
    [{action: "player_seek", direction: "forward", steps: 5}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Tua lùi 2 bước"),
    [{action: "player_seek", direction: "backward", steps: 2}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Tua phim tới 3 lần"),
    [{action: "player_seek", direction: "forward", steps: 3}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Tua tới"),
    [{action: "player_seek", direction: "forward"}]
  );
});

test("fails closed on a seek wording that is not a step count", () => {
  for (const line of ["B1. Tua tới 5 phút", "B1. Tua ngang 5 bước", "B1. Tua đến giữa phim"]) {
    assert.throws(() => compileQaDescription(line), /Không thể parse được bước/u, line);
  }
});

test("compiles pause and resume wording into player_toggle_play", () => {
  for (const line of ["B1. Tạm dừng", "B1. Tạm dừng phim", "B1. Pause", "B1. Tiếp tục phát", "B1. Phát tiếp phim"]) {
    assert.deepEqual(compileQaDescription(line), [{action: "player_toggle_play"}], line);
  }
});

test("compiles an OK press that spells out its purpose", () => {
  assert.deepEqual(
    compileQaDescription("B1. Nhấn phím OK để play"),
    [{action: "press_ok"}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Bấm OK để xác nhận"),
    [{action: "press_ok"}]
  );
});

test("compiles the short row and first-item wording", () => {
  assert.deepEqual(
    compileQaDescription('B1. Di chuyển đến dòng "Phim lẻ không thể bỏ lỡ"'),
    [{action: "focus_row", rowName: "Phim lẻ không thể bỏ lỡ"}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Focus vào item đầu tiên"),
    [{action: "focus_row_first_item"}]
  );
});

test("compiles a login step that shortens tài khoản to TK", () => {
  assert.deepEqual(
    compileQaDescription("B1. Đăng nhập TK ts1/111222"),
    [{action: "login", username: "ts1", password: "111222"}]
  );
});

test("compiles the player-control case end to end", () => {
  const qaDescription = [
    "B1. Đăng nhập TK ts1/111222",
    "B2. Vào trang chủ ứng dung",
    'B3. Di chuyển đến dòng "Thể loại"',
    'B4. Focus vào mục "PHIM TRUYỆN"',
    "B5. Nhấn phím OK",
    'B6. Di chuyển đến dòng "Phim lẻ không thể bỏ lỡ"',
    "B7. Focus vào item đầu tiên",
    "B8. Nhấn phím OK để play",
    "B9. Tua tới 5 bước",
    "B10. Nhấn phím OK để play",
  ].join("\n");

  assert.deepEqual(compileQaDescription(qaDescription, {caseId: "player-seek"}), [
    {action: "login", username: "ts1", password: "111222"},
    {action: "open_home"},
    {action: "focus_row", rowName: "Thể loại"},
    {action: "focus_text", text: "PHIM TRUYỆN"},
    {action: "press_ok"},
    {action: "focus_row", rowName: "Phim lẻ không thể bỏ lỡ"},
    {action: "focus_row_first_item"},
    {action: "press_ok"},
    {action: "player_seek", direction: "forward", steps: 5},
    {action: "press_ok"},
  ]);
});

test("compiles the in-player related-content wording", () => {
  assert.deepEqual(
    compileQaDescription("B1. Chọn phim liên quan đầu tiên"),
    [{action: "player_focus_related"}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Chọn nội dung liên quan thứ 3"),
    [{action: "player_focus_related", itemIndex: 3}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Mở poster liên quan đầu tiên"),
    [{action: "player_focus_related"}]
  );
});

test("compiles the play wording for related content into focus plus OK", () => {
  for (const line of [
    "B1. Phát phim liên quan đầu tiên",
    "B1. Play nội dung liên quan đầu tiên",
    "B1. Chơi phim liên quan đầu tiên",
  ]) {
    assert.deepEqual(
      compileQaDescription(line),
      [{action: "player_focus_related"}, {action: "press_ok"}],
      line
    );
  }

  assert.deepEqual(
    compileQaDescription("B1. Play nội dung liên quan thứ 2"),
    [{action: "player_focus_related", itemIndex: 2}, {action: "press_ok"}]
  );
});

test("lets an explicit OK line own the activation of a played related item", () => {
  // Otherwise the poster would be activated twice.
  assert.deepEqual(
    compileQaDescription("B1. Phát phim liên quan đầu tiên\nB2. Nhấn phím OK để play"),
    [{action: "player_focus_related"}, {action: "press_ok"}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Chọn phim liên quan đầu tiên\nB2. Nhấn phím OK để play"),
    [{action: "player_focus_related"}, {action: "press_ok"}]
  );
});

test("fails closed on related-content wording without a position", () => {
  for (const line of ["B1. Chọn phim liên quan", "B1. Xem nội dung liên quan bất kỳ"]) {
    assert.throws(() => compileQaDescription(line), /Không thể parse được bước/u, line);
  }
});

test("compiles the episode picker wording", () => {
  for (const line of ["B1. Mở giao diện chọn tập", "B1. Mở danh sách tập", "B1. Hiển thị chọn tập"]) {
    assert.deepEqual(compileQaDescription(line), [{action: "player_open_episodes"}], line);
  }

  assert.deepEqual(
    compileQaDescription("B1. Chọn tập 5"),
    [{action: "player_focus_episode", episode: 5}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Phát tập 12"),
    [{action: "player_focus_episode", episode: 12}, {action: "press_ok"}]
  );
  // An explicit OK line owns the activation.
  assert.deepEqual(
    compileQaDescription("B1. Xem tập 3\nB2. Nhấn phím OK để play"),
    [{action: "player_focus_episode", episode: 3}, {action: "press_ok"}]
  );
});

test("fails closed on episode wording without a number", () => {
  for (const line of ["B1. Chọn tập", "B1. Chọn tập cuối cùng"]) {
    assert.throws(() => compileQaDescription(line), /Không thể parse được bước/u, line);
  }
});

test("compiles the Mở dịch vụ wording with a quoted service name", () => {
  assert.deepEqual(
    compileQaDescription('B1. Mở dịch vụ "Phim truyện"'),
    [{action: "open_service", service: "Phim truyện"}]
  );
  assert.deepEqual(
    compileQaDescription("B1. Vào dịch vụ Phim truyện"),
    [{action: "open_service", service: "Phim truyện"}]
  );
});
