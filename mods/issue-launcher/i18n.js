// The panel's own text in English and Traditional Chinese. No herdr imports, so `node --test` runs it.
// Status labels, issue titles and CLI output are data and never pass through here.

export const STRINGS = {
  en: {
    tabMine: "Mine",
    tabOthers: "Others",
    tabClosed: "Closed",
    emptyMine: "No open issues assigned to you.",
    emptyOthers: "No open issues from others.",
    emptyClosed: "No closed issues assigned to you.",
    updatedAt: "Updated {time}",
    loading: "Loading…",
    refresh: "Refresh",
    collapseAll: "Collapse all",
    expandAll: "Expand all",
    notGit: "This space isn't in a git repo.",
    cliFailed: "{cli} failed: {reason}",
    unparsable: "could not parse the output",
    openFailed: "Could not open the issue page: {reason}",
    noStatus: "(No status)",
    closedGroup: "Closed",
    switchLabel: "中",
    prompt: "First read issue #{id} and its comments with `{view}`, then summarize the requirement, the acceptance criteria and anything still unclear. Stop after the summary and wait for my instructions; don't start changing code.",
  },
  "zh-TW": {
    tabMine: "我的",
    tabOthers: "其他",
    tabClosed: "已關閉",
    emptyMine: "沒有指派給你的 open issue。",
    emptyOthers: "沒有其他人的 open issue。",
    emptyClosed: "沒有指派給你的已關閉 issue。",
    updatedAt: "更新於 {time}",
    loading: "讀取中…",
    refresh: "重新整理",
    collapseAll: "全部收合",
    expandAll: "全部展開",
    notGit: "目前的 space 不在 git repo 裡。",
    cliFailed: "{cli} 失敗：{reason}",
    unparsable: "無法解析輸出",
    openFailed: "開啟 issue 頁面失敗：{reason}",
    noStatus: "（無狀態）",
    closedGroup: "已關閉",
    switchLabel: "EN",
    prompt: "請先用 `{view}` 讀取 issue #{id} 的內容與留言，摘要需求、驗收條件與待釐清的地方。摘要完先停下來等我指示，不要開始改程式碼。",
  },
};

export const LANGUAGES = ["en", "zh-TW"];

// A system language value (zh-Hant-TW, zh_TW.UTF-8, en-US…) to one of ours: zh* is zh-TW, anything else en.
export const pickLanguage = (value) => (/^zh/i.test((value ?? "").trim()) ? "zh-TW" : "en");

// The first entry of `defaults read -g AppleLanguages`, which prints a plist array like ("zh-Hant-TW", en).
export const firstAppleLanguage = (stdout) => /[A-Za-z][\w-]*/.exec((stdout ?? "").replace(/^\s*\(/, ""))?.[0] ?? "";

// What a detection run says: Chinese only when the program succeeded and named a zh language.
// result is exec's { code, stdout }, or null when it couldn't run.
export const languageFromDetection = (platform, result) =>
  !result || result.code !== 0 ? "en" : pickLanguage(platform === "macos" ? firstAppleLanguage(result.stdout) : result.stdout);

// The shared choice when it is one of ours, else the detected language.
export const chooseLanguage = (chosen, detected) => (LANGUAGES.includes(chosen) ? chosen : detected);

// The text for key in lang, with {name} placeholders filled; English when the language or key is missing.
export const t = (lang, key, params = {}) => {
  const text = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
};
