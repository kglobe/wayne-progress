// wayne-mode todo lines: "- [ ] 步驟", "- [x]", "- [skip] 理由", "- [wait] 等什麼".
export function parseTodo(text) {
  return [...text.matchAll(/^\s*[-*]\s*\[( |x|skip|wait)\]\s*(.*)$/gm)].map((m) => ({ mark: m[1], text: m[2].trim() }));
}
