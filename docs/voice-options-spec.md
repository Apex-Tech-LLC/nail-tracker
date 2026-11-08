# Voice options (release 2.6 draft)

**Status:** draft for Bay, 2026-11-07. Picture: `docs/design/voice-options-mockup.html`.

## 1. The problem

During the day a technician has no time to tap through Add turn for every client. Many write the jobs on paper or
keep them in their head. At the end of the day they should be able to say the whole day once, in English or
Vietnamese, and get the turns made for them. All they do is check and save.

> "Three jobs. Gel manicure 45, 10 tip cash. Pedicure 35. Acrylic fill 50, 8 tip on card, she asked for me."

becomes three draft turns on the chosen day, ready to check.

## 2. What we can and cannot use (research, November 2026)

| Way | Verdict | Why |
|---|---|---|
| The phone keyboard's mic button | **Use it** | Works in the installed app on iPhone and Android, knows Vietnamese, often works offline on iPhone, costs nothing |
| An in-app mic button (the browser's speech API) | Not now | Broken in iPhone home-screen apps (WebKit bug 225298, open since 2021); needs the internet on Android |
| The person's ChatGPT subscription signing in to our app | Not now | "Sign in with ChatGPT" plan use is a preview for chosen partners and local apps only |
| A ChatGPT app or MCP connection | Not now | Needs our own server; ChatGPT cannot reach data that lives only on the phone |
| ChatGPT by copy and paste | **Optional** | Works with any ChatGPT plan, even free, with no key and no server |
| The person's own AI key (Gemini, OpenRouter, OpenAI) | **Optional, later** | Smarter with messy speech; costs under a cent a day; Gemini's free tier may use the text to train |
| An AI model inside the phone's browser | No | Not on phones, and no Vietnamese |

So the default is free, private and offline: **the keyboard mic plus our own reader** that turns the words into
turns on the phone. ChatGPT and an AI key are extras for people who want them.

## 3. The screens

**Entry.** On Home, a `Say your turns` / `Nói các turn` button beside `+ Add turn`; on Add turn, a mic chip at the
top. Both open the Say screen.

**Say screen** (`/say`):
- The day, as on Add turn: `Today`, `Yesterday` or a date. End of day from paper is the main use.
- One big text box with the hint: `Tap the mic on your keyboard and say each job: service, price, tip.` and an example
  in the person's language. Typing works too.
- `Make turns` / `Tạo turn`.

**Check screen:**
- One card per draft turn in the order said: services with prices, tips (cash or card), request or walk-in, time.
  Each card shows what was heard under it in small grey text, so a wrong turn is easy to spot.
- A card the reader is unsure about is marked `Check this` in orange with the reason: `No price heard, used your usual
  $35`, `"Gel X" matched to Gel-X`, `Price for two services: split by usual prices`.
- Words it could not use show at the end as `Not understood: "…"`, with `Add as a turn` to open Add turn.
- Tap a card to fix it in the usual Add turn form; swipe or `Remove` to drop it.
- At the bottom: the total earned for these turns and `Save 3 turns` / `Lưu 3 turn`. Nothing is saved before this.
- Times: turns get times spread across the work day in the order said (9:00, then every 45 minutes), unless a time
  was said ("at 2", "lúc 2 giờ").

## 4. The reader (free, on the phone)

A pure function in `src/domain/` that takes the text, the service list (English and Vietnamese names), usual prices,
and the locale, and returns draft turns with a confidence note on each. No network.
- **Splitting into turns:** sentences, new lines, "next", "then", "another", "rồi", "tiếp", "khách tiếp theo", and
  counted lists ("three jobs: …"). A count said up front that does not match what follows gets a `Check this`.
- **Services:** match against the person's own service names in both languages, ignoring case, accents and spaces,
  plus common short forms (mani, pedi, full set, fill, gel X, dip, bột, sơn gel, đắp bột, chân, tay). Several services
  joined by "and" / "với" / "và" make one turn.
- **Money:** "45", "$45", "45 dollars", "forty five", "45.50", and Vietnamese "bốn mươi lăm", "bốn lăm", "45 đô". A
  price with no service, or a service with no price, uses the usual price and is marked.
- **Tips:** "10 tip", "tip 10", "10 cash tip", "8 on card", "boa 10", "tiền tip 10", "tip thẻ 8". Cash is the
  default unless "card" / "thẻ" is said.
- **Request or walk-in:** "asked for me", "request", "khách quen", "khách gọi tên"; otherwise walk-in.
- Money stays in whole cents. Commission and earned are worked out by the same code Add turn uses.

## 5. ChatGPT by copy and paste (optional)

On the Say screen, `Use ChatGPT instead`:
1. Copies a short prompt with the person's service names and the exact reply format (a JSON block), and opens ChatGPT.
2. The person talks to ChatGPT (voice or text), then copies its reply.
3. Back in the app, `Paste ChatGPT's answer`: the app finds the JSON block, checks every field, and shows the same
   Check screen. Anything malformed is shown as `Not understood`, never saved.

Nothing is sent by the app itself; the person chooses what to tell ChatGPT.

## 6. Own AI key (optional, later)

Settings › `AI helper`: off by default. Paste a key for Gemini, OpenRouter or OpenAI. The app then sends **only the
spoken text and the service names** to that service and expects the same JSON as section 5. A plain warning: the text
leaves the phone; Gemini's free tier may use it to improve Google's products. Later, the same helper could read a
**photo of the paper list**.

## 7. Done when

- WHEN the technician says "Gel manicure 45, 10 tip cash. Pedicure 35." THE APP SHALL show two draft turns: Gel
  Manicure $45 with $10 cash tip, and Pedicure $35. *Example: at 60%, the check screen shows $27 + $10 + $21 = $58.*
- WHEN a service has no price THE APP SHALL use the usual price and mark the card `Check this`. *Example: "pedicure"
  alone, usual price $35, shows $35 and `No price heard, used your usual $35`.*
- WHEN the text is in Vietnamese THE APP SHALL read Vietnamese service names and numbers. *Example: "Sơn gel tay bốn
  lăm, tip mười đô" gives Gel Manicure $45 with $10 cash tip.*
- WHEN the technician taps Save THE APP SHALL save every draft turn on the chosen day, and nothing before. *Example:
  three drafts on Yesterday add three turns to yesterday in History, and Home's week bottles update.*
- WHEN a ChatGPT reply is pasted THE APP SHALL accept only the JSON block and refuse fields it cannot check. *Example:
  a price of "forty-ish" shows as `Not understood`.*
- WHEN no AI key is set THE APP SHALL make no network request on the Say and Check screens.

## 8. Build order

| Task | What |
|---|---|
| V22 | The reader: domain function and a large table of English and Vietnamese example sentences as unit tests |
| V23 | Say and Check screens, entry buttons, save; browser tests |
| V24 | ChatGPT by copy and paste |
| V25 | Own AI key (later, if people ask for it) |

Before V22: a Vietnamese-speaking technician should say five real days into the keyboard mic, so the example table
uses real words, not guessed ones.
