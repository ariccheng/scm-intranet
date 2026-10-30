#!/bin/bash
# ---- Publish a staged week ----------------------------------------------------------
#   ./publish-week.sh 03            content-staging/weeks/week-03 -> content/weeks/week-03
#   ./publish-week.sh 03 --force    replace content/weeks/week-03 if it is already there
#   ./publish-week.sh 15-after-class
#                                   add the emails in content-staging/weeks/week-15-after-class
#                                   to the published week-15 (for mail sent after class)
# Copies the week, adds it to content/weeks/index.json and runs tools/check.py.
# If the check reports a problem, everything is put back as it was and the
# script stops with an error. It never runs git: preview, then commit and push
# yourself. Run it from anywhere; it works in the folder it lives in.
set -u
cd "$(dirname "$0")" || exit 1

force=0; arg=""
for a in "$@"; do
  case "$a" in
    --force) force=1 ;;
    -h|--help) sed -n 2,11p "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) arg="$a" ;;
  esac
done
if [[ ! "$arg" =~ ^[0-9]{1,2}(-[a-z0-9-]+)?$ ]]; then
  echo "Usage: ./publish-week.sh 03 [--force]   (or 15-after-class)" >&2; exit 2
fi
num="${arg%%-*}"; extra="${arg#"$num"}"
week="week-$(printf '%02d' "$((10#$num))")"
src="content-staging/weeks/${week}${extra}"
dest="content/weeks/$week"
index="content/weeks/index.json"

[ -d "$src" ] || { echo "Not found: $src" >&2; exit 1; }
backup="$(mktemp -d "${TMPDIR:-/tmp}/publish-week.XXXXXX")" || exit 1
trap 'rm -rf "$backup"' EXIT
cp "$index" "$backup/index.json"

if [ -n "$extra" ]; then
  # after-class mail: merge the emails into the published week
  [ -d "$dest" ] || { echo "$dest is not published yet; publish $week first." >&2; exit 1; }
  cp -R "$dest" "$backup/week"
  python3 - "$src" "$dest" <<'PY' || { echo "Nothing changed." >&2; exit 1; }
import json, shutil, sys
from pathlib import Path
src, dest = Path(sys.argv[1]), Path(sys.argv[2])
names = json.loads((src / "emails" / "index.json").read_text(encoding="utf-8"))
(dest / "emails").mkdir(exist_ok=True)
idx = dest / "emails" / "index.json"
listed = json.loads(idx.read_text(encoding="utf-8")) if idx.exists() else []
for n in names:
    if n in listed or (dest / "emails" / n).exists():
        sys.exit(f"{dest}/emails/{n} is already there")
for n in names:
    shutil.copy2(src / "emails" / n, dest / "emails" / n)
idx.write_text(json.dumps(listed + names) + "\n", encoding="utf-8")
print(f"Added {', '.join(names)} to {dest}/emails/")
PY
  restore() { rm -rf "$dest"; cp -R "$backup/week" "$dest"; }
else
  if [ -e "$dest" ]; then
    [ "$force" = 1 ] || { echo "$dest already exists. Use --force to replace it." >&2; exit 1; }
    cp -R "$dest" "$backup/week"
    rm -rf "$dest"
  fi
  cp -R "$src" "$dest"
  find "$dest" -name .DS_Store -delete
  python3 - "$index" "$week" <<'PY'
import json, sys
path, week = sys.argv[1], sys.argv[2]
weeks = json.load(open(path, encoding="utf-8"))
weeks = sorted(set(weeks + [week]), key=lambda w: (len(w), w))
open(path, "w", encoding="utf-8").write(json.dumps(weeks) + "\n")
n = int(week.split("-")[1])
gap = [f"week-{i:02d}" for i in range(1, n) if f"week-{i:02d}" not in weeks]
if gap:
    print(f"Warning: {', '.join(gap)} not published yet; students will skip from the last open week to {week}.")
PY
  restore() { rm -rf "$dest"; [ -d "$backup/week" ] && cp -R "$backup/week" "$dest"; cp "$backup/index.json" "$index"; }
  echo "Copied $src to $dest and added $week to $index."
fi

echo "Running tools/check.py ..."
if python3 tools/check.py; then
  echo "Published $week. Preview with ?today= set to a day in that week, then commit and push."
else
  restore
  echo "The check found problems (listed above). $week was NOT published; content/ is as it was." >&2
  exit 1
fi
