import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BOARD, parseBoard, detectProvider, listArgs, viewCommand, parseIssues, toIssue, othersOf,
  groupsFor, summarize, toggle, extractMentions, sameProject, matchSessions, sessionName, initialPrompt,
  openUrlCommand, NO_STATUS, CLOSED_GROUP,
} from "../mods/issue-launcher/logic.js";
import * as mod from "../mods/issue-launcher/logic.js";

const raw = (iid, labels = [], title = `t${iid}`) => ({ iid, title, labels, url: `u${iid}`, updatedAt: "" });
const ids = (groups) => groups.map(([s, list]) => [s, list.map((i) => i.iid)]);

// 2.1 Status board from CLAUDE.md / provider detection

test("custom board with a color", () => {
  const md = "# Proj\n\n## Issue 狀態\n\n- 進行中 #ff0000\n- 可處理\n- 已完成\n\n## Other\n- x\n";
  const board = parseBoard(md);
  assert.deepEqual(board.statuses, ["進行中", "可處理", "已完成"]);
  assert.equal(board.colors["進行中"], "#ff0000");
  assert.equal(board.colors["可處理"], "#4ade80");
  assert.equal(board.done, "已完成");
  assert.equal(board.colors["已完成"], undefined);
});

test("no board section gives undefined, default has eight labels", () => {
  assert.equal(parseBoard("# Proj\n- 進行中\n"), undefined);
  assert.equal(parseBoard(null), undefined);
  assert.deepEqual(DEFAULT_BOARD.statuses, ["進行中", "檢驗中", "測試站待檢驗", "正式站待檢驗", "已上線待檢驗", "可處理", "討論中", "已完成"]);
  assert.equal(DEFAULT_BOARD.done, "已完成");
});

test("origin URLs pick the CLI", () => {
  assert.equal(detectProvider("git@github.com:fripig/x.git"), "github");
  assert.equal(detectProvider("https://github.com/fripig/x"), "github");
  assert.equal(detectProvider("git@gitlab.example.com:team/x.git"), "gitlab");
  assert.equal(detectProvider(""), "gitlab");
  assert.equal(detectProvider(undefined), "gitlab");
});

// 2.2 Three issue lists

test("commands per provider and tab", () => {
  const gh = ["--limit", "100", "--json", "number,title,labels,url,updatedAt"];
  assert.deepEqual(listArgs("gitlab", "mine"), ["glab", "issue", "list", "--assignee=@me", "--per-page", "100", "--output", "json"]);
  assert.deepEqual(listArgs("gitlab", "others"), ["glab", "issue", "list", "--per-page", "100", "--output", "json"]);
  assert.deepEqual(listArgs("gitlab", "closed"), ["glab", "issue", "list", "--assignee=@me", "--closed", "--per-page", "100", "--output", "json"]);
  assert.deepEqual(listArgs("github", "mine"), ["gh", "issue", "list", "--assignee", "@me", "--state", "open", ...gh]);
  assert.deepEqual(listArgs("github", "others"), ["gh", "issue", "list", "--state", "open", ...gh]);
  assert.deepEqual(listArgs("github", "closed"), ["gh", "issue", "list", "--assignee", "@me", "--state", "closed", ...gh]);
});

test("view commands", () => {
  assert.equal(viewCommand("gitlab", 12), "glab issue view 12 --comments");
  assert.equal(viewCommand("github", 15), "gh issue view 15 --json title,body,labels,comments");
});

test("parses both providers' JSON and rejects junk", () => {
  assert.deepEqual(parseIssues("gitlab", JSON.stringify([{ iid: 3, title: "a", labels: ["進行中"], web_url: "w", updated_at: "d" }])),
    [{ iid: 3, title: "a", labels: ["進行中"], url: "w", updatedAt: "d" }]);
  assert.deepEqual(parseIssues("github", JSON.stringify([{ number: 4, title: "b", labels: [{ name: "討論中" }], url: "w", updatedAt: "d" }])),
    [{ iid: 4, title: "b", labels: ["討論中"], url: "w", updatedAt: "d" }]);
  assert.throws(() => parseIssues("github", "not json"), /無法解析輸出/);
  assert.throws(() => parseIssues("gitlab", "{}"), /無法解析輸出/);
});

test("others list excludes my issues", () => {
  assert.deepEqual(othersOf([raw(1), raw(2), raw(3)], [raw(2)]).map((i) => i.iid), [1, 3]);
});

// 2.3 Grouping by status / collapsible groups

test("issues land in board order", () => {
  const issues = [raw(5, ["討論中"]), raw(3, ["進行中"]), raw(4, ["進行中", "bug"]), raw(9, ["bug"])].map((r) => toIssue(r));
  assert.deepEqual(ids(groupsFor("mine", issues)), [["進行中", [3, 4]], ["討論中", [5]], [NO_STATUS, [9]]]);
});

test("closed tab is one group, newest first", () => {
  const issues = [raw(2, ["已完成"]), raw(8), raw(5)].map((r) => toIssue(r));
  assert.deepEqual(ids(groupsFor("closed", issues)), [[CLOSED_GROUP, [8, 5, 2]]]);
  assert.deepEqual(groupsFor("closed", []), []);
});

test("summary skips the done status", () => {
  const issues = [raw(1, ["進行中"]), raw(2, ["進行中"]), ...[3, 4, 5, 6, 7].map((n) => raw(n, ["討論中"])), raw(8, ["已完成"])].map((r) => toIssue(r));
  assert.equal(summarize(issues), "進行中 2 · 討論中 5");
});

test("toggle one group", () => {
  assert.deepEqual(toggle(["已完成"], "進行中"), ["已完成", "進行中"]);
  assert.deepEqual(toggle(["已完成", "進行中"], "進行中"), ["已完成"]);
});

// 2.4 Match agents to issues

test("mentions in agent text", () => {
  const nums = (t) => [...extractMentions(t).keys()];
  assert.deepEqual(nums("#12 新增登入頁"), [12]);
  assert.deepEqual(nums("/repo/.worktrees/gl-15-export"), [15]);
  assert.deepEqual(nums("Issue 7 review"), [7]);
  assert.deepEqual(nums('claude -n #12 新增登入頁'), [12]);
  assert.deepEqual(nums("https://gitlab.example.com/a/b/-/issues/42"), [42]);
  assert.deepEqual(nums("v1.2.3 build 2024"), []);
  assert.deepEqual(nums("#123456"), []);
  assert.deepEqual(nums("票 #8, work item 9"), [8, 9]);
  assert.equal(extractMentions("#12 a #12 b").get(12), 2);
});

test("agent in another repository is not matched", () => {
  assert.equal(sameProject("/repo/a", "/repo/a"), true);
  assert.equal(sameProject("/repo/a/sub", "/repo/a"), true);
  assert.equal(sameProject("/repo", "/repo/a"), true);
  assert.equal(sameProject("/repo/ab", "/repo/a"), false);
  assert.equal(sameProject("/other/b", "/repo/a"), false);
  assert.equal(sameProject(null, "/repo/a"), false);
  const agents = [
    { address: "t1", cwd: "/repo/a", text: "#12 fix", status: "working", label: "#12 fix" },
    { address: "t2", cwd: "/other/b", text: "#12 fix", status: "idle", label: "#12 fix" },
  ].filter((a) => sameProject(a.cwd, "/repo/a"));
  const [issue] = matchSessions([toIssue(raw(12))], agents);
  assert.deepEqual(issue.sessions.map((s) => s.address), ["t1"]);
});

test("sessions sorted by mention count", () => {
  const agents = [
    { address: "t1", cwd: "/r", text: "#3", status: "idle", label: "a" },
    { address: "t2", cwd: "/r", text: "#3 #3 issue 3", status: "working", label: "b" },
    { address: "t3", cwd: "/r", text: "#4", status: "idle", label: "c" },
  ];
  const [issue] = matchSessions([toIssue(raw(3))], agents);
  assert.deepEqual(issue.sessions, [
    { address: "t2", status: "working", label: "b", count: 3 },
    { address: "t1", status: "idle", label: "a", count: 1 },
  ]);
});

// 2.5 Session name, first message, browser command

test("session name and cut", () => {
  assert.equal(sessionName(raw(15, [], "匯出報表 CSV")), "#15 匯出報表 CSV");
  const long = sessionName(raw(1, [], "x".repeat(50)));
  assert.equal(long.length, 40);
  assert.ok(long.endsWith("…"));
});

test("first message uses the provider's view command", () => {
  const p = initialPrompt("github", raw(15, [], "匯出報表 CSV"));
  assert.ok(p.includes("gh issue view 15 --json title,body,labels,comments"));
  assert.ok(initialPrompt("gitlab", raw(12)).includes("glab issue view 12 --comments"));
  assert.ok(p.includes("不要開始改程式碼"));
});

test("browser command per platform", () => {
  assert.deepEqual(openUrlCommand("macos", "u"), ["open", ["u"]]);
  assert.deepEqual(openUrlCommand("linux", "u"), ["xdg-open", ["u"]]);
});

test("error line skips glab's lone ERROR", () => {
  const { errorLine } = mod;
  assert.equal(errorLine("   ERROR  \n          \n  No git remotes found.   \n"), "No git remotes found.");
  assert.equal(errorLine("HTTP 401: Bad credentials\nmore"), "HTTP 401: Bad credentials");
  assert.equal(errorLine(""), "");
});
