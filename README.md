# Saguaro Kitchen Co. intranet

A static website for an ASU supply chain course: students sit at a desk on their first day at a fictional fast-casual restaurant chain, read their mail and message colleagues (chatbots in the university's AI tool). Live at https://ariccheng.github.io/scm-intranet/. No build step; nothing about students leaves their own browser.

**The repository is public.** Put only public information in it: no sales, inventory, costs, prices, lead times, routes or other internal numbers, and no hints about company problems.

## Preview

```
python3 -m http.server 8000
```

Open http://localhost:8000/. Add `?today=2027-02-04` to see the date and week number of another day. It does not open more weeks.

## Open a new week

Weeks that are not open yet live in `content-staging/weeks/` (git-ignored, never pushed).

1. Fill in the week and replace every `TODO`.
2. `./publish-week.sh 03` copies it into `content/weeks/`, adds it to `content/weeks/index.json` and runs `python3 tools/check.py`. It rolls back if the check finds a problem.
3. Commit and push. The site updates within a few minutes.

Content adds up week by week. Only the sticky-note to-dos come from the newest week alone.

## Where things are

| Path | What |
|---|---|
| `content/company.json` | Company facts, stores, menu, suppliers, class days and breaks |
| `content/people.json` | Colleagues and their contact status |
| `content/ui.json` | Every word of the interface |
| `content/scene.json`, `content/map.json` | Desk layout; store map background (OpenStreetMap freeways, keep the credit) |
| `content/weeks/week-XX/` | `week.json`, `unlocks.json`, `emails/`, `files.json`, `newspaper.json`, `desk.json` |
| `tools/check.py` | Checks content before you push (`--staging` checks staged weeks) |
| `tools/make_stores_list.py` | Rebuilds the stores and menu spreadsheet |

Full notes for the instructor (file formats, statuses, desk art, open questions) are in `content-staging/README-full.md`, which is not pushed.
