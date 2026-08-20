const {
  validateAction,
  validateTestCase,
} = require("./test-case-schema");
const { normalizeVietnameseText } = require("./text-utils");

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function prepareStepLine(line) {
  return line.replace(/^B\d+\s*\.\s*/iu, "").trim();
}

function getCaseId(context) {
  return context.caseId ?? context.id ?? "unknown";
}

function unsupportedStepError(context, originalLine) {
  return new Error(`Không thể parse được bước: ${originalLine}`);
}

function ambiguousStepError(context, originalLine) {
  return new Error(
    `Test case ${getCaseId(context)} has ambiguous step: ${originalLine}`
  );
}

// A description can spell the OK press on its own line, or fold it into the
// "Bấm vào <poster>" wording. The lookahead below decides which line owns the
// activation so a poster is never activated twice.
const OK_STEP_PATTERN = /^(?:nhan|bam|chon)(?: chon)?(?: phim)? (?:ok|enter)[.!?…。！？]*$/u;

const STEP_COMPILERS = [
  {
    matches(normalizedLine) {
      return /\bdang nhap\b.*\btai khoan\b/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const slashCredentials = normalizedLine.match(
        /^dang nhap\b.*\btai khoan\s+\S+\s*\/\s*\S+[.!?…。！？]*$/u
      )
        ? preparedLine.match(/([^\s/]+)\s*\/\s*([^\s/]+)[.!?…。！？]*$/u)
        : null;
      const labeledCredentials = preparedLine.match(
        /\btên\s+(?:(?:TK|tài khoản)\s*)?[:：]?\s*([^\s,;]+)\s*[,;]\s*(?:pass|mật khẩu|password)\s*[:：]?\s*([^\s,;.!?…。！？]+)/iu
      );
      // Some descriptions put the package name directly between “tài khoản”
      // and the credentials, e.g. “tài khoản OPEN MAX 091... pass 091...”.
      // Capture the token immediately before the password label; the package
      // wording is descriptive and must not become the username.
      const packageCredentials = preparedLine.match(
        /\btài khoản\b.*?([^\s,;]+)\s*[,;]?\s*(?:pass|mật khẩu|password)\s*[:：]?\s*([^\s,;.!?…。！？]+)/iu
      );
      const credentials = slashCredentials || labeledCredentials || packageCredentials;

      if (!credentials) return null;

      return {
        action: "login",
        username: credentials[1],
        password: credentials[2],
      };
    },
  },
  {
    matches(normalizedLine) {
      return /\b(?:vao trang chu(?: app)?|vao (?:man hinh )?trang chu(?: (?:app|ung dung))?|vao home)\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:vao trang chu(?: app)?|vao (?:man hinh )?trang chu(?: (?:app|ung dung))?|vao home)[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return { action: "open_home" };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:(?:di chuyen)(?: den)?(?: va)?\s+)?focus vao (?:muc|item)\s+["“].+?["”][.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^(?:(?:di chuyen)(?: den)?(?: va)?\s+)?focus vao (?:muc|item)\s+["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^(?:(?:di chuyển)(?: đến)?(?: và)?\s+)?focus vào (?:mục|item)\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      return {
        action: "focus_text",
        text: (preparedMatch?.[1] || normalizedMatch[1]).trim(),
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^di chuyen den focus vao nut\s+["“].+?["”]\s+cua\s+(?:1|mot)\s+(?:trailer|trailler)\s+trang chu\s+bat ky[.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^di chuyen den focus vao nut\s+["“](.+?)["”]\s+cua\s+(?:1|mot)\s+(?:trailer|trailler)\s+trang chu\s+bat ky[.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^di chuyển đến focus vào nút\s+["“](.+?)["”]\s+của\s+(?:1|một)\s+(?:trailer|trailler)\s+trang chủ\s+bất kỳ[.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      return {
        action: "focus_text",
        text: (preparedMatch?.[1] || normalizedMatch[1]).trim(),
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:chay|phat|play)\s+(?:toan bo|tat ca|cac)\s+(?:trailer|trailler)\s+(?:o|tren|tai)\s+(?:trang chu|home)[.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:chay|phat|play)\s+(?:toan bo|tat ca|cac)\s+(?:trailer|trailler)\s+(?:o|tren|tai)\s+(?:trang chu|home)[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return {action: "play_home_trailers"};
    },
  },
  {
    matches(normalizedLine) {
      return /^di chuyen focus vao poster\s+(?:kenh|phim|noi dung|channel|movie|content)\s+thu\s+\d+\s+cua dong\s+(?:subcate|cate|hang cate|row)\s+["“].+?["”][.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^di chuyen focus vao poster\s+(?:kenh|phim|noi dung|channel|movie|content)\s+thu\s+(\d+)\s+cua dong\s+(?:subcate|cate|hang cate|row)\s+["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^di chuyển focus vào poster\s+(?:kênh|phim|nội dung|channel|movie|content)\s+thứ\s+\d+\s+của dòng\s+(?:subcate|cate|hàng cate|row)\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      return {
        action: "focus_row",
        rowName: (preparedMatch?.[1] || normalizedMatch[2]).trim(),
        itemIndex: Number(normalizedMatch[1]),
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^di chuyen den (?:focus vao poster dau tien cua\s+(?:muc|hang cate|row)\s+|(?:dong cate|subcate)\s*(?:[:：]\s*)?)["“].+?["”][.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^di chuyen den (?:focus vao poster dau tien cua\s+(?:muc|hang cate|row)\s+|(?:dong cate|subcate)\s*(?:[:：]\s*)?)["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^di chuyển đến (?:focus vào poster đầu tiên của\s+(?:mục|hàng cate|row)\s+|(?:dòng cate|subcate)\s*(?:[:：]\s*)?)["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      return {
        action: "focus_row",
        rowName: (preparedMatch?.[1] || normalizedMatch[1]).trim(),
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^di chuyen focus vao poster\s+(?:kenh|phim|noi dung|channel|movie|content)\s+dau tien ben trai cua dong subcate\s+["“].+?["”][.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^di chuyen focus vao poster\s+(?:kenh|phim|noi dung|channel|movie|content)\s+dau tien ben trai cua dong subcate\s+["“].+?["”][.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      // B5 has already focused this subcategory row. B6 moves to its
      // leftmost item without reopening or navigating to another page.
      return {action: "focus_row_first_item"};
    },
  },
  {
    matches(normalizedLine) {
      return /^di chuyen focus den\s+(?:1\s+)?(?:kenh|phim|noi dung|channel|movie|content)\s+dau tien ben trai[.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^di chuyen focus den\s+(?:1\s+)?(?:kenh|phim|noi dung|channel|movie|content)\s+dau tien ben trai[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return {action: "focus_row_first_item"};
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:chon|bam|nhan)\s+vao\s+(?:muc|item|poster)\s+["“].+?["”][.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine, context = {}) {
      const normalizedMatch = normalizedLine.match(
        /^(?:chon|bam|nhan)\s+vao\s+(?:muc|item|poster)\s+["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^(?:chọn|bấm|nhấn)\s+vào\s+(?:mục|item|poster)\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      const focus = {
        action: "focus_text",
        text: (preparedMatch?.[1] || normalizedMatch[1]).trim(),
      };

      // On a remote, pressing a poster is focus plus activation. When the next
      // step already spells the OK press, that step owns the activation.
      if (OK_STEP_PATTERN.test(context.nextNormalizedLine || "")) return focus;
      return [focus, {action: "press_ok"}];
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:phat|play|chay)\s+(?:toan bo|tat ca|\d+)\s+.*\b(?:trang )?danh sach\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      const allMatch = normalizedLine.match(
        /^(?:phat|play|chay)\s+(?:toan bo|tat ca)(?:\s+(?:noi dung|poster|phim|kenh))?\s+(?:trong|o|tai|cua)\s+(?:trang\s+)?danh sach[.!?…。！？]*$/u
      );
      if (allMatch) return {action: "play_all_contents"};

      const rowMatch = normalizedLine.match(
        /^(?:phat|play|chay)\s+(\d+)\s+dong(?:\s+dau(?: tien)?)?\s+(?:trong|o|tai|cua)\s+(?:trang\s+)?danh sach[.!?…。！？]*$/u
      );
      if (rowMatch) return {action: "play_all_contents", rowCount: Number(rowMatch[1])};

      const itemMatch = normalizedLine.match(
        /^(?:phat|play|chay)\s+(\d+)\s+(?:poster|noi dung)(?:\s+dau(?: tien)?)?\s+(?:trong|o|tai|cua)\s+(?:trang\s+)?danh sach[.!?…。！？]*$/u
      );
      if (itemMatch) return {action: "play_all_contents", count: Number(itemMatch[1])};

      return null;
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:nhan|bam|chon)(?: chon)?(?: phim)? (?:ok|enter)[.!?…。！？]*$/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:nhan|bam|chon)(?: chon)?(?: phim)? (?:ok|enter)[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return { action: "press_ok" };
    },
  },
  {
    matches(normalizedLine) {
      return /^vao (?:trang )?tim kiem(?: noi dung)?\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^vao (?:trang )?tim kiem(?: noi dung)?[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return {action: "open_search"};
    },
  },
  {
    isService: true,
    matches(normalizedLine) {
      return /\bvao dich vu\b/u.test(normalizedLine);
    },
    startsLine(normalizedLine) {
      return /^vao dich vu\b/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      if (!/^vao dich vu\s+.+$/u.test(normalizedLine)) {
        return null;
      }

      const service = preparedLine.match(/^\S+\s+\S+\s+\S+\s+(.+)$/u)[1];

      return {
        action: "open_service",
        service: service.trim(),
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:tim(?: kiem)?|search)\s+(?:kenh|phim|noi dung)\s+/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^(?:tim(?: kiem)?|search)\s+(kenh|phim|noi dung)\s+["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^(?:tìm(?: kiếm)?|search)\s+(kênh|phim|nội dung)\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch || !preparedMatch) return null;

      return {
        action: "search_content",
        name: preparedMatch[2].trim(),
        type: normalizedMatch[1] === "kenh"
          ? "channel"
          : normalizedMatch[1] === "phim"
            ? "movie"
            : "content",
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:phat|play)\s+(?:kenh|phim|noi dung)\s+(?:tim duoc|vua tim|tim thay|tim kiem duoc)[.!?…。！？]*$/u.test(
        normalizedLine
      );
    },
    compile(_preparedLine, normalizedLine) {
      const match = normalizedLine.match(
        /^(?:phat|play)\s+(kenh|phim|noi dung)\s+(?:tim duoc|vua tim|tim thay|tim kiem duoc)[.!?…。！？]*$/u
      );
      if (!match) return null;

      return {
        action: "play_search_result",
        type: match[1] === "kenh" ? "channel" : match[1] === "phim" ? "movie" : "content",
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:phat|play)\s+(?:kenh|phim|noi dung)\s+[“"]/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^(?:phat|play)\s+(kenh|phim|noi dung)\s+["“](.+?)["”][.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^(?:phát|play)\s+(kênh|phim|nội dung)\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch || !preparedMatch) return null;

      const type = normalizedMatch[1] === "kenh"
        ? "channel"
        : normalizedMatch[1] === "phim"
          ? "movie"
          : "content";

      return {
        action: "play_content",
        name: preparedMatch[2].trim(),
        type,
      };
    },
  },
  {
    matches(normalizedLine) {
      return /^(?:phat|play)\s+(?:toan bo|tat ca|\d+)\s+(?:noi dung(?:\s+(?:kenh|phim))?|kenh|phim)\s+cua hang cate\s+/u.test(
        normalizedLine
      );
    },
    compile(preparedLine, normalizedLine) {
      const normalizedMatch = normalizedLine.match(
        /^(?:phat|play)\s+(toan bo|tat ca|(\d+))\s+(?:noi dung(?:\s+(?:kenh|phim))?|kenh|phim)\s+cua hang cate\s+(?:thu\s+(\d+)|["“](.+?)["”])[.!?…。！？]*$/u
      );
      const preparedMatch = preparedLine.match(
        /^(?:phát|play)\s+(?:toàn bộ|tất cả|\d+)\s+(?:nội dung(?:\s+(?:kênh|phim))?|kênh|phim)\s+của hàng cate\s+["“](.+?)["”][.!?…。！？]*$/iu
      );

      if (!normalizedMatch) return null;

      const action = { action: "play_row" };
      const count = normalizedMatch[2] ? Number(normalizedMatch[2]) : undefined;
      const rowIndex = normalizedMatch[3] ? Number(normalizedMatch[3]) : undefined;
      const rowName = normalizedMatch[4]
        ? (preparedMatch?.[1] || normalizedMatch[4]).trim()
        : undefined;

      if (count !== undefined) action.count = count;
      if (rowIndex !== undefined) action.rowIndex = rowIndex;
      if (rowName !== undefined) action.rowName = rowName;
      return action;
    },
  },
  {
    matches(normalizedLine) {
      return /\b(?:quay lai|quay ve|nhan back)\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:quay lai|quay ve|nhan back)[.!?…。！？]*$/u.test(normalizedLine)) {
        return null;
      }

      return { action: "press_back" };
    },
  },
  {
    matches(normalizedLine) {
      return /\bcho (?:app|home|content|player)\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      const readyMatch = normalizedLine.match(
        /^cho (app|home|content|player)[.!?…。！？]*$/u
      );

      if (!readyMatch) {
        return null;
      }

      return { action: "wait_for_ready", name: readyMatch[1] };
    },
  },
];

function hasTrailingCommand(normalizedLine) {
  return /(?:\b(?:va|roi|sau do)\s+|[,;.!?…]+\s*)(?:dang nhap\b|vao trang chu(?: app)?\b|vao home\b|vao dich vu\b|quay lai\b|quay ve\b|nhan back\b|cho (?:app|home|content|player)\b)/u.test(
    normalizedLine
  );
}

function compileLine(originalLine, context, actionIndex, nextLine) {
  const preparedLine = prepareStepLine(originalLine);
  const normalizedLine = normalizeVietnameseText(preparedLine);
  const serviceCompiler = STEP_COMPILERS.find((compiler) => compiler.isService);
  const startsWithService = serviceCompiler.startsLine(normalizedLine);

  if (hasTrailingCommand(normalizedLine)) {
    throw ambiguousStepError(context, originalLine);
  }

  const matchingCompilers = startsWithService
    ? [serviceCompiler]
    : STEP_COMPILERS.filter((compiler) => compiler.matches(normalizedLine));

  if (matchingCompilers.length > 1) {
    throw ambiguousStepError(context, originalLine);
  }

  if (matchingCompilers.length === 0) {
    throw unsupportedStepError(context, originalLine);
  }

  const compiled = matchingCompilers[0].compile(preparedLine, normalizedLine, {
    nextNormalizedLine: nextLine === undefined
      ? ""
      : normalizeVietnameseText(prepareStepLine(nextLine)),
  });

  if (!compiled) {
    throw unsupportedStepError(context, originalLine);
  }

  const actions = Array.isArray(compiled) ? compiled : [compiled];
  if (!actions.length) {
    throw unsupportedStepError(context, originalLine);
  }

  return actions.map((action, offset) =>
    validateAction(action, `compiledActions[${actionIndex + offset}]`)
  );
}

function compileQaDescription(qaDescription, context = {}) {
  if (typeof qaDescription !== "string" || !qaDescription.trim()) {
    throw new Error(
      `Test case ${getCaseId(context)} qaDescription must be a non-empty string`
    );
  }

  const lines = qaDescription
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);

  const actions = [];
  lines.forEach((line, lineIndex) => {
    actions.push(...compileLine(line, context, actions.length, lines[lineIndex + 1]));
  });

  return actions;
}

function compileTestCase(testCase) {
  const validatedTestCase = validateTestCase(testCase);

  if (
    Array.isArray(validatedTestCase.actions) &&
    validatedTestCase.actions.length > 0
  ) {
    return validatedTestCase;
  }

  if (!hasOwn(validatedTestCase, "qaDescription")) {
    throw new Error(
      `Test case ${validatedTestCase.id} actions must be non-empty when qaDescription is absent`
    );
  }

  const actions = compileQaDescription(validatedTestCase.qaDescription, {
    caseId: validatedTestCase.id,
  });

  return validateTestCase({ ...validatedTestCase, actions });
}

module.exports = { compileTestCase, compileQaDescription };
