#!/usr/bin/env bash
# Copy the issue-launcher mod into herdr-app. Re-run after every change: the copy
# is what reloads the running mod. herdr-app refuses modules that resolve outside
# its mods folder, so symlinks into this repo can't be used.
set -euo pipefail

src="$(cd "$(dirname "$0")/../mods/issue-launcher" && pwd)"
dest="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/issue-launcher"
manifest="$dest/.installed-from"

# Files herdr-app writes into every mod folder itself.
app_owned() { case "$1" in jsconfig.json|*.d.ts) return 0 ;; esac; return 1; }

# Earlier installs: one symlink to the folder, or a folder of symlinks into $src.
if [ -L "$dest" ]; then
  if [ "$(readlink "$dest")" = "$src" ]; then rm "$dest"; else echo "refusing: $dest is a symlink to $(readlink "$dest")" >&2; exit 1; fi
fi

if [ -e "$dest" ]; then
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

mkdir -p "$dest"
# Remove what the last install put there (or old symlinks), then copy the current files.
if [ -f "$manifest" ]; then
  tail -n +2 "$manifest" | while IFS= read -r name; do [ -n "$name" ] && rm -f "$dest/$name"; done
fi
for entry in "$dest"/*; do [ -L "$entry" ] && rm "$entry"; done

files=()
for file in "$src"/*; do
  name="$(basename "$file")"
  [ -f "$file" ] || continue
  app_owned "$name" && continue
  cp "$file" "$dest/$name"
  files+=("$name")
done
{ echo "$src"; printf '%s\n' "${files[@]}"; } > "$manifest"
echo "installed ${#files[@]} files: $src -> $dest"
