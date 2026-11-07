# Nail Tracker redesign: UX patterns from the best-rated apps

Research date: 6 November 2026. Written for the Nail Tracker redesign (offline phone web app for nail technicians).
Method: web search and page fetches of app store pages, vendor help centres, release notes, Apple developer sessions, Nielsen Norman Group articles and Cashew's open-source code. Reddit was not used. Mobbin and Pageflows screen galleries need a login, so they were not used; only Mobbin's public blog was read.

The current app was looked at through the screenshots in this folder (`today.png`, `add.png`, `payday.png`) so each pattern can be tied to a real problem:
- Today: a big plum "Turns 4" card, a six-line totals table, then "Add Turn" and "Repeat last turn" buttons, then turn cards of about 120px each. Only about 1.5 turns are visible above the bottom bar.
- Add Turn: one long page. Eleven service chips take about 280px, money fields use the phone's system keyboard, and Save sits at the very bottom, below "More options".
- Payday: one row ("Nov 1 – Nov 7, Still owed $116.00") and the rest of the screen is empty.

---

## Part A. The 15 most useful patterns, ranked

The ranking is for a nail tech who logs 10 to 20 customers a day between clients, often with wet nails or gloves, holding the phone in one hand. Impact means seconds saved per turn multiplied by about 15 turns a day, plus how much the pattern builds trust that "my paycheck is right".

| # | Pattern | Seen in | What it means for Nail Tracker |
|---|---|---|---|
| 1 | **Repeat chips: one tap re-logs a frequent turn** | Cashew (long-press + shows "commonly used transactions" as chips; tapping one duplicates it; long-press a chip to change the amount), Server44 ("one-tap restore of previous values"), BudgetBakers Wallet (templates) | Put a row of 3 to 5 chips at the top of Add Turn, built from the most frequent service and price combinations of the last 30 days (for example "Gel Mani $35", "Pedi + Art $55"). One tap fills services and price; the tech only adds tips. This replaces typing for most turns. |
| 2 | **Built-in number keypad instead of the phone keyboard** | Cashew (`NumberPadAmount`: 3x4 digit grid, long-press backspace clears, haptics), Saver 2 (keypad is a calculator), Toshl (Σ key), YNAB (amount first), Balance (2026) | One fixed keypad at the bottom of Add Turn with big keys (at least 56px, ideally 64px, for knuckles and wet nails). Three tabs above it, **Price · Cash tip · Card tip**, choose which field the keypad types into. This also avoids a known iPhone home-screen web app bug where the system keyboard shrinks the screen until the app is force-quit. |
| 3 | **Service chips that remember price** | Cashew (custom titles fill in the category), Toshl (relevant tags shown first), spec item "Preserve recent service selections" | Sort service chips by how often she uses them and show the top 6 on one or two rows, with "More" for the rest. Tapping a chip puts the last price used for that service into Price, already selected so she can type over it. |
| 4 | **Copy from any row, always dated "now"** | Cashew (Duplicate in the selection bar; long-press Duplicate copies with the current date and time), Wiz (swipe right shows Duplicate), BudgetBakers (swipe left shows Clone) | Every turn row gets a visible copy icon (a 44px target) and a long-press menu: Copy / Edit / Delete. Copy opens Add Turn filled in and dated now. Today, copying is buried inside the edit screen. |
| 5 | **Undo bar instead of "Are you sure?" pop-ups** | Material Design ("confirmation isn't necessary when the consequences of an action are reversible"), NN/g ("support easy undo" for repetitive tasks), Actual Budget (swipe-to-delete with undo, 2025) | After Save: a bar saying "Saved · you earn $27 · Undo · Copy again", shown for about 5 seconds. After Delete: "Turn deleted · Undo". Keep the deleted turn for a few seconds before removing it for good. This takes a tap and a pop-up out of every action. |
| 6 | **One-line rows grouped by day, with a day total in each day header** | Monarch (Dec 2024: "condensed the height of each transaction row… to bring more into view"), Cashew (compact rows, minimum height 45px), Monzo (users asked again and again for a total beside each date) | A row about 52 to 56px high: time and services on the left (cut short with "…" if long), what she earned on the right in bold, with tips in small grey text under it. A day header that stays at the top while scrolling: "Sat Nov 7 · 4 turns · $131". About 10 turns fit on one screen instead of 1.5. |
| 7 | **A big hero number plus one fair comparison line** | Strava Weekly Snapshot (totals "compared to the same point in the previous week"), iPhone Screen Time (percentage up or down from last week), Server44 ("how today compares to your 30-day average"), Apple WWDC22 ("Sales for the past 30 days are up 12%, totaling 1,234…") | Today's header: **$131 earned today**, then one line: "$18 more than last Saturday" or "On pace with your usual Saturday". Compare like with like (the same weekday, or the week so far up to the same day), use calm colours, and never shame her on a day off. Strava got complaints that a mid-week comparison "makes me feel bad". |
| 8 | **A week strip: this week's bars over last week's faded bars** | Apple Card weekly activity (seven daily bars, swipe back to earlier weeks), Apple Watch weekly summary (week totals compared with your average), ServerLife (totals in the calendar) | Under the hero number, seven small bars (Mon to Sun, each about 40px wide on a 390px screen) for this week, with last week drawn behind them as faded "ghost" bars, and the week total on the right. Tapping a day opens that day's list. This answers "this week vs last week" without a chart page. |
| 9 | **Payday as a pay-period story: what is owed so far, what has come in, the gap** | Monzo (planned top-of-feed widget: amount left, days left in the pay cycle, progress bar), Zenoti MyZen and TipHaus (pick current or previous pay period), Fresha (every team member sees their own pay breakdown per period) | The Payday hero: "**Salon owes you $1,440 so far** · payday Friday (3 days)". Under it, a short breakdown: commission + card tips − cash tips already in hand = expected payout. Then "Paid $1,400 · **Short $40**" in amber, a "Record payment" button, and past periods listed with Paid / Short / Waiting labels. This fills the empty tab with the one question it exists to answer. |
| 10 | **One add screen, controls in thumb reach, no sheets stacked on sheets** | NN/g on bottom sheets (sheets suit brief tasks; never stack them; give a visible Close; the reachability argument is "largely incorrect" because the middle of the screen is easiest), Hoober (main actions in the centre, secondary actions at the edges) | Add Turn becomes one full-height sheet: repeat chips → service chips → big amount display with a live "you earn $X" → keypad → **Save** as the keypad's large bottom-right key. Date (default today), commission % (default from settings) and notes go into one small "Today · 60%" line that opens on tap. Nothing opens a second sheet. |
| 11 | **Money typography: aligned digits, quiet cents, one weight for amounts** | Fintech type guides (Smashing Magazine; tabular figures so "decimal points line up"); wallet concept with "cents in muted gray so the dollars stay loud" | Use `font-variant-numeric: tabular-nums` on every amount, right-align amounts in lists, make the hero amount large (40 to 48px) with "$" and ".00" smaller and grey, and show amounts in semibold. Drop ".00" in lists when the cents are zero ($35, not $35.00). Inter, already in use, covers Vietnamese; Be Vietnam Pro is the backup choice if accents look crowded. |
| 12 | **Colour only on data; plain neutral chrome; real dark mode** | Copilot Money (Apple Design Award finalist 2024; a third-party design guide describes "colour is reserved for data", and a deep navy background, not pure black, in dark mode) | Make the screen white or very light grey, not beige, with near-black text. Use one accent colour for the main action. Green means money earned, amber means owed or short, red only for errors. Remove the tinted plum card behind "Turns". Add a dark theme with a dark navy or charcoal background. |
| 13 | **Charts: a one-sentence summary first, simple bars, tap to read a value** | Apple WWDC22 "Design app experiences with charts" and "Design an effective chart" (text that states the total and the trend; bars for days because lines mislead when some days are zero; zero baseline; about 4 grid lines; small static charts need no labels) | On the Earnings page, each chart starts with a sentence such as "Last 4 weeks: $4,820, up 6%". Use a stacked bar per day or week (commission / card tips / cash tips) starting from zero. Tapping a bar updates the headline number. No pie charts and no line charts for days. |
| 14 | **Month calendar heat map + "your best day" insight** | Server44 ("color-coded month at a glance"; best and worst days; which weekday earns most), ServerLife (calendar with daily totals), TipTrack and Shift (best day of week) | In History, a month grid whose cells get darker as earnings rise, with the dollar amount in each cell; tapping a day opens its list. In Earnings, one line: "Saturdays are your best day · avg $310". |
| 15 | **An optional weekly goal ring, not a streak** | ServerLife and Tip Tracker (daily and weekly goals), Gridwise (daily and weekly goals); Mobbin's study of 859 streak designs ("Missing a day feels catastrophic, but has almost no effect on habit formation") | Let her set an optional weekly target ("$1,200 this week") and show a thin progress ring next to the week total. Avoid "days in a row" streaks: her schedule and walk-ins are not under her control, and a broken streak would punish normal days off. |

---

## Part B. The patterns in detail

### B1. Duplicating, repeating and templating a turn

**B1.1 Repeat chips (quick add from frequent entries)**
- **What:** A horizontal row of chips, each a full saved entry. Tapping one creates the entry; long-pressing lets you change the amount first.
- **Who:** Cashew. Its FAQ says: "After long pressing the plus button, you will see a list of commonly used transactions, tapping them will duplicate the transaction. If the amount differs, long press on the chip to customize the amount." It also has user-pinned entries. BudgetBakers Wallet has Templates, chosen from the + button. Server44 offers "Quick Entry mode and one-tap restore of previous values".
- **Why it works:** Nail work repeats. Most customers are one of 4 to 6 service and price combinations. Recognising a chip is faster than building the entry again.
- **For Nail Tracker:** Work out the top combinations automatically (same services + same price, counted over the last 30 days) and show them first in Add Turn. Allow pinning. Today's single "Repeat last turn" button is the same idea in a weaker form: it only knows the last turn, and it is a large full-width button.

**B1.2 Copy always lands on "now"**
- **Who:** Cashew. The 5.3.4 release notes say long-pressing duplicate creates a copy at the current date and time.
- **Why:** When you copy yesterday's turn, you almost always mean "I just did this again".
- **For Nail Tracker:** Copy opens a filled-in Add Turn dated now. Tips start empty, because tips vary even when the service repeats.

**B1.3 Copy on the row: visible button, swipe as a shortcut**
- **Who:** Wiz (swipe right on a transaction to show Duplicate), BudgetBakers Wallet (swipe left, then Clone; you can save the exact copy or change it first), YNAB (swipe left to delete), Actual Budget (long-press a transaction to show an action bar, from 2024).
- **Caution from NN/g:** Swipe actions are hard to discover, should be "limited to destructive actions", must have visible controls as well, must mean the same thing on every screen, and must keep the row visible while the actions show.
- **For Nail Tracker:** A visible copy icon on each row (44px tap area), long-press for a Copy / Edit / Delete menu, and optionally swipe left for delete (with Undo). Swipe right for copy is a fine shortcut, but never the only way.

**B1.4 Select several turns by long-pressing and dragging**
- **Who:** Cashew. In its code, long-pressing a row starts selection, and `swipeToSelectTransactions` lets a finger drag down the list to select or unselect rows, with a light haptic tap for each row.
- **For Nail Tracker:** Lower priority. Useful for "delete these 3 test entries" or "move these to yesterday".

### B2. The fastest entry form

**B2.1 Built-in keypad versus the system keyboard**
- **Who:** Cashew draws its own keypad (`NumberPadAmount`). It has a 3-column digit grid that can be ordered 1-2-3 or 7-8-9, a decimal key and a backspace key; long-pressing backspace clears the whole amount; there is an optional calculator column (÷ × − +); digits give a light vibration and operators a medium one; the total is shown at 35pt bold and shrinks to fit. Saver 2's keypad "is actually a calculator" (MacStories). Toshl adds maths operators through a Σ key. Balance added a keypad with basic maths in April 2026. Scrooge advertises a "custom keyboard built for quick one-handed input".
- **Why it works (general):** The keypad is always in the same place, so muscle memory builds. The keys can be much bigger than the phone keyboard's. Nothing jumps when the keyboard opens and closes. Save can live inside the keypad.
- **Why it matters more for a home-screen web app on iPhone:** Fixed bottom buttons get covered by the iPhone keyboard. In a web app added to the home screen, the first time the keyboard opens the screen can shrink and stay shrunk until the app is force-quit (seen on iOS 17 and 18; developer write-up on DEV Community). A built-in keypad avoids the system keyboard on the main path completely.
- **For Nail Tracker:** Keys of at least 56px, ideally 64px. Long-press backspace to clear. Nail prices are mostly whole dollars, so typing "45" means $45, and a "." key is there for cents. Keep a physical-keyboard fallback for desktop. Vibration works on Android only; iPhone web pages cannot vibrate. Store money as whole cents, as the project rules require.

**B2.2 One screen, amount first, live result**
- **Who:** YNAB's mobile flow opens on the amount keypad, then type, then payee and category, then Save. Toshl advertises "manual expense entry in only 4 taps". Tip Tracker added default shift times "to speed up data entry".
- **For Nail Tracker:** Order the screen as repeat chips → service chips → amount display with tabs (Price / Cash tip / Card tip) → keypad with Save. A live line "Commission 60% · You earn $27.00" sits just above the keypad, so she sees the result before saving. Date and commission % become one small line ("Today · 60%"), changed only when needed.

**B2.3 Bottom sheet or full page**
- **NN/g:** Sheets are for "brief" tasks and should not replace page-to-page flows. Do not stack sheets. Give a clear Close button and let Back close the sheet. The usual "easier to reach" argument is "largely incorrect".
- **For Nail Tracker:** A full-height sheet (or a page) is right for Add Turn, because it is a short, focused task that ends back on Today. Do not open a second sheet from inside it; for example, "other day" should be an inline date row, not a new sheet.

**B2.4 Save and add another, without the extra button**
- Today's screen has both "Save" and "Save & Add Another". With repeat chips and an Undo bar that offers "Copy again", the second button can go, or become a small toggle.

### B3. List density and row design

**B3.1 Group by day, with a total in each header**
- **Who:** Monzo community threads repeatedly ask for a total beside each past date, so people do not have to add rows up by hand. A Monzo redesign that removed "spent today" drew complaints. Monarch condensed row height on mobile in December 2024 "to bring more into view", and in June 2024 put category and account details into the main list.
- **For Nail Tracker:** A day header that stays at the top while scrolling ("Today · 4 turns · $131 earned"), with turns under it. The product spec already asks for day totals in History.

**B3.2 Row anatomy (about 52 to 56px)**
- Left: time (grey, small) and services ("Gel Mani + Art", cut short with "…").
- Right: what she earned (bold, aligned digits), and the tip in grey under it ("+$8 tip", with a small icon to tell cash from card).
- Drop "Turn #4". The time, or a small counter in the day header, is enough. Price and commission go on the detail view.
- Cashew's compact row is 45px minimum with a 27px icon. Nail Tracker should stay at about 52 to 56px so every row is a comfortable tap target.

**B3.3 Undo instead of confirmation dialogs**
- **Material Design:** "Confirmation isn't necessary when the consequences of an action are reversible or negligible." A snackbar holds one action, such as UNDO.
- **NN/g:** If confirming would be tedious for repetitive tasks, "support easy undo" and make the undo control easy to see.
- **Actual Budget** shipped swipe-to-delete with undo for rules in 2025.
- **For Nail Tracker:** Undo for delete, edit and save. Keep a real confirmation pop-up only for things that cannot be undone, such as wiping all data or restoring a backup over current data.

### B4. Home and dashboard

**B4.1 A hero number with one comparison**
- **Strava** compares the week so far with "the same point in the previous week". Riders criticised it because irregular schedules make mid-week look like falling behind, and asked for a way to hide it.
- **iPhone Screen Time** shows a daily average and a percentage change from last week (described in third-party guides).
- **Server44** compares today with the 30-day average.
- **Apple WWDC22:** add text that states the total and interprets it ("up 12%").
- **For Nail Tracker:** Today = "$131 earned · 4 turns", then one line comparing with the same weekday last week. On a quiet or off day, use neutral wording ("Day off" or "Light day"), not red arrows. Put the six-line totals table behind a tap ("See breakdown").

**B4.2 A week strip**
- **Apple Card** shows weekly activity as a bar chart you can swipe back through, with exact totals listed under the chart.
- **Apple Watch's weekly summary** compares the week's totals with your average.
- **For Nail Tracker:** Seven bars for this week, last week as faded bars behind them, the week total and "vs last week $X" next to it. Tap a day to filter.

**B4.3 Pay period at the centre of Payday**
- **Monzo** planned a top-of-feed budget widget showing the amount left, days left in the pay cycle and a progress bar.
- **ServerLife** lets you set your own pay-week start, and its calendar follows it.
- **Zenoti MyZen** and **TipHaus** let staff pick the current or a previous pay period. **Fresha** says every team member can see their own pay breakdown for each period.
- **Square:** on the salon side, staff often cannot see their own tips and commission on the phone. The Appointments app's sales report shows total tips but no commission, and the per-person report is in the web Dashboard and needs a paid plan. Owners on Square's forum recommend workarounds. This gap is exactly the job Nail Tracker does.
- **For Nail Tracker:** Payday hero: owed so far, days until payday, the expected-payout breakdown, then payments received and the shortfall. Below that, a list of past periods with Paid / Short / Waiting labels. A "Looks wrong?" link opens the turn list for that period, so she can check it against the salon's pay slip line by line.

**B4.4 Goals and streaks**
- Goals appear in ServerLife (daily and weekly goals under each day and week), Tip Tracker and Gridwise.
- On streaks, Mobbin's study of 859 streak designs found that freezes exist "because the fear of missing a day was working too well", and that a broken streak "resets the motivation".
- **For Nail Tracker:** An optional weekly goal ring. No streaks.

**B4.5 Calendar heat map**
- **Server44** has a "color-coded month at a glance" and shows earnings for each day worked. **ServerLife** shows daily totals in its calendar.
- One search turned up no tip app that shades calendar days by earnings, so this would set Nail Tracker apart a little.

### B5. Charts on a 390px phone (from Apple's WWDC22 chart sessions)
- Use bars for daily values. Lines between far-apart values "become more prominent than the values themselves" when some days are zero, which is true for days off.
- Bars start at zero, so a bar twice as tall means twice the money.
- Use about 4 horizontal grid lines. Small preview charts (sparklines) need no grid lines, labels or interaction; larger charts need axis labels and tap-to-read values.
- Put a description first that states the total and whether it is up or down.
- Move from big to small in steps: overview, then weekdays vs weekends, then single days. Keep values and colours the same when moving from a small chart to its full version.
- Check colours against colour-blindness filters and in dark mode.
- **Copilot Money** treats charts as the main way to interact: tapping a segment shows its breakdown, and swiping changes the time period (third-party guide).
- **Coinbase's design system** documents a "scrubber": a reference line and dot that follow the finger, with the header number updating as you drag.
- **For Nail Tracker:** 7 bars (a week) or 4 to 6 bars (weeks in a month) fit at 390px. Stack commission, card tips and cash tips in each bar, with the stack colours also listed in text. Tapping a bar changes the headline to that day or week.

### B6. Visual design: premium versus cheap

**What reads as cheap in the current screens:** a beige page; every turn in its own bordered card; a tinted plum card behind a statistic; two full-width buttons stacked together; "$" and ".00" on every amount; the same font size for labels and amounts; a large empty Payday screen; big date controls at the top of Today.

**What reads as premium in Copilot, Monarch, Apple Wallet and Apple Fitness:**
1. One clear hero number per screen, with lots of space around it, and dense lists below.
2. Flat lists on one surface with thin dividers (Monarch and Cashew rows), not a card for every item. Use cards only for summary blocks.
3. Neutral chrome and colour only for meaning: green for earned, amber for owed or short, the accent for the main action (Copilot as described in the third-party guide; also Apple's WWDC guidance to "remove color to draw attention").
4. Aligned digits, quiet currency symbol and cents, a semibold weight for amounts, and only 3 to 4 text sizes.
5. A dark mode with a dark navy or charcoal background rather than pure black. One guide quotes Copilot's background as `#000814` with card surfaces of `#001533`; these values come from a third-party page and were not checked in the app.
6. Small motion and haptics: the hero number animates when a turn is added; key presses vibrate on Android.
7. Touch targets of at least 44pt (Apple) or 48dp (Material). Google's in-car guidance uses 76dp, which is a fair model for wet hands, so the keypad and Save should be well above the minimum.

---

## Part C. Source notes and confidence

- **Strong primary sources:** Cashew FAQ, release notes and code (`selectAmount.dart`, `transactionEntry.dart`, `swipeToSelectTransactions.dart`); YNAB help centre; Monarch release notes; BudgetBakers help; Actual Budget release notes; NN/g on bottom sheets and contextual swipe; Material Design's confirmation guidance; Apple WWDC22 chart sessions (read through WWDC Notes summaries); Apple developer article on Copilot; App Store pages for Copilot, Tip Tracker, ServerLife, Server44 and TipTrack; Strava support; Square seller community.
- **Secondary or unverified:** Copilot colour values (blakecrosley.com guide); the Screen Time "% from last week" wording (blogs, not Apple); Duolingo streak figures (Mobbin blog); the money typography ratios.
- **Not found:** Details of 1Money's and Spendee's entry screens; a staff-facing earnings screen in the Vagaro or GlossGenius mobile apps; Monarch's swipe review (only listed as upcoming in June 2024). Apple's Charts guidelines page did not render, so the WWDC sessions were used instead.

## Sources

Duplicate, repeat and templates
- Cashew FAQ: https://cashewapp.web.app/faq.html
- Cashew 5.3.4 release notes (long-press duplicate at the current date): https://newreleases.io/project/github/jameskokoska/Cashew/release/5.3.4%2B396
- Cashew GitHub: https://github.com/jameskokoska/Cashew
- Cashew keypad code: https://raw.githubusercontent.com/jameskokoska/Cashew/main/budget/lib/widgets/selectAmount.dart
- Cashew row code: https://raw.githubusercontent.com/jameskokoska/Cashew/main/budget/lib/widgets/transactionEntry/transactionEntry.dart
- Cashew drag-to-select code: https://raw.githubusercontent.com/jameskokoska/Cashew/main/budget/lib/widgets/transactionEntry/swipeToSelectTransactions.dart
- Cashew App Store (4.94 from 519 ratings, per AppGoblin): https://apps.apple.com/app/id6463662930 , https://appgoblin.info/apps/6463662930
- BudgetBakers clone: https://support.budgetbakers.com/hc/en-us/articles/7002928224786
- BudgetBakers templates: https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates
- Wiz duplicate (found in search; the page now returns 404): https://help.wiz.money/en/articles/4440652

Entry form
- YNAB add transaction: https://support.ynab.com/en_us/how-to-add-transactions-in-ynab-HyDwA_byi.md
- YNAB edit and delete: https://support.ynab.com/en_us/how-to-edit-and-delete-transactions-BJG4oS1s.md
- YNAB card mode and undo: https://support.ynab.com/en_us/approving-and-matching-transactions-a-guide-ByYNZaQ1i.md , https://support.ynab.com/en_us/how-to-fix-mistakes-with-undo-and-redo-HJzO5CfA9.md
- Toshl App Store and tutorials: https://apps.apple.com/us/app/id921590251 , https://toshl.com/blog/category/tips-tricks/tutorials/ios-tutorials/page/2
- Saver 2 review (calculator keypad): https://www.macstories.net/news/saver-2-for-iphone-review/
- Balance keypad changelog: https://balance.featurebase.app/changelog/date-version-2180-faster-calculations-at-your-fingertips
- iPhone home-screen web app keyboard bug: https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
- Fixed bottom buttons and the iPhone keyboard: https://dev.to/max_b6de653730725567de515/keep-bottom-action-buttons-visible-on-ios-using-react-18jo
- NN/g bottom sheets: https://www.nngroup.com/articles/bottom-sheet/
- Hoober, how people hold phones: https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php , https://smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/ , https://addyosmani.com/blog/touch-friendly-design/
- Touch target sizes: https://tetralogical.com/blog/2022/12/20/foundations-target-size/

Lists, swipe and undo
- NN/g contextual swipe: https://www.nngroup.com/articles/contextual-swipe/
- Material confirmation and acknowledgement: https://m2.material.io/design/communication/confirmation-acknowledgement.html
- Monarch condensed rows and mobile updates: https://monarchmoney.com/whats-new/customizable-dashboard-manual-transactions , https://www.monarch.com/quicker-and-easier-transaction-review-and-more
- Actual Budget release notes: https://actualbudget.org/blog/release-25.11.0/ , https://actualbudget.org/blog/release-24.9.0/
- Monzo daily totals threads: https://community.monzo.com/t/keep-the-daily-amount-visible/35505 , https://community.monzo.com/t/total-spent-per-day-3/5852

Dashboard, comparisons and goals
- Strava Weekly Snapshot critique: https://road.cc/content/tech-news/stravas-weekly-snapshot-makes-me-feel-bad-307315
- Strava progress chart: https://support.strava.com/hc/en-us/articles/28437860016141-Progress-Summary-Chart
- Apple Fitness and Health trends: https://www.macworld.com/article/3429077/ios-13-and-apple-watch-activity-trends-give-you-the-big-picture.html , https://www.igeeksblog.com/view-weekly-activity-summary-on-apple-watch-iphone
- Apple Card spending history: https://support.apple.com/102329
- Screen Time weekly report (third-party guides): https://timingapp.com/blog/screen-time-on-iphone-and-ipad/ , https://tms-outsource.com/blog/posts/screen-time-on-iphone/
- Mobbin, streaks study: https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs
- Duolingo on streaks: https://blog.duolingo.com/how-duolingo-streak-builds-habit

Gig and tip trackers
- Tip Tracker° (4.6 from 166 ratings): https://apps.apple.com/us/app/id1589026466
- ServerLife (4.8 from about 10K ratings): https://apps.apple.com/app/id1098987860
- Server44 (4.9 from 53 ratings): https://apps.apple.com/app/id6758269550
- TipTrack: https://apps.apple.com/us/app/-/id6762436523
- Shiftips: https://apps.apple.com/us/app/shiftips/id6761449027
- Gridwise: https://apps.apple.com/app/id1215991382 , https://gridwise.io/features
- Stride review: https://timeero.com/reviews/stride-review

Salon apps
- Square: staff tips and commission reporting gaps: https://community.squareup.com/t5/Reports-Setup-Management/Report-Inconsistencies-between-the-Dashboard-Team-Sales-Report/m-p/832802 , https://www.sellercommunity.com/t5/Square-Appointments/Individual-Team-Member-Sales-Report-in-App-Issues/m-p/678897 , https://www.sellercommunity.com/t5/Feature-Requests/We-need-a-report-that-shows-just-the-tips-earned-during-a-shift/m-p/130223
- Fresha pay: https://www.fresha.com/help-center/knowledge-base/team/587-paying-your-team-overview , https://www.fresha.com/help-center/knowledge-base/team/100-manage-your-teams-pay
- Booksy stats and team: https://biz.booksy.com/en-us/features/stats-and-reports , https://biz.booksy.com/features/team-management
- GlossGenius commission and payroll: https://glossgenius.com/blog/commission-salon , https://glossgenius.com/payroll
- Zenoti MyZen earnings: https://help.zenoti.com/en/myzen/manage-earnings.html
- TipHaus employee pay periods: https://learn.tiphaus.com/en/articles/8461732-employee-app-my-tips

Charts and visual design
- WWDC22 "Design app experiences with charts": https://developer.apple.com/videos/play/wwdc2022-110342 , notes: https://wwdcnotes.com/documentation/wwdc22-110342-design-app-experiences-with-charts/
- WWDC22 "Design an effective chart": https://developer.apple.com/videos/play/wwdc2022-110340 , notes: https://wwdcnotes.com/documentation/wwdc22-110340-design-an-effective-chart/
- Copilot and Swift Charts (Apple): https://developer.apple.com/articles/copilot-money
- Copilot App Store (4.8 from about 31K ratings; Editors' Choice; Apple Design Award finalist 2024): https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651
- Copilot design breakdown (third party): https://blakecrosley.com/guides/design/copilot-money
- Coinbase chart scrubber: https://cds.coinbase.com/components/charts/Scrubber/
- Fintech typography: https://smashingmagazine.com/2023/10/choose-typefaces-fintech-products-best-practices-guide-part2
- Be Vietnam Pro: https://fontsource.org/fonts/be-vietnam-pro/about
