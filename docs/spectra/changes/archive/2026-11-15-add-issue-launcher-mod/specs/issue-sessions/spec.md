## Purpose

Issue sessions tie each issue in the panel to the Herdr agents working on it, so the person can jump to an existing Claude session for an issue, start a new one with the issue already loaded, or open the issue page.

## ADDED Requirements

### Requirement: Match agents to issues

For every issue shown, the panel SHALL list the Herdr agents that mention the issue number, using only agents in the same project: the agent's working folder equals the project's top-level folder, is under it, or contains it, and the agent runs on the same machine. The text searched for each agent SHALL be its tab name, its terminal title, its working folder and its terminal's launch arguments. A mention SHALL be a number of 1 to 5 digits directly after `#`, `gl-`, `/issues/`, `/work_items/`, or the words `issue`, `work item` or `票` (case-insensitive, optionally followed by a space and/or `#`). Agents SHALL be ordered by how many mentions of that issue they contain, most first. The list SHALL update when agents, tabs or titles change, without refetching issues.

#### Scenario: Mentions in agent text

- **WHEN** the panel extracts issue numbers from an agent's text
- **THEN** it finds the numbers below

##### Example: extraction

| Agent text | Issue numbers |
| ---------- | ------------- |
| tab "#12 新增登入頁" | 12 |
| folder /repo/.worktrees/gl-15-export | 15 |
| title "Issue 7 review" | 7 |
| argv claude -n "#12 新增登入頁" | 12 |
| https://gitlab.example.com/a/b/-/issues/42 | 42 |
| "v1.2.3 build 2024" | (none) |

#### Scenario: Agent in another repository

- **WHEN** an agent's tab is named "#12 fix" but its working folder is in a different repository
- **THEN** it is not listed under issue #12 of this project

### Requirement: Focus a matched agent

Each matched agent SHALL be shown under its issue as one clickable line with a status mark (◑ working, ! blocked, ✓ done, · idle) and its tab name or terminal title. Clicking the line SHALL run the herdr command `agent.focus` with that agent's terminal address.

#### Scenario: Jump to the session

- **WHEN** the person clicks the line "↪ ◑ #12 新增登入頁" under issue #12
- **THEN** Herdr shows the space and tab of that agent and focuses its pane

### Requirement: Start a Claude session for an issue

Every issue SHALL have a ▶ button, also when sessions already exist for it. Clicking it SHALL run the herdr command `tab.new` in the active space with the tab name `#<id> <title>` (cut to 39 characters plus `…` when longer than 40), the project's top-level folder as the folder, the program `claude -n <tab name>`, and a first message that asks Claude to read the issue and its comments with the provider's view command, summarise the requirement, acceptance criteria and open questions, and stop without changing code. The view command SHALL be `glab issue view <id> --comments` for GitLab and `gh issue view <id> --json title,body,labels,comments` for GitHub. While a start for an issue is in progress, further clicks on that issue's ▶ SHALL be ignored.

#### Scenario: Start a session on GitHub

- **WHEN** the person clicks ▶ on GitHub issue #15 "匯出報表 CSV"
- **THEN** a new tab named "#15 匯出報表 CSV" opens in the active space, runs `claude -n "#15 匯出報表 CSV"` in the project folder, and its first message contains `gh issue view 15 --json title,body,labels,comments`

#### Scenario: New session is matched

- **WHEN** a session started from ▶ for issue #15 is running
- **THEN** issue #15 lists that agent as a matched session without the person refreshing

### Requirement: Open the issue page

Clicking the issue number button `#<id>` SHALL open the issue's web URL in the system browser of this computer, using `open` on macOS and `xdg-open` elsewhere. When the program fails or exits non-zero, the panel SHALL post an error notification "開啟 issue 頁面失敗：<reason>".

#### Scenario: Open in browser

- **WHEN** the person clicks `#12`
- **THEN** the issue's URL opens in the default browser
