## Context

The reference implementation is the Claude Code mod gl-issues (sibling repo claude-mod-gl-issues, `hooks/register.tsx`). It runs inside one Claude Code session, takes the project from that session's folder, and talks to the herdr TUI through `herdr api snapshot`, `herdr tab create`, `herdr agent start`, `herdr agent prompt`, plus a bash/jq/perl script that greps Claude transcripts for issue numbers.

The Herdr desktop app (herdr-app) loads mods from `~/.config/herdr-app/mods/<name>/`: a `main.js` default-exporting a gpui-kit `View`, plus a `mod.json`. The contract is the generated `~/.config/herdr-app/herdr.d.ts` and the "Mods" sections of `~/.config/herdr-app/AGENTS.md`. Relevant facts from them:

- Live data re-renders the mod: `spaces()`, `agents()` (address, pane, space, tab_name, title, status), `panes()` (cwd per pane), `terminals()` (`hc ls --json` with argv), `focused()`.
- `exec(cmd, args, { cwd, on, timeout })` runs programs in the user's real environment, on another machine with `on`.
- `run("tab.new", { name, space, folder, argv, task })` opens a tab running a program, `task` being the agent's first message; `run("agent.focus", { terminal })` focuses an agent.
- `readTextFile(path, { on })`, `notify({...})`, `localStorage` per mod copy, `cx.timer.every`, `cx.spawn`. No `setTimeout`, no Node APIs.
- `herdr-app check <mod folder>` loads and renders the mod once; a mod is not done without a passing check.
- The shipped `changes` mod resolves "where am I" from the focused pane's cwd, the focused terminal's cwd, then the active space folder, with the space's machine as `on`.

## Goals / Non-Goals

**Goals:**

- Feature parity with gl-issues for listing, grouping, the three tabs, session matching, focusing, starting a session and opening the issue page (specs `issue-panel`, `issue-sessions`).
- A floating panel window that follows the active space and reopens on the next start.
- Pure logic covered by unit tests that run with plain Node, no installs.

**Non-Goals:**

- The `/gl-issues-init` command that writes the default board into CLAUDE.md (the default board applies when the section is missing).
- A status-bar summary; herdr-app has no status line API, so the summary sits in the panel header.
- Scanning Claude transcripts (`~/.claude/projects/*.jsonl`) for issue numbers; herdr-app gives no session id per agent.
- Creating git worktrees for issues, editing or labelling issues, and opening a browser on a remote machine.
- Editing the person's layouts or keys.json; the panel docks through `mod.json` only.

## Decisions

### Native herdr-app mod instead of extending gl-issues

Write a new gpui-kit mod rather than keep the Claude Code mod and shell out to herdr. herdr-app gives live agents and panes and `tab.new {argv, task}`, which replaces the snapshot script, `jq`, `perl`, the `herdr agent start` name juggling (`freeAgentName`) and the separate `herdr agent prompt` call. Alternative considered: keep gl-issues and add herdr-app support to it; rejected because it would stay tied to one Claude session's folder.

### Project comes from the active space

Resolve the project like the shipped `changes` mod: focused pane cwd, else focused terminal cwd, else active space folder, with the space's `machine` as `on`; then `git rev-parse --show-toplevel` and `git remote get-url origin` through `exec`. The project key is `machine + top-level folder`; a change of key resets the panel state and fetches again. Alternative: a fixed folder in mod props; rejected because one panel should serve every space.

### Pure logic module with node tests

Put everything that does not touch `herdr` or `gpui-kit` in `mods/issue-launcher/logic.js` (an ES module with no imports): board parsing, provider detection, CLI argument lists, JSON parsing for both providers, grouping, summary, issue-number extraction, same-project check, agent matching, tab name and first-message text. `main.js` imports it as `./logic.js`. Tests live in `test/logic.test.js` and run with `node --test` (Node 26 is installed; no package dependencies). Alternative: TypeScript with a build step like herdr-spectra-viewer; rejected because herdr-app loads plain JS and a build would add a step between save and hot reload.

### Agent matching from live herdr data

For each agent in `agents()`, take the pane's `cwd` from `panes()` (fallback: the terminal's `cwd` from `terminals()`), keep it when it is in the same project and `space`'s machine matches, and search its `tab_name`, `title`, cwd and the terminal's `argv` joined with spaces using the gl-issues pattern. Count mentions per issue number and sort sessions by count. This runs in `render`, so new or renamed agents show up without a refetch. The `-n "#<id> <title>"` in argv keeps a launched session matched even if its tab is renamed.

### Start sessions with tab.new

`run("tab.new", { name, space: activeSpace.id, folder: projectRoot, argv: ["claude", "-n", name], task: initialPrompt })`. A per-issue `launching` set ignores repeat clicks; it is cleared after a 3-second `cx.timer.after` because `run` returns before the agent is up.

### State and refresh

Fetched issue lists, board, provider, errors and fetch time live on the View instance. The selected tab and collapsed groups are kept in `localStorage` keys `tab` and `collapsed` (JSON, wrapped in try/catch). One fetch at a time (`this.loading`); a 5-minute `cx.timer.every`, a 1-second timer that, when the focused folder or machine changes, re-checks the repository with `git rev-parse` and fetches issues only if the project key changed, the refresh button, and start-up. 我的 failing keeps previous lists; 其他 / 已關閉 failures are stored per tab.

### Floating window opened with mod.open

`mod.json` is `{ "place": "none", "title": "Issues", "overlay": { "kind": "window", "key": "issue-launcher", "keep": true, "width": 380, "height": 0.8 } }`. `herdr-app do mod.open --name issue-launcher` (or the command palette) opens it as a draggable window that Herdr remembers in `windows.json` and reopens on the next start. A window does not close on Esc, so the panel draws a title row with a close button that calls `closeOverlay(props().overlay)`.

Rejected: `{ "place": "right" }` docking. Measured on Herdr 2026-11-15: neither this mod (symlinked folder, then a real folder) nor a throwaway real-folder test mod was docked into the `main` layout or recorded in `seen.json`, after an app restart, after re-showing `main`, or after switching to `terminals` and back. The trigger for docking is undocumented, so the design does not depend on it. Rejected: cloning `main` and the shipped `tabs` mod to add a third panel button, because it forks shipped files.

### Install by copy

The source of truth is this repo's `mods/issue-launcher/`. `scripts/install.sh` copies its files (except the `jsconfig.json` and `*.d.ts` herdr-app writes itself) into `~/.config/herdr-app/mods/issue-launcher/` and records the source path and file list in `.installed-from`; it refuses to touch a folder it did not install. Re-running it is the reload step during development, because herdr-app reloads a mod when files in its own folder change.

Rejected, measured 2026-11-15: a symlink to the whole folder (loads with `mod.open`, but `seen.json` never lists it), and a folder of per-file symlinks (saving in the repo does not reload the mod, and `import "./logic.js"` fails `herdr-app check` with "module `./logic.js` resolves outside the application directory").

## Implementation Contract

**Behavior.** A panel titled by provider ("GitLab issues" / "GitHub issues") in a floating Herdr window shows, top to bottom: a title row (provider name and a ✕ close button), a header line ("更新於 HH:MM:SS", 重新整理 button, 全部收合/全部展開 button, the status summary), the tab row (我的（n）, 其他（n）, 已關閉（n）), error or empty lines, then status groups with ▾/▸ arrows; each issue row is `[#id] [▶] title`, followed by one `↪ <mark> <name>` line per matched agent. Colors come from `theme()` except status colors from the board. All visible text is Traditional Chinese as in gl-issues.

**Interfaces.**

- `logic.js` exports: `DEFAULT_BOARD`, `makeBoard(entries)`, `parseBoard(markdown) -> Board | undefined`, `detectProvider(remoteUrl) -> "github" | "gitlab"`, `listArgs(provider, tab) -> string[]` (argv including the CLI name), `viewCommand(provider, id) -> string`, `parseIssues(provider, stdout) -> RawIssue[]` with `RawIssue = { iid, title, labels, url, updatedAt }`, `toIssue(raw, board)`, `othersOf(all, mine)`, `groupsFor(tab, issues, board) -> [status, Issue[]][]`, `summarize(issues, board) -> string`, `toggle(list, status)`, `extractMentions(text) -> Map<number, count>`, `sameProject(agentCwd, root)`, `matchSessions(issues, agents) -> Issue[]` where an agent input is `{ address, cwd, text, status, label }`, `sessionName(issue)`, `initialPrompt(provider, issue)`, `openUrlCommand(platform, url) -> [cmd, args]`.
- `Board = { statuses: string[], colors: Record<string,string>, done: string }`; `Issue = RawIssue & { status, sessions: { address, status, label, count }[] }`.
- Herdr calls: `exec`, `readTextFile`, `run("tab.new" | "agent.focus")`, `notify`, `spaces`, `agents`, `panes`, `terminals`, `focused`, `theme`, `window`.

**Failure modes.** Not a git repo → message, no CLI run. CLI missing or `exec` rejects → same red line as a non-zero exit. Invalid JSON → red line "<cli> 失敗：無法解析輸出". CLAUDE.md unreadable → default board, silent. `tab.new` / `agent.focus` problems surface through Herdr's own toasts. Opening the browser failing → `notify` with level `error`.

**Acceptance.**

- `node --test test/` passes and covers every Example table in both specs.
- `herdr-app check ~/.config/herdr-app/mods/issue-launcher` prints `check passed`.
- Manual in the running app on a GitHub repo (this person's repos, e.g. claude-mod-gl-issues) and a GitLab repo: list and grouping match `gh`/`glab` output, ▶ opens a tab whose Claude summarises the issue, the new session appears under the issue, clicking it focuses it, `#id` opens the browser, switching spaces switches projects.

**Scope.** In: files under `mods/issue-launcher/`, `test/`, `README.md`, `package.json` (`name`, `private`, `"type": "module"` and a `test` script), `.gitignore` (the `jsconfig.json` and `*.d.ts` herdr-app writes into mod folders), `scripts/install.sh` (copy install). Out: everything listed in Non-Goals, changes to shipped mods, layouts or keys.json.

## Risks / Trade-offs

- [The claim that `tab.new`'s `argv` finds `claude` on PATH and that `task` is typed once Claude is ready comes from herdr.d.ts, not a test] → the manual check of ▶ verifies it; if `task` is not delivered, fall back to `hc send <terminal>` after the agent reports idle, recorded as a follow-up.
- [`agents()` only lists terminals that report status (OSC 7501); a plain shell in an issue worktree is not matched] → same as gl-issues, which only matched Claude agents.
- [Issue numbers in unrelated tab names (e.g. "#1") give false matches] → matching is limited to the same project, as in gl-issues.
- [Per-copy `localStorage` means two copies of the panel keep separate tab and collapse state] → acceptable; one window copy is opened by `mod.open`.
- [100-issue limit per list] → same as gl-issues; large projects see the first 100.
