import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme } from "herdr";

export default class IssueLauncher extends View {
  render() {
    const t = theme();
    return v_flex().size_full().bg(t.surface).p(10).text_size(13).text_color(t.dim).child(div().child("讀取中…"));
  }
}
