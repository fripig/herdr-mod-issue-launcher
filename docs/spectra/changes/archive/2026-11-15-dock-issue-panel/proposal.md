## Why

The issue panel only exists as a floating window that covers the terminals. The person wants it docked like Herdr's Files and Changes panels, with a button in the tab bar that shows and hides it. Herdr's shipped `main` layout and `tabs` mod cannot be changed in structure (a mod with `place: "right"` was never docked into `main`), so the panel needs a layout of its own.

## What Changes

- Add a layout `layouts/issue-launcher.json` to this repo. It is a copy of Herdr's `main` layout structure with two additions:
  - an `issues` block in the right panel stack next to `files` and `changes`
  - a small block to the right of the tab bar that shows an "Issues" button
- The `issue-launcher` mod draws the button when given `props: { role: "button" }`. Clicking it shows the panel on Issues, or hides it when Issues is already shown, the same way Files and Changes behave. Herdr's shipped `tabs` mod is not copied.
- Without the role, the mod still draws the issue panel, so the same code fills the docked block and the floating window. The ✕ close button shows only in the floating window.
- The mod adds `issues` to the shared `workspace.panels` list, so the shipped `tabs` mod keeps the Issues panel per space when switching spaces.
- `scripts/install.sh` also copies the layout into `~/.config/herdr-app/layouts/`, refusing to replace a layout it did not install. Switching to the layout stays the person's choice (`layout.switch`, `cmd-shift-l`).

## Non-Goals (optional)

Recorded in design.md.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `issue-panel`: adds the docked panel and its tab-bar button, and how the panel is kept when switching spaces.

## Impact

- New: `layouts/issue-launcher.json`.
- Changed: `mods/issue-launcher/main.js` (button role, close button only in a window, `workspace.panels`), `mods/issue-launcher/logic.js` with its tests, `scripts/install.sh`, README.md, RECIPE.md.
- The person's own layouts, keys.json, and Herdr's shipped layouts and mods are not edited. The shared `workspace.panels` value gains `issues`.
