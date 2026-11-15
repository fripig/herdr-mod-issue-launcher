## Purpose

The issue panel is a herdr-app mod that shows the GitLab or GitHub issues of the project the person is working in, grouped by the project's board status labels, so they can see their queue without leaving the Herdr window.

## ADDED Requirements

### Requirement: Panel follows the active project

The panel SHALL take its project from the active space: the working folder of the focused pane, else the focused terminal's folder, else the space folder, resolved to its git top-level folder on the space's machine. When that project changes, the panel SHALL discard the previous project's issues and fetch the new project's issues.

#### Scenario: Switching spaces changes the project

- **WHEN** the person selects a space whose focused pane is inside a different git repository
- **THEN** the panel clears the previous issues, shows a loading line, and lists the issues of the new repository

#### Scenario: Folder is not a git repository

- **WHEN** the active space's folder is not inside a git repository
- **THEN** the panel shows the message "目前的 space 不在 git repo 裡。" and runs no issue CLI

### Requirement: Provider detection from the origin remote

The panel SHALL use `gh` when the repository's `origin` remote URL contains `github.com` followed by `:` or `/`, and SHALL use `glab` in every other case, including a missing `origin` remote.

#### Scenario: Remote decides the CLI

- **WHEN** the panel resolves the provider for a repository
- **THEN** it picks the CLI by the origin URL

##### Example: origin URLs

| origin URL | CLI |
| ---------- | --- |
| git@github.com:fripig/x.git | gh |
| https://github.com/fripig/x | gh |
| git@gitlab.example.com:team/x.git | glab |
| (no origin) | glab |

### Requirement: Status board from CLAUDE.md

The panel SHALL read the status labels from a `## Issue 狀態` heading (any heading level, case-insensitive "issue") in the project's `CLAUDE.md`, else `.claude/CLAUDE.md`, taking each list item under it as one label until the next heading; a trailing `#rgb` or `#rrggbb` on an item SHALL set that label's color. Labels without a color SHALL take colors in order from the palette `#4ade80`, `#facc15`, `#22d3ee`, `#c084fc`, `#60a5fa`, `#fb923c`, `#f472b6`. The last label SHALL be the done status. When neither file has the section, the panel SHALL use the default labels 進行中, 檢驗中, 測試站待檢驗, 正式站待檢驗, 已上線待檢驗, 可處理, 討論中, 已完成. The board SHALL be re-read on every refresh.

#### Scenario: Custom board with a color

- **WHEN** CLAUDE.md contains the section with items "進行中 #ff0000", "可處理", "已完成"
- **THEN** the board is [進行中, 可處理, 已完成], 進行中 is `#ff0000`, 可處理 is `#4ade80`, and 已完成 is the done status

#### Scenario: No board section

- **WHEN** neither CLAUDE.md file has an `## Issue 狀態` heading
- **THEN** the default eight labels are used with 已完成 as the done status

### Requirement: Three issue lists

The panel SHALL offer three tabs: 我的 (open issues assigned to me), 其他 (all open issues of the project minus those assigned to me, including unassigned ones), and 已關閉 (closed issues assigned to me). Each tab button SHALL show its issue count. A failure fetching 其他 or 已關閉 SHALL be shown only on that tab and SHALL NOT hide the 我的 list.

#### Scenario: CLI arguments per tab

- **WHEN** the panel fetches a list
- **THEN** it runs the provider's command for that tab, limited to 100 issues, with JSON output

##### Example: commands

| Provider | Tab | Command |
| -------- | --- | ------- |
| gitlab | mine | glab issue list --assignee=@me --per-page 100 --output json |
| gitlab | others | glab issue list --per-page 100 --output json |
| gitlab | closed | glab issue list --assignee=@me --closed --per-page 100 --output json |
| github | mine | gh issue list --assignee @me --state open --limit 100 --json number,title,labels,url,updatedAt |
| github | others | gh issue list --state open --limit 100 --json number,title,labels,url,updatedAt |
| github | closed | gh issue list --assignee @me --state closed --limit 100 --json number,title,labels,url,updatedAt |

#### Scenario: Others list excludes my issues

- **WHEN** the project has open issues #1, #2, #3 and #2 is assigned to me
- **THEN** 我的 shows #2 and 其他 shows #1 and #3

### Requirement: Grouping by status

In the 我的 and 其他 tabs, the panel SHALL put each issue in the first board label it carries, else in a group named （無狀態）, show groups in board order with （無狀態） last, omit empty groups, and sort issues in a group by ascending number. In the 已關閉 tab the panel SHALL show one group named 已關閉 sorted by descending number. Each group heading SHALL show its label in its board color and its count; the done status SHALL be drawn dimmed.

#### Scenario: Issues land in board order

- **WHEN** issues are #5 [討論中], #3 [進行中], #4 [進行中, bug], #9 [bug]
- **THEN** the groups are 進行中 (#3, #4), 討論中 (#5), （無狀態） (#9)

### Requirement: Collapsible groups

Each group SHALL collapse and expand when its arrow is clicked. Before the person has toggled anything, only the done status group SHALL be collapsed. A 全部收合 / 全部展開 button SHALL collapse all shown groups or expand them all. The collapsed set and the selected tab SHALL survive a reload of the mod.

#### Scenario: Toggle one group

- **WHEN** the person clicks the arrow of the expanded group 進行中
- **THEN** its issues are hidden and its arrow changes from ▾ to ▸, and other groups stay as they were

### Requirement: Refresh and errors

The panel SHALL fetch issues when it starts, every 5 minutes, when the project changes, and when the 重新整理 button is clicked, and SHALL NOT start a fetch while one is running. The header SHALL show the time of the last fetch as "更新於 HH:MM:SS" and a summary of open counts per non-done status of the 我的 list, such as "進行中 2 · 討論中 5". When the 我的 fetch fails, the panel SHALL show "<cli> 失敗：<first line of stderr>" in red and keep showing the issues from the last successful fetch.

#### Scenario: CLI not logged in

- **WHEN** `glab issue list` exits non-zero with stderr "401 Unauthorized"
- **THEN** the panel shows "glab 失敗：401 Unauthorized" in red and the previous list stays

#### Scenario: Empty list

- **WHEN** 我的 fetch succeeds with no issues
- **THEN** the panel shows "沒有指派給你的 open issue。"
