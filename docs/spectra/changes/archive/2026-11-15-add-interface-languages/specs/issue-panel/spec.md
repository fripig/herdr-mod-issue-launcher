## ADDED Requirements

### Requirement: Interface language

The panel SHALL show all of its own text in one interface language, `en` or `zh-TW`. Its own text means tabs, header, buttons, messages, errors, the "no status" and "closed" group names, and the first message of a session started with ▶. Status labels, issue titles, and CLI output SHALL NOT be translated. The language SHALL be the shared value `issue-launcher.lang` when it is `en` or `zh-TW`. Otherwise it SHALL be detected once at start: the first entry of `defaults read -g AppleLanguages` on macOS, else the `LANG` environment value. A value starting with `zh` (case-insensitive) selects `zh-TW`; any other value, or a failed detection, selects `en`. The title row SHALL show a switch labelled with the other language ("EN" while in `zh-TW`, "中" while in `en`). Clicking it SHALL set `issue-launcher.lang` to that language, so every copy of the panel changes at once.

#### Scenario: Detected language

- **WHEN** the panel starts with `issue-launcher.lang` unset
- **THEN** it picks the language from the system value

##### Example: detection

| System value | Language |
| ------------ | -------- |
| zh-Hant-TW | zh-TW |
| zh_TW.UTF-8 | zh-TW |
| en-US | en |
| ja-JP | en |
| (detection failed) | en |

#### Scenario: Switching language

- **WHEN** the panel is in `zh-TW` and the person clicks EN
- **THEN** `issue-launcher.lang` becomes `en`, and every open copy shows 我的 as "Mine", 重新整理 as "Refresh" and 沒有指派給你的 open issue。 as "No open issues assigned to you."

## MODIFIED Requirements

### Requirement: Status board from CLAUDE.md

The panel SHALL read the status labels from a `## Issue 狀態` or `## Issue status` heading (any heading level, case-insensitive) in the project's `CLAUDE.md`, else `.claude/CLAUDE.md`, taking each list item under it as one label until the next heading; a trailing `#rgb` or `#rrggbb` on an item SHALL set that label's color. Labels without a color SHALL take colors in order from the palette `#4ade80`, `#facc15`, `#22d3ee`, `#c084fc`, `#60a5fa`, `#fb923c`, `#f472b6`. The last label SHALL be the done status. When neither file has the section, the panel SHALL use the default labels of the interface language: for `zh-TW` 進行中, 檢驗中, 測試站待檢驗, 正式站待檢驗, 已上線待檢驗, 可處理, 討論中, 已完成; for `en` In progress, In review, Ready, Discussion, Done. The board SHALL be re-read on every refresh.

#### Scenario: Custom board with a color

- **WHEN** CLAUDE.md contains the section with items "進行中 #ff0000", "可處理", "已完成"
- **THEN** the board is [進行中, 可處理, 已完成], 進行中 is `#ff0000`, 可處理 is `#4ade80`, and 已完成 is the done status

#### Scenario: English heading

- **WHEN** CLAUDE.md contains `## Issue status` with items "Doing", "Done"
- **THEN** the board is [Doing, Done] with Done as the done status, in either interface language

#### Scenario: No board section

- **WHEN** neither CLAUDE.md file has a board heading
- **THEN** the default labels of the interface language are used, with 已完成 (`zh-TW`) or Done (`en`) as the done status
