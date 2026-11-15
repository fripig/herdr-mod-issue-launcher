## 1. Panel toggle and panels list logic

- [x] 1.1 Add `withIssuesPanel` and `panelToggle` to `mods/issue-launcher/logic.js` (workspace.panels gets issues; Button role in the same mod's click logic). Verify: `node --test test/` passes new tests asserting every row of the spec's "panels list" and "button clicks" example tables.

## 2. Own layout copied from main

- [x] 2.1 Add `layouts/issue-launcher.json` as the Docked issue panel layout (Own layout copied from main): Herdr app 0.1.15's `main.json` with all ids and look fields kept, `issues` as the third child of `panel-body`, and the `tabs` block wrapped in a 42px `tabs-row` with an 88px `issues-button` block (`props: { role: "button" }`). Extend `scripts/install.sh` to install the layout by copy, listing it in `.installed-from` and refusing a layout it did not install. Verify: `jq` shows the `files`, `changes`, `issues` children and the `issues-button` block; `scripts/install.sh` succeeds twice; in an isolated `HERDR_APP_HOME` with a foreign `layouts/issue-launcher.json`, it exits 1 with "refusing" and leaves the file unchanged.

## 3. Issues button in the tab bar

- [x] 3.1 [after: 1.1] Issues button in the tab bar: in `main.js`, make `props().role === "button"` skip fetch timers, draw the Issues button with `issues.svg` styled like the Files/Changes buttons and highlighted while on, run `panelToggle` on click, and ensure `workspace.panels` contains `issues` on start (Issues panel kept per space). The docked panel keeps a title row with the ✕ only in a floating window (Close button only in a window). Verify: `herdr-app check` passes; after `scripts/install.sh` and `herdr-app do layout.switch --name issue-launcher`, a screenshot taken while Herdr redraws shows the Issues button beside Files and Changes, and `shared.json` lists `issues` in `workspace.panels`.

## 3b. Pop out and dock back

- [x] 3.2 [after: 3.1] Pop out and dock back: the docked panel's title row gets a ⧉ button that hides the right panel and opens the floating window with `openOverlay` (same spec as `mod.json`, so an open window stays open); the floating window gets a ⇲ button, shown only when the layout's `panel-body` has an `issues` child, that closes the window and shows the Issues panel. The command lists live in `logic.js`. Verify: `node --test test/` covers the pop-out and dock-back command lists and the ⇲ visibility check; `herdr-app check` passes; the person confirms ⧉ and ⇲ in the app.

## 4. Check in the app

- [x] 4.1 [after: 2.1, 3.2] Adjust the `issues-button` width so the button fits without clipping or a large gap, then have the person confirm: the Issues button toggles the panel as in the "button clicks" table, Files and Changes still toggle, a space that showed Issues shows it again after switching spaces, and `mod.open` still opens the floating window with ✕. Verify: the person's confirmation is recorded in the commit message.

## 5. Documentation

- [x] 5.1 [after: 4.1] Update README.md and RECIPE.md: the `issue-launcher` layout, how to switch to it, that it is a copy of `main` from Herdr app 0.1.15 with the two additions, and how to re-apply them after a Herdr update. Verify: content review; the commands in both files run as written.
