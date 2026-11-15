# issue-launcher

Herdr 桌面版（herdr-app）的 mod：在浮動視窗列出目前 space 所在 repo 的 GitLab／GitHub issue，依 board 狀態 label 分組，並對到 Herdr 裡正在處理該 issue 的 agent，一鍵切換或開新 Claude session。

由 Claude Code mod [gl-issues](https://github.com/fripig/claude-mod-gl-issues) 改寫而來：不再綁在單一 Claude session 的目錄，而是跟著 Herdr 目前的 space 走，session 對應改用 Herdr 的即時資料（`agents()`、`panes()`、`terminals()`），開 session 用一個 `tab.new` 指令完成。

```
GitHub issues                              ✕
更新於 14:32:05 [重新整理] [全部收合]
進行中 2 · 討論中 5
[我的（7）] [其他（3）] [已關閉（12）]

▾ 進行中（2）
[#12] [▶] 新增登入頁        ← 點票號：用瀏覽器開 issue
  ↪ ◑ #12 新增登入頁         ← 點了切到那個 agent
[#15] [▶] 匯出報表 CSV      ← 點 ▶ 開新分頁跑 claude
▸ 已完成（3）
```

## 功能

- **跟著目前的專案**：取目前 space 焦點 pane 的資料夾（沒有就用 space 資料夾）所在的 git repo；切 space 就換 repo。不在 git repo 裡時顯示「目前的 space 不在 git repo 裡。」
- **GitLab／GitHub 自動切換**：`origin` 指到 `github.com` 用 `gh`，其餘（含自架 GitLab、沒有 origin）用 `glab`。
- **三個分頁**：我的（指派給我的 open issue）、其他（專案其他 open issue，含未指派）、已關閉（指派給我的已關閉 issue）。每份清單最多 100 張。
- **狀態分組**：依專案 `CLAUDE.md` 的狀態 label 分組、上色，最後一項是完成狀態（淡色、預設收起）。分頁與收合狀態會記住。
- **對應 session**：從 agent 的分頁名、終端機標題、工作目錄（例如 `gl-<id>-` worktree）、啟動參數抽出 issue 編號（`#123`、`gl-123`、`/issues/123`、`issue 123`、`票 123`），只看同一個 repo 底下的 agent；點 `↪` 執行 `agent.focus`。
- **開新 session**：▶ 在目前 space 開一個名為 `#<id> <標題>` 的分頁，執行 `claude -n "#<id> <標題>"`，第一句話請 Claude 用 `gh`／`glab` 讀 issue 與留言、摘要後停下等指示。
- **開 issue 頁面**：點 `#<id>` 用系統瀏覽器開（macOS `open`，其他 `xdg-open`）。
- 每 5 分鐘自動重新整理，或按「重新整理」。

## 需求

- Herdr 桌面版（herdr-app）
- `git`
- 依 repo 準備對應 CLI 並登入：GitHub 用 [`gh`](https://cli.github.com)（`gh auth status`），GitLab 用 [`glab`](https://gitlab.com/gitlab-org/cli)（`glab auth status`）
- `claude`（Claude Code）在登入 shell 的 PATH 上

## 安裝

```sh
scripts/install.sh
herdr-app check ~/.config/herdr-app/mods/issue-launcher
herdr-app do mod.open --name issue-launcher
```

`install.sh` 把 `mods/issue-launcher/` 的檔案複製到 `~/.config/herdr-app/mods/issue-launcher/`，並在 `.installed-from` 記下來源；資料夾不是它裝的就拒絕覆蓋。視窗可拖曳，Herdr 會記住位置並在下次啟動時重開；按 ✕ 關閉，`mod.open` 再打開。

為什麼不用 symlink、也不停靠在側邊：實測 herdr-app 不會載入解析到 mods 資料夾以外的模組（`logic.js` 透過 symlink 會失敗），而 `mod.json` 的 `place: "right"` 在 `main` layout 裡沒有停靠。細節見 `docs/spectra/changes/add-issue-launcher-mod/design.md`。

## 自訂狀態 label

在專案根目錄的 `CLAUDE.md`（或 `.claude/CLAUDE.md`）加一段 `## Issue 狀態` 清單。順序就是面板的排序，最後一項是完成狀態。顏色可在後面接色碼，沒寫就依序配色。每次重新整理都會重讀。

```markdown
## Issue 狀態

- 進行中 #4ade80
- 檢驗中
- 可處理
- 討論中
- 已完成
```

沒有這段時使用預設：進行中、檢驗中、測試站待檢驗、正式站待檢驗、已上線待檢驗、可處理、討論中、已完成。

## 開發

```sh
npm test                    # node --test test/：logic.js 的單元測試
scripts/install.sh          # 改完檔案後重新安裝，Herdr 會重新載入 mod
herdr-app check ~/.config/herdr-app/mods/issue-launcher
```

不依賴 Herdr 的邏輯放在 `mods/issue-launcher/logic.js`，畫面與 Herdr 呼叫放在 `main.js`。

## 沒有做的

- gl-issues 的 `/gl-issues-init`（寫入預設狀態清單）與狀態列摘要（摘要改放在面板頂端）
- 掃 Claude 對話紀錄找 issue 編號
- 建立 git worktree、修改 issue 或 label、在遠端機器開瀏覽器
- 修改你的 layout 或 `keys.json`
