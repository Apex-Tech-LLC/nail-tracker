# Voice entry language matrix

Research draft, 2026-11-08. Companion: [phrases.json](phrases.json), 315 synthetic examples (126 English, 126 Vietnamese, 63 mixed). These are proposed language acceptance cases, not recordings, measured keyboard outputs, or evidence that the reader already supports them. A Vietnamese-speaking US salon technician must review them, then supply the five real dictated days requested by [the voice spec](../voice-options-spec.md). No reader or new service is introduced here.

## Evidence and current input methods

**S = sure:** exact seed name, explicit spec rule, or ordinary unambiguous meaning. **G = best guess:** proposed salon shorthand, interpretation needing local confirmation, or hypothesised transcription error. A row can have S meaning and G aliases. **Every mishearing in this document is G**, for both platforms; none was tested on an iPhone or Android. Similar-looking words are not proof of speech-recognition behaviour. Do not describe these as common measured errors or enable broad fuzzy matching from this list.

Reused the existing voice spec and all ten presets in `src/db/seed.ts`; there is no existing voice corpus in this checkout. No GitHub API calls or outside parser packages were needed.

Checked the current vendor guidance before selecting the research method:

- [Apple's current iPhone Dictation guide](https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/ios) describes automatic punctuation and editing commands, with device and language limits. Its newer iOS 27 spelling/punctuation improvement is described as English-only on specified devices. It is not evidence for Vietnamese-English salon accuracy.
- [Google's standard voice typing guide](https://support.google.com/gboard/answer/2781851?hl=en) covers keyboard input and warns punctuation is not available in all languages. [Advanced voice typing](https://support.google.com/gboard/answer/11197787?hl=en) lists six supported languages, excluding Vietnamese. Do not confuse Vietnamese keyboard availability with advanced Vietnamese dictation support, or assume all Android keyboards are Gboard.
- Newer option skipped as a dependency: [Google's Rambler guide](https://support.google.com/gboard/answer/17468539?hl=en) describes Gemini-based rewriting, Pixel 11 prerequisites, internet for full features and limited offline use. The reader must accept whatever text arrives, but cannot depend on that device or on AI cleaning up corrections.
- [A Gboard user's bilingual switching report](https://www.reddit.com/r/gboard/comments/1nwi360/auto_switch_language_voice_typing_issue/) is an anecdote about choosing the wrong language, not Vietnamese accuracy evidence. It motivates testing both keyboard languages; no error frequencies are inferred.
- Newer LLM-assisted speech-writing research, [Rambler in the Wild (2025)](https://arxiv.org/abs/2502.05612), studies writing rather than deterministic nail-pay extraction. Skipped as an implementation method: this task requires plain TypeScript, no AI and no network. The research prototype and Google's same-named product should not be assumed identical.

The following sources establish terminology, not how frequently US Vietnamese technicians say it: [World Nail School's bilingual glossary](https://www.worldnail.edu.vn/tin-tuc/thuat-ngu-tieng-anh-thong-dung-cho-tho-nail) (search-index text available; full page timed out), [Aprés' Gel-X definition](https://help.apresnail.com/en-US/what-is-gel-x-539185), [SNS' professional FAQ](https://snsnails.com/pages/faq-pro), and [Caroline Phung's Vietnamese number guide](https://howtovietnamese.com/numbers-in-vietnamese/). US salon shorthand and mixed sentences below are research hypotheses until technician review.

There is limited **attested US speech**, distinct from our synthetic sentences. [RFA's 2015 interviews with US nail workers and owners](https://www.rfa.org/vietnamese/news/programs/WomenMagazine/vn-wm-nailing-it-in-america-hn-03292015102532.html) include “tiền bo,” “trăm rưỡi,” “hai chục” and “hai lăm đồng” in the New York owner's account. The last phrase is in a US-dollar conversation: **đồng does not always mean VND**. [Người Việt's 2017 Stanton salon interviews](https://www.nguoi-viet.com/nhung-neo-duong-nails/nghe-nail-khong-phai-cu-mo-tiem-la-co-khach/) attest “cả chân lẫn tay,” “full set” and “mani & pedi.” These dated first-hand quotes support vocabulary, not today's prices, prevalence, or our exact turn boundaries. [Alio's current Vietnamese salon product page](https://aliopos.com/vi/app-chia-turn-tiem-nail) also uses khách walk-in, khách chỉ định and khách gọi tên; this is vendor-written terminology, not a recording of technician speech.

## Service matrix

Use the longest specific service phrase first: `sơn gel chân` overrides `chân`; `acrylic fill` overrides `acrylic`; `Gel-X full set` is Gel-X. Accent folding must also map `đ` to `d`. Keep token boundaries: ignoring spaces for a known service does not mean matching `tay` inside another word. Capitalization, accents, and ordinary hyphen/space variants alone do not need a warning.

| Seed preset id | English, including short forms | Vietnamese with accents → without accents | Mixed salon candidates | Confidence and guard |
| --- | --- | --- | --- | --- |
| `manicure` | manicure; regular manicure; basic manicure; mani | làm móng tay → lam mong tay; tay thường → tay thuong; tay → tay | làm mani; regular tay | S seed/mani; G tay shorthand. Bare tay tentatively means basic manicure; flag it. Do not turn polish-only work into a full manicure silently. |
| `pedicure` | pedicure; regular pedicure; basic pedicure; pedi | làm móng chân → lam mong chan; chân thường → chan thuong; chân → chan | làm pedi; regular chân | S seed/pedi; G chân shorthand. Bare chân tentatively means basic pedicure; flag it. |
| `gel-manicure` | gel manicure; gel mani; gel polish manicure; gel on hands | sơn gel tay → son gel tay; làm gel tay → lam gel tay | gel tay; mani gel; sơn gel manicure | S seed/spec sơn gel tay; G bare sơn gel (hands unspecified). Bare gel or Shellac needs body/service confirmation. |
| `gel-pedicure` | gel pedicure; gel pedi; gel polish pedicure; gel on toes | sơn gel chân → son gel chan; làm gel chân → lam gel chan | gel chân; pedi gel | S seed; G spoken order variants. Gel modifier belongs to the nearby service, not the entire turn. |
| `gel-x` | Gel-X; gel x; gel ex; Gel-X extensions | nối móng Gel-X → noi mong Gel-X; đắp Gel-X → dap Gel-X | làm Gel-X; full set Gel-X | S seed/product identity; G phonetic spellings. Gel-X is a soft-gel extension system, distinct from gel polish. Aprés alone is not sufficient. |
| `acrylic-full-set` | acrylic full set; full set acrylic; new acrylic set; full set | full set bột → full set bot; đắp bột → dap bot; bộ bột mới → bo bot moi | làm full set; acrylic bộ mới | S seed; G bare full set/đắp bột default to acrylic with warning. Bare acrylic/bột does not distinguish a new set from a fill (or dip for bột). |
| `acrylic-fill` | acrylic fill; acrylic refill; fill-in; fill; refill | dặm bột → dam bot; dậm bột → dam bot; đắp bột lại → dap bot lai | fill bột; refill bột | S seed dặm bột; G dậm spelling/bare fill default to acrylic with warning. Gel fill is not automatically acrylic. |
| `dip-powder` | dip powder; dip; dipping powder; SNS dip; SNS | bột nhúng → bot nhung; nhúng bột → nhung bot | làm dip; dip bột; làm SNS | S seed/dip; SNS sells a dip system but also other products. G bare SNS defaults to dip with warning; explicit SNS dip is clear. Generic bột is insufficient. |
| `nail-art` | nail art; design; nail design; designs | vẽ móng → ve mong; vẽ → ve; trang trí móng → trang tri mong | thêm design; làm nail art | S seed; G isolated vẽ/design requires service context. French/ombre/chrome can be included finishes: do not invent a separate charge. |
| `removal` | removal; soak off; soak-off; take off nails; take off | tháo móng → thao mong; tháo bột → thao bot; tháo gel → thao gel | remove móng; soak off bột | S seed; G shorthand. `Take off five dollars` is a price change, not removal. |

Polish brands (Shellac, OPI, DND), builder gel, BIAB, hard gel, pink-and-white, ombre and chrome are not new preset ids. Brand/finish alone cannot establish a service. Preserve an unresolved phrase for review unless a known service is explicit. Likewise `tip` can mean plastic nail tips, not gratuity: `Gel-X tips` must not make a cash tip.

### Service mishearings to test, all G

Each platform cell supplies **English dictation / Vietnamese dictation** candidates. These are a testing queue, not platform-specific claims. Brand spellings suggested by the brief are included without claiming independent confirmation.

| Intended service | iPhone: English / Vietnamese candidates | Android keyboard: English / Vietnamese candidates | Proposed handling |
| --- | --- | --- | --- |
| Manicure / làm móng tay | `man a cure`, `many cure` / `làm món tay`, `móng tai` | `money cure` / `lam mong tay`, `làm mỏng tay` | Canonical accentless form is safe; speculative homophones require warning and narrow context. |
| Pedicure / làm móng chân | `peddy cure` / `làm móng chăn` | `petty cure` / `lam mong chan`, `móng chanh` | No arbitrary word-distance matching. |
| Gel manicure / sơn gel tay | `jail manicure` / `sơn deo tay` | `gel many cure` / `son gel tay`, `sơn gieo tay` | Only a tiny explicit alias list; flag recovery. |
| Gel pedicure / sơn gel chân | `jail pedicure` / `sơn deo chân` | `gel petty cure` / `son gel chan`, `sơn gieo chân` | Require foot/pedi context. |
| Gel-X | `jello ex`, `gel ex` / `gel ích`, `gel ét` | `JOX`, `gel eggs` / `gieo ích`, `gel x` | `gel ex` is a plausible phonetic spelling; jello ex/JOX are speculative. Mark the intended match; do not recover every `eggs`. |
| Acrylic full set / full set bột | `a critic full set` / `full sét bột` | `acrylic fool set` / `phun set bột`, `dap bot` | Explicit full set or đắp bột helps; no silent correction of generic acrylic. |
| Acrylic fill / dặm bột | `acrylic feel` / `dậm bột` | `acrylic field` / `dam bot`, `dặm bộ` | Dặm/dậm is a proposed spelling variant, not measured microphone error. |
| Dip powder / bột nhúng | `deep powder` / `bột nhung` | `dip power`, `S and S` / `bột nhún`, `ép en ét` | Distinguish accents lost in nhúng from genuinely different words; flag recovery. |
| Nail art / vẽ móng | `nail heart` / `vẻ móng` | `male art` / `ve mong`, `vẽ món` | Only within a clearly nail-related clause. |
| Removal / tháo móng | `soak of` / `thảo móng` | `remove all` / `thao mong`, `tháo món` | `Remove all` could be an editing command: do not make a service automatically. |

## Money matrix

All bare service amounts here mean US dollars. No VND conversion, implied thousands, commission calculation, or tip percentages. Integer cents are the expected output; strings below are input only. The number guide supports common numeral variants; applying slang to US salon prices is G until confirmed. Numeric vocabulary includes: không/khong, một/mot, hai, ba, bốn/bon or tư/tu, năm/nam or lăm/lam, sáu/sau, bảy/bay, tám/tam, chín/chin; mười/muoi, mươi/muoi, chục/chuc, trăm/tram, lẻ/le or linh. Folding mười and mươi together loses information: retain original text and grammatical context.

| Meaning | English | Vietnamese with accents → without | Mixed | Confidence / exact cents |
| --- | --- | --- | --- | --- |
| Whole dollars | `45`, `$45`, `45 dollars`, `forty-five`, `forty five bucks` | `45 đô`, `bốn mươi lăm đô` → `45 do`, `bon muoi lam do` | `bốn lăm dollars`, `forty five đô` | S explicit money; 4500. G slang bucks coverage. |
| Short tens | `twenty`, `forty five` | `hai chục`, `bốn lăm`, `ba lăm`, `hai mốt`, `hai tư` → `hai chuc`, `bon lam`, `ba lam`, `hai mot`, `hai tu` | `pedi ba lăm` | S ordinary numbers; G salon dialect choice. 2000, 4500, 3500, 2100, 2400. |
| Hundreds and internal zero | `one hundred five`, `one hundred and five` | `một trăm lẻ năm`, `một trăm linh năm` → `mot tram le nam`, `mot tram linh nam` | `full set một trăm lẻ năm` | S 10500; count classifier khách/turn is not money. |
| Explicit cents | `45.50`, `$45.05`, `forty five dollars and five cents` | `45 đô 50 xu`, `bốn lăm đô năm xu` → `45 do 50 xu`, `bon lam do nam xu` | `45 đô fifty cents` | S 4550 / 4505. `xu` used as US cents here: G local wording. |
| Decimal words | `forty five point five zero`, `forty five point zero five` | `bốn lăm phẩy năm`, `bốn lăm chấm không năm` → `bon lam phay nam`, `bon lam cham khong nam` | `gel mani bốn lăm point five` | S decimal arithmetic: 4550 / 4505; G preferred spoken forms. Decimal tail is digits, not another dollar amount. |
| Decimal comma | `45,50` (typed/pasted) | `45,50 đô` → `45,50 do` | `pedi 35,25 đô` | G locale policy: two adjacent fractional digits, no space, yields 4550/3525 with warning; `45, 10 tip` is two fields. |
| Explicit half-dollar | `forty five and a half dollars` | `bốn lăm đô rưỡi` → `bon lam do ruoi` | `tip five đô rưỡi` | S half a dollar after a dollar unit, 4550/550; G local idiom. |
| Half of a larger unit | `half of thirty` | `ba chục rưỡi`, `một trăm rưỡi` → `ba chuc ruoi`, `mot tram ruoi` | `full set một trăm rưỡi đô` | G usage: proposed 35 / 150, not 30.50 / 100.50. Keep a warning for this unit-relative shorthand. |
| Missing half-unit | `forty five fifty`, `fifty-ish` | `ba rưỡi`, `bốn lăm rưỡi` → `ba ruoi`, `bon lam ruoi` | `pedi ba rưỡi` | G ambiguous: no automatic price. Bare ba rưỡi could be 3.50, 35, or a time. Use null and preserve the phrase for review. |
| Local currency word | `dollars` | `đồng` → `dong`; `bo năm đồng` → `bo nam dong` | `tip năm đồng cash` | S attested in US-dollar speech, G default policy: interpret as USD only under this app's US-salon context, with warning. Explicit VND/nghìn đồng remains unresolved. |
| Unsupported precision/currency | `45.555`, `minus five`, `ten percent tip` | `45 nghìn đồng`, `âm năm`, `tip mười phần trăm` → `45 nghin dong`, `am nam`, `tip muoi phan tram` | `pedi 35 VND` | S meaning, G rejection policy: never round a third decimal, silently convert VND, or interpret a negative price as removal. |

| Money target | iPhone: English / Vietnamese candidates (G) | Android: English / Vietnamese candidates (G) | Response |
| --- | --- | --- | --- |
| 45 versus 40 or 15 | `forty`, `forty fine` / `bốn mươi`, `bốn năm` | `four five`, `fifteen` / `bon lam`, `mười lăm` | Accept a clearly stated valid number as written; cannot reconstruct lost audio. Do not silently turn `four five` or `bốn năm` into 45. |
| 20, cents and half | `twenty` → `twenty cents` / `hai chục` → `hai chút` | `point five zero` → `point fifty` / `rưỡi` → `rưới`, `rưỡi` → `ruoi` | Missing accents may be expected; added currency units change meaning. Flag malformed decimal words or dubious homophones. |
| Zero/negation | `no tip` → `a tip` / `không tip` → `khong tip` | `zero tip` → `hero tip` / `không` → `công` | Never strip không before reading negation. A missing negation cannot be repaired from text alone. |

## Other field matrix

| Field | English | Vietnamese with accents → without | Mixed candidates | Confidence and interpretation |
| --- | --- | --- | --- | --- | --- |
| Tip amount | `10 tip`, `tip 10`, `10 cash tip`, `gratuity 10` | `boa 10`, `tiền boa 10`, `tiền tip 10`, `bo 10` → `boa 10`, `tien boa 10`, `tien tip 10`, `bo 10` | `tip mười`, `boa ten dollars` | S spec tip/boa and interview bo; G gratuity coverage. Cash default. Tip omission means 0; explicit no tip means 0. Never confuse móng tip (plastic tips) with money. |
| Cash tip channel | `cash tip 10`, `tip 10 cash`, `10 in cash` after a tip marker | `tip tiền mặt 10`, `boa tiền mặt 10` → `tip tien mat 10`, `boa tien mat 10` | `10 tip cash`, `cash mười đô` | S cash/tiền mặt. A service paid cash does not establish a gratuity amount. |
| Card tip channel | `card tip 8`, `8 on card`, `tip 8 credit` | `tip thẻ 8`, `boa qua thẻ 8` → `tip the 8`, `boa qua the 8` | `tip tám on card`, `tip card tám` | S spec 8 on card / tip thẻ 8; G credit/debit variants. `Paid 45 on card` describes payment, not a $45 tip. Two explicit tip channels add separately. |
| Request | `request`, `requested me`, `asked for me`, `asked for me by name` | `khách quen`, `khách gọi tên`, `khách chỉ định`, `khách yêu cầu tôi` → `khach quen`, `khach goi ten`, `khach chi dinh`, `khach yeu cau toi` | `khách request`, `chị ấy request em` | S spec mapping khách quen is request=true, even though being a regular does not necessarily mean requesting this visit; confirm this product choice. G chỉ định scope: must refer to this technician. |
| Walk-in / explicit negative | `walk-in`, `walk in`, `no request`, `didn't ask for me` | `khách vãng lai`, `không request`, `không gọi tên`, `khách không hẹn` → `khach vang lai`, `khong request`, `khong goi ten`, `khach khong hen` | `khách walk-in`, `không phải request` | S default false/explicit negation; G vãng lai/không hẹn equivalence. Appointment alone does not imply request. |
| Next turn | sentence boundary; newline; `next`, `then`, `another customer`, `next client` | `rồi`, `tiếp`, `khách tiếp theo`, `khách nữa` → `roi`, `tiep`, `khach tiep theo`, `khach nua` | `next khách`, `rồi next`, `khách hai` | S spec separators; G extra variants. A period before only tip/request continues the current turn. `Then`/rồi inside one explicit customer can introduce another service. |
| Same turn / services | `and`, `with`, `plus`, `same customer` | `và`, `với`, `cùng một khách`, `thêm` → `va`, `voi`, `cung mot khach`, `them` | `mani với pedi`, `same khách` | S and/và/với; G scope details. Separate adjacent unjoined service-price pairs conservatively with a warning; a known bundle stays one customer. |
| Count before list | `three jobs:`, `two customers:`, `one client:` | `ba khách:`, `hai lượt:`, `một khách:` → `ba khach:`, `hai luot:`, `mot khach:` | `ba jobs`, `two khách` | S spec counts. Counts never become service prices. Count mismatch gets review; never duplicate turns to meet it. Explicit `two customers, each ...` may expand with warning. |
| Correction | `no, I mean 50`, `make that 50`, `sorry, 50`, `not cash, card` | `à không, 50`, `ý là 50`, `sửa thành 50`, `không phải tiền mặt, là thẻ` → `a khong 50`, `y la 50`, `sua thanh 50`, `khong phai tien mat la the` | `no, năm mươi`, `à không, card` | S meaning; G proposed repair scope. Replace the latest explicit compatible field, mark correction, never add both amounts. Named `first customer` is a back-reference needing review, not a new customer. |
| Filler | `um`, `uh`, `okay`, `well`, `please`, `let me see` | `ờ`, `ừm`, `dạ`, `nhé`, `nha`, `để xem`, `chị ơi` → `o`, `um`, `da`, `nhe`, `nha`, `de xem`, `chi oi` | `okay rồi`, `ờ okay` | S conversational filler; G safe positions. Ignore standalone filler only. À không is a correction; rồi can split turns; một/one, không/no, tiền/money are not fillers. |

### Other-field mishearings to test, all G

| Field | iPhone: English / Vietnamese candidates | Android: English / Vietnamese candidates | Guard |
| --- | --- | --- | --- |
| Tips | `tip` → `ten`, `tips` → `tapes` / `boa` → `bò` | `tip` → `ship`, `gratuity` → `gratitude` / `tiền tip` → `tiền tiếp` | Amount needs tip context. Do not make ten a keyword for tip. |
| Cash/card | `cash` → `catch`, `card` → `cart` / `thẻ` → `thể` | `cash` → `cashed`, `card` → `car` / `tiền mặt` → `tiền mạc` | Only curated recoveries in a tip clause; `the` after accent folding is a Vietnamese card word only in Vietnamese/mixed context. |
| Request/walk-in | `request` → `re quest`, `walk-in` → `walking` / `gọi tên` → `gọi tiền` | `asked for me` → `ask for me`, `walk in` → `walked in` / `khách quen` → `khách quên` | Do not globally map English walking or Vietnamese tiền to request. Preserve negation. |
| Turn boundary/count | `next` → `neck`, `three jobs` → `free jobs` / `khách tiếp` → `khách típ` | `then` → `than`, `two turns` → `to turns` / `ba khách` → `bà khách`, `rồi` → `rời` | No splitting solely on these speculative words. Newlines and punctuation may be absent or added by the keyboard. |
| Corrections | `no I mean` → `now I mean` / `à không` → `a khong` | `make that` → `make it` / `ý là` → `y la`, `à không` → `à công` | Correction keyword precedence before punctuation splitting. Accentless a khong is safe, à công is not. |
| Fillers | `um` → `I'm`, `uh` → `a` / `ờ` → `ở`, `dạ` → `giá` | `well` → `we'll` / `ừm` → `um`, `nhé` → `nhẹ` | Do not remove giá (price), tôi/I'm introducing a request, or bare a/one without context. |

## Corpus contract and unresolved product choices

- Top-level JSON is an array. IDs are stable and locale describes the utterance, not a guaranteed keyboard setting. English service names and the loanword tip may occur in vi; mixed means a longer English-Vietnamese switch. English check reasons are intentional even in Vietnamese cases.
- `services` and `turns` preserve spoken order. Seed prices are all null. `priceCents: null` means no reliable per-service amount: downstream may use a user's configured usual price, but no usual price is invented by this corpus. All accepted prices and tips are nonnegative integer cents. Tip defaults to cash; unspecified request defaults false.
- `check` is an exact array of proposed reason strings, not existing UI translation keys. `Turn N:` uses one-based draft indices; count mismatches and no-draft errors are global. The optional `note` explains evidence or an unresolved span, not another expected field. Warnings must remain visible until reviewed; test consumers should not silently treat an unresolved case as a complete financial entry.
- Unknown or absent service: keep a draft with `services: []`, known tips and a warning. Never choose a preset by price. This is a proposed schema-compatible representation: the spec's instruction to use a usual price when no service was heard cannot identify which service. Product owner must confirm the draft shape; the future reader should retain the original text and unresolved amount.
- Shared total for several services: keep the identified services with null prices and preserve the total in `check`. The spec suggests splitting by usual prices, but supplies no fixture prices, rounding rule, or behaviour when defaults are null. These cases deliberately require review rather than invent an allocation. A later allocation fixture must define weights and a deterministic remainder rule in cents.
- Ambiguous numbers, unsupported currency, negative prices, percentages and extra decimal precision remain unresolved. Known unaffected fields survive. No silently rounded amounts. Explicit zero prices survive. No-service/no-tip filler produces no draft. `No tip` is not a missing tip amount.
- Immediate corrections replace the nearest compatible value, service or channel and get a warning. Contradictory unscoped request flags or an unsupported back-reference do not silently rewrite an earlier turn. Explicit `first customer` corrections in this corpus preserve the earlier value for review and state the proposed correction in the warning.
- Sentences normally split turns; tip-only and request-only fragments attach to the previous draft. Decimal dots do not split. `and`/và/với joins services; explicit same-customer language overrides rồi/then. Missing punctuation with no connector is a proposed split with a warning. A declared count checks results, not a license to fabricate customers.
- Mishearing examples in the JSON use only a small proposed alias subset, always warned. They are adversarial synthetic input, not device captures. A valid but wrong dictated number cannot be detected without the audio or technician's review.
- Dates, customer names and cash/card service payments are outside this JSON's output fields. Do not convert their numbers into prices/tips. A turn may carry an optional `startTime` ("HH:MM", 24 hours) when a time was said and the reader reads it; the table compares it when present (en-117, vi-116, mixed-057).

## Technician review questions

1. Dictate five actual days into both phone keyboards (English selected, Vietnamese selected, online/offline). Keep raw text, intended services/prices/tips, device/OS/keyboard versions and language. Use invented client names. Which aliases and error guesses actually occur?
2. Do tay/chân always mean basic services locally? Does sơn gel alone mean hands? Do full set, fill, bột, Shellac or SNS identify a service in your salon? Which words distinguish polish-only, hard gel and Gel-X?
3. In US dollars, what do ba rưỡi, ba chục rưỡi, bốn lăm rưỡi, một trăm rưỡi and bốn lăm năm mean to you? How do you say $45.05 and $45.50? Do xu, cent, cắc or hào appear? Do not add cắc/hào conversion without this answer.
4. Does khách quen truly mean a request on this visit? How do you distinguish an appointment from a request, and service payment by card from the tip being on card?
5. Do rồi/tiếp separate clients or steps in one client's work? How do you correct an earlier customer's price, split a combined total, and say two customers had the same service? Confirm the corpus' conservative warnings before making it a release gate.
