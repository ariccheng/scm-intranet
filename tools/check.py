"""Check the intranet's content files before publishing.

    python3 tools/check.py              the site as students see it (content/)
    python3 tools/check.py --staging    also every staged week, as if published

Run it from the scm-intranet folder (or pass that folder as an argument).
It reads content/ and reports problems the site would otherwise only show
in the browser: broken JSON, missing files, file names whose upper/lower
case does not match (works on a Mac, fails on GitHub Pages), emails with
missing header fields, unknown people or attachments, badly written times,
desk papers that name a spot scene.json does not have, and week folders
that are not listed in weeks/index.json.

It also scans the text students read (emails, newspaper, desk papers,
people, company.json, week.json) for words that suggest internal numbers
(sales, inventory, cost, lead time ...) and lists them as notes, with file
and line. The site shows public information only; internal numbers reach
students through the chatbots. A note is not an error: a newspaper story
may mention prices on purpose. Nothing is changed.

With --staging it copies content/ to a temporary folder, adds every week
in content-staging/weeks/ (and merges week-15-after-class into week-15),
and checks that copy. Placeholders still marked TODO show up as problems
there; that is expected until the week is written.
"""
import datetime
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
STAGING = "--staging" in sys.argv[1:]
SITE = (Path(ARGS[0]) if ARGS else Path(__file__).parent.parent).resolve()
ROOT = SITE                     # the folder being checked: the site, or a temporary copy with the staged weeks
CONTENT = ROOT / "content"
_TIME = re.compile(r"^(?:W(\d{1,2})\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})$|^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$", re.I)


class TIME:
    """A time as the site reads it: "Mon 09:00", "W3 Fri 17:00" or "2027-01-11[T09:00]", with real hours, minutes, weeks and days."""
    @staticmethod
    def match(s):
        m = _TIME.match(str(s).strip())
        if not m:
            return False
        week, h, mi, day, h2, mi2 = m.groups()
        if day:
            try:
                datetime.date.fromisoformat(day)
            except ValueError:
                return False
            h, mi = h2, mi2
        if week is not None and int(week) < 1:
            return False
        return h is None or (int(h) <= 23 and int(mi) <= 59)
DESK_TYPES = {"memo": ["subject", "body"], "flyer": []}   # fields each type needs; a flyer prints whatever it has
STORE_TYPES = {"Urban", "Suburban", "Urban edge"}           # shown in the store table and the Excel list
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
INTERNAL = re.compile(r"\b(sales|revenues?|inventor(y|ies)|stock[ -]?levels?|stock[ -]?outs?|out of stock|wastes?|wasted|spoilage|"
                      r"costs?|margins?|profits?|lead[ -]?times?|back[ -]?orders?|shortages?|order quantit(y|ies)|prices?|par levels?|"
                      r"routes?|mileage|miles|stop orders?)\b"
                      r"|\$\s?\d[\d,.]*|\b\d+(\.\d+)?\s?%", re.I)
problems, notes, internal = [], [], []


def rel(p):
    return str(p.relative_to(ROOT))


def exists_exact(path):
    """True if every part of the path exists with exactly this upper/lower case."""
    p = ROOT
    for part in path.relative_to(ROOT).parts:
        if not p.is_dir() or part not in {c.name for c in p.iterdir()}:
            return False
        p = p / part
    return True


def load(path, required=True):
    if not path.exists():
        if required:
            problems.append(f"{rel(path)}: file is missing")
        return None
    if not exists_exact(path):
        problems.append(f"{rel(path)}: exists but its upper/lower case differs (fails online)")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        problems.append(f"{rel(path)}: not valid JSON (line {e.lineno}, column {e.colno}: {e.msg})")
        return None


def items(value, where):
    """A list of {...}; anything else is reported."""
    if value is None:
        return []
    if not isinstance(value, list):
        problems.append(f"{where}: should be a list [...]")
        return []
    for i, x in enumerate(value):
        if not isinstance(x, dict):
            problems.append(f"{where}: item {i + 1} should be {{...}}")
    return [x for x in value if isinstance(x, dict)]


def check_path(value, base, where):
    """A content path: '#', a web address, or a file that must exist."""
    if not isinstance(value, str) or not value or value == "#":
        return
    scheme = re.match(r"^([a-z][a-z0-9+.-]*):", value, re.I)
    if scheme:
        if scheme.group(1).lower() not in ("http", "https", "mailto"):
            problems.append(f'{where}: "{value}" is not a web (http/https) or mailto address; the site will not open it')
        return
    if value.startswith("/"):
        problems.append(f'{where}: "{value}" starts with "/"; write it relative to its folder')
        return
    target = Path(os.path.normpath(base / value))   # not resolve(): --staging links assets/ into a temporary folder
    if not target.exists():
        problems.append(f'{where}: "{value}" does not exist')
    elif not exists_exact(target):
        problems.append(f'{where}: "{value}" exists but its upper/lower case differs (fails online)')
    if re.search(r"[\s()]", value):
        notes.append(f'{where}: "{value}" has spaces or brackets; plain-dash names are safer')


def scan(path):
    """Note every line of a file students read that mentions an internal-sounding word or number."""
    if not path.is_file():
        return
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if re.search(r"\bTODO\b", line) and '"_note"' not in line:
            problems.append(f"{rel(path)}:{n}: still says TODO; students would see it")
        if re.search(r"\b(mailto|tel):", line, re.I):
            notes.append(f"{rel(path)}:{n}: has a mailto: or tel: link; contact details are meant to be plain text")
        found = sorted({m.group(0).strip().lower() for m in INTERNAL.finditer(line)})
        if found:
            internal.append(f'{rel(path)}:{n}: {", ".join(found)}')


def front_matter(text):
    lines = text.lstrip("﻿").replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return None
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return None
    data, key = {}, None
    for line in lines[1:end]:
        if not line.strip() or line.strip().startswith("#"):
            continue
        m = re.match(r"^\s*-\s+(.*)$", line)
        if m and key:
            data[key].append(m.group(1).strip().strip("\"'"))
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            k, v = k.strip(), v.strip()
            if not v:
                data[k], key = [], k
            else:
                key = None
                data[k] = [s.strip().strip("\"'") for s in v[1:-1].split(",") if s.strip()] if v.startswith("[") and v.endswith("]") else v.strip("\"'")
    return data


def add_people(value, where, people):
    """people.json (top level or a week's): id and name required; contact "email" or left out."""
    for p in items(value, where):
        pid = p.get("id")
        if not pid or not p.get("name"):
            problems.append(f'{where}: every person needs "id" and "name" ({pid or p.get("name") or "?"})')
            continue
        if pid in people:
            notes.append(f'{where}: "{pid}" is already listed earlier; this entry replaces it')
        people.add(pid)
        if "contact" in p and p["contact"] not in ("email", None):
            problems.append(f'{where} {pid}: contact "{p["contact"]}" should be "email" or left out')
        for k in ("external", "listed"):
            if k in p and not isinstance(p[k], bool):
                problems.append(f'{where} {pid}: {k} should be true or false')
        check_path(p.get("avatar"), ROOT, f"{where} {pid} avatar")


def iso_day(value):
    try:
        return datetime.date.fromisoformat(str(value))
    except ValueError:
        return None


def check_company(company):
    """Class days and breaks set the weeks: week n is the Monday-to-Sunday week of the n-th class."""
    days = company.get("classDays")
    if not isinstance(days, list) or not days:
        problems.append('company.json: classDays is missing (one date per class, for example ["2027-01-14", "2027-01-21"])')
        days = []
    dates = []
    for d in days:
        day = iso_day(d)
        if day is None:
            problems.append(f'company.json classDays: "{d}" should look like "2027-01-14"')
        else:
            dates.append(day)
    if dates != sorted(dates) or len(set(dates)) != len(dates):
        problems.append("company.json classDays: dates should be in order, each once")
    mondays = {d - datetime.timedelta(days=d.weekday()) for d in dates}
    if len(mondays) != len(dates):
        problems.append("company.json classDays: two classes fall in the same week (Monday to Sunday); each class is one week")
    if len({d.weekday() for d in dates}) > 1:
        odd = [str(d) for d in dates if d.weekday() != dates[0].weekday()]
        notes.append(f"company.json classDays: not all on a {dates[0]:%A} ({', '.join(odd)}); fine if the class really moved")
    for i, b in enumerate(items(company.get("breaks"), "company.json breaks")):
        day = iso_day(b.get("date"))
        if day is None:
            problems.append(f'company.json breaks {i + 1}: date "{b.get("date")}" should look like "2027-03-11"')
            continue
        if not b.get("label"):
            problems.append(f'company.json breaks {b["date"]}: needs a "label", for example "Spring break" (shown in the top bar)')
        if day - datetime.timedelta(days=day.weekday()) in mondays:
            problems.append(f'company.json breaks {b["date"]}: falls in the same week as a class day')
    for k in ("termStartDate", "termWeeks", "simStartDate"):
        if k in company:
            notes.append(f"company.json: {k} is no longer used; classDays sets the weeks")
    zone = company.get("timeZone")
    if not isinstance(zone, str) or not zone:
        problems.append('company.json: timeZone is missing (for example "America/Phoenix")')
    else:
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(zone)
        except ImportError:
            pass
        except Exception:
            problems.append(f'company.json: timeZone "{zone}" is not a known time zone (for example "America/Phoenix")')
    stores = items(company.get("stores"), "company.json stores")
    codes = [st.get("code") for st in stores]
    if len(codes) != len(set(codes)):
        problems.append("company.json stores: two stores share a code")
    for st in stores:
        w = f'company.json store {st.get("code") or st.get("name") or "?"}'
        if not st.get("code") or not st.get("name"):
            problems.append(f'{w}: needs "code" and "name"')
        if st.get("type") not in STORE_TYPES:
            problems.append(f'{w}: type "{st.get("type")}" should be one of {", ".join(sorted(STORE_TYPES))}')
        if not all(isinstance(st.get(x), (int, float)) for x in ("lat", "lon")):
            problems.append(f'{w}: needs "lat" and "lon" (numbers) for the store map')
    # supplier contacts are shown as plain text; the card never makes a phone or mail link
    for sp in items(company.get("suppliers"), "company.json suppliers"):
        for k in ("contact", "phone", "email"):
            v = sp.get(k)
            if isinstance(v, str) and re.match(r"^\s*(mailto|tel|https?):", v, re.I):
                notes.append(f'company.json supplier {sp.get("name")}: {k} "{v}" is a link address; write the plain number or address (it is shown as text)')
    for k in ["logo", "wallpaper"]:
        check_path(company.get(k), ROOT, f"company.json {k}")
    return dates


def main():
    if not CONTENT.is_dir():
        sys.exit(f"No content/ folder in {ROOT}")
    for f in ["ui.json", "company.json", "people.json", "scene.json", "credits.json"]:
        load(CONTENT / f)
    company = load(CONTENT / "company.json", False) or {}
    class_days = check_company(company if isinstance(company, dict) else {})
    people = set()
    add_people(load(CONTENT / "people.json", False), "people.json", people)
    scan(CONTENT / "company.json")
    scan(CONTENT / "people.json")
    # the store map's background (optional)
    mp = load(CONTENT / "map.json", False)
    if isinstance(mp, dict):
        for k in ("cities", "venues"):
            for i, c in enumerate(items(mp.get(k), f"map.json {k}")):
                if not c.get("name") or not all(isinstance(c.get(x), (int, float)) for x in ("lat", "lon")):
                    problems.append(f'map.json {k} {i + 1}: needs "name", "lat" and "lon"')
        if mp.get("roads") and not mp.get("attribution"):
            problems.append('map.json: "attribution" is missing; OpenStreetMap data must credit "OpenStreetMap contributors"')
    elif mp is not None:
        problems.append("map.json: should be an object with cities, venues and roads")
    scene = load(CONTENT / "scene.json", False) or {}
    for s in (scene.get("base") or {}).get("srcset") or []:
        check_path(s.get("src"), ROOT, "scene.json base.srcset")
    for o in (scene.get("objects") or []) + (scene.get("decor") or []):
        check_path(o.get("image"), ROOT, f"scene.json {o.get('id')}")
    spots = set()
    for o in items(scene.get("spots"), "scene.json spots"):
        if not o.get("id") or any(not isinstance(o.get(k), (int, float)) for k in "xywh"):
            problems.append(f'scene.json spots: "{o.get("id", "?")}" needs id, x, y, w and h')
        spots.add(o.get("id"))
        check_path(o.get("image"), ROOT, f"scene.json spot {o.get('id')}")

    weeks_dir = CONTENT / "weeks"
    listed = load(weeks_dir / "index.json") or []
    folders = sorted(p.name for p in weeks_dir.iterdir() if p.is_dir())
    for name in folders:
        if name not in listed:
            notes.append(f"weeks/{name}/ is not in weeks/index.json, so students do not see it (it is still public on GitHub)")
    file_ids, unlocked, no_link = set(), set(), []
    ordered = sorted((w for w in listed if isinstance(w, str)), key=lambda w: (len(w), w))
    if ordered != [w for w in listed if isinstance(w, str)]:
        notes.append("weeks/index.json: weeks are not in order (the site sorts them, so this is only tidiness)")
    for wid in ordered:
        wk = weeks_dir / str(wid)
        where = f"weeks/{wid}"
        if not re.match(r"^week-\d{2}$", str(wid)):
            problems.append(f'weeks/index.json: "{wid}" should look like week-01')
            continue
        if not wk.is_dir() or not exists_exact(wk):
            problems.append(f"weeks/index.json lists {wid}, but there is no folder with exactly that name")
            continue
        week = load(wk / "week.json") or {}
        week = week if isinstance(week, dict) else {}
        scan(wk / "week.json")
        for kind in ["todos", "phoneNotifications", "calendarEvents"]:
            for i, item in enumerate(week.get(kind) or []):
                if not isinstance(item, dict):
                    problems.append(f'{where}/week.json {kind}[{i + 1}]: should be {{"id": ..., ...}}')
                elif not item.get("id"):
                    problems.append(f"{where}/week.json {kind}[{i + 1}]: needs an id")
        n_week = int(str(wid)[5:])
        for e in [x for x in week.get("calendarEvents") or [] if isinstance(x, dict)]:
            for k in ["start", "end"]:
                if e.get(k) and not TIME.match(e[k]):
                    problems.append(f'{where}/week.json event {e.get("id")}: {k} "{e[k]}" should look like "Thu 10:30"')
            day = re.match(r"^(?:W\d{1,2}\s+)?(\w{3})\s", str(e.get("start", "")))
            if e.get("kind") == "class" and day and not re.match(r"^W", str(e["start"])) and n_week <= len(class_days) \
                    and day.group(1).title() != DAYS[class_days[n_week - 1].weekday()]:
                notes.append(f'{where}/week.json event {e.get("id")}: class on {day.group(1)}, but classDays puts week {n_week} on {class_days[n_week - 1]:%a %b %d}')
        if n_week > len(class_days):
            notes.append(f"{where}: classDays has only {len(class_days)} classes, so week {n_week} has no class day")
        for n in [x for x in week.get("phoneNotifications") or [] if isinstance(x, dict)]:
            if n.get("time") and not TIME.match(n["time"]):
                problems.append(f'{where}/week.json phone {n.get("id")}: time "{n["time"]}" should look like "Mon 08:00"')
        if "now" in week:
            notes.append(f'{where}/week.json: "now" is no longer used (the site follows the real calendar)')

        # people who join this week, then the colleagues who can be messaged
        add_people(load(wk / "people.json", False), f"{where}/people.json", people)
        scan(wk / "people.json")
        for u in items(load(wk / "unlocks.json", False), f"{where}/unlocks.json"):
            pid = u.get("personId")
            if pid not in people:
                problems.append(f'{where}/unlocks.json: unknown personId "{pid}" (not in people.json or an earlier week\'s people.json)')
            if "botUrl" in u and u["botUrl"] is None:      # relock: out of office again from this week on
                if pid not in unlocked:
                    notes.append(f'{where}/unlocks.json {pid}: "botUrl": null takes {pid} offline, but no earlier week made them available')
                unlocked.discard(pid)
                continue
            if not u.get("botUrl"):
                problems.append(f'{where}/unlocks.json {pid}: botUrl is missing (use "#" until the chat link exists, or null to take them offline)')
            elif u["botUrl"] == "#":
                no_link.append(f"{wid} {pid}")
            check_path(u.get("botUrl"), wk, f"{where}/unlocks.json {pid} botUrl")
            unlocked.add(pid)
            q = u.get("quota")
            if q is not None and (isinstance(q, bool) or not isinstance(q, int) or q < 1):
                problems.append(f'{where}/unlocks.json {pid}: quota should be a whole number of questions, or null for no limit')

        # newspaper stories
        story_ids = set()
        for i, s in enumerate(items(load(wk / "newspaper.json", False), f"{where}/newspaper.json")):
            w = f'{where}/newspaper.json story {s.get("id") or i + 1}'
            if not s.get("id") or not s.get("headline"):
                problems.append(f'{w}: needs "id" and "headline"')
            if s.get("id") in story_ids:
                problems.append(f'{w}: id is used twice in this file')
            story_ids.add(s.get("id"))
            body = s.get("body")
            if body is not None and not isinstance(body, str) and not (isinstance(body, list) and all(isinstance(p, str) for p in body)):
                problems.append(f"{w}: body should be a list of paragraph strings")
        scan(wk / "newspaper.json")

        # papers on the desk
        for d in items(load(wk / "desk.json", False), f"{where}/desk.json"):
            w = f'{where}/desk.json {d.get("id", "?")}'
            if not d.get("id") or d.get("type") not in DESK_TYPES:
                problems.append(f'{w}: needs "id" and a "type" of {" or ".join(DESK_TYPES)}')
                continue
            if d.get("spot") not in spots:
                problems.append(f'{w}: spot "{d.get("spot")}" is not one of the spots in scene.json ({", ".join(sorted(map(str, spots))) or "none yet"})')
            for k in DESK_TYPES[d["type"]]:
                if not d.get(k):
                    problems.append(f"{w}: {k} is missing")
            if d.get("date") and not TIME.match(str(d["date"])):
                notes.append(f'{w}: date "{d["date"]}" is shown as written (times look like "W2 Mon 08:00")')
            if isinstance(d.get("body"), str) and d["body"]:
                check_path(d["body"], wk, f"{w} body")
                scan(wk / d["body"])
            check_path(d.get("image"), wk, f"{w} image")
        scan(wk / "desk.json")

        for f in items(load(wk / "files.json", False), f"{where}/files.json"):
            file_ids.add(f.get("id"))
            check_path(f.get("url"), wk, f"{where}/files.json {f.get('id')}")
        dash = items(load(wk / "dashboards" / "index.json", False), f"{where}/dashboards/index.json")
        if dash:
            notes.append(f"{where}/dashboards/index.json: lists dashboards; the plan for this course keeps data off the site")
        for d in dash:
            check_path(d.get("file"), wk / "dashboards", f"{where}/dashboards {d.get('id')}")
        login = (week.get("loginNotification") or {}).get("emailId")
        email_ids = set()
        for name in load(wk / "emails" / "index.json", False) or []:
            path = wk / "emails" / name
            check_path(name, wk / "emails", f"{where}/emails/index.json")
            if not path.exists():
                continue
            scan(path)
            data = front_matter(path.read_text(encoding="utf-8"))
            w = f"{where}/emails/{name}"
            if data is None:
                problems.append(f'{w}: must start with a header between two "---" lines')
                continue
            for k in ["id", "fromPersonId", "subject", "sentAt"]:
                if not data.get(k):
                    problems.append(f"{w}: header is missing {k}")
            email_ids.add(data.get("id"))
            if data.get("fromPersonId") and data["fromPersonId"] not in people:
                problems.append(f'{w}: unknown fromPersonId "{data["fromPersonId"]}"')
            if data.get("sentAt") and not TIME.match(data["sentAt"]):
                problems.append(f'{w}: sentAt "{data["sentAt"]}" should look like "Mon 08:30"')
            atts = data.get("attachments") or []
            for a in [atts] if isinstance(atts, str) else atts:
                if a not in file_ids:
                    problems.append(f'{w}: attachment "{a}" is not an id in files.json of this or an earlier week')
        if login and login not in email_ids:
            notes.append(f'{where}/week.json: loginNotification emailId "{login}" is not an email of this week')
    if no_link:
        notes.append(f'chat links still "#" (shows "not set up yet"): {", ".join(no_link)}')



def stage_copy(tmp):
    """A copy of the site's content/ with every staged week added, as if all were published."""
    global ROOT, CONTENT
    staged = SITE / "content-staging" / "weeks"
    if not staged.is_dir():
        sys.exit(f"No content-staging/weeks/ folder in {SITE}")
    shutil.copytree(SITE / "content", tmp / "content", ignore=shutil.ignore_patterns(".DS_Store"))
    for item in SITE.iterdir():    # assets/ and the rest are only read: link them instead of copying
        if item.name not in ("content", "content-staging"):
            (tmp / item.name).symlink_to(item)
    weeks = tmp / "content" / "weeks"
    index = json.loads((weeks / "index.json").read_text(encoding="utf-8"))
    added = []
    for src in sorted(p for p in staged.iterdir() if p.is_dir() and re.match(r"^week-\d{2}$", p.name)):
        if src.name in index:
            notes.append(f"content-staging/weeks/{src.name}/ is already published; the copy in content/weeks/ is checked")
            continue
        shutil.copytree(src, weeks / src.name, ignore=shutil.ignore_patterns(".DS_Store"))
        index.append(src.name)
        added.append(src.name)
    # after-class extras (week-15-after-class): their emails join that week
    for src in sorted(p for p in staged.iterdir() if p.is_dir() and re.match(r"^week-\d{2}-.+$", p.name)):
        target = weeks / src.name[:7]
        if not target.is_dir():
            problems.append(f"content-staging/weeks/{src.name}/: {src.name[:7]} is neither published nor staged")
            continue
        names = json.loads((src / "emails" / "index.json").read_text(encoding="utf-8"))
        (target / "emails").mkdir(exist_ok=True)
        for name in names:
            shutil.copy2(src / "emails" / name, target / "emails" / name)
        listed = json.loads((target / "emails" / "index.json").read_text(encoding="utf-8")) if (target / "emails" / "index.json").exists() else []
        (target / "emails" / "index.json").write_text(json.dumps(listed + [n for n in names if n not in listed]), encoding="utf-8")
    (weeks / "index.json").write_text(json.dumps(sorted(set(index))), encoding="utf-8")
    ROOT, CONTENT = tmp, tmp / "content"
    return added


def report(added=()):
    def show(msg):   # in --staging, name the staged folder the instructor edits, not the temporary copy
        for w in added:
            msg = msg.replace(f"weeks/{w}", f"content-staging/weeks/{w}").replace(f"content/content-staging", "content-staging")
        return msg
    for n in notes:
        print("note:", show(n))
    if internal:
        print("note: words that may point to internal numbers (the site shows public information only; fine in a news story):")
        for n in internal:
            print("   ", show(n))
    for p in problems:
        print("PROBLEM:", show(p))
    print(f"{len(problems)} problem(s), {len(notes) + len(internal)} note(s).")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    if STAGING:
        with tempfile.TemporaryDirectory() as tmp:
            added = stage_copy(Path(tmp).resolve())
            print(f"Checking content/ with the staged weeks added: {', '.join(added) or 'none'}")
            main()
            report(added)
    main()
    report()
