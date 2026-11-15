// The issue launcher's pure logic. No herdr or gpui-kit imports, so `node --test` runs it.

export const NO_STATUS = "（無狀態）";
export const CLOSED_GROUP = "已關閉";
// Colors, in order, for status labels that don't name one.
export const PALETTE = ["#4ade80", "#facc15", "#22d3ee", "#c084fc", "#60a5fa", "#fb923c", "#f472b6"];

// Labels in workflow order; the last one is the done status: no color, dimmed, collapsed at first.
export const makeBoard = (entries) => {
  const done = entries[entries.length - 1]?.name ?? "";
  const colors = {};
  let next = 0;
  for (const e of entries.filter((e) => e.name !== done)) colors[e.name] = e.color ?? PALETTE[next++ % PALETTE.length];
  return { statuses: entries.map((e) => e.name), colors, done };
};

export const DEFAULT_BOARD = makeBoard(
  ["進行中", "檢驗中", "測試站待檢驗", "正式站待檢驗", "已上線待檢驗", "可處理", "討論中", "已完成"].map((name) => ({ name })),
);

// Reads the list under a "## Issue 狀態" heading, one label per item with an optional #color, up to the next heading.
export const parseBoard = (markdown) => {
  const lines = (markdown ?? "").split("\n");
  const start = lines.findIndex((l) => /^#{1,6}\s*issue\s*狀態\s*$/i.test(l.trim()));
  if (start < 0) return undefined;
  const entries = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line.trim())) break;
    const m = /^\s*[-*+]\s+(.+?)(?:\s+(#[0-9a-f]{3}(?:[0-9a-f]{3})?))?\s*$/i.exec(line);
    if (m?.[1]) entries.push(m[2] ? { name: m[1], color: m[2] } : { name: m[1] });
  }
  return entries.length > 0 ? makeBoard(entries) : undefined;
};

export const PROVIDERS = {
  gitlab: { name: "GitLab", cli: "glab" },
  github: { name: "GitHub", cli: "gh" },
};

// origin on github.com uses gh; everything else, self-hosted GitLab and no origin included, uses glab.
export const detectProvider = (remoteUrl) => (/github\.com[:/]/i.test(remoteUrl ?? "") ? "github" : "gitlab");

// tab: "mine" (open, assigned to me), "others" (every open issue), "closed" (closed, assigned to me).
export const listArgs = (provider, tab) =>
  provider === "github"
    ? ["gh", "issue", "list", ...(tab === "others" ? [] : ["--assignee", "@me"]), "--state", tab === "closed" ? "closed" : "open", "--limit", "100", "--json", "number,title,labels,url,updatedAt"]
    : ["glab", "issue", "list", ...(tab === "others" ? [] : ["--assignee=@me"]), ...(tab === "closed" ? ["--closed"] : []), "--per-page", "100", "--output", "json"];

// gh issue view --comments queries the retired Projects (classic) and fails, so GitHub uses --json.
export const viewCommand = (provider, id) =>
  provider === "github" ? `gh issue view ${id} --json title,body,labels,comments` : `glab issue view ${id} --comments`;

// Both CLIs' JSON as { iid, title, labels, url, updatedAt }. Throws "無法解析輸出" on anything else.
export const parseIssues = (provider, stdout) => {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new Error("無法解析輸出");
  }
  if (!Array.isArray(data)) throw new Error("無法解析輸出");
  return provider === "github"
    ? data.map((i) => ({ iid: i.number, title: i.title, labels: (i.labels ?? []).map((l) => l.name), url: i.url, updatedAt: i.updatedAt }))
    : data.map((i) => ({ iid: i.iid, title: i.title, labels: i.labels ?? [], url: i.web_url, updatedAt: i.updated_at }));
};

export const toIssue = (raw, board = DEFAULT_BOARD) => ({
  ...raw,
  status: raw.labels.find((l) => board.statuses.includes(l)) ?? NO_STATUS,
  sessions: [],
});

// The others tab: the project's open issues minus mine.
export const othersOf = (all, mine) => {
  const mineIids = new Set(mine.map((i) => i.iid));
  return all.filter((i) => !mineIids.has(i.iid));
};

export const groupByStatus = (issues, board = DEFAULT_BOARD) =>
  [...board.statuses, NO_STATUS]
    .map((s) => [s, issues.filter((i) => i.status === s).sort((x, y) => x.iid - y.iid)])
    .filter(([, list]) => list.length > 0);

// Closed issues mostly still carry the done label: one group, newest first.
export const groupsFor = (tab, issues, board = DEFAULT_BOARD) =>
  tab !== "closed"
    ? groupByStatus(issues, board)
    : issues.length > 0 ? [[CLOSED_GROUP, [...issues].sort((x, y) => y.iid - x.iid)]] : [];

export const summarize = (issues, board = DEFAULT_BOARD) =>
  groupByStatus(issues, board)
    .filter(([s]) => s !== board.done)
    .map(([s, list]) => `${s} ${list.length}`)
    .join(" · ");

export const toggle = (list, status) => (list.includes(status) ? list.filter((s) => s !== status) : [...list, status]);

// Issue numbers after #, gl-, /issues/, /work_items/, "issue", "work item" or 票, with how often each appears.
const MENTION = /(?:\/(?:work_items|issues)\/|\bgl-|#|(?:\b(?:issue|work item)|票) ?#?)(\d{1,5})\b/gi;
export const extractMentions = (text) => {
  const counts = new Map();
  for (const m of (text ?? "").matchAll(MENTION)) {
    const n = Number(m[1]);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
};

// Issue numbers only mean something inside one project: the agent's folder is the root, under it, or contains it.
export const sameProject = (agentCwd, root) =>
  !!agentCwd && !!root && (agentCwd === root || agentCwd.startsWith(`${root}/`) || root.startsWith(`${agentCwd}/`));

// agents: [{ address, cwd, text, status, label }] already limited to this project.
export const matchSessions = (issues, agents) => {
  const mentions = agents.map((a) => ({ a, counts: extractMentions(a.text) }));
  return issues.map((issue) => ({
    ...issue,
    sessions: mentions
      .flatMap(({ a, counts }) => (counts.has(issue.iid) ? [{ address: a.address, status: a.status, label: a.label, count: counts.get(issue.iid) }] : []))
      .sort((x, y) => y.count - x.count),
  }));
};

export const STATUS_MARK = { working: "◑", blocked: "!", done: "✓", idle: "·" };

export const sessionName = (issue) => {
  const chars = [...`#${issue.iid} ${issue.title}`];
  return chars.length > 40 ? `${chars.slice(0, 39).join("")}…` : chars.join("");
};

// The new session's first message: read the issue and its comments with the CLI, summarise, then wait.
export const initialPrompt = (provider, issue) =>
  `請先用 \`${viewCommand(provider, issue.iid)}\` 讀取 issue #${issue.iid} 的內容與留言，摘要需求、驗收條件與待釐清的地方。摘要完先停下來等我指示，不要開始改程式碼。`;

export const openUrlCommand = (platform, url) => (platform === "macos" ? ["open", [url]] : ["xdg-open", [url]]);

// The CLI's reason in one line: glab prints a lone "ERROR" before it.
export const errorLine = (output) =>
  (output ?? "").split("\n").map((l) => l.trim()).find((l) => l && !/^error:?$/i.test(l)) ?? "";

// W3: collapse or expand only the groups on screen, keeping other tabs' choices.
export const collapseShown = (collapsed, shown) => [...new Set([...collapsed, ...shown])];
export const expandShown = (collapsed, shown) => collapsed.filter((s) => !shown.includes(s));

export const emptyData = () => ({ mine: null, others: null, closed: null, board: DEFAULT_BOARD, fetchedAt: null, error: null, errors: {} });

// What the panel shows after a fetch. Each result is { raws } or { error }.
// A failed 我的 keeps every previous list; a failed 其他 or 已關閉 keeps that list and errors on its tab only.
export const nextData = (prev, { mine, all, closed }, board, fetchedAt) =>
  mine.error
    ? { ...prev, board, fetchedAt, error: mine.error }
    : {
        board,
        fetchedAt,
        error: null,
        mine: mine.raws,
        others: all.raws ? othersOf(all.raws, mine.raws) : prev.others,
        closed: closed.raws ?? prev.closed,
        errors: { others: all.error ?? null, closed: closed.error ?? null },
      };

// Herdr's live agents as matchSessions takes them: same machine as the project, folder in the project.
export const agentInputs = ({ agents, panes, terminals, spaces }, project) => {
  if (!project) return [];
  const paneCwd = new Map(panes.map((p) => [p.pane, p.cwd]));
  const terms = new Map(terminals.map((t) => [t.address, t]));
  const machineOf = new Map(spaces.map((s) => [s.id, s.machine ?? null]));
  return agents.flatMap((a) => {
    if ((machineOf.get(a.space) ?? null) !== (project.on ?? null)) return [];
    const t = terms.get(a.address);
    const cwd = paneCwd.get(a.pane) ?? t?.cwd ?? null;
    if (!sameProject(cwd, project.root)) return [];
    const argv = Array.isArray(t?.argv) ? t.argv.join(" ") : "";
    // An unnamed tab is called by its position: the title says more then.
    const label = /^\d+$/.test(a.tab_name ?? "") ? a.title || a.tab_name : a.tab_name || a.title || a.address;
    return [{ address: a.address, cwd, status: a.status, label, text: [a.tab_name, a.title, cwd, argv].join("\n") }];
  });
};

// Herdr's tab bar restores a space's panel only if its id is in workspace.panels (default files, changes).
export const withIssuesPanel = (list) => {
  const current = Array.isArray(list) ? list : ["files", "changes"];
  return current.includes("issues") ? current : [...current, "issues"];
};

// The Issues button: on while the right panel shows issues (hidden null = unknown, not on).
export const panelOn = (hidden, active) => hidden === false && active === "issues";
// layout() reports the stack's active child but not the panel's shown/hidden clicks (Herdr app 0.1.15),
// so the click goes by the active child alone: on issues, toggle the panel; otherwise switch to issues and show it.
export const panelToggle = (active) =>
  active === "issues"
    ? [["layout.toggle", { id: "panel" }]]
    : [["layout.select", { stack: "panel-body", child: "issues" }], ["layout.show", { id: "panel" }]];
// The panel's shown/hidden click, from Herdr's layouts/.state/<layout>.json; the layout file's value when never
// clicked, null when the state can't be read.
export const panelHidden = (stateText, fileHidden) => {
  if (stateText == null) return fileHidden;
  try {
    return JSON.parse(stateText)?.nodes?.panel?.hidden ?? fileHidden;
  } catch {
    return null;
  }
};

// The floating window, as mod.json describes it, for openOverlay (which replaces rather than toggles).
export const WINDOW = { mod: "issue-launcher", kind: "window", key: "issue-launcher", keep: true, width: 380, height: 0.8 };
// ⧉ hides the docked panel (then opens WINDOW); ⇲ shows the Issues panel (then closes the window).
export const popOutCommands = () => [["layout.hide", { id: "panel" }]];
export const dockBackCommands = () => [["layout.select", { stack: "panel-body", child: "issues" }], ["layout.show", { id: "panel" }]];
// ⇲ only makes sense in a layout whose right panel has the issues block.
export const canDock = (panelBody) => (panelBody?.children ?? []).some((c) => c.id === "issues");
