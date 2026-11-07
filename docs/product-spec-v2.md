# Nail Tracker 2.0: Product Spec

**Status:** draft for Bay's review, 6 November 2026
**Builds on:** `docs/product-spec.md` (version 1, built as tasks 1 to 25 and live today)
**Research behind it:** section 15 at the end lists every source.

---

## 1. Why version 2

Version 1 is a good notebook. A technician can log a turn in about 15 seconds, see today's total, and record what the
salon paid. But after logging, there is little to look at: the Earnings tab is a long list of numbers for one period, and
nothing answers the questions a technician actually asks:

- Did I do better than last week?
- How many turns, and of which services, did I do this week, this month?
- Is my paycheck right?
- How much of my pay comes as a check, and how much as cash?
- What is my real pay per hour?
- How much did I make in tips this year, for my taxes?

Version 2 turns the notebook into the place a technician checks every day and every payday.

### The promise, version 2

> Log a turn in seconds. See at a glance how your day, week and month are going. Know to the cent what the salon owes
> you, and catch it when your paycheck is short.

### What makes it different

The research found no app that checks a paycheck against what the technician logged. Salon software shows pay stubs only
when the salon uses that software, and the personal trackers stop at totals. Shorted checks, unexplained "product fees"
and card-tip fees are the most common pay complaints found. **Paycheck check is the centre of version 2.**

It stays free, private, offline, with no account, in Vietnamese and English. People were angry when Gridwise, a tracker
for delivery drivers, moved its free features behind a paywall and when another tracker lost a year of data, so being
free and keeping data safe are both selling points.

---

## 2. Who it is for

Unchanged from version 1: a Vietnamese-speaking nail technician in a US salon, paid by commission, often 60/40,
usually weekly. Version 2 adds what the research found about how they are really paid:

| Pay pattern | How common | What the app must handle |
|---|---|---|
| Commission 60/40, tips 100% to the tech | The norm in Vietnamese salons | Version 1 already does this |
| 50/50 or 70/30, or a different rate per service | Common | Version 1 already does this |
| Pay split into a check part and a cash part, often 50/50 | The traditional norm | **New:** check/cash split |
| Card tips held by the salon until payday | Common; can take 1 to 2 weeks | Version 1 tracks it; version 2 shows it clearly |
| Card-tip fee taken from tips, around 3% | Common; banned in California | **New:** card-tip fee |
| Supply or "product" fee: $5 per service, or about 5% of sales | Common, and often disputed | **New:** supply fee |
| Guaranteed pay: $100 to $200 a day, or a weekly floor | Common for new or slow-season techs | **New:** guarantee |
| Tiered commission: the rate rises as weekly sales rise | Some salons | **New:** tiers |
| Weekly pay; some every two weeks | Weekly is most common | Version 1 already does this |

### The main job, step by step

1. **Set up once:** language, how I am paid (rate, split, fees, guarantee), payday.
2. **Every client:** log the turn (services, price, tips). Several services at once; copy a past turn.
3. **During the day and week:** glance at Home: turns, earnings, progress toward my goal, how I compare to last week.
4. **On payday:** open Paycheck, enter what I got (check and cash), and see right away whether it matches. If it is
   short, see where, and show the owner a clear statement.
5. **Looking back:** compare weeks and months, see my best days and services, request versus walk-in clients, tips.
6. **Once a year (and each quarter if paid on a 1099 tax form):** see the year's totals and tips for taxes, and give the
   tax preparer a summary.

---

## 3. What exists today (version 1)

| Area | Built |
|---|---|
| Add turn | Services with price and rate, cash and card tips, turn count, time, client type, note, Save and Add Another, edit, delete |
| Today | Day totals and the day's turns |
| History | Turns by day, date filters, search by service, adjustments |
| Earnings | Totals for a day, week, month, year or custom range; averages; two bar charts; CSV export |
| Payday | Pay periods, expected pay, payments received and split across periods, balance owed |
| Settings | Language, rate, per-service rates, week start, payday, tip handling, service list, backup, restore, delete all |
| Setup | Four first-launch steps |
| Being built now | A Back button in setup; picking several services at once; Copy a turn; Repeat last turn |

Everything below either reshapes these screens or adds new ones. Nothing already saved may be lost: every change to how
data is stored comes with an upgrade that converts old data (section 9).

---

## 4. The new layout

Five tabs at the bottom, in this order:

| Tab | English | Vietnamese | Replaces |
|---|---|---|---|
| 1 | Home | Trang chính | Today |
| 2 | History | Lịch sử | History |
| 3 | Reports | Báo cáo | Earnings |
| 4 | Paycheck | Lương | Payday |
| 5 | Settings | Cài đặt | Settings |

A large **+ Add turn** button stays on Home. Every screen must work one-handed on a 375-pixel-wide phone, with tap
targets at least 44 pixels, in both languages, and offline.

### 4.1 Look and feel

Bay's verdict on version 1: it works but "looks like trash", and copying a turn is hidden. Version 2 gets a real
design. The picture to match is `docs/design/v2-mockup.html` (open it in a browser). The research behind it is
`docs/design/ux-research.md` (Cashew, Copilot, Monarch, Toshl, Server44, Strava, Apple, Nielsen Norman Group).

**Colours** (CSS variables in `src/index.css`; keep the variable names, change the values):

| Role | Light | Use |
|---|---|---|
| Ink | `#1d1822` | Text, dark buttons |
| Ink 2 / Ink 3 | `#5d5566` / `#8a8292` | Secondary and quiet text (check 4.5:1 contrast) |
| Base | `#f7f4f8` | Page background (cool, not beige) |
| Card | `#ffffff`, border `#ebe5ee` | Lists and cards |
| Lacquer | `#a3164d`, deep `#7d0f3a`, soft `#fbe7ef` | Main action, selected chips, the week bottles. Nothing else |
| Money | `#0d7a57` on `#e3f4ec` | Only for money you earned or got |
| Short | `#b4441b` on `#fdeee6` | Only for money missing or owed |

Dark mode comes later (release 2.5) and uses deep plum-navy, never pure black.

**Type:** Be Vietnam Pro (designed for Vietnamese, so accent marks sit cleanly), weights 400 to 800, Latin and
Vietnamese subsets only. All numbers use tabular figures. Big money numbers are 800 weight with tight letter spacing;
cents may be shown smaller and grey on hero numbers. In lists, whole dollars drop the cents (`$35`, but `$35.50`).

**Shapes:** lists are one white card with thin dividers between rows (not one card per row). Corners: 18px cards,
12px chips, 16px big buttons. No drop shadows except the floating Add turn button and sheets.

**Interaction rules (apply on every screen):**

1. **Copy is never more than one tap away.** Every turn row has a visible copy icon (44px). Swiping a row left shows
   Copy and Delete as a shortcut. Long-press opens a small menu: Copy, Edit, Delete.
2. **Undo instead of "Are you sure?".** Deleting a turn or adjustment happens at once and shows a bar for 6 seconds:
   `Turn deleted · Undo`. Saving a turn shows `Saved · you earn $27 · Undo · Copy again`. Only "Delete all data" keeps
   a confirmation.
3. **Compact rows.** One turn row is about 60px: a colour mark for the first service, service names, time and client
   type, earned on the right with the tip under it in green. About 10 rows fit on one screen.
4. **Day headers** show the day, number of turns and earned: `Friday, Nov 6 · 9 turns · $333`.
5. **Colour carries meaning, never decoration.** Green = earned, rust = short or owed, lacquer = act here.
6. **Chips scroll sideways** instead of wrapping onto a second line when they are filters.

---

## 5. Screens

Each screen lists what it shows, what you can do, its empty state, and **Done when** checks written as
"WHEN ... THE APP SHALL ...", each with a worked example. Money examples assume 60% commission unless stated.

### 5.1 Home (dashboard)

The screen a technician opens dozens of times a day. It answers "how am I doing?" in one look, without scrolling for
the most important part.

**Top to bottom:**

1. **Period switch:** three chips, `Today`, `This week`, `This month`. Today is chosen when the app opens. The app
   remembers the last choice for the rest of the day.
2. **Main card** for the chosen period:
   - **You earned** (big number): your share of services plus all tips, after fees, plus adjustments.
   - Under it: turns, clients, services.
   - A comparison line: `▲ $142 more than this time last week` or `▼ $60 less than this time last month`. "This time"
     means the same point in the earlier period: on Wednesday, this week compares to last Sunday to last Wednesday,
     not the whole of last week (section 7.4). Today compares to the same weekday last week.
   - **Goal progress** when a goal is set for that period: a bar and `$640 of $1,000 — $360 to go`.
3. **Money card:**
   - **Tips:** cash and card, with what share of your earnings came from tips.
   - **Salon owes you** for the current pay period, and how it splits: `Check $899 · Cash $899` (section 7.3).
   - **Card tips the salon is holding**, from all periods.
4. **Buttons:** `+ Add turn` (large) and `Repeat last turn` (secondary).
5. **Hours** (only when hours tracking is on, section 5.7): `Start day` / `End day` button and today's hours.
6. **Recent turns:** the last five today, each opening its edit screen. `See all` opens History.
7. **Reminders** (only when due, one at a time, dismissable): "You haven't saved a backup in 14 days", "Pay period
   ended: check your paycheck", "Your goal for this week was met".

**Empty state:** a short welcome, the Add turn button, and one line explaining what will appear here.

**Done when:**
- WHEN the technician logs a turn THE APP SHALL update every number on Home without a reload. *Example: a $45 pedicure
  with a $10 cash tip moves today's earned from $107.30 to $144.30.*
- WHEN `This week` is chosen on a Wednesday THE APP SHALL compare against last Sunday to last Wednesday (or Monday to
  Wednesday when the week starts Monday). *Example: this week so far $640; last Sunday to Wednesday $498; shows ▲ $142.*
- WHEN the earlier period has no data THE APP SHALL say "Nothing to compare yet" instead of a percentage.
- WHEN the pay rules include a 50/50 check/cash split THE APP SHALL show the amount owed split into the two parts.
  *Example: owed $1,798 shows Check $899 · Cash $899.*

### 5.2 Add turn

Version 1 plus several services at once, copy and repeat (shipped), and these speed-ups:

0. **Fast entry layout** (see the mockup): one screen, no pop-ups on top of it.
   - **Repeat chips** at the very top: the 3 to 5 most-used service-and-price combinations from the last 30 days, plus
     `Same as last`. One tap fills the services and prices; the technician only adds the tip and saves.
   - **Service chips sorted by use** (most used first), each showing the price it will fill in (`Gel mani $35`).
   - **Built-in number pad** with 56px keys and Save as one of its keys, instead of the phone keyboard, which jumps
     the screen around in home-screen web apps on iPhone. The pad types into the line that is underlined (each
     service price, cash tip, card tip); `Next` moves to the next one.
   - Date/time and commission % shrink to one small line at the top (`Today, 4:12 pm ▾`, `60% ▾`).
1. **Tip quick buttons** under each tip box: `$5`, `$10`, `$15`, `$20`, and `%` (15%, 18%, 20% of the services total).
   Tapping one fills the box; typing still works.
2. **Usual price:** each service fills in its usual price (already possible in the service list). New: when a service
   has no usual price, the app offers the price used last time for that service, shown as a grey hint the technician
   can tap to fill in.
3. **Who tipped how:** a turn can have both a cash and a card tip (already true).

**Shared client** (later phase, section 11): when two technicians work on one client, enter your share of the price and
tip; a `Shared` tag marks the turn so reports can count it.

**Done when:**
- WHEN the technician taps `$10` under Card tip THE APP SHALL put 10.00 in the box and update the preview.
- WHEN the technician taps `18%` with services totalling $60 THE APP SHALL put 10.80 in the tip box.
- WHEN a service has no usual price but was last logged at $35 THE APP SHALL show "Last time: $35" and fill it in on tap.

### 5.3 History

Version 1 plus:

1. **Month calendar view** (a toggle at the top: `List` / `Calendar`). Each day shows earned that day; darker colour
   means a bigger day. Tapping a day opens its list. Days marked as days off show a small "off" mark.
2. **Filters:** by service, by client type (request, walk-in), by tip type, by "has a note".
3. **Day summary row** for each day: turns, earned, hours when tracked.
4. **Mark a day off** (from the calendar): used by guarantee pay and averages.

**Done when:**
- WHEN the calendar is shown for November THE APP SHALL show each worked day's earned total on that day's cell.
- WHEN the filter `Request` is on THE APP SHALL list only turns marked as request clients, with totals for just those.

### 5.4 Reports (replaces Earnings)

Answers "how am I doing over time, and where does my money come from?". Top: the same period picker as version 1
(`Week`, `Month`, `Year`, `Custom`) with arrows to step back and forward. Below, sections in this order, each a card:

1. **Summary with comparison.** Earned, turns, clients, tips, hours. Each with the change from the previous period and,
   when there is data, from the same period last year. *Example: October earned $4,210, ▲ 8% on September, ▲ 15% on
   October last year.*
2. **Trend chart.** The last 12 weeks (in Week mode), 12 months (Month mode) or the days of the period. Bars for earned,
   a line for the goal when set. Tapping a bar shows its numbers and opens that period.
3. **By service.** For each service: how many, total price, your share, average price. Sorted by your share. *Example:
   Gel-X 14 · $980 · $588 · avg $70.*
4. **By weekday.** Average earned and turns on each weekday over the period, the best and slowest day highlighted.
   *Example: Saturday avg $310 (best), Tuesday avg $95 (slowest).*
5. **Clients.** Request versus walk-in: count, share, average tip for each. *Example: requests 38% of clients, average
   tip $14 versus $8.*
6. **Tips.** Cash versus card; average tip per client; average tip as a percent of the service price; card tips still
   held by the salon.
7. **Per hour** (when hours are tracked): earned per hour, with and without tips (section 5.7).
8. **Records.** Best day, best week, best month ever, most turns in a day. Shown only once there are 4 weeks of data.
9. **Export:** CSV of the period's turns (as version 1), and **Share summary**, which makes a picture or printable
   page of this report (section 5.9).

**Done when:**
- WHEN Month is chosen for October 2026 and September has data THE APP SHALL show October's earned and the change in
  dollars and percent. *Example: Oct $4,210, Sep $3,900: ▲ $310 (8%).*
- WHEN the previous period earned $0 THE APP SHALL show the dollar change only, never "infinite" or a divide-by-zero.
- WHEN a turn has three services THE APP SHALL count each service once in By service and the turn once in turns.
- WHEN shared or zero-turn entries exist THE APP SHALL count them in money but not in turns, exactly as version 1.

### 5.5 Paycheck (replaces Payday): the centre of version 2

One screen per pay period. The current period opens first; a list of past periods sits below, each marked
`Matches`, `Short $40`, `Over $12`, or `Not checked`.

#### Part 1: What you should get (the statement)

Laid out like a pay stub, every line traceable to the technician's own turns:

```
Pay period: Nov 1 – Nov 7                                  6 days worked
Services you did (45 services, 40 turns)                     $2,500.00
Supply fee ($2 × 45 services)                                  − $90.00
Your share (60% of $2,410.00)                                $1,446.00
Card tips                                                      $400.00
Card-tip fee (3%)                                              − $12.00
Adjustments                                                      $0.00
Guarantee ($150 × 6 days = $900): not needed                     $0.00
────────────────────────────────────────────────────────────────────────
Salon should pay you                                         $1,834.00
   as check (50%)                                              $917.00
   as cash (50%)                                               $917.00
Cash tips you already have                                     $300.00
You earned in total                                          $2,134.00
```

The supply fee in this example comes off the sales before the split; the other choice takes it off your share
(section 7.2). Each line appears only when that pay rule is in use. A technician with no fees and no split sees four
lines.

`Show by day` opens a day-by-day table (services total, your share, card tips, per day). Many salons hand out a daily
slip or show a weekly sheet, so the technician can compare line by line.

#### Part 2: What you got

`Record what you got` opens a form:
- **Check amount**, **cash amount**, and other payments (Zelle, direct deposit) with their date. Version 1 payments and
  the split across periods keep working.
- **Optional: what the salon's stub or sheet says.** Their services total, their tips total, their deductions. Any can
  be left blank.
- **Optional: photo of the check or stub**, kept only on the phone (section 9.4).

#### Part 3: The check

Right after saving, a result banner:

- **Matches** (within $1, to allow rounding): green.
- **Short $X**: amber, with the likely reasons below it.
- **Over $X**: neutral, with a note.

**Likely reasons** compare the stub numbers, when entered, with the statement:
- "The salon counted $112 less in services than you logged." If the day-by-day sheet was entered, the days that differ
  are named.
- "The salon took $50 more in deductions than your pay rules say."
- "Card tips: the salon counted $380; you logged $400."
- "The cash part is $20 short; the check part matches."

**Then:** `Mark as checked`, or `Share statement` (section 5.9) to show the owner a bilingual statement.

#### Rules that stay from version 1

- Cash tips in hand are never counted as owed by the salon.
- Card tips are never marked paid automatically.
- A payment can cover several periods, and a period can have several payments.
- Closed periods can be reopened.

**Done when:**
- WHEN the pay rules are 60%, a $2 supply fee per service taken before the split, a 3% card-tip fee and a 50/50 split
  THE APP SHALL produce exactly the statement above from 45 services worth $2,500 and $400 in card tips.
- WHEN the technician records a check of $917 and cash of $877 for that period THE APP SHALL show "Short $40" and "The
  cash part is $40 short; the check part matches".
- WHEN the stub's services total is $2,388 against $2,500 logged THE APP SHALL say the salon counted $112 less in
  services.
- WHEN the received total is within $1 of expected THE APP SHALL show Matches.
- WHEN the pay rules change on November 4 THE APP SHALL use the old rules for November 1 to 3 and the new ones from
  November 4 (section 7.1).

### 5.6 Goals

Set from Home (tap the goal bar) or from Settings.

- A **weekly** goal and a **monthly** goal, each optional, in dollars earned.
- Home shows progress for the chosen period; Reports draws the goal line.
- When a goal is met, a one-time message on Home: "You hit your goal for this week."
- No streaks, no badges, no pressure messages.

**Done when:**
- WHEN the weekly goal is $1,000 and the week so far earned $640 THE APP SHALL show "$640 of $1,000 — $360 to go".
- WHEN the goal is met THE APP SHALL show the message once and not again that week.

### 5.7 Hours and pay per hour (optional, off by default)

Turned on in Settings. When on:

- Home shows `Start day` and `End day`. Tapping them records the time. Hours can also be typed in for any day from
  History (for days the technician forgot).
- If no hours were recorded for a day with turns, the app offers "First turn 10:05, last turn 6:40. Use 9:45 to 7:00?"
  (first turn minus 20 minutes to last turn plus 20 minutes, rounded to the quarter-hour). Nothing is saved unless the
  technician agrees.
- Reports shows **pay per hour**: earned per hour with tips, and the salon's pay per hour without tips.
- **Minimum wage check:** the technician can type their state's or city's minimum wage (no internet lookup). When the
  salon's pay per hour, without tips, falls below it for a week, Reports shows a calm note: "Your salon pay this week
  was $9.80 an hour, below the $16.50 you entered. You can ask your state labor office about this." The app never says
  the salon broke the law.

**Done when:**
- WHEN a day has 8 hours and $240 earned including $40 tips THE APP SHALL show $30.00 an hour with tips and $25.00
  without.
- WHEN hours tracking is off THE APP SHALL hide every hours control and number.

### 5.8 Taxes and year summary

A page reached from Reports (`Year` mode) and from Settings. Not tax advice; the page says so in one line.

- **Year totals:** salon pay by check, by cash, other payments; tips in cash and by card; adjustments; total earned.
- **Tips for the year:** a clear total, with a note that the federal tip deduction for 2025 to 2028 only counts tips
  that appear on a tax form, so keeping a record helps.
- **Set aside for taxes** (optional): the technician picks a percent (no default value). The app shows how much to
  have put aside so far this year and this quarter. Each quarter's due date (Apr 15, Jun 15, Sep 15, Jan 15) is listed
  with the amount for that quarter.
- **Expenses** (later phase, section 11): supplies, tools, classes, license fees, with totals by category, for
  technicians who file as contractors.
- **Export for the tax preparer:** a printable year summary and a CSV, in English (tax preparers work in English) with
  the Vietnamese terms beside them.

**Done when:**
- WHEN the year has $9,600 in card tips and $7,200 in cash tips THE APP SHALL show $16,800 tips for the year.
- WHEN set-aside is 20% and the year so far earned $40,000 THE APP SHALL show $8,000 to have set aside.

### 5.9 Share and print

From Reports and Paycheck, `Share` builds a page on the phone and opens the phone's share sheet (save picture, send by
text, print). Nothing is uploaded.

- **Paycheck statement:** the Part 1 statement plus what was received and the difference. Bilingual: each line in
  Vietnamese and English so the owner can read it.
- **Report summary:** the chosen period's summary card, trend chart and by-service table.
- **Year summary:** see 5.8.

**Done when:**
- WHEN Share statement is tapped THE APP SHALL create a picture of the statement with both languages, without any
  network request.

### 5.10 Settings

Grouped into sections, in this order:

1. **Language.**
2. **How I'm paid** (new page, section 7): commission rate, rate per service, supply fee, card-tip fee, check/cash
   split, guarantee, tiers. Each rule shows a one-line example in plain words.
3. **Payday:** schedule and start date (as version 1).
4. **Tips:** cash and card handling (as version 1).
5. **Goals** (5.6).
6. **Hours** (5.7): on or off, minimum wage.
7. **Taxes** (5.8): set-aside percent.
8. **Services:** the service list (as version 1).
9. **Salons** (later phase): more than one salon.
10. **Backup:** save backup, restore, backup reminder interval (7, 14 or 30 days, or off), last backup date.
11. **App lock** (later phase): a 4-digit code.
12. **Delete all data** (as version 1).

### 5.11 First-launch setup

The four steps stay (language, pay, tips, payday) with the Back button. Step 2 gains one optional question: "Does your
salon pay part in check and part in cash?" with `No`, `50/50`, `Other`. Everything else about pay rules is left for
Settings so setup stays under a minute.

---

## 6. Words

New terms, one word for each idea, used everywhere:

| Idea | English | Vietnamese |
|---|---|---|
| The whole dashboard | Home | Trang chính |
| Pay check screen | Paycheck | Lương |
| Statement | What you should get | Lương bạn phải nhận |
| Check part | Check | Check |
| Cash part | Cash | Tiền mặt |
| Supply fee | Supply fee | Tiền đồ nghề |
| Card-tip fee | Card-tip fee | Phí tip thẻ |
| Guaranteed pay | Guarantee | Bao lương |
| Tiered commission | Tiers | Chia theo bậc |
| Matches | Matches | Đúng |
| Short | Short | Thiếu |
| Over | Over | Dư |
| Goal | Goal | Mục tiêu |
| Day off | Day off | Ngày nghỉ |

A Vietnamese-speaking salon worker confirms these before release (as for version 1: the client labels and "khoản trừ
riêng" are still waiting for that check).

---

## 7. Pay rules: how the money is worked out

All money in whole cents, all rates in basis points (60% = 6000), as version 1. Rounding: each service's share is
rounded to the nearest cent, half up, then added, as version 1. Every fee is rounded the same way at the line it
applies to.

### 7.1 Pay rules change over time

Pay rules are saved with a **start date**. A change applies from its start date onward and never rewrites earlier pay
periods. A turn uses the rules in force on its work date. Version 1 already keeps each service's rate on the turn
itself; that stays the source for the rate. The new rules below are looked up by date.

### 7.2 Order of calculation for one pay period

1. **Services total** = sum of every service price in the period.
2. **Supply fee**, one of:
   - per service: fee × number of services (zero-priced services excluded);
   - percent of services total;
   - none.
   It is taken either **before the split** (from the services total) or **after the split** (from your share). The
   technician chooses, with an example of each.
3. **Your share** = sum over services of (price × that service's rate), with the supply fee applied as chosen. With
   **tiers** (7.5), the rate comes from the tier table instead.
4. **Card tips** = sum of card tips in the period.
5. **Card-tip fee** = card tips × fee percent, when set. The screen where it is set says in one line that federal rules
   allow only the real card fee (about 3%) and that California allows none. The app never asks for the state.
6. **Adjustments** as version 1.
7. **Guarantee** (7.6): if the guarantee for the period is higher than your share, the difference is added as a
   `Guarantee top-up` line.
8. **Salon should pay** = your share + top-up + card tips the salon still holds (not those already handed to you) −
   card-tip fee + adjustments that change pay (as version 1).
9. **Check/cash split** (7.3) of the amount in step 8.
10. **You earned in total** = step 8 + cash tips in hand + adjustments that do not go through the salon.

### 7.3 Check/cash split

- Choices: none, 50/50, or a custom check percent.
- Option: **card tips paid in**: check, cash, or split like the rest.
- Rounding: the check part is rounded to the cent; the cash part is the rest, so the two always add up exactly.
- *Example:* owed $1,834.00 at 50/50: check $917.00, cash $917.00. Owed $1,834.01: check $917.01, cash $917.00.

### 7.4 Comparisons

- **This time last week:** from the start of last week through the same weekday, with today counted as a whole day.
- **This time last month:** from the 1st of last month through the same day number. If last month is shorter (on March
  31, comparing to February), it stops at the last day of that month.
- **Same period last year:** the same dates one year earlier; February 29 compares to February 28.
- **Change** = this − earlier, in dollars; percent = change ÷ earlier, rounded to a whole percent, shown only when the
  earlier amount is more than zero.

### 7.5 Tiers

- A table of weekly (or per pay period) sales levels and rates. *Example: 50% up to $500, 55% from $500 to $1,000, 65%
  above $1,000.*
- Two ways salons apply it, the technician picks one:
  - **Each part at its own rate** (like tax brackets). *$1,200 in sales: $500 × 50% + $500 × 55% + $200 × 65% = $655.*
  - **The whole week at the highest rate reached.** *$1,200 × 65% = $780.*
- With tiers on, a per-service rate is ignored for that period, and the screen says so.

### 7.6 Guarantee

- Per day worked (a day with at least one turn and not marked off), or per week.
- Optional: the guarantee applies only if a minimum number of days were worked (some salons drop it when a day is
  missed).
- Top-up = guarantee − your share, when positive; otherwise zero and the statement says "not needed".
- *Example: $150 a day, 6 days worked = $900. Your share $1,446: not needed. A slow week with a $760 share: top-up
  $140.*

### 7.7 Pay per hour

- With tips = (your share + top-up + all tips + adjustments) ÷ hours.
- Salon pay without tips = (your share + top-up + adjustments) ÷ hours.
- Shown to the cent; hidden when hours are zero.

---

## 8. Reminders

The app has no server, so it cannot send notifications to a closed app on iPhone. Reminders appear **inside the app**
on Home when it is opened:

- Backup is overdue (setting, default 14 days).
- A pay period has ended and is not checked.
- A goal is met.
- A quarterly tax date is within 14 days, when set-aside is on.

One reminder at a time, the most urgent first, each dismissable until its next occurrence.

---

## 9. Data

### 9.1 New and changed records

| Record | New fields | Why |
|---|---|---|
| PayRules (new) | start date, supply fee (kind, amount, before/after split), card-tip fee, check percent, card tips paid in, guarantee (kind, amount, minimum days), tiers (levels, rates, mode) | Section 7, changes over time |
| WorkDay (new) | date, start time, end time, hours, day off | Hours, guarantee, calendar |
| Goal (new) | period kind (week or month), amount, start date | Goals |
| Payment (changed) | kind: check, cash, Zelle, direct deposit, other (the existing method list, with check and cash used for the split) | Paycheck check |
| PaycheckRecord (new) | pay period, stub services total, stub tips total, stub deductions, note, photo, checked date | Paycheck check |
| Expense (later) | date, amount, category, note | Taxes |
| Settings (changed) | hours on, minimum wage, set-aside percent, backup reminder days, last backup date, Home period choice | Several |

### 9.2 Upgrade

- A new database version with an upgrade step. Existing data keeps working: version 1 users get one PayRules record
  starting on their first turn's date, holding their current settings (no fees, no split, no guarantee).
- Backups get a new format version. Old backups still restore; new backups do not restore into the old app (the old
  app already says "made by a newer version").

### 9.3 Speed

Home and Reports must stay quick with five years of data: about 20,000 turns. Totals are worked out from indexed
date ranges. The target is that Home shows its numbers in under 300 milliseconds on a mid-range phone with that much
data. A test fills a database with 20,000 turns and measures it.

### 9.4 Photos

Stub photos are shrunk on the phone (longest side 1600 pixels) and kept in the app's own storage. They are included
in backups only when the technician ticks "include photos", because they make backups large.

### 9.5 Privacy

Unchanged: no account, no server, no analytics, no outside requests. Sharing only hands a file to the phone's own share
sheet.

---

## 10. What stays out

Same as version 1: no salon management, booking, client marketing, inventory, card payments, payroll for owners, or
tax filing. Also out: comparing your pay to other technicians (that needs a server), and any automatic legal judgment.

---

## 11. Releases

Each release is a set of small builder tasks, the way version 1 was built, each with its own tests, merged one at a
time.

| Release | Contents | Why first |
|---|---|---|
| **2.0 Look and speed** | New look (section 4.1); compact rows with copy on every row; swipe and long-press; undo bar; fast Add turn (repeat chips, usual prices, number pad, tip buttons, last-price hint) | Bay's top complaint: it looks bad and copying is hidden |
| **2.1 Home** | Home dashboard with period switch, comparisons, polish-bottle week view, owed split, card tips held; reminders | Something to look at after logging |
| **2.2 Paycheck** | How I'm paid (supply fee, card-tip fee, check/cash split, rules by date); Paycheck statement; record check and cash; the check and its reasons; data upgrade | The gap no other app fills |
| **2.3 Reports** | Reports with comparisons, trend, by service, by weekday, clients, tips, records; calendar in History; filters; goals | Looking back and comparing |
| **2.4 Share, taxes, hours** | Share statement and year summary; tax set-aside; hours and pay per hour; guarantee; tiers; day off | Fewer technicians need these |
| **2.5 Later** | Expenses; several salons; shared clients; app lock; stub photos | Useful, not urgent |

Each release ends with the full browser test suite passing, the live site updated, and a check by a Vietnamese speaker
of any new wording.

---

## 12. Edge cases to test

- A turn after midnight belongs to the work day it started (as version 1).
- Pay rules change in the middle of a pay period.
- A pay period with no turns, and one with only adjustments.
- A payment covering two periods, one of which is short.
- Check/cash split with an odd number of cents.
- Comparisons at month ends (March 31 to February), leap days, and the first week of the year.
- Week start Sunday versus Monday.
- Tiers exactly at a level boundary ($500.00 sits in which tier: the lower one).
- A guarantee with a day marked off and a day with only a zero-priced turn.
- Hours crossing midnight.
- Restoring a version 1 backup into version 2, and a version 2 backup that holds photos.
- 20,000 turns for speed.
- Every new screen in Vietnamese at 375 pixels, with long words not cut off.

---

## 13. Done when (whole of version 2)

- A technician paid 60/40 with a 50/50 check/cash split, a $2 supply fee and a 3% card-tip fee can set that up in under
  two minutes, log a week, and see the statement in section 5.5 exactly.
- After entering their check and cash, they see `Matches` or the shortfall with a reason.
- Home answers "how am I doing today, this week, this month, and against last time" without scrolling.
- Reports compares any week, month or year against the one before and the same one last year, and breaks earnings down
  by service, weekday, client type and tips.
- Everything works offline, in both languages, on a 375-pixel phone, and survives a backup and restore.
- Version 1 data upgrades with nothing lost.

---

## 14. Decisions taken (November 6, 2026)

Bay asked for "a real full app" without answering the open questions, so these defaults were taken. Any can change.

1. **Order:** look and speed first, then Home, then Paycheck (section 11), because Bay's complaints were the look,
   copying, and having nothing to see after logging.
2. **Guarantee and tiers** move to release 2.4.
3. **Web address:** stays at unity7.github.io/nail-tracker until Bay picks a domain. Moving later means each user
   moves their data with a backup file.
4. **Vietnamese:** new wording gets a ChatGPT review pass, as in version 1, until a salon worker can read it.
5. **Reddit:** a pass through the research browser was run for this revision.

---

## 15. Research sources

Gathered 6 November 2026. Reddit was blocked, so there are no first-hand Reddit quotes; app reviews are thin (most
nail apps have under 5 ratings). Several apps named in version 1 section 15 (The Nail Ledger, NailPay Tracker, Alio,
SimpliNail) could not be found under those names.

**Pay complaints and pay structures**
- Unexplained product fee and paycheck example: https://thisuglybeautybusiness.com/?p=81 and https://thisuglybeautybusiness.com/?p=84
- California class action on deductions: https://topclassactions.com/lawsuit-settlements/employment-labor/former-nail-salon-employees-file-california-labor-violations-lawsuit
- Supply fee and tiered pay, owner forum: https://www.salongeek.com/threads/nails-salon-owners-how-do-you-pay-your-technicians.335893/
- Tiered commission and pay per hour below minimum: https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570
- Wage theft reporting: https://kqed.org/news/11275303/nail-salon-workers-allege-wage-theft-indicate-larger-exploitation , https://www.nbcnews.com/news/asian-america/quietly-suffering-former-california-nail-salon-employees-sue-labor-violations-n704116 , https://www.mass.gov/decision/salem-nail-bar-v-fair-labor-div-lb-22-0441-445-final-decision
- Tips docked: https://consumerist.com/2015/05/07/10-things-we-learned-about-labor-abuses-in-nail-salons/ , https://www.bustle.com/articles/81768-new-york-times-report-on-underpaid-manicurists-reveals-these-7-shocking-facts-about-nail-salons
- Card-tip fee rules: https://www.dol.gov/sites/dolgov/files/WHD/flsa/tips_final-rule.pdf , https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/FOH_Ch30.pdf , https://selectviet.com/tram-su-nghe-nails/cach-chu-tiem-chia-tien-tips-cho-tho-nail-o-my/
- Card tips delayed: https://www.nerdwallet.com/finance/learn/how-much-to-tip-nail-salon
- Check/cash 50/50 and 60/40 norms (Vietnamese press): https://viendongonline.com/article/luat-thue-va-lao-dong-trong-nghe-nail-SYI3Fo2w.html , https://nguoivietusa.net/chu-tiem-nails-duoc-loi-bao-nhieu-tien-tu-tho.html
- Guarantee pay: https://raovatnailsalon.com/chu%CC%89-bao-luong-cho-tho%CC%A3-va-gia%CC%89i-phap-cho-luat-thue-va-lao-dong-trong-nghe-nails/ , https://kinhdoanhusa.com/luong-tho-nail-california-khao-sat-moi-nhat/
- Commission ranges: https://www.zenoti.com/thecheckin/how-do-nail-salons-pay-their-employees , https://www.nailsmag.com/392992/the-compensation-dilemma , https://www.vagaro.com/en-au/learn/nail-salon-commission-structure
- Walk-in turns: https://www.nailsmag.com/article/92717/Turning-Walk-ins

**Taxes**
- No tax on tips: https://www.irs.gov/newsroom/one-big-beautiful-bill-how-to-take-advantage-of-no-tax-on-tips-and-overtime , https://www.irs.gov/newsroom/treasury-irs-issue-final-regulations-listing-occupations-where-workers-customarily-and-regularly-receive-tips-under-the-one-big-beautiful-bill
- Tip records: https://www.irs.gov/businesses/small-businesses-self-employed/tip-recordkeeping-and-reporting
- Cash pay tax case: https://viendongonline.com/article/vo-chong-trieu-phu-viet-o-texas-chu-60-tiem-nail-nhan-toi-gian-lan-5uwu38ix.html

**Apps**
- Nail Tech Income Tracker: https://apps.apple.com/us/app/id6754782390
- Nail Tech Payroll & Commission: https://apps.apple.com/mx/app/nail-tech-payroll/id6741119182
- Polish: https://apps.apple.com/us/app/id6760669719
- KV Income: https://apps.apple.com/us/app/kv-income/id6450826965
- ServerLife: https://apps.apple.com/us/app/id1098987860
- Tip Tracker: https://apps.apple.com/us/app/tip-tracker/id1589026466
- Gridwise: https://gridwise.io/features , https://justuseapp.com/en/app/1215991382/gridwise-gig-driver-assistant/reviews
- Stride: https://support.stridehealth.com/hc/en-us/articles/360051715114
