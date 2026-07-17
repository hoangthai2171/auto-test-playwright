const test = require("node:test");
const assert = require("node:assert/strict");
const {redactSensitiveText, createLogRedactor} = require("../../app/credential-redaction");

test("redacts arbitrary password punctuation", () => {
  assert.equal(redactSensitiveText("password=a]b, username=User_Đ/PaSS123."), "password=•••••• username=User_Đ/••••••");
});

test("buffers split and long log credentials until a complete line or flush", () => {
  const chunks = [];
  const redactor = createLogRedactor((value) => chunks.push(value));
  const longPassword = "x".repeat(200) + "]tail";

  redactor.push(`password=${longPassword.slice(0, 120)}`);
  assert.deepEqual(chunks, []);
  redactor.push(`${longPassword.slice(120)}\nnext line`);

  assert.deepEqual(chunks, ["password=••••••\n"]);
  redactor.flush();
  assert.deepEqual(chunks, ["password=••••••\n", "next line"]);
});
