import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS, pickLanguage, firstAppleLanguage, t } from "../mods/issue-launcher/i18n.js";

test("detection", () => {
  assert.equal(pickLanguage("zh-Hant-TW"), "zh-TW");
  assert.equal(pickLanguage("zh_TW.UTF-8"), "zh-TW");
  assert.equal(pickLanguage("ZH-tw"), "zh-TW");
  assert.equal(pickLanguage("en-US"), "en");
  assert.equal(pickLanguage("ja-JP"), "en");
  assert.equal(pickLanguage(""), "en");
  assert.equal(pickLanguage(null), "en");
});

test("first AppleLanguages entry", () => {
  assert.equal(firstAppleLanguage('(\n    "zh-Hant-TW"\n)\n'), "zh-Hant-TW");
  assert.equal(firstAppleLanguage("(\n    en,\n    \"zh-Hant-TW\"\n)"), "en");
  assert.equal(firstAppleLanguage(""), "");
});

test("both languages have the same keys", () => {
  assert.deepEqual(Object.keys(STRINGS["zh-TW"]).sort(), Object.keys(STRINGS.en).sort());
});

test("placeholders and fallback", () => {
  assert.equal(t("en", "cliFailed", { cli: "gh", reason: "401" }), "gh failed: 401");
  assert.equal(t("zh-TW", "cliFailed", { cli: "glab", reason: "401 Unauthorized" }), "glab 失敗：401 Unauthorized");
  assert.equal(t("en", "tabMine"), "Mine");
  assert.equal(t("en", "refresh"), "Refresh");
  assert.equal(t("en", "emptyMine"), "No open issues assigned to you.");
  assert.equal(t("zh-TW", "emptyMine"), "沒有指派給你的 open issue。");
  assert.equal(t("en", "switchLabel"), "中");
  assert.equal(t("zh-TW", "switchLabel"), "EN");
  assert.equal(t("fr", "refresh"), "Refresh");
});

test("detection result and chosen language", async () => {
  const { languageFromDetection, chooseLanguage } = await import("../mods/issue-launcher/i18n.js");
  assert.equal(languageFromDetection("macos", { code: 0, stdout: '(\n    "zh-Hant-TW"\n)' }), "zh-TW");
  assert.equal(languageFromDetection("linux", { code: 0, stdout: "zh_TW.UTF-8" }), "zh-TW");
  assert.equal(languageFromDetection("linux", { code: 0, stdout: "en_US.UTF-8" }), "en");
  assert.equal(languageFromDetection("macos", { code: 1, stdout: "zh-Hant-TW" }), "en");
  assert.equal(languageFromDetection("macos", null), "en");
  assert.equal(chooseLanguage("zh-TW", "en"), "zh-TW");
  assert.equal(chooseLanguage("en", "zh-TW"), "en");
  assert.equal(chooseLanguage("fr", "zh-TW"), "zh-TW");
  assert.equal(chooseLanguage(undefined, "en"), "en");
});
