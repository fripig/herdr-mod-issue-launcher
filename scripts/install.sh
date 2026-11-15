#!/usr/bin/env bash
# Install the issue-launcher mod into herdr-app as a real folder of symlinks
# into this repo, so saving a file here hot-reloads the mod. Re-run after
# adding or removing a file under mods/issue-launcher/.
set -euo pipefail

src="$(cd "$(dirname "$0")/../mods/issue-launcher" && pwd)"
dest="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/issue-launcher"

# An older install was one symlink to the whole folder: replace only that.
if [ -L "$dest" ]; then
  if [ "$(readlink "$dest")" = "$src" ]; then rm "$dest"; else echo "refusing: $dest is a symlink to $(readlink "$dest")" >&2; exit 1; fi
fi

if [ -e "$dest" ]; then
  [ -d "$dest" ] || { echo "refusing: $dest exists and is not a folder" >&2; exit 1; }
  for entry in "$dest"/* "$dest"/.[!.]*; do
    [ -e "$entry" ] || [ -L "$entry" ] || continue
    # herdr-app writes its own type files into every mod folder.
    case "$(basename "$entry")" in jsconfig.json|*.d.ts) [ -L "$entry" ] || continue ;; esac
    case "$(readlink "$entry" 2>/dev/null)" in
      "$src"/*) ;;
      *) echo "refusing: $entry is not a symlink into $src" >&2; exit 1 ;;
    esac
  done
fi

mkdir -p "$dest"
# Drop links whose file was removed from the repo, then link every file.
for entry in "$dest"/*; do
  [ -L "$entry" ] || continue
  case "$(basename "$entry")" in jsconfig.json|*.d.ts) rm "$entry"; continue ;; esac
  [ -e "$entry" ] || rm "$entry"
done
for file in "$src"/*; do
  case "$(basename "$file")" in jsconfig.json|*.d.ts) continue ;; esac
  [ -f "$file" ] && ln -sfn "$file" "$dest/$(basename "$file")"
done
echo "installed: $dest -> $src"
