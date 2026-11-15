## Why

The issue launcher is published on herdr.dev, but every word in its panel is Traditional Chinese, so most people who find it can't read it. The person who uses it daily reads Traditional Chinese. The panel should show English or Traditional Chinese, chosen from the system language, and let anyone switch.

## What Changes

- Every interface string comes from a dictionary with `en` and `zh-TW` entries, in a new `mods/issue-launcher/i18n.js`. This covers tabs, header, buttons, messages, errors, the "no status" and "closed" group names, and the first message sent to a new Claude session.
- The language is detected once at start:
  - macOS: the first entry of `defaults read -g AppleLanguages`.
  - elsewhere: `LANG`.
  - A value starting with `zh` selects `zh-TW`; anything else selects `en`.
- A small 中 / EN switch in the panel's title row sets the language. The choice is stored in Herdr's shared value `issue-launcher.lang`, so every copy (docked panel, floating window) switches together. It overrides detection until switched again.
- Status labels stay data and are never translated. The board heading is also accepted in English (`## Issue status`). When no board is written, the default board depends on the language: the existing eight Chinese labels for `zh-TW`, and `In progress`, `In review`, `Ready`, `Discussion`, `Done` for `en`.
- The tab-bar button keeps its name "Issues" in both languages, like Herdr's own Files and Changes buttons.

## Non-Goals (optional)

Recorded in design.md.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `issue-panel`: the panel's text follows a chosen interface language; the status board accepts an English heading and has a per-language default.

## Impact

- New: `mods/issue-launcher/i18n.js`.
- Changed: `mods/issue-launcher/main.js`, `mods/issue-launcher/logic.js`, `test/logic.test.js` (and a new `test/i18n.test.js`), README.md, RECIPE.md, preview.png only if the default view changes.
- Runs one more program at start: `defaults` on macOS, or `sh -c 'printf %s "$LANG"'` elsewhere.
