import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, agents, terminals, exec, readTextFile, run, notify, theme, props, openOverlay, closeOverlay, layout, shared, setShared, appHome, window as appWindow } from "herdr";
import * as L from "./logic.js";
import { languageFromDetection, chooseLanguage, t as tr } from "./i18n.js";

const REFRESH_MS = 5 * 60 * 1000;
const TABS = [["mine", "tabMine", "emptyMine"], ["others", "tabOthers", "emptyOthers"], ["closed", "tabClosed", "emptyClosed"]];
const LANG_KEY = "issue-launcher.lang";
// "Label (3)" in English, "標籤（3）" with full-width parentheses in Chinese.
const counted = (lang, label, n) => (lang === "en" ? `${label} (${n})` : `${label}（${n}）`);

// The system language, asked once per panel copy: macOS AppleLanguages, else LANG.
async function detectLanguage() {
  const platform = appWindow()?.platform;
  const res = await (platform === "macos"
    ? exec("defaults", ["read", "-g", "AppleLanguages"], { timeout: 5000 })
    : exec("sh", ["-c", 'printf %s "$LANG"'], { timeout: 5000 })).catch(() => null);
  return languageFromDetection(platform, res);
}
// The window drags on any press a control doesn't stop.
const stop = (_e, cx) => cx.stop_propagation();
const firstLine = L.errorLine;
const pad = (n) => String(n).padStart(2, "0");
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The right panel's active child, which layout() reports correctly.
const panelActive = () => find(layout(), "panel-body")?.active ?? null;

// Whether the right panel is hidden. layout() keeps the file's `hidden`, so read Herdr's click state instead.
async function readPanelHidden() {
  const fileHidden = find(layout(), "panel")?.hidden ?? false;
  const name = shared("layout");
  if (typeof name !== "string") return null;
  try {
    return L.panelHidden(await readTextFile(`${appHome()}/layouts/.state/${name}.json`), fileHidden);
  } catch {
    return null;
  }
}

// Where the person is working, as the shipped changes mod finds it.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder || null, on };
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Per-copy convenience only.
  }
}

// The board from CLAUDE.md, or null so render can use the interface language's default board.
async function loadBoard(root, on) {
  for (const path of [`${root}/CLAUDE.md`, `${root}/.claude/CLAUDE.md`]) {
    try {
      const board = L.parseBoard(await readTextFile(path, { on }));
      if (board) return board;
    } catch {
      // Unreadable: try the next one, then the default board.
    }
  }
  return null;
}

const emptyData = L.emptyData;

export default class IssueLauncher extends View {
  init(_props, cx) {
    // The tab-bar button only draws a toggle; it never fetches.
    if (props()?.role === "button") {
      const panels = shared("workspace.panels");
      const next = L.withIssuesPanel(panels);
      if (next !== panels) setShared("workspace.panels", next);
      // Layout clicks don't re-render a mod: check the panel twice a second and redraw on change.
      this.panelHidden = null;
      this.panelActive = panelActive();
      const check = (cx) => cx.spawn(async (cx) => {
        const hidden = await readPanelHidden();
        const active = panelActive();
        if (hidden !== this.panelHidden || active !== this.panelActive) {
          this.panelHidden = hidden;
          this.panelActive = active;
          cx.notify();
        }
      });
      check(cx);
      cx.timer.every(500, check);
      return;
    }
    this.project = null; // { key, root, on, provider }
    this.notGit = false;
    this.data = emptyData();
    this.loading = false;
    this.queued = null; // null, or whether the queued refresh must refetch issues
    this.where = null;
    this.launching = new Set();
    // The last detected language until this start's detection answers, so the panel doesn't flash English.
    this.detected = load("detectedLang", "en");
    cx.spawn(async (cx) => {
      this.detected = await detectLanguage();
      save("detectedLang", this.detected);
      cx.notify();
    });
    this.tab = load("tab", "mine");
    this.collapsed = load("collapsed", null);
    this.refresh(cx, true);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx, true));
    // A change of folder or machine only checks the repo; issues are fetched again when the repo changed.
    cx.timer.every(1000, (cx) => {
      const { cwd, on } = location();
      const where = `${on ?? ""}\n${cwd ?? ""}`;
      if (where !== this.where) this.refresh(cx, false);
    });
  }

  // force: fetch the issue lists even when the repo is the same (start-up, timer, the `refresh` button).
  refresh(cx, force) {
    if (this.loading) {
      this.queued = Boolean(this.queued) || force;
      return;
    }
    this.loading = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        await this.fetch(cx, force);
      } finally {
        this.loading = false;
        cx.notify();
        if (this.queued !== null) {
          const again = this.queued;
          this.queued = null;
          this.refresh(cx, again);
        }
      }
    });
  }

  async fetch(cx, force) {
    const { cwd, on } = location();
    this.where = `${on ?? ""}\n${cwd ?? ""}`;
    const top = cwd ? await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null) : null;
    if (!top || top.code !== 0) {
      this.project = null;
      this.notGit = true;
      this.data = emptyData();
      return;
    }
    this.notGit = false;
    const root = top.stdout.trim();
    const key = `${on ?? ""}\n${root}`;
    if (key !== this.project?.key) {
      const remote = await exec("git", ["remote", "get-url", "origin"], { cwd: root, on }).catch(() => null);
      this.project = { key, root, on, provider: L.detectProvider(remote?.code === 0 ? remote.stdout.trim() : "") };
      this.data = emptyData();
      cx.notify();
    } else if (!force) {
      return;
    }
    const { provider } = this.project;
    const board = await loadBoard(root, on);
    const list = async (tab) => {
      const [cmd, ...args] = L.listArgs(provider, tab);
      const res = await exec(cmd, args, { cwd: root, on, timeout: 30000 });
      if (res.code !== 0) throw new Error(firstLine(res.stderr) || firstLine(res.stdout) || `exit ${res.code}`);
      return L.parseIssues(provider, res.stdout);
    };
    const settle = (tab) => list(tab).then((raws) => ({ raws }), (err) => ({ error: err?.message ?? String(err) }));
    const [mine, all, closed] = await Promise.all([settle("mine"), settle("others"), settle("closed")]);
    this.data = L.nextData(this.data, { mine, all, closed }, board, clock(new Date()));
  }

  // The shared choice when set, else what the system says.
  lang() {
    return chooseLanguage(shared(LANG_KEY), this.detected);
  }

  // Agents in this project, as matchSessions takes them.
  agentsHere() {
    return L.agentInputs({ agents: agents(), panes: panes(), terminals: terminals(), spaces: spaces() }, this.project);
  }

  start(issue, cx) {
    const project = this.project;
    if (!project || this.launching.has(issue.iid)) return;
    this.launching.add(issue.iid);
    const name = L.sessionName(issue);
    const space = spaces().find((s) => s.active);
    run("tab.new", { name, space: space?.id, folder: project.root, argv: ["claude", "-n", name], task: L.initialPrompt(project.provider, issue, this.lang()) });
    // run returns before the agent is up; ignore repeat clicks for a moment.
    cx.timer.after(3000, (cx) => {
      this.launching.delete(issue.iid);
      cx.notify();
    });
    cx.notify();
  }

  open(issue, cx) {
    const [cmd, args] = L.openUrlCommand(appWindow()?.platform, issue.url);
    cx.spawn(async () => {
      try {
        const res = await exec(cmd, args, { timeout: 10000 });
        if (res.code !== 0) throw new Error(firstLine(res.stderr) || `exit ${res.code}`);
      } catch (err) {
        notify({ level: "error", title: tr(this.lang(), "openFailed", { reason: err?.message ?? String(err) }) });
      }
    });
  }

  setTab(tab, cx) {
    this.tab = tab;
    save("tab", tab);
    cx.notify();
  }

  setCollapsed(list, cx) {
    this.collapsed = list;
    save("collapsed", list);
    cx.notify();
  }

  // The Issues button, styled like the shipped tab bar's Files and Changes buttons.
  renderButton() {
    const t = theme();
    const on = L.panelOn(this.panelHidden, this.panelActive);
    return h_flex().size_full().pr(10).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("panel-issues").h(26).px(8).gap(5).flex_none().items_center().rounded(6).cursor_pointer()
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => { for (const [name, args] of L.panelToggle(panelActive())) run(name, args); })
        .child(svg("mods/issue-launcher/issues.svg").size(14)).child("Issues"));
  }

  render() {
    if (props()?.role === "button") return this.renderButton();
    const t = theme();
    const lang = this.lang();
    const project = this.project;
    const data = this.data;
    const board = data.board ?? L.defaultBoard(lang);
    const say = (key, params) => tr(lang, key, params);
    const reason = (message) => (message === "unparsable" ? say("unparsable") : message);
    const provider = project?.provider;
    const cli = provider ? L.PROVIDERS[provider].cli : "";
    const lists = { mine: data.mine, others: data.others, closed: data.closed };
    const here = this.agentsHere();
    const shown = L.matchSessions((lists[this.tab] ?? []).map((r) => L.toIssue(r, board)), here);
    const groups = L.groupsFor(this.tab, shown, board);
    const closedGroups = this.collapsed ?? [board.done];
    const allClosed = groups.length > 0 && groups.every(([s]) => closedGroups.includes(s));
    const tabError = this.tab === "mine" ? null : data.errors[this.tab];
    const summary = data.mine ? L.summarize(data.mine.map((r) => L.toIssue(r, board)), board, lang) : "";

    const button = (id, label, onPress, opts = {}) =>
      div().id(id).flex_none().px(6).py(1).rounded(5).cursor_pointer()
        .bg(opts.on ? t.selected : t.raised).text_color(opts.dim ? t.muted : t.foreground)
        .hover((s) => s.bg(t.hover))
        .on_mouse_down("left", stop)
        .on_click((_e, cx) => onPress(cx))
        .child(label);

    const overlay = props()?.overlay;
    const runAll = (commands) => { for (const [name, args] of commands) run(name, args); };
    const icon = (id, label, onPress) =>
      div().id(id).px(4).rounded(4).cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover))
        .on_mouse_down("left", stop).on_click(onPress).child(label);
    const title = h_flex().h(30).px(10).flex_none().items_center().justify_between().bg(t.chrome).border_b(1).border_color(t.border)
      .child(div().font_semibold().text_color(t.foreground).child(provider ? `${L.PROVIDERS[provider].name} issues` : "Issues"))
      .child(h_flex().gap(2)
        // Interface language: shows the other one; every copy follows the shared choice.
        .child(icon("lang", say("switchLabel"), () => setShared(LANG_KEY, lang === "en" ? "zh-TW" : "en")))
        // Docked: pop out into the floating window.
        .when(!overlay, (el) => el.child(icon("pop-out", "⧉", () => { runAll(L.popOutCommands()); openOverlay(L.WINDOW); })))
        // Floating: dock back when this layout has the Issues panel, and close.
        .when(Boolean(overlay) && L.canDock(find(layout(), "panel-body")), (el) => el.child(icon("dock-back", "⇲", () => { runAll(L.dockBackCommands()); closeOverlay(overlay); })))
        .when(Boolean(overlay), (el) => el.child(icon("close", "✕", () => closeOverlay(overlay)))));

    const header = v_flex().gap(4).flex_none()
      .child(h_flex().gap(6).items_center()
        .child(div().text_color(t.dim).child(data.fetchedAt ? say("updatedAt", { time: data.fetchedAt }) : this.notGit ? "" : say("loading")))
        .child(button("refresh", this.loading ? say("loading") : say("refresh"), (cx) => { if (!this.loading) this.refresh(cx, true); }))
        .when(groups.length > 0, (el) => el.child(button("toggle-all", allClosed ? say("expandAll") : say("collapseAll"),
          (cx) => this.setCollapsed((allClosed ? L.expandShown : L.collapseShown)(closedGroups, groups.map(([s]) => s)), cx)))))
      .when(Boolean(summary), (el) => el.child(div().text_color(t.muted).truncate().child(summary)))
      .child(h_flex().gap(4).children(TABS.map(([id, label]) =>
        button(`tab-${id}`, counted(lang, say(label), lists[id] ? lists[id].length : "…"), (cx) => this.setTab(id, cx), { on: this.tab === id, dim: this.tab !== id }))));

    const messages = [];
    if (this.notGit) messages.push(div().text_color(t.muted).child(say("notGit")));
    if (data.error) messages.push(div().text_color(t.ansi1).child(say("cliFailed", { cli, reason: reason(data.error) })));
    if (tabError) messages.push(div().text_color(t.ansi1).child(say("cliFailed", { cli, reason: reason(tabError) })));
    if (lists[this.tab] && shown.length === 0 && !tabError) messages.push(div().text_color(t.dim).child(say(TABS.find(([id]) => id === this.tab)[2])));

    const row = (i) => v_flex()
      .child(h_flex().gap(6).items_center().min_w(0)
        .child(button(`open-${i.iid}`, `#${i.iid}`, (cx) => this.open(i, cx)))
        .child(button(`start-${i.iid}`, this.launching.has(i.iid) ? "…" : "▶", (cx) => this.start(i, cx)))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(i.title)))
      .children(i.sessions.map((s) =>
        div().id(`agent-${i.iid}-${s.address}`).pl(14).cursor_pointer().truncate().text_color(t.muted).rounded(4)
          .hover((st) => st.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", stop)
          .on_click(() => run("agent.focus", { terminal: s.address }))
          .child(`↪ ${L.STATUS_MARK[s.status] ?? "·"} ${s.label}`)));

    const group = ([status, list]) => {
      const folded = closedGroups.includes(status);
      return v_flex().gap(4)
        .child(h_flex().id(`group-${status}`).gap(6).items_center().cursor_pointer()
          .on_mouse_down("left", stop)
          .on_click((_e, cx) => this.setCollapsed(L.toggle(closedGroups, status), cx))
          .child(div().w(12).text_color(t.muted).child(folded ? "▸" : "▾"))
          .child(div().font_semibold().text_color(status === board.done ? t.dim : board.colors[status] ?? t.foreground)
            .child(counted(lang, L.groupName(status, lang), list.length))))
        .when(!folded, (el) => el.children(list.map(row)));
    };

    return v_flex().size_full().bg(t.surface).text_size(13).text_color(t.foreground)
      .child(title)
      .child(v_flex().id("body").flex_1().min_h(0).p(10).gap(10).overflow_y_scrollbar()
        .child(header)
        .children(messages)
        .children(groups.map(group)));
  }
}
