// What the phone's keyboard may write instead of a word the reader knows, from
// docs/voice/mishearings.json: the forms and their keys only, for both keyboard
// languages whatever language the app is in. Only "joe x" was seen on a real
// phone; the rest are guesses, so the reader marks every hit `Check this`, and
// takes a form only where its guard holds (see the table notes in voiceReader.ts).
// A key is a service preset id, or tip, cash or card. Request, walk-in and
// next are left out: their forms are too easily ordinary words. "mong tai" is left
// out too: it sounds as much like Tháo móng (removal) as like Làm móng tay.
// Plain data, written without accents and in lower case.

export const MISHEARD_FORMS: Readonly<Record<string, readonly string[]>> = {
  manicure: [
    'man a cure', 'many cure', 'money cure', 'mani cure', 'manny cure', 'mini cure', 'many care', 'manic cure',
    'ma ni cu', 'ma ni kiu', 'ma ni ki u', 'ma ni cua', 'ma ni ke', 'ma ni', 'lam mon tay',
  ],
  pedicure: [
    'petty cure', 'peddy cure', 'pedi cure', 'penny cure', 'petty care', 'pedi care', 'peddie cure', 'pet a cure',
    'pe di cu', 'pe di kiu', 'pe di ki u', 'pe di cua', 'pe di ke', 'pe di', 'mong chanh', 'lam mon chan',
  ],
  'gel-manicure': [
    'jail manicure', 'gel many cure', 'jell manicure', 'jell mani', 'jail mani', 'gel money cure', 'joe mani',
    'gel man a cure', 'jello mani', 'son deo tay', 'son gieo tay', 'son giao tay', 'son geo tay', 'gieo tay',
    'deo tay', 'geo ma ni', 'gieo ma ni cu', 'deo ma ni cu',
  ],
  'gel-pedicure': [
    'jail pedicure', 'gel petty cure', 'jell pedicure', 'jell pedi', 'jail pedi', 'gel penny cure', 'joe pedi',
    'gel peddy cure', 'jello pedi', 'son deo chan', 'son gieo chan', 'son giao chan', 'son geo chan', 'gieo chan',
    'deo chan', 'geo pe di', 'gieo pe di cu', 'deo pe di cu',
  ],
  'gel-x': [
    'joe x', 'jello x', 'joel x', 'gel ex', 'jello ex', 'gel eggs', 'jox', 'gelx', 'gel x', 'joex', 'joe ex',
    'joel ex', 'jail x', 'gio ich', 'jeo ich', 'gieo ich', 'gel ich', 'gel et', 'deo ich', 'geo ich', 'gioich',
    'jeoich', 'gieoich', 'gieo x', 'deo x',
  ],
  'acrylic-full-set': [
    'a critic full set', 'acrylic fool set', 'acrylic full said', 'acrylic full sat', 'a cry lick full set',
    'a krill lick full set', 'acrylic fullset', 'acrylic full set', 'acrylic full sets', 'fool set', 'full said',
    'ac ri lich full set', 'ac ri lic full set', 'ac ri lich phun set', 'a cri lic phun set', 'ac ri lich',
    'full set bot', 'phun set bot', 'phu set bot', 'phun sec bot', 'dap boc',
  ],
  'acrylic-fill': [
    'acrylic feel', 'acrylic field', 'a critic fill', 'a cry lick fill', 'a krill lick fill', 'acrylic refill in',
    'acrylic re feel', 'ac ri lich fill', 'ac ri lich phi', 'ac ri lic phiu', 'phi bot', 'phiu bot', 'ri phi bot',
    'dam bo', 'dam boc', 'zam bot', 'giam bot',
  ],
  'dip-powder': [
    'deep powder', 'dip power', 'deep power', 'dipping power', 'dip powdered', 'deep powdered', 's and s', 's n s',
    'sn s', 'dip pao do', 'dip pau do', 'dip bao do', 'dip pao der', 'dip bo', 'dip bot', 'bot nhun', 'ep en et',
    'et en et',
  ],
  'nail-art': [
    'nail heart', 'male art', 'nail hard', 'nail arts', 'nailart', 'nail art', 'nail are', 'mail art', 'knee art',
    'neo at', 'neo a', 'neo art', 'neu at', 'nai at', 'di dai', 'di zain', 've mon', 've man',
  ],
  removal: [
    'soak of', 'remove all', 're move all', 'soakoff', 'soak off', 'sock off', 'take of nails', 'take of',
    'ri mu vo', 'ri mu vol', 'ri mu', 'soc op', 'soc of', 'sok op', 'thao mon', 'thao boc',
  ],
  tip: [
    'tips', 'tapes', 'ship', 'bow', 'tip', 'tien tiep', 'boa',
  ],
  cash: [
    'catch', 'cache', 'cashed', 'cash', 'ket', 'cat', 'tien mac', 'tien mat',
  ],
  card: [
    'cart', 'car', 'cod', 'the', 'cac', 'cot', 'ca',
  ],
}
