## 1. Dictionary

- [x] 1.1 Add `mods/issue-launcher/i18n.js` (Dictionary module) with `STRINGS` for `en` and `zh-TW`, `pickLanguage` and `t`, covering every interface string now in `main.js` and `logic.js`. Verify: `node --test test/` passes a new `test/i18n.test.js` asserting every row of the "detection" example, key parity between the two languages, and placeholder substitution.

## 2. Language-aware logic

- [x] 2.1 [after: 1.1] Pass the language as a parameter to logic.js: `defaultBoard(lang)`, `groupName(key, lang)` for the no-status and closed groups (keys unchanged), `summarize(…, lang)`, `initialPrompt(provider, issue, lang)`, the `"unparsable"` error code, and `parseBoard` accepting `Issue status` (Status board from CLAUDE.md). Verify: `node --test test/` passes, with the existing zh-TW expectations unchanged plus tests for the English heading, both default boards, and the English first message containing `gh issue view 15 --json title,body,labels,comments`.

## 3. Interface language in the panel

- [ ] 3.1 [after: 2.1] In `main.js`, detect once and override in shared state for the Interface language: detection at init, `issue-launcher.lang` read in render, every string through `t`, and the EN / 中 switch in the title row calling `setShared`. Verify: `herdr-app check` passes; the person confirms that clicking EN turns the docked panel and the floating window to English together, that 中 turns them back, and that the choice survives `scripts/install.sh`.

## 4. Documentation

- [ ] 4.1 [after: 3.1] Update README.md and RECIPE.md: languages, detection, the switch, the `## Issue status` heading, and the English default board. Verify: content review.
