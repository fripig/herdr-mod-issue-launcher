## Why

The gl-issues Claude Code mod (in the sibling repo claude-mod-gl-issues) lists my GitLab/GitHub issues and jumps to or starts the herdr session working on each one, but it lives inside one Claude Code session and drives the herdr TUI through shell scripts (`herdr api snapshot`, `jq`, `perl`). The Herdr desktop app (herdr-app) now exposes live agents, panes, spaces and a `tab.new {argv, task}` command to mods, so the same launcher can live as a native panel in the window, follow whichever project space is active, and drop the shell plumbing.

## What Changes

- Add a herdr-app mod `issue-launcher` (gpui-kit JavaScript) in this repo at `mods/issue-launcher/`, installed by `scripts/install.sh`, which copies it into `~/.config/herdr-app/mods/issue-launcher`. The panel opens as a floating Herdr window with `mod.open`.
- The panel shows the active project's issues in three tabs (assigned to me, others' open issues, my closed issues), grouped by status labels read from the project's `CLAUDE.md` `## Issue 狀態` section, with the same default label list and colors as gl-issues.
- It picks `gh` for repos whose `origin` points at github.com and `glab` otherwise, run through herdr's `exec` in the user's real environment.
- Under each issue it lists the herdr agents already working on it (matched from tab name, terminal title, working folder and launch arguments) with their status; clicking one focuses that agent.
- Each issue has a start button that opens a new herdr tab running `claude -n "#<id> <title>"` in the project folder with a first message asking Claude to read the issue and its comments and stop after summarising.
- Clicking the issue number opens the issue page in the system browser.
- The panel refreshes every 5 minutes and on a refresh button; agent matching updates live without refetching.

## Non-Goals (optional)

Recorded in design.md.

## Capabilities

### New Capabilities

- `issue-panel`: Which project the panel follows, how it fetches and groups issues (provider detection, status board from CLAUDE.md, the three tabs, collapse state, refresh, error display).
- `issue-sessions`: How the panel ties issues to herdr agents and acts on them (matching agents to issues, focusing an agent, starting a new Claude session for an issue, opening the issue page).

### Modified Capabilities

(none)

## Impact

- New files: mods/issue-launcher/main.js, mods/issue-launcher/mod.json, supporting modules under mods/issue-launcher/, a README.md, and unit tests for the pure logic.
- Local setup: one copied mod folder in ~/.config/herdr-app/mods/issue-launcher/; the person's layouts and keys.json are not edited.
- Runtime dependencies on the user's machine: herdr-app, `git`, and `gh` or `glab` logged in; `open` (macOS) or `xdg-open` to open issue pages. No network calls from the mod itself beyond those CLIs.
