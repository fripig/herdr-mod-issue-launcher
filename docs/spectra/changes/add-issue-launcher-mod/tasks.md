## 1. Scaffold and install by copy

- [x] 1.1 Create `mods/issue-launcher/` with the window `mod.json` (Floating window opened with mod.open) and a minimal `main.js` View that renders "讀取中…"; add `package.json` with only `"type": "module"` and `"test": "node --test test/"`; add `scripts/install.sh` to install by copy (copies the files, records them in `.installed-from`, refuses to replace a folder it did not install). Verify: `scripts/install.sh` run twice succeeds, `herdr-app check ~/.config/herdr-app/mods/issue-launcher` prints `check passed`, and `herdr-app do mod.open --name issue-launcher` lists `issue-launcher` in `herdr-app status` overlays with no errors.

## 2. Pure logic module with node tests

- [x] 2.1 [after: 1.1] In `logic.js`, implement the status board from CLAUDE.md (`makeBoard`, `parseBoard`, `DEFAULT_BOARD`) and provider detection from the origin remote (`detectProvider`). Verify: `node --test test/` passes tests covering the "Custom board with a color", "No board section" scenarios and the origin URLs example table.
- [x] 2.2 [after: 2.1] Implement the three issue lists data side: `listArgs(provider, tab)`, `parseIssues` for both JSON shapes, `othersOf`, `viewCommand`. Verify: tests assert every row of the "commands" example table and the "Others list excludes my issues" scenario.
- [x] 2.3 [after: 2.2] Implement grouping by status (`toIssue`, `groupsFor` including the 已關閉 single group sorted descending, `summarize`) and `toggle` for collapsible groups. Verify: tests for "Issues land in board order", closed-tab ordering, and a summary string like "進行中 2 · 討論中 5" that excludes the done status.
- [x] 2.4 [after: 2.3] Implement agent matching from live herdr data on the logic side to match agents to issues: `extractMentions`, `sameProject`, `matchSessions` (sorted by mention count). Verify: tests assert every row of the "extraction" example table and the "Agent in another repository" scenario.
- [x] 2.5 [after: 2.4] Implement `sessionName` (40-character cut with `…`), `initialPrompt(provider, issue)` and `openUrlCommand(platform, url)`. Verify: tests show the tab name for issue #15 "匯出報表 CSV" is "#15 匯出報表 CSV", a 50-character title is cut to 40 characters, and the GitHub prompt contains `gh issue view 15 --json title,body,labels,comments`.

## 3. Panel follows the active project

- [x] 3.1 [after: 2.5] In `main.js`, so the panel follows the active project (Project comes from the active space), resolve the project from (focused pane cwd → focused terminal cwd → space folder, `on` = space machine), run `git rev-parse --show-toplevel` and `git remote get-url origin` through `exec`, read the board from CLAUDE.md with `readTextFile`, and fetch the three lists with refresh and errors handling: one fetch at a time, start-up, 5-minute timer, 1-second project-key check, 重新整理 button, "更新於 HH:MM:SS", red "<cli> 失敗：…" line keeping the previous list, per-tab errors for 其他/已關閉, and the "目前的 space 不在 git repo 裡。" message. Verify: `herdr-app check` passes; in the app, the panel lists this person's GitHub issues for claude-mod-gl-issues, switching to a space in another repo switches the list, a non-git space shows the message, and a space in a GitLab repo where `glab auth status` fails shows the red "glab 失敗：…" line.

## 4. Panel UI

- [x] 4.1 [after: 3.1] Render the title row with a ✕ button that closes the window via `closeOverlay(props().overlay)`, the header, the tab row with counts, status groups with board colors and dimmed done status, collapsible groups with ▾/▸ and 全部收合/全部展開, and the empty-list texts; persist tab and collapsed set in `localStorage` (State and refresh). Verify: `herdr-app check` passes; `herdr-app shot` shows the header, tabs and groups; toggling a group and reloading the mod (save `main.js`) keeps it collapsed.

## 5. Sessions

- [x] 5.1 [after: 4.1] Show matched sessions under each issue using `agents()`, `panes()` and `terminals()` in `render`, each line `↪ <mark> <label>`; clicking runs `run("agent.focus", { terminal })` to focus a matched agent. Verify: with a Claude agent in a tab renamed "#<id> test" in the project folder, the line appears under that issue within a second and clicking it focuses that agent (`herdr-app status` shows its terminal as `agent`).
- [x] 5.2 [after: 5.1] Start a Claude session for an issue (Start sessions with tab.new): ▶ runs `tab.new` with name, active space, project folder, `argv` `["claude", "-n", name]` and `task` = `initialPrompt`, ignoring repeat clicks for 3 seconds. Verify manually on a real issue: a tab named "#<id> <title>" opens, Claude receives the first message and summarises the issue, and the new session is listed under the issue without refreshing. If `task` is not delivered, record it in the change as a blocker instead of working around it.
- [x] 5.3 [after: 4.1] Open the issue page: the `#<id>` button runs `openUrlCommand(window().platform, url)` locally and posts `notify({ level: "error", title: "開啟 issue 頁面失敗：<reason>" })` on failure. Verify: clicking `#<id>` opens the issue in the browser.

## 6. Documentation

- [x] 6.1 [after: 5.3] Write `README.md` in Traditional Chinese: what the panel shows, requirements (herdr-app, git, gh/glab logged in), the `scripts/install.sh` install and `herdr-app do mod.open --name issue-launcher`, the `## Issue 狀態` board format, and how to run `node --test test/` and `herdr-app check`; state that this is a native herdr-app mod instead of extending gl-issues and what was left out (Non-Goals). Verify: content review that every command in it runs as written.
