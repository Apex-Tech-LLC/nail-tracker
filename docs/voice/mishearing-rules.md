# iPhone salon mishearings: research handoff

2026-11-09. Extends the sound-alike testing queue in [the word matrix](word-matrix.md); [the table](mishearings.json) is data for a later reader change. No recordings were available and no recognizer was installed or run.

## Evidence and table meaning

- `sure` concerns evidence for the exact dictation output, not whether the intended service exists. Only English-mode `joe x` is true: the owner directly reported Gel-X becoming Joe X in this brief. This is owner testimony, not an independently reproduced recording; device/version and frequency remain unknown.
- Every other row is false, including old aliases and ordinary spellings. The brief's `jello x`, `joel x`, `gio ich`, `jeo ich`, `gieo ich` and `ac ri lich` are candidate examples, not additional observed outputs. No paper below establishes these exact iPhone strings.
- `mode` is the selected dictation language, not the app locale or language of every spoken word. Proposed English outputs can come from accented English or Vietnamese in a mixed sentence; proposed Vietnamese outputs include English rendered as Vietnamese syllables. Native Vietnamese phrase distortions are also included.
- Within each key, rows start with the most useful candidates to test, grouped English then Vietnamese; order is editorial likelihood, not measured frequency. Joining variants have separate rows, notably `gelx` / `gel x` and `gioich` / `gio ich`. Correct spellings in the table are comparison controls, not claims of errors.
- `new` compares normalized whole-token spans anywhere in the existing matrix and exact reader `misheard` entries, regardless of key or platform. Fold accents and đ, lowercase, split punctuation/hyphens and collapse whitespace. An old Android hypothesis therefore has `new: false` without becoming iPhone evidence. The synthetic phrase corpus supplies no evidence upgrades.
- `collisions` are warnings and negative examples, never unconditional replacement rules. Their `key` names the affected field/service; `number:2`, `number:4`, `number:5` are explanatory targets, not preset ids. Some collision examples deliberately have no positive row. Every speculative recovery needs “Check this”; `sure: true` does not waive collision checks.

## What was reused and what newer options were skipped

Read the ten seed services, the 315 synthetic phrases, the existing matrix, and the reader's number, marker, strict-accent and phrase-lookup tables. Existing lookup chooses the longest token phrase, tries strict accents before folded text, and lets the person's own names override built-in entries. Existing `bo` and `the` handling deliberately retains accent/context restrictions. This handoff changes none of that.

- [Apple's current Dictation guide](https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/27/ios/27) ties dictation language to keyboards and describes automatic punctuation. Its newer iOS 27 spelling/punctuation model is English-only on specified devices. Skip dependence on it: neither mixed Vietnamese salon accuracy nor this person's hardware is established.
- [Apple SpeechAnalyzer](https://developer.apple.com/documentation/Speech/SpeechAnalyzer) is a native Swift speech API, not a drop-in browser correction stage. Skip adopting it in this Windows-researched React PWA; no native app work is authorized here.
- [TSPC, revised March 2026](https://arxiv.org/abs/2509.05983), and [ViMedCSS, revised June 2026](https://arxiv.org/abs/2602.12911), are newer Vietnamese-English recognition research. They support investigating domain vocabulary and phoneme-aware methods; they do not supply iPhone nail-salon outputs. Skip their models/datasets as runtime dependencies: no demonstrated browser integration here, and medical speech is a different domain.
- [A recent multilingual iOS user report](https://www.reddit.com/r/ios/comments/1wd64uc/why_is_it_so_clunky_to_have_multiple_languages/) describes keyboard/language switching trouble. It is anecdotal context, not Vietnamese salon evidence. Current official pages, papers and Reddit were checked before choosing a small local text table; no new package, server or cloud service is needed for the deliverables.

## Sound changes to propose, never global rewrites

[Kang, Vo and Moran's speech study](https://tesl-ej.org/wordpress/issues/volume20/ej77/ej77a1/) discusses final consonant/cluster changes and lax/tense vowel contrasts in Vietnamese-accented English; it is not an iPhone study and its speakers do not represent every Vietnamese-American technician. [Vu and Schultz's Vietnamese ASR paper](https://www.csl.uni-bremen.de/cms/images/documents/publications/VuSchultz_ASRU2009.pdf) discusses dialect-dependent ch/tr and d/gi/r distinctions. The mappings below are testing hypotheses inferred from this background and the brief, not measured dictation confusion rates.

| Feature | Bounded candidate generation | Required guard |
| --- | --- | --- |
| English soft g/j; Vietnamese gi/d/z | Gel may surface as joe/jell/jail or gieo/deo/geo; test the complete name. | English soft g is not Vietnamese hard g/gh; d is not đ. These are spelling/output candidates, not one universal pronunciation rule. |
| Vietnamese ch/tr, s/x | Offer a dialect-sensitive alternate syllable for a known name. | Dialects differ; do not merge every word beginning with these letters. |
| Letter X versus sounds | For the X in Gel-X, test x/ex/ich/et; an English /ks/ ending may lose a consonant. | Vietnamese x in an ordinary word is /s/, not automatically the English letter name ex. Never replace bare ich, ex or eggs. |
| Final stops and clusters | Test a missing final t/k/p/s or reduced st/ks/kt only within a complete service name; request and next are especially vulnerable. | Dropping endings can turn card into car and next into neck; both have ordinary meanings. |
| Final l/r and syllable boundaries | Test fill/feel/field and acrylic/ac ri lich as explicit candidates. | Do not make every r/l pair equivalent; bare acrylic cannot choose full set versus fill. |
| Vowel length/quality and weak vowels | Test short i/long ee (dip/deep, fill/feel), e/ae-like renderings (set/sat), and a weak inserted vowel between English consonants. | No unrestricted vowel deletion or substitutions: gel, jail and joe may be unrelated words/names. |
| Stress, splitting and joining | Test manicure/man a cure/ma ni cu, pedicure/pe di cu, fullset/full set, gelx/gel x. | Compare whole tokens; only join a bounded name span, never the whole sentence or across amounts/negation. |

## Names the person added or renamed

1. Build candidate names from the active presets' actual English and Vietnamese names, including the reader's existing slash/parenthesis alternatives. Honor exact user names first; keep aliases attached to a preset id, not a global spelling replacement.
2. For an unmatched service-like span, compare whole-name syllables after ordinary normalization. Try one listed sound change or one join/split first; several simultaneous guesses need explicit review. Recompute candidates when a preset is renamed, added or removed.
3. Require evidence of service structure, such as an adjacent amount and a distinctive name portion. Preserve qualifiers for hands/feet, gel/acrylic/dip, full set/fill/removal. A price alone cannot select a service; an absent preset cannot be created by its old alias.
4. If two active names fit, keep the text unresolved and show the choices. Example: custom “Mini Mani” and “Manicure” both fit `mini cure`; custom “Gel Fill” must not be redirected to acrylic fill. Exact user names still beat a built-in fuzzy candidate.
5. Keep original text and the proposed matched span for review. Table hits and unseen sound-alikes need the same semantic guards. Keyboard mode may be unknown to the PWA; compare both candidate sets with warnings rather than infer the mode from the UI language or a single word.

## Numbers, prices and order

These are proposed input representations and acceptance examples, not captured keyboard outputs. Reuse the reader's number grammar; no new one-to-one-hundred aliases are supplied.

| Selected mode | Representations to retain | Price-first / price-last examples |
| --- | --- | --- |
| English | `45`, `$45`, `forty five`, `forty-five`, `45 dollars` | `45 joe x` / `joe x forty five` |
| Vietnamese | `45`, `$45`, `45 đô` → `45 do`, `bốn mươi lăm` → `bon muoi lam`, `bốn lăm` → `bon lam` | `45 đô gieo ích` → `45 do gieo ich` / `gieo ích bốn lăm` → `gieo ich bon lam` |
| Mixed in either mode | A numeral plus English or Vietnamese units/number words; do not translate digits or infer keyboard mode. | `bon lam joe x` / `gel x 45 do` |

- All examples above represent 4500 cents only after service/amount association is unambiguous. Amount before or after a name does not by itself distinguish a service charge from a tip, count, time, discount or another customer's price.
- In `45 joe x, 10 tip`, retain service 4500 cents and tip 1000 cents; in `tip 10 card, joe x 45`, the card amount belongs to the tip. In `45 joe x 10`, the unmarked second amount needs review. Never duplicate or borrow an amount across a guessed boundary.
- Preserve `$45.05`, `$45.50`, `45 đô 50 xu` and decimal words as amounts, not word-boundary separators. Reuse integer-cent parsing. Do not round unsupported precision or infer cents from an unmarked pair such as `forty five fifty`.
- Only the brief's `for`/four, `to`/two and `nam`/năm ambiguities appear under number collisions. They are supplied illustrations, not recorded iPhone findings. No additional unobserved number-as-word errors are asserted. `nam` already parses as five; folding alone cannot distinguish năm/year, nam/south or the name Nam.
- A real number substituted for another (15/50, 40/45), a missing digit, or a lost `no`/`không` cannot be recovered reliably from text. Keep the dictated value visible; do not silently adjust it using a usual price.

## Matches too risky to guess without context

- Protect whole service phrases before marker recovery: `Gel-X tips` means nail tips; `full set bộ bột` is not gratuity `bo`. `tiếp` can mean next/continue; it must not become a tip just because it resembles English tip.
- Preserve raw accents for `thẻ` versus `thể`/English `the`, and `bo` versus `bộ`/`bò`/`bỏ`. Folded JSON cannot carry these distinctions. English-mode `the` is a high-risk test candidate, never an unconditional card marker.
- Require a gratuity amount/clause before cash/card recovery. `cache`, `catch`, `car`, `cart`, `cat` and `ca` are insufficient alone; a service paid by card is not a card tip. Preserve “not cash, card” and other corrections.
- Request must concern this technician; a request for a color is different. Preserve negative spans before alias lookup. A walk-in can request someone; an appointment or regular client does not settle request status.
- Do not split turns on `neck`, `net`, `khach tip` or an ordinary `next` step alone. `work in` may concern work. Require a clear new-client/service-price structure and retain a warning for any inferred split.
- Bare feel/field, bot, acrylic, gel, SNS, art and removal-like editing commands lack enough meaning for a safe service assignment. Do not create a charge from a described included finish or a step within another service.

## What real recordings must settle

Record the same intended names and complete price/tip/request sentences in each selected keyboard language, both standalone and code-switched, using several technicians and their own renamed/custom services. Include accent-preserving raw text, intended meaning, audio with consent, iPhone model, iOS build, keyboard language, dictation settings, online/offline state and repeat count. Keep final committed dictation text distinct from transient suggestions and manual edits.

The evidence must establish which proposed syllables actually occur, their frequency/order, dialect/speaker differences, the owner's Joe-X mode/version, join/split behavior, and false matches on ordinary conversation. Paired amount, negation, nail-tip/gratuity and price-order recordings must determine usable confidence thresholds and when a suggestion is too risky. Synthetic examples and phonetic plausibility cannot settle those questions.
