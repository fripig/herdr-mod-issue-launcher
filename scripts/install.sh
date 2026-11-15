#!/usr/bin/env bash
# Copy the issue-launcher mod and its layout into herdr-app. Re-run after every
# change: the copy is what reloads the running mod. herdr-app refuses modules
# that resolve outside its mods folder, so symlinks into this repo can't be used.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
src="$repo/mods/issue-launcher"
home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
dest="$home/mods/issue-launcher"
manifest="$dest/.installed-from"

# Files herdr-app writes into every mod folder itself.
app_owned() { case "$1" in jsconfig.json|*.d.ts) return 0 ;; esac; return 1; }
# What the last install recorded (empty when there is none or it came from elsewhere).
installed=""
if [ -f "$manifest" ] && [ "$(head -n 1 "$manifest")" = "$src" ]; then installed="$(tail -n +2 "$manifest")"; fi
recorded() { printf '%s\n' "$installed" | grep -qxF "$1"; }

# Check everything before changing anything.
# Earlier installs: one symlink to the folder, or a folder of symlinks into $src.
if [ -L "$dest" ] && [ "$(readlink "$dest")" != "$src" ]; then
  echo "refusing: $dest is a symlink to $(readlink "$dest")" >&2; exit 1
fi
if [ -e "$dest" ] && [ ! -L "$dest" ]; then
  [ -d "$dest" ] || { echo "refusing: $dest exists and is not a folder" >&2; exit 1; }
  if [ ! -f "$manifest" ] || [ "$(head -n 1 "$manifest")" != "$src" ]; then
    for entry in "$dest"/* "$dest"/.[!.]*; do
      [ -e "$entry" ] || [ -L "$entry" ] || continue
      name="$(basename "$entry")"
      if app_owned "$name" && [ ! -L "$entry" ]; then continue; fi
      case "$(readlink "$entry" 2>/dev/null)" in
        "$src"/*) ;;
        *) echo "refusing: $dest was not installed from $src ($name)" >&2; exit 1 ;;
      esac
    done
  fi
fi
for layout in "$repo"/layouts/*.json; do
  [ -f "$layout" ] || continue
  name="$(basename "$layout")"
  if [ -e "$home/layouts/$name" ] && ! recorded "layout:$name"; then
    echo "refusing: $home/layouts/$name exists and was not installed from $repo" >&2; exit 1
  fi
done

[ -L "$dest" ] && rm "$dest"
mkdir -p "$dest" "$home/layouts"
# Remove what the last install put there (or old symlinks), then copy the current files.
printf '%s\n' "$installed" | while IFS= read -r entry; do
  case "$entry" in
    "") ;;
    layout:*) rm -f "$home/layouts/${entry#layout:}" ;;
    *) rm -f "$dest/$entry" ;;
  esac
done
for entry in "$dest"/*; do [ -L "$entry" ] && rm "$entry"; done

files=()
for file in "$src"/*; do
  name="$(basename "$file")"
  [ -f "$file" ] || continue
  app_owned "$name" && continue
  cp "$file" "$dest/$name"
  files+=("$name")
done
for layout in "$repo"/layouts/*.json; do
  [ -f "$layout" ] || continue
  cp "$layout" "$home/layouts/$(basename "$layout")"
  files+=("layout:$(basename "$layout")")
done
{ echo "$src"; printf '%s\n' "${files[@]}"; } > "$manifest"
echo "installed ${#files[@]} files: $src -> $dest"
