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
  return new Error(
    `Test case ${getCaseId(context)} has unsupported step: ${originalLine}`
  );
}

function ambiguousStepError(context, originalLine) {
  return new Error(
    `Test case ${getCaseId(context)} has ambiguous step: ${originalLine}`
  );
}

const STEP_COMPILERS = [
  {
    matches(normalizedLine) {
      return /\bdang nhap\b.*\btai khoan\b/u.test(normalizedLine);
    },
    compile(preparedLine, normalizedLine) {
      if (
        !/^dang nhap\b.*\btai khoan\s+\S+\s*\/\s*\S+$/u.test(
          normalizedLine
        )
      ) {
        return null;
      }

      const credentials = preparedLine.match(
        /([^\s/]+)\s*\/\s*([^\s/]+)$/u
      );

      return {
        action: "login",
        username: credentials[1],
        password: credentials[2],
      };
    },
  },
  {
    matches(normalizedLine) {
      return /\b(?:vao trang chu|vao home)\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:vao trang chu|vao home)$/u.test(normalizedLine)) {
        return null;
      }

      return { action: "open_home" };
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
      return /\b(?:quay lai|quay ve|nhan back)\b/u.test(normalizedLine);
    },
    compile(_preparedLine, normalizedLine) {
      if (!/^(?:quay lai|quay ve|nhan back)$/u.test(normalizedLine)) {
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
        /^cho (app|home|content|player)$/u
      );

      if (!readyMatch) {
        return null;
      }

      return { action: "wait_for_ready", name: readyMatch[1] };
    },
  },
];

function compileLine(originalLine, context, actionIndex) {
  const preparedLine = prepareStepLine(originalLine);
  const normalizedLine = normalizeVietnameseText(preparedLine);
  const serviceCompiler = STEP_COMPILERS.find((compiler) => compiler.isService);
  const matchingCompilers = serviceCompiler.startsLine(normalizedLine)
    ? [serviceCompiler]
    : STEP_COMPILERS.filter((compiler) => compiler.matches(normalizedLine));

  if (matchingCompilers.length > 1) {
    throw ambiguousStepError(context, originalLine);
  }

  if (matchingCompilers.length === 0) {
    throw unsupportedStepError(context, originalLine);
  }

  const action = matchingCompilers[0].compile(preparedLine, normalizedLine);

  if (!action) {
    throw unsupportedStepError(context, originalLine);
  }

  return validateAction(action, `compiledActions[${actionIndex}]`);
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

  return lines.map((line, actionIndex) =>
    compileLine(line, context, actionIndex)
  );
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
