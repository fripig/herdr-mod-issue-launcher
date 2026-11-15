## Context

The archived change `add-issue-launcher-mod` shipped the panel as a floating window, because `mod.json` `place: "right"` never docked it into Herdr's `main` layout (measured 2026-11-15, Herdr app 0.1.15). AGENTS.md says shipped layouts accept only click/look edits through `layout.set`, and shipped layouts and mods are replaced at start, so `main` and the shipped `tabs` mod (which draws the Files and Changes buttons) cannot gain a block or a button.

What `main` (`~/.config/herdr-app/layouts/main.json`, Herdr app 0.1.15) looks like:

- `root` row: `titlebar: "none"`, `traffic_lights`, `background: "canvas"`, `terminal_padding`, `divider`.
- `sidebar` column: `brand`, `sidebar-lists` (`spaces`, `agents`), `sidebar-footer`.
- `work` column, `resizable: false`:
  - `tabs`: 42px, `window_drag`, mod `tabs`.
  - `work-body` row: `main` (the active tab), then `panel`, a column that is hidden by default, 368px, min 280, max 900, holding `panel-body`, a stack of `files` and `changes`.
  - `status`: 28px, mod `workspace-status`.

The shipped `tabs` mod finds nodes by id (`sidebar`, `panel`, `panel-body`). Its Files and Changes buttons run `layout.select {stack: "panel-body", child}` plus `layout.show {id: "panel"}`, or `layout.hide {id: "panel"}` when that child is already shown. When the space changes, it restores a space's last panel only if that child id is in the shared `workspace.panels` list (default `["files", "changes"]`, also written by the welcome frame).

## Goals / Non-Goals

**Goals:**

- The issue panel docks in the right panel like Files and Changes, with an Issues button in the tab bar.
- No shipped layout or mod is copied or edited. Only a layout file of our own is added.
- One mod serves the docked panel, the button and the floating window.

**Non-Goals:**

- Copying the shipped `tabs` mod to put Issues between Files and Changes. Rejected by the person: it forks the tab bar.
- Switching the person to the new layout, or making it their default. They switch with `cmd-shift-l` or `layout.switch {name: "issue-launcher"}`.
- Keeping the copied layout in sync with future changes to Herdr's `main`.
- A key binding for the panel.

## Decisions

### Own layout copied from main

Add `layouts/issue-launcher.json`: Herdr app 0.1.15's `main.json` with every node, id and look field kept, plus two changes:

- `panel-body` gets a third child, `{ "id": "issues", "type": "block", "content": { "mod": "issue-launcher" } }`.
- The `tabs` block (42px) is replaced by a row `tabs-row` of 42px holding:
  - the unchanged `tabs` block, at weight 1
  - a new `issues-button` block, 88px wide (an estimate, to be checked on screen and adjusted), whose content is `{ "mod": "issue-launcher", "props": { "role": "button" } }`

Keeping the ids keeps the shipped mods working. Alternative: `layout.clone` inside the app. Rejected because the result is not in the repo and cannot be shared or reinstalled.

### Button role in the same mod

`props().role === "button"` makes the View skip its fetch timers and draw only the button. Its style matches the shipped `tabs` panel buttons:

- the block: `chrome` background, 1px `border` line at the bottom, so it continues the tab bar
- the button: 26px high, 8px horizontal padding, 5px gap, 6px corners, 12px text, a 14px icon (`issues.svg` in the mod folder)
- colors: `selected` background and `foreground` text while on, `chrome` background and `muted` text otherwise

"On" means the `panel` node in `layout()` is not hidden and `panel-body`'s `active` is `issues`. The click logic lives in `logic.js` as `panelToggle(panelHidden, active)`, which returns the list of `[command, args]` pairs to run, so the example table in the spec is unit-tested.

### Close button only in a window

The panel draws ✕ only when `props().overlay` is set, which is true only for the floating window. The current code already does this, so the docked copy has a title row without ✕.

### workspace.panels gets issues

The button copy's `init` calls `setShared("workspace.panels", withIssuesPanel(shared("workspace.panels")))` when the result differs. `withIssuesPanel` lives in `logic.js`. It treats `undefined` and `null` as `["files", "changes"]` and appends `issues` only if missing. With this, the shipped tab bar restores the Issues panel per space.

### Install the layout by copy

`scripts/install.sh` also copies `layouts/issue-launcher.json` to `~/.config/herdr-app/layouts/issue-launcher.json` and lists it in the mod's `.installed-from` manifest. It refuses when a layout with that name exists that the manifest does not list. Herdr applies layout files live.

## Implementation Contract

**Behavior.**

- In the `issue-launcher` layout the window looks like `main`, plus an Issues button to the right of the tab bar.
- Clicking Issues shows the right panel on the issue list, which has a title row without ✕. Clicking again hides it.
- Files and Changes keep working. Switching spaces restores Issues for a space that last showed it.
- `mod.open` still opens the floating window with ✕.

**Interfaces.**

- `logic.js` gains `withIssuesPanel(list) -> string[]` and `panelToggle(hidden, active) -> [string, object][]`:
  - on (shown and `active === "issues"`) → `[["layout.hide", {id: "panel"}]]`
  - otherwise → `[["layout.select", {stack: "panel-body", child: "issues"}], ["layout.show", {id: "panel"}]]`
- `main.js`: `props().role === "button"` selects the button view.
- Files: `layouts/issue-launcher.json`, `mods/issue-launcher/issues.svg`.

**Failure modes.**

- If the layout or its `panel` / `panel-body` node is missing (the button shown in another layout), the button still draws, and clicking it runs the commands. Herdr reports unknown ids as error toasts.
- `install.sh` exits 1 with "refusing: …" for a layout it did not install.

**Acceptance.**

- `node --test test/` passes with tests for both example tables in the spec.
- `herdr-app check ~/.config/herdr-app/mods/issue-launcher` passes.
- After `scripts/install.sh`, `herdr-app status` shows no errors and `herdr-app do layout.switch --name issue-launcher` succeeds. A screenshot shows the Issues button next to Files and Changes.
- The person confirms in the app:
  - the button toggles the panel as in the example table
  - Files and Changes still toggle
  - a space that showed Issues shows it again after switching away and back
- Switching back to `main` with `layout.switch` leaves `main` unchanged.

**Scope.**

- In: `layouts/issue-launcher.json`, `mods/issue-launcher/` (main.js, logic.js, issues.svg), `test/logic.test.js`, `scripts/install.sh`, README.md, RECIPE.md.
- Out: shipped layouts and mods, keys.json, the person's choice of layout.

## Risks / Trade-offs

- [The layout is a snapshot of `main` from Herdr app 0.1.15. Later Herdr changes to `main` don't reach it.] → README and RECIPE name the version it was copied from, and say to re-copy `main.json` and re-apply the two changes.
- [The 88px button block is an estimate.] → The apply task checks it on screen and adjusts it.
- [The welcome frame may rewrite `workspace.panels` and drop `issues`.] → The button copy re-adds `issues` every time it starts.
- [The docked panel and a floating window open at the same time fetch separately, doubling CLI calls.] → Acceptable. The floating window is optional.
