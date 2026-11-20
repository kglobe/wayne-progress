import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTodo } from "../mods/wayne-progress/todo.js";

test("parseTodo reads every mark and ignores other lines", () => {
  const steps = parseTodo([
    "# 標題",
    "- [x] 讀 code",
    "- [skip] 品質關：沒有 UI",
    "- [wait] 核可計畫：等使用者",
    "- [ ] 收成範本",
    "  * [ ] 縮排的星號也算",
    "- [?] 不認得的標記",
  ].join("\r\n"));
  assert.deepEqual(steps.map((s) => s.mark), ["x", "skip", "wait", " ", " "]);
  assert.equal(steps[2].text, "核可計畫：等使用者");
  assert.equal(steps[3].text, "收成範本");
});

test("parseTodo returns nothing for a file with no steps", () => {
  assert.deepEqual(parseTodo("隨便寫的筆記\n"), []);
});
