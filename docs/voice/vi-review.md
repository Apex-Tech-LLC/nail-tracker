# Vietnamese voice-screen copy review

Copy suggestions only; no screen or translation code changed. Reviewed the full Vietnamese Voice options block in `src/lib/i18n.ts` against its English copy and the Say and Check screens. Unlisted strings can stay. Use everyday salon words and short, friendly instructions; keep technical literals only where the imported ChatGPT format requires them.

| Key | Current text | Better text | Reason |
| --- | --- | --- | --- |
| sayYourTurns | Nói các turn | Nói turn trong ngày | Gives the title a natural purpose instead of a literal plural. |
| sayHint | Chạm nút micro trên bàn phím và nói từng việc: dịch vụ, giá, tip. | Bấm mic trên bàn phím điện thoại, nói từng khách: làm gì, giá, tip. | Names the phone keyboard and uses the client as the unit of work. |
| sayExample | Ví dụ: "Sơn gel tay bốn mươi lăm, tip mười đô. Làm móng chân ba mươi lăm." | Ví dụ: "Sơn gel tay bốn lăm, tip mười tiền mặt. Làm móng chân ba lăm." | Uses shorter spoken numbers and the reader’s existing Vietnamese two-client example. |
| sayTextLabel | Các việc đã làm | Các turn trong ngày | Uses the salon term already used throughout this flow. |
| sayNothing | Hãy nói hoặc gõ ít nhất một việc trước. | Nói hoặc gõ một turn trước nha. | Replaces the formal command with a brief, friendly next step. |
| checkTurns | Kiểm tra {n} turn | Xem lại {n} turn | Sounds like reviewing one’s work rather than an inspection. |
| checkOneTurn | Kiểm tra 1 turn | Xem lại 1 turn | Keeps the single-turn heading consistent with the plural. |
| checkNoTurns | Không tìm thấy turn nào trong lời bạn nói. Hãy quay lại và thử lại. | Chưa đọc được turn nào. Quay lại nói hoặc gõ lại nha. | Explains the result briefly and gives a concrete recovery. |
| cardCashTip | +{amount} tip tiền mặt | +{amount} tip cash | Uses familiar salon wording on a small card. |
| cardCardTip | +{amount} tip thẻ | +{amount} tip card | Keeps the cash and card labels in the same salon vocabulary. |
| notUnderstood | Không hiểu: "{text}" | Chưa hiểu: "{text}" | Makes an uncertain reading sound less final. |
| useChatGpt | Dùng ChatGPT thay thế | Dùng ChatGPT | Removes the stiff, unnecessary “replacement” wording from the button. |
| chatGptCopied | Đã sao chép hướng dẫn. Dán vào ChatGPT rồi quay lại với câu trả lời của nó. | Đã copy hướng dẫn. Dán vào ChatGPT, kể các turn, rồi copy câu trả lời về đây. | Uses familiar copy-and-paste language and explains the missing middle step. |
| chatGptCopyFailed | Điện thoại không tự sao chép được. Hãy sao chép hướng dẫn này bằng tay, rồi mở ChatGPT. | Chưa copy tự động được. Chọn rồi copy phần hướng dẫn bên dưới, sau đó mở ChatGPT. | “Bằng tay” can sound like retyping; selecting and copying is the actual fallback. |
| pasteAnswerHint | Dán cả câu trả lời. Ứng dụng tự tìm các turn trong đó và kiểm tra từng số. | Dán hết câu trả lời vào đây. App sẽ đọc các turn và kiểm tra từng số tiền. | Uses ordinary phone language and makes the number check concrete. |
| notUnderstoodWhy | Không hiểu: {why} | Chưa hiểu: {why} | Matches the softer label used for unrecognized spoken text. |
| answerEmpty | câu trả lời đang trống | chưa có câu trả lời | A missing answer sounds more natural than an answer “being empty.” |
| answerNoJson | không thấy khối JSON nào trong câu trả lời | câu trả lời thiếu phần JSON | Keeps the format name while removing the technical-sounding “block.” |
| answerBadJson | khối JSON bị lỗi | phần JSON trong câu trả lời bị lỗi | Identifies where the problem is in ordinary words. |
| answerNotObject | turn {turn} không đúng dạng | turn {turn} sai định dạng | Makes the format error clear instead of vaguely saying “wrong shape.” |
| answerUnknownService | turn {turn} có dịch vụ không có trong danh sách của bạn ({detail}) | dịch vụ ở turn {turn} chưa có trong danh sách ({detail}) | Avoids the repeated “có … không có” construction. |
| answerBadPrice | turn {turn} có giá không phải đô la và cent ({detail}) | giá ở turn {turn} chưa đúng dạng tiền đô, như 45 hay 45.50 ({detail}) | Explains the accepted number format instead of sounding like the currency is wrong. |
| answerBadTip | turn {turn} có tip không phải đô la và cent ({detail}) | tip ở turn {turn} chưa đúng dạng tiền đô, như 5 hay 5.50 ({detail}) | Gives concrete tip formats and stays consistent with the price message. |
| answerNegativeTip | turn {turn} có tip âm ({detail}) | tip ở turn {turn} nhỏ hơn 0 ({detail}) | Explains a negative value without relying on a math term. |
| answerBadRequest | turn {turn} phải ghi request là true hoặc false ({detail}) | turn {turn} ghi request chưa đúng: phải là true hoặc false ({detail}) | Identifies the bad field while preserving the required format literals. |
| youEarnFromThese | Bạn kiếm được từ các turn này | Tiền bạn được | Reads naturally as the label beside the take-home total. |
| fixOrRemoveFirst | Hãy sửa hoặc xóa các turn màu cam trước. | Sửa hoặc bỏ các turn màu cam trước nha. | Uses the card’s Bỏ action and a warmer instruction. |
| reasonNoPrice | Chưa nghe thấy giá, đã dùng giá quen thuộc {price} | Chưa có giá, tạm lấy giá thường tính là {price} | “Giá quen thuộc” is an unnatural way to describe the usual service price. |
| reasonNoPriceFor | Chưa nghe thấy giá của {service}, đã dùng giá quen thuộc {price} | {service} chưa có giá, tạm lấy giá thường tính là {price} | Names the service first and clearly marks the fallback price as provisional. |
| reasonNoPriceNone | Chưa nghe thấy giá của {service}: hãy nhập giá | Chưa có giá cho {service}: nhập giá nha | Avoids implying the app itself listens to audio and softens the instruction. |
| reasonNoService | Chưa nghe thấy dịch vụ: hãy chọn một dịch vụ | Chưa rõ làm gì: chọn dịch vụ nha | Replaces a stiff repeated noun with familiar work language. |
| reasonUnclearService | Không rõ "{heard}" là dịch vụ nào: hãy chọn dịch vụ | "{heard}" là dịch vụ nào? Chọn lại nha | Makes the uncertainty and next action easy to scan. |
| reasonShorthand | "{heard}" được hiểu là một dịch vụ: hãy xác nhận | App tạm hiểu "{heard}" là tên dịch vụ, xem lại nha | Makes a tentative interpretation clear without a formal confirmation demand. |
| reasonShorthandAs | "{heard}" được hiểu là {service}: hãy xác nhận | App tạm hiểu "{heard}" là {service}, xem đúng chưa nha | Invites a quick check of the specific service match. |
| reasonGuessed | "{heard}" có thể bị nghe nhầm: hãy xác nhận | Có thể nghe nhầm "{heard}", xem lại nha | Keeps the uncertainty while using a natural spoken instruction. |
| reasonGuessedAs | "{heard}" được hiểu là {service} | App đoán "{heard}" là {service}, xem đúng chưa nha | Makes the guessed match and need for review explicit. |
| reasonSharedTotal | Một giá cho nhiều dịch vụ: chia theo giá quen thuộc | Có một giá chung cho nhiều dịch vụ, app chia theo giá thường tính | Explains the shared total without the awkward “familiar prices” wording. |
| reasonBadAmount | Không đọc được "{heard}" thành số tiền: hãy nhập số tiền | Chưa rõ "{heard}" là bao nhiêu: nhập số tiền nha | Uses the way someone would ask about an unclear amount. |
| reasonHalfShorthand | Đã hiểu "{heard}" là số tiền một nửa: hãy xác nhận số tiền | App đã tính phần “rưỡi” trong "{heard}", xem lại số tiền nha | The reader adds 5 or 50 for this shorthand; it does not halve the amount. |
| reasonDecimalComma | Đã hiểu dấu phẩy trong "{heard}" là dấu thập phân: hãy xác nhận số tiền | App đọc dấu phẩy trong "{heard}" như dấu chấm ở số tiền đô, xem lại nha | Explains the comma conversion using the money format shown in the app. |
| reasonCurrencyAssumed | Đã hiểu "{heard}" là đô la Mỹ: hãy xác nhận số tiền | App tạm tính "{heard}" là tiền đô Mỹ, xem lại nha | Makes the assumed currency provisional and easy to understand. |
| reasonCountMismatch | Bạn nói {said} nhưng tìm thấy {found}. Có đúng không? | Bạn nói {said} khách, app đọc ra {found} turn. Xem đủ chưa nha. | Labels both counts so the mismatch is understandable. |
| reasonRepeatExpanded | Turn này được lặp lại cho cả {n} khách: hãy xác nhận | App tạo turn giống nhau cho {n} khách, xem lại từng turn nha | Describes the generated cards rather than an abstract repetition. |
| reasonInferredSplit | Không nghe thấy từ ngăn cách trước turn này: hãy xác nhận đây là khách mới | App tạm tách thành turn riêng. Đây là khách khác đúng không? | Asks the real question without talking about separator words. |
| reasonCorrection | Có một lời sửa: đã dùng những lời nói sau cùng | Có sửa lại, app lấy phần nói sau cùng. Xem lại nha. | Replaces a literal translation with a clear explanation of the correction. |
| reasonTipNoAmount | Có nhắc đến tip nhưng không có số tiền: hãy nhập tip | Có nói tip mà chưa có số tiền, nhập thêm nha | Sounds like a quick reminder rather than a formal error. |
| reasonPaymentNotTip | Cách khách trả tiền không phải là tip: không lấy tip từ đó | Mới có cách khách trả bill, app chưa tính đó là tip. | Distinguishes bill payment from gratuity; “lấy tip” can sound like withholding money. |
| reasonAppointment | Khách hẹn trước chưa chắc là khách gọi đích danh bạn | Có hẹn chưa chắc là request. Khách có gọi tên mình không? | Uses the salon term and asks about the actual request rule. |
| reasonRequestConflict | Có nói cả khách chọn bạn và khách không chọn thợ: hãy chọn một | Có nói cả request lẫn walk-in, chọn lại một loại nha | Keeps the spoken salon terms instead of two long descriptions. |
| reasonPriceChange | "{heard}" có vẻ là đổi giá: giá được giữ như đã nghe | "{heard}" có vẻ là sửa giá. App vẫn giữ giá đã đọc, xem lại nha. | Explains that the possible price change was not applied. |
| reasonTimeNotRead | Có nói giờ ("{heard}"): hãy đặt giờ cho turn này | Chưa đọc được giờ "{heard}", nhập giờ cho turn này nha | Explains why the time needs attention instead of merely noting that one was said. |
| reasonTimeGuessedHalf | Là buổi sáng hay buổi tối? | Giờ sáng hay tối vậy? | Uses a shorter, natural spoken question. |
| reasonBackReference | "{heard}" nhắc đến khách trước đó: hãy sửa tay | "{heard}" nhắc tới khách trước đó. Mở turn của khách đó để sửa nha. | Gives a concrete action; “sửa tay” is awkward and unclear. |
| cashTipReceivedLabel | Đã nhận tip tiền mặt | Tip cash đã cầm | Preserves both familiar cash wording and the English meaning of already having the money. |
| cardTipReceivedLabel | Đã nhận tip thẻ | Tip card đã cầm | Makes clear this is a card tip already received, rather than a tip still owed. |

The how-to uses the current button labels so a later screen build can match today’s UI. If these suggestions are applied too, update the how-to’s matching button references together.

The English examples in `how-to.json` copy phrase cases en-041, en-042 and en-046; the Vietnamese examples copy vi-041, vi-053 and vi-046. Each expects no warning. These are synthetic reader cases, not phone-dictation recordings. The six steps are kept short for a roughly 30-second first read; actual reading time and salon wording still need a technician’s check.

The privacy sentence names Nail Tracker deliberately: the app reads text on the phone and sends none itself. A keyboard’s own dictation service is outside that promise. “Request” means the client asked for this technician by name; the how-to avoids treating every regular client or appointment as a request.
