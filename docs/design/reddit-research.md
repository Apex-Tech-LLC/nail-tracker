# Reddit research: how commission nail techs track turns, tips and pay

Date: 2026-11-07 (UTC). Read-only; nothing was posted, voted on, joined or messaged.

## Status: partial. Reddit blocked us after 7 page loads

- The quick Reddit tool (`reddit-research`) failed on its first load with an empty page, which is how Reddit's block page often looks.
- The slower research kit then read 7 subreddit "top posts" lists, each 100 posts long, at about one page a minute: r/Nailtechs, r/hairstylist, r/Salon and r/Esthetics for all time, and r/Nailtechs, r/hairstylist and r/Cosmetology for the past year.
- The 8th load was refused with HTTP 403 and the message "You've been blocked by network security". Under the kit's rules we stopped Reddit for the day with no retries. That 8th load was the newest posts in r/Nailtechs.
- So **no comments were read**. Everything below comes from post titles and post text only. Reddit search pages are not allowed under the kit's rules, and the web search tool cannot reach reddit.com, so the planned search phrases ("nail tech commission tracking", "tip tracker app" and so on) could not be run.
- Raw data is in `C:/Bay/Temp/r3w/nail-tracker-reddit-20261106/`. The block is also recorded in the research kit's notes on Reddit (`C:/Bay/Tools/playwright-cli/sites/reddit.com.md`).
- Coverage is thin. In about 700 top posts, money and pay topics are rare; most are nail photos and stories about clients. Nothing turned up about Vietnamese-American salons, turns, check-plus-cash pay, or tracker apps.

All of this is anecdotal: single posts with their dates, and no comment consensus.

## 1. Top pains (from post text)

1. **Not sure what the split and paperwork mean, or whether they are legal.**
   r/Nailtechs, "Is this a legal?" (2024-01-20, 31 comments): "She takes 60% I take 40% ... instead of a W-2 I'll be getting a 1099. Is it normal to work commission and get a 1099?" https://www.reddit.com/r/Nailtechs/comments/19be2di/is_this_a_legal/
   *Fits the app:* a plain-words view of "my share at X%, and what that adds up to", plus a tax note for 1099 workers.
2. **Splits differ by service, and the tech pays for supplies.**
   r/Nailtechs, "Is this fair?" (2024-06-12, 36 comments): "commissions 45/55 with products included ... She offered that we go 60/40, where I keep the 60% and tips ... I have to completely provide everything on my own". https://www.reddit.com/r/Nailtechs/comments/1de868e/is_this_fair/
   *Fits the app:* one person can have more than one split rate, and supplies are a real cost of the job.
3. **Owners count tips as part of pay, and low commission rates.**
   r/Esthetics, "What's up with the lowpay for Estheticians?" (2025-02-10, 95 comments): "commission under 35% ... they count tip as part of the potential earnings ... We should not be starving if 5 customers don't tip us 20% in one pay period." It also gives a rate history of "40% ... 45% ... cap out at 55%". https://www.reddit.com/r/Esthetics/comments/1im33d8/whats_up_with_the_lowpay_for_estheticians/
   *Fits the app:* show tips apart from commission, and show totals per pay period.
4. **The tip rules change after hiring, and base pay is low.**
   r/Cosmetology, "I was making $9.50 an hour..." (2026-10-27): "The tipping arrangements also changed after I was hired". https://www.reddit.com/r/Cosmetology/comments/1xgea8u/
5. **Slow days and no idea what the take-home really is.**
   r/Cosmetology, "Is anyone else having this problem?" (2025-12, 90 comments): "8 haircuts today and made only 39 dollars in tips". https://www.reddit.com/r/Cosmetology/comments/1pbt9o8/
   r/hairstylist, "I'm really sick of people saying I make more than a doctor" (2026-05, 52 comments): "After rent, product and all my other monthly expenses I end up with about $600". https://www.reddit.com/r/hairstylist/comments/1thsw3j/
   r/hairstylist, "Is anyone else in the hair industry struggling?" (2024-09, 245 comments): "three no shows and SEVEN last minute cancellations ... I'm not making it financially". https://www.reddit.com/r/hairstylist/comments/1flaayk/
6. **Tiny or missing tips from regulars hurt.**
   r/Esthetics (2024-09-25, 258 comments): a regular client whose services run "over 200+ dollars" leaves "a ... DOLLAR tip". https://www.reddit.com/r/Esthetics/comments/1fpbepb/

## 2. Apps and tools people use or ask for

- **Nothing found on Reddit.** No post in the lists we read names a tracker, a notebook, the Notes app or a spreadsheet, and the comments, where tools usually come up, could not be read.
- Off Reddit, from a general web search; these are leads only and were not checked:
  - Several App Store apps target this exact job: "Nail Tech Income Tracker" (tracks split, tips and clients; reportedly 2.3 stars from only 3 ratings), "TipJar: Server Tip Tracker" (names nail techs; $3.99 a month or $39.99 lifetime), "ServerLife", "TipMap" (has a tax estimator) and "Salon Accounting". The low ratings suggest room for a better app.
  - A Salon Geek forum thread, "Am I getting screwed on my pay checks (USA)": https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570
  - Card-tip fees. Forum posts say salons take "about 3%", and one claims 20%, from tips paid by card. A beauty-business blog says some states, California among them, ban any deduction from tips: https://thisuglybeautybusiness.com/2016/02/service-charges-autogratuity-tips-taxes-quick-reference-beauty-industry.html and https://www.salongeek.com/threads/owners-charging-staff-to-off-set-client-credit-card-transaction-fees.154945/
  - The same blog advises keeping your own records and receipts as proof when a paycheck looks short.

## 3. Copying or repeating a regular client's services

No direct evidence. Related signs: posts keep describing **regulars who come on a fixed cycle** ("every six to eight weeks clients", in the "struggling" thread above, and "I see this girl regularly" in the one-dollar-tip thread), and price rises that have to be explained to "a few older clients" (r/Nailtechs, "Bit the bullet and upped my prices", 2025-11-15: https://www.reddit.com/r/Nailtechs/comments/1oxpfgc/). This is indirect support for reusing a regular's usual service and price, and for changing that price when prices go up.

## 4. Comparing weeks, goals and taxes

- **Taxes:** a 1099 instead of a W-2 under commission is a real point of confusion (pain 1).
- **Pay periods:** people judge income per pay period ("5 customers don't tip us 20% in one pay period", pain 3) and per month after costs ("about $600", pain 5).
- **Goals:** the only "goal" posts are about skills, not money (r/Nailtechs, "My first week taking paid clients", 2023-11-12). There is no evidence of people asking for earnings goals or week-to-week comparisons.

## What would fill the gaps

Reading the comments on the 6 to 8 threads above, plus the newest posts in r/Nailtechs, should turn up the tools people use and more direct pains. That has to wait until Reddit lifts the block on the research Chrome, with a fresh run on another day at the kit's slow pace.
