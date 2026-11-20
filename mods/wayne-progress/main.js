// wayne-mode progress: every active .wayne-mode-todo-*.md in the repos Claude Code agents work in.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, panes, run, theme, exec, checking } from "herdr";
import { parseTodo } from "./todo.js";

const RECENT = 30 * 60000; // a finished list stays this long, then it's an old session
const STALE = 10 * 60000;  // working but the list hasn't moved for this long

// One node call per poll: repo roots of the given folders, then each root's todo files.
const SCAN = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const out = {};
for (const cwd of JSON.parse(process.argv[1])) {
  let root;
  try { root = cp.execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { continue; }
  out[cwd] = root;
  if (out["#" + root]) continue;
  out["#" + root] = fs.readdirSync(root).filter((f) => /^\\.wayne-mode-todo-.*\\.md$/.test(f)).map((f) => {
    const p = path.join(root, f);
    return { id: f.slice(17, -3), mtime: fs.statSync(p).mtimeMs, text: fs.readFileSync(p, "utf8") };
  });
}
process.stdout.write(JSON.stringify(out));
`;

const RANK = { blocked: 3, working: 2, done: 1, idle: 0 };

export default class WayneProgress extends View {
  init(_props, cx) {
    this.sessions = [];
    if (checking()) return;
    this.load(cx);
    cx.timer.every(4000, (cx) => this.load(cx));
  }

  load(cx) {
    if (this.loading) return;
    const claude = agents().filter((a) => a.app === "claude-code");
    const cwdOf = (a) => panes().find((p) => p.pane === a.pane)?.cwd;
    const cwds = [...new Set(claude.map(cwdOf).filter(Boolean))];
    if (!cwds.length) { this.sessions = []; cx.notify(); return; }
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("node", ["-e", SCAN, JSON.stringify(cwds)], { timeout: 10000 });
        if (r.code !== 0) { this.error = (r.stderr || r.stdout).split("\n")[0]; return; }
        this.error = null;
        const scan = JSON.parse(r.stdout), now = Date.now(), sessions = [];
        for (const root of new Set(cwds.map((c) => scan[c]).filter(Boolean))) {
          const here = claude.filter((a) => scan[cwdOf(a)] === root);
          // shortcut: several agents in one repo can't be told apart (herdr gives no session id); the card takes the most urgent one's status.
          const agent = here.reduce((m, a) => (!m || (RANK[a.status] ?? 0) > (RANK[m.status] ?? 0) ? a : m), null);
          // Todo files are never deleted: only the newest one per agent in this repo is a live session.
          const newest = [...scan["#" + root]].sort((a, b) => b.mtime - a.mtime).slice(0, here.length);
          for (const f of newest) {
            const steps = parseTodo(f.text);
            const open = steps.some((s) => s.mark === " " || s.mark === "wait");
            if (!steps.length || (!open && now - f.mtime > RECENT)) continue;
            sessions.push({ root, name: root.split(/[\\/]/).pop(), id: f.id, mtime: f.mtime, steps, agent });
          }
        }
        this.sessions = sessions;
      } catch (e) { this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  card(t, s, now) {
    const done = s.steps.filter((x) => x.mark === "x" || x.mark === "skip").length;
    const total = s.steps.length;
    const wait = s.steps.find((x) => x.mark === "wait");
    const cur = s.steps.findIndex((x) => x.mark === " ");
    const status = s.agent?.status ?? "idle";
    const idleMin = Math.round((now - s.mtime) / 60000);
    const stale = status === "working" && now - s.mtime > STALE;
    const finished = cur < 0 && !wait;
    const [label, color] = status === "blocked" || wait ? ["等你", t.blocked]
      : stale ? [`${idleMin} 分鐘沒動`, t.blocked]
      : finished ? ["完成", t.done ?? t.accent]
      : status === "working" ? ["進行中", t.working] : ["停著", t.muted];

    // Around the current step: two done before it, four after. The rest folds into counts.
    const from = cur < 0 ? Math.max(0, total - 3) : Math.max(0, cur - 2);
    const to = cur < 0 ? total : Math.min(total, cur + 5);
    const line = (x, i) => {
      const mark = x.mark === "x" ? "✓" : x.mark === "skip" ? "–" : x.mark === "wait" ? "!" : i === cur ? "▶" : "·";
      const c = x.mark === "wait" ? t.blocked : i === cur ? t.foreground : x.mark === " " ? t.muted : t.dim;
      return h_flex().gap(8).items_start()
        .child(div().w(12).flex_none().text_color(c).child(mark))
        .child(div().flex_1().min_w(0).text_color(c).when(i === cur, (el) => el.font_semibold()).child(x.text));
    };

    return v_flex().id(`wp-${s.id}`).gap(6).p(12).rounded(10).border(1).border_color(stale || wait || status === "blocked" ? t.blocked : t.border)
      .bg(t.background).cursor_pointer().hover((st) => st.bg(t.hover))
      .on_click(() => s.agent && run("pane.focus", { pane: s.agent.pane }))
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().min_w(0).truncate().text_size(15).font_semibold().child(s.name))
        .child(div().flex_none().px(8).py(2).rounded(6).bg(color + "26").text_color(color).text_size(12.5).font_semibold().child(label)))
      .child(h_flex().items_center().gap(8)
        .child(div().w(240).flex_none().h(6).rounded(3).bg(t.border).child(div().h(6).rounded(3).bg(color).w(Math.round(240 * done / total))))
        .child(div().flex_1())
        .child(div().flex_none().text_color(t.muted).child(`${done}/${total}`)))
      .when(Boolean(wait), (el) => el.child(div().text_color(t.blocked).font_semibold().child(`等：${wait.text}`)))
      .when(from > 0, (el) => el.child(div().text_color(t.dim).child(`前面 ${from} 步已處理`)))
      .children(s.steps.slice(from, to).map((x, k) => line(x, from + k)))
      .when(to < total, (el) => el.child(div().text_color(t.dim).child(`後面還有 ${total - to} 步`)))
      .child(div().text_size(11.5).text_color(t.dim).child(`session ${s.id} · ${idleMin < 1 ? "剛剛" : `${idleMin} 分鐘前`}更新`));
  }

  render(_cx) {
    const t = theme(), now = Date.now();
    const order = (s) => (s.agent?.status === "blocked" || s.steps.some((x) => x.mark === "wait") ? 0 : s.agent?.status === "working" ? 1 : 2);
    const list = [...this.sessions].sort((a, b) => order(a) - order(b) || b.mtime - a.mtime);
    return v_flex().id("wayne-progress").size_full().min_h(0).bg(t.chrome ?? t.background).text_color(t.foreground).text_size(13.5)
      .child(h_flex().px(14).py(10).items_center()
        .child(div().flex_1().text_size(14).font_semibold().child("wayne-mode 進度"))
        .child(div().text_color(t.dim).child(`${list.length} 場`)))
      .child(v_flex().id("wp-list").flex_1().min_h(0).px(10).pb(10).gap(10).overflow_y_scrollbar()
        .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).child(this.error)))
        .when(!list.length && !this.error, (el) => el.child(div().p(6).text_color(t.dim).child("沒有進行中的 wayne-mode。")))
        .children(list.map((s) => this.card(t, s, now))));
  }
}
