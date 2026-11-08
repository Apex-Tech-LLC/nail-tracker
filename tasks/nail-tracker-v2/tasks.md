# Nail Tracker 2.0 build plan

**Status key:** ⬜ pending · 🔄 in progress · ✅ verified · 🚫 blocked

Builders: OpenCode with DeepSeek V4.1 Flash, one task per session, in its own worktree. Manager: reviews, pushes,
opens the pull request, waits for checks, merges, updates this file. Product: `docs/product-spec-v2.md`. Look:
`docs/design/v2-mockup.html`.

## Release 2.0: look and speed

| Task | What | Status |
|---|---|---|
| V01 | New look: colours, Be Vietnam Pro font, shared styles, bottom bar, page titles | ✅ |
| V02 | Compact turn rows, copy button on every row, swipe and long-press, undo bar | ✅ |
| V03 | Fast Add turn, part 1: repeat chips, chips sorted by use with prices, tip buttons, last-price hint, saved bar | ✅ |
| V04 | Fast Add turn, part 2: built-in number pad and compact top line | ✅ |

## Release 2.1: Home

| Task | What | Status |
|---|---|---|
| V05 | Comparison maths: same point last week/month, week days (domain + unit tests) | ✅ |
| V06 | Home screen: period switch, hero number, comparison, polish-bottle week view, stats, today's turns | ✅ |
| V07 | Home reminders; backup through the phone's share sheet, backup reminder, last backup date | ✅ |

## Release 2.2: Paycheck

| Task | What | Status |
|---|---|---|
| V08 | Pay rules by date, statement maths, paycheck check maths, database and backup upgrade (no screens) | ✅ |
| V09 | "How I'm paid" page: commission, supply fee, card-tip fee, check/cash split, rules by start date | 🔄 |
| V10 | Paycheck screen part 1: the statement, show by day, past periods; Home owes split | 🔄 |
| V11 | Paycheck parts 2 and 3: record check and cash, stub numbers, Matches / Short / Over with reasons, reminder | ⬜ |

## Release 2.3: Reports and goals

| Task | What | Status |
|---|---|---|
| V12 | Reports maths: period and last-year comparisons, by service, by weekday, clients, tips, records | ⬜ |
| V13 | Reports screen (replaces Earnings) with trend chart and goal line | ⬜ |
| V14 | History calendar view, filters, day off | ⬜ |
| V15 | Goals: weekly and monthly, Home progress, goal-met message | ⬜ |

## Release 2.4: Share, taxes, hours, guarantee, tiers

| Task | What | Status |
|---|---|---|
| V16 | Share statement and report summary as a picture, both languages, no network | ⬜ |
| V17 | Taxes and year summary, set-aside, export for the tax preparer | ⬜ |
| V18 | Hours: start and end day, suggested hours, pay per hour, minimum wage note | ⬜ |
| V19 | Guarantee and tiers in pay rules and the statement | ⬜ |
| V20 | Speed with 20,000 turns; Vietnamese check of all new words at 375 pixels | ⬜ |

Briefs for 2.3 and 2.4 are written when the release before them is merged, so they match the code as it is then.
