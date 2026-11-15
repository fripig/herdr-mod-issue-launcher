## Context

All interface text is hard-coded Traditional Chinese, in `mods/issue-launcher/main.js` (tab names, empty texts, header, buttons, messages) and `mods/issue-launcher/logic.js` (`NO_STATUS`, `CLOSED_GROUP`, `DEFAULT_BOARD`, the "無法解析輸出" error, `initialPrompt`). Herdr gives mods no language setting: `herdr.d.ts` and `settings.json` have none. On the person's Mac, `defaults read -g AppleLanguages` prints `("zh-Hant-TW")`.

## Goals / Non-Goals

**Goals:**

- English and Traditional Chinese for all of the panel's own text, detected from the system and switchable from the panel.
- Status labels keep working as data. Existing boards and existing behaviour don't change for `zh-TW`.

**Non-Goals:**

- More languages. The dictionary shape allows them later.
- Translating status labels, issue titles, or CLI output.
- Renaming the tab-bar "Issues" button, or translating README/RECIPE. The docs are already split (README in Chinese, RECIPE in English).

## Decisions

### Dictionary module

`mods/issue-launcher/i18n.js` exports `STRINGS = { en: {...}, "zh-TW": {...} }`, `pickLanguage(systemValue)` and `t(lang, key, params)`. `t` substitutes `{name}` placeholders and falls back to `en` for a missing key. It has no `herdr` import, so `node --test` covers it. A test checks that both languages have the same keys.

### Language as a parameter to logic.js

Functions that produce text take the language:

- `defaultBoard(lang)` replaces the `DEFAULT_BOARD` constant.
- `parseIssues` throws a fixed code (`"unparsable"`). `main.js` maps the code to the localized text.
- `initialPrompt(provider, issue, lang)`.
- The "no status" and "closed" groups keep fixed keys (`NO_STATUS`, `CLOSED_GROUP`), which the collapsed set stores. `groupName(key, lang)` shows them in the interface language, and `summarize` takes `lang`. This way, switching language doesn't reset collapsed groups.

Grouping still compares labels exactly, so only the displayed names change.

### Detect once, override in shared state

At init each panel copy runs detection and caches the result:
- macOS (`window().platform === "macos"`): `defaults read -g AppleLanguages`, first quoted or bare entry.
- elsewhere: `sh -c 'printf %s "$LANG"'`.

`render` uses `shared("issue-launcher.lang")` when it is `en` or `zh-TW`, else the detected value. The title-row switch calls `setShared`, which re-renders every copy. Alternative: `localStorage`. Rejected because it is per copy, so the docked panel and the window would disagree.

## Implementation Contract

**Behavior.**
- With the setting unset on a zh system, the panel looks exactly as today, plus an "EN" chip in the title row.
- Clicking EN turns every copy to English, and the chip then reads "中".
- Without a board section, an `en` panel groups issues by In progress / In review / Ready / Discussion / Done.
- Clicking ▶ in `en` sends an English first message that contains the same view command.

**Interfaces.**
- `i18n.js`: `STRINGS`, `pickLanguage(value) -> "en" | "zh-TW"`, `t(lang, key, params?)`.
- `logic.js`: `defaultBoard(lang)`, `groupName(key, lang)`, `summarize(issues, board, lang)`, `parseBoard(markdown)` (also accepts `Issue status`), `initialPrompt(provider, issue, lang)`.
- Shared key: `issue-launcher.lang`.

**Failure modes.**
- If detection fails (the program errors, exits non-zero or prints nothing), the language is `en`, silently.
- An unknown value in `issue-launcher.lang` is ignored.

**Acceptance.**
- `node --test test/` passes, including:
  - the detection table
  - key parity between the two dictionaries
  - the English heading
  - both default boards
- `herdr-app check` passes.
- The person confirms the switch in the app: both copies change together, and the choice survives a reinstall.

**Scope.**
- In: `mods/issue-launcher/` (i18n.js, logic.js, main.js), the tests, README.md and RECIPE.md.
- Out: layouts, the `install.sh` logic, Herdr's shipped files.

## Risks / Trade-offs

- [An `en` user whose repo has the Chinese labels gets the English default board and sees everything under "No status".] → They add a board section to CLAUDE.md. README says so.
- [`defaults` output format could change.] → Parsing takes the first token that starts with a letter; on failure it falls back to `en`.
- [Two dictionaries can drift.] → The key-parity test fails when they do.
