"""Keep every outside link of the intranet in one table.

    python3 tools/links.py status    list every link slot and what it holds now
    python3 tools/links.py apply     copy the links from the table into the content files

The table is content-staging/LINKS.md (not pushed). Each row has a key:
    chat:<personId>   a colleague's chat link (botUrl in that person's unlocks.json)
    file:<fileId>     a Files entry whose url is a web link (url in files.json)
An empty link cell (or "#") means "not set up yet"; the site then shows that
note instead of opening anything. apply writes the same link into every week
folder that has the slot, in content/weeks/ and content-staging/weeks/, and
leaves "botUrl": null (taking a colleague offline) alone. Only https:// links
are accepted. Run python3 tools/check.py afterwards.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / "content-staging" / "LINKS.md"
WEEKS = [ROOT / "content" / "weeks", ROOT / "content-staging" / "weeks"]
ROW = re.compile(r"^\|\s*`((?:chat|file):[\w-]+)`\s*\|(.*)\|\s*$")


def rel(p):
    return str(p.relative_to(ROOT))


def read_table():
    """{key: link} from LINKS.md; the link is the last cell of the row."""
    if not TABLE.exists():
        sys.exit(f"{rel(TABLE)} is missing")
    links = {}
    for n, line in enumerate(TABLE.read_text(encoding="utf-8").splitlines(), 1):
        m = ROW.match(line.strip())
        if not m:
            continue
        cells = [c.strip().strip("`<>") for c in m.group(2).split("|")]
        link = cells[-1] if cells else ""
        if link and link != "#" and not link.startswith("https://"):
            sys.exit(f"{rel(TABLE)} line {n}: {m.group(1)} link should start with https:// (or stay empty)")
        links[m.group(1)] = link or "#"
    return links


def slots():
    """Every link slot in the week folders: (key, file, list, index, field)."""
    for base in WEEKS:
        for wk in sorted(base.glob("week-*")):
            for name, prefix, id_key, field in (("unlocks.json", "chat", "personId", "botUrl"), ("files.json", "file", "id", "url")):
                path = wk / name
                if not path.exists():
                    continue
                data = json.loads(path.read_text(encoding="utf-8"))
                for i, item in enumerate(data if isinstance(data, list) else []):
                    if not isinstance(item, dict) or not item.get(id_key) or field not in item:
                        continue
                    value = item[field]
                    if field == "botUrl" and value is None:
                        continue   # a colleague going offline, not a link
                    if field == "url" and isinstance(value, str) and value != "#" and not value.startswith("http"):
                        continue   # a file stored in the site (files/...), not a link
                    yield f"{prefix}:{item[id_key]}", path, data, i, field


def dump(data):
    """One object per line, like the hand-written files."""
    return "[\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False).replace('{"', '{ "').replace('"}', '" }') for x in data) + "\n]\n"


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd not in ("status", "apply"):
        sys.exit(__doc__)
    table = read_table() if cmd == "apply" or TABLE.exists() else {}
    found = list(slots())
    if cmd == "status":
        for key, path, data, i, field in found:
            value = data[i][field]
            mark = "ok " if value not in ("#", "") else "-- "
            upload = data[i].get("type") == "pdf" and key not in table   # a PDF to put in files/, see LINKS.md section 3
            note = "" if key in table else "   (a file to upload, see LINKS.md section 3)" if upload else "   (no row in LINKS.md)"
            print(f"{mark}{key:28} {rel(path):48} {value}{note}")
        missing = sorted(set(table) - {k for k, *_ in found})
        for key in missing:
            print(f"?? {key:28} in LINKS.md but in no week folder")
        return
    changed = {}
    for key, path, data, i, field in found:
        if key in table and data[i][field] != table[key]:
            data[i][field] = table[key]
            changed[path] = data
            print(f"{key}: {rel(path)} -> {table[key]}")
    for path, data in changed.items():
        path.write_text(dump(data), encoding="utf-8")
    print(f"{len(changed)} file(s) changed. Next: python3 tools/check.py")


if __name__ == "__main__":
    main()
