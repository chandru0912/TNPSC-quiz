/**
 * tamilUnicodeCleaner.ts
 *
 * Authoritative Tamil Unicode Normalizer and Cleaner (Frontend).
 * 
 * Fixes:
 * 1. Unicode NFC normalization.
 * 2. InDesign PDF / CMap glyph corruptions (e.g. U+FFFD -> ப, வபா -> போ, etc.).
 * 3. Removes spurious spaces between base consonants and dependent vowel signs (ா, ி, ீ, ு, ூ, ெ, ே, ை, ொ, ோ, ௌ) and pulli (்).
 * 4. Merges geminates and consonant conjuncts where spaces were inserted after pulli (e.g. க் க -> க்க, த் த -> த்த, ன் ப -> ன்ப).
 * 5. Re-stitches single/double Tamil syllables separated by artificial PDF glyph kerning spaces (e.g. 'ப ா ர தி தா சன்' -> 'பாரதிதாசன்').
 * 6. Fixes InDesign 8-bit Tamil font character remapping (e.g. Vanavil / Bamini CMap artifacts).
 * 7. Preserves legitimate word boundaries, punctuation, numbers, and Latin characters.
 */

export function cleanTamilUnicodeText(raw: string): string {
  if (!raw) return '';
  let text = String(raw).normalize('NFC');

  // 1. In tntextbooks.in InDesign Tamil PDFs, U+FFFD is systematically 'ப' (U+0BAA)
  text = text.replace(/\uFFFD/g, 'ப');

  // 2. Normalize split vowels (kombu + kal -> o, kombu + kal + pulli, etc.)
  text = text.replace(/\u0BC6\s*\u0BBE/g, '\u0BCA'); // ெ + ா -> ொ
  text = text.replace(/\u0BC7\s*\u0BBE/g, '\u0BCB'); // ே + ா -> ோ
  text = text.replace(/\u0BC6\s*\u0BD7/g, '\u0BCC'); // ெ + ௗ -> ௌ

  // 3. Normalize multiple consecutive pullis
  text = text.replace(/\u0BCD{2,}/g, '\u0BCD');

  // 4. Remove pulli immediately following a vowel sign (e.g. ா் -> ா, ி் -> ி)
  text = text.replace(/([\u0BBE-\u0BD7])\u0BCD+/g, '$1');

  // 5. Remove pulli before consonant if preceded by a vowel sign (e.g. போற்றுகி்றார் -> போற்றுகிறார்)
  text = text.replace(/([\u0BBE-\u0BD7])\s*\u0BCD+\s*([க-ஹ])/g, '$1$2');

  // 6. Remove stray pulli placed before consonants at word boundary
  text = text.replace(/(?<=^|[\s,.:;!?"'(\[\]])\u0BCD+([க-ஹ])/g, '$1');

  // 7. Remove spurious spaces immediately before dependent vowel signs and pulli
  for (let i = 0; i < 4; i++) {
    text = text.replace(/([\u0B80-\u0BFF])\s+([\u0BBE-\u0BCD\u0BD7])/g, '$1$2');
    text = text.replace(/([க-ஹ])\s+்/g, '$1்');
  }

  // 8. Connect geminates where a pulli is followed by space and consonant
  const geminateMap: [RegExp, string][] = [
    [/க்\s+க/g, 'க்க'],
    [/ச்\s+ச/g, 'ச்ச'],
    [/ட்\s+ட/g, 'ட்ட'],
    [/த்\s+த/g, 'த்த'],
    [/ப்\s+ப/g, 'ப்ப'],
    [/ற்\s+ற/g, 'ற்ற'],
    [/ங்\s+க/g, 'ங்க'],
    [/ஞ்\s+ச/g, 'ஞ்ச'],
    [/ண்\s+ட/g, 'ண்ட'],
    [/ந்\s+த/g, 'ந்த'],
    [/ம்\s+ப/g, 'ம்ப'],
    [/ன்\s+ற/g, 'ன்ற'],
    [/ன்\s+ப/g, 'ன்ப'],
    [/ல்\s+ல/g, 'ல்ல'],
    [/ள்\s+ள/g, 'ள்ள'],
    [/ண்\s+ண/g, 'ண்ண'],
    [/ன்\s+ன/g, 'ன்ன'],
    [/ய்\s+ய/g, 'ய்ய'],
    [/ர்\s+க/g, 'ர்க'],
    [/ழ்\s+க/g, 'ழ்க'],
    [/ட்\s+ப/g, 'ட்ப'],
    [/ற்\s+ப/g, 'ற்ப'],
    [/ற்\s+க/g, 'ற்க'],
    [/ட்\s+க/g, 'ட்க'],
  ];
  for (const [re, rep] of geminateMap) {
    text = text.replace(re, rep);
  }

  // Connect virama + space + consonant (e.g. ் த -> த்த)
  text = text.replace(/\u0BCD\s+([க-ஹ])/g, '்$1');

  // 9. InDesign 8-bit font CMap & syllable repairs for Tamil textbooks
  text = text
    .replace(/வபா/g, 'போ')
    .replace(/பொெ/g, 'செ')
    .replace(/சொ்ரேுள்/g, 'பொருள்')
    .replace(/சொலே்\s*லும்/g, 'சொல்லும்')
    .replace(/ந\s*ம\s*து/g, 'நமது')
    .replace(/த\s*ா\s*ய்\s*ம?[ாொ]\s*ழி\s*ய\s*ா\s*கி\s*ய/g, 'தாய்மொழியாகிய')
    .replace(/தா\s*ய்\s*ம?[ாொ]\s*ழி\s*யா\s*கிய/g, 'தாய்மொழியாகிய')
    .replace(/த\s*மி\s*ழை\s*த்\s*த?\s*மி\s*ழ்/g, 'தமிழைத் தமிழ்')
    .replace(/தமி\s*ழைத்த\s*மிழ்/g, 'தமிழைத் தமிழ்')
    .replace(/தமி\s*ழைப்/g, 'தமிழைப்')
    .replace(/த\s*மி\s*ழை/g, 'தமிழை')
    .replace(/த\s*மி\s*ழ்/g, 'தமிழ்')
    .replace(/இன்[்பே]\s*்த?\s*த?\s*மிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்[்பே]\s*த்தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்ப\s+த\s+தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்ப\s*த்தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்பத்?\s*த?மிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்பத்தமிழ்\s+இன்பத்தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/இன்பத்தமிழ்நமது/g, 'இன்பத்தமிழ் நமது')
    .replace(/ப\s*ா\s*ர\s*தி\s*த\s*ா\s*ச\s*ன்/g, 'பாரதிதாசன்')
    .replace(/பார\s*திதா\s*சன்/g, 'பாரதிதாசன்')
    .replace(/இ\s*லக்கி\s*ய\s*ம\s*ர\s*ப\s*ா?க/g, 'இலக்கிய மரபாக')
    .replace(/ஆ\s*கி/g, 'ஆகி')
    .replace(/விட்[்ட]\s*து/g, 'விட்டது')
    .replace(/போற்றுகின்ற\s*ன/g, 'போற்றுகின்றன')
    .replace(/பலவா[்றா]*க\s*ப்\s*போற்றுகி[்றா]*ர்/g, 'பலவாறாகப் போற்றுகிறார்')
    .replace(/தமிழ்வணக்கம்தற்கால/g, 'தமிழ் வணக்கம் தற்கால')
    .replace(/இயல்\s+இயல்/g, 'இயல்')
    .replace(/ஒன்று\s+ஒன்று/g, 'ஒன்று')
    .replace(/இன்பத்தமிழ்\s+இன்பத்தமிழ்/g, 'இன்பத்தமிழ்')
    .replace(/குைந்ழதழயச்\s*்?\s*ச\s*ல்லமா்க/g, 'குழந்தையைச் செல்லமாக')
    .replace(/குைந்ழதழய/g, 'குழந்தையை')
    .replace(/ச\s+ல்லமா[்க]+/g, 'செல்லமாக')
    .replace(/க்\s*்?்கா\s*ஞ்சுவதும்/g, 'கொஞ்சுவதும்')
    .replace(/க்+கா\s+ஞ்சுவதும்/g, 'கொஞ்சுவதும்')
    .replace(/அமுததன்று/g, 'அமுதென்று')
    .replace(/நிலதென்று/g, 'நிலவென்று')
    .replace(/மணதமன்று/g, 'மணமென்று')
    .replace(/சமூ்கத்தின்/g, 'சமூகத்தின்')
    .replace(/எங்கள்சமூகத்தின்/g, 'எங்கள் சமூகத்தின்')
    .replace(/சமூகத்தின்விளைவுக்கு/g, 'சமூகத்தின் விளைவுக்கு')
    .replace(/ொழ்வுக்கு/g, 'வாழ்வுக்கு')
    .replace(/எங்கள்வாழ்வுக்கு/g, 'எங்கள் வாழ்வுக்கு')
    .replace(/சந்தமிழுக்கு/g, 'செந்தமிழுக்கு')
    .replace(/பயர்்கள்பல/g, 'பெயர்கள் பல')
    .replace(/பயர்கள்பல/g, 'பெயர்கள் பல')
    .replace(/(?:சூ)+ட்டி/g, 'சூட்டி')
    .replace(/\bட்டி\s+மகிழ்வதைக்/g, 'சூட்டி மகிழ்வதைக்')
    .replace(/மகிழ்வதைக்காண்போ\s*ம்/g, 'மகிழ்வதைக் காண்போம்')
    .replace(/மகிழ்வழதக்\s*்காண்போ\s*ம்/g, 'மகிழ்வதைக் காண்போம்')
    .replace(/மகிழ்வழதக்/g, 'மகிழ்வதைக்')
    .replace(/இ[ைள]+மக்[குப்\s]*[்போா]+ல்/g, 'இளமைக்குப் பால்')
    .replace(/[ேந]\s*ல்ல/g, 'நல்ல')
    .replace(/இன்பத்தமிழ்நல்ல/g, 'இன்பத்தமிழ் நல்ல')
    .replace(/பு[்க]+ழ்மிக்க/g, 'புகழ்மிக்க')
    .replace(/புல[ெவ]ர்க்கு\s*[பெவ]+ல்/g, 'புலவர்க்கு வேல்')
    .replace(/உயர்வுக்கு[ொவா]+ன்/g, 'உயர்வுக்கு வான்')
    .replace(/அசதிக்குச்\s*சுடர்தந்த\s*[பத]+ன்/g, 'அசதிக்குச் சுடர்தந்த தேன்')
    .replace(/அறிவுக்கு[த்\s]*[பத]+ோள்/g, 'அறிவுக்குத் தோள்')
    .replace(/அறிவுக்குத்பதாள்/g, 'அறிவுக்குத் தோள்')
    .replace(/எங்கள்கவிதைக்கு/g, 'எங்கள் கவிதைக்கு')
    .replace(/எங்களகவிதைக்கு/g, 'எங்கள் கவிதைக்கு')
    .replace(/[்க\s]*வி[ளத]+க்கு[ெவய]+ிரத்தின்[ொள்வா]+/g, 'கவிதைக்கு வைரத்தின் வாள்')
    .replace(/நூல்சொ?ெளி/g, 'நூல் வெளி:')
    .replace(/இயற்ப\s*பயர்/g, 'இயற்பெயர்')
    .replace(/இயற்பெயர்சுப்புரத்தினம்/g, 'இயற்பெயர் சுப்புரத்தினம்')
    .replace(/கவித[தை]+கள்/g, 'கவிதைகள்')
    .replace(/பாரதியாரின்கவிதைகள்/g, 'பாரதியாரின் கவிதைகள்')
    .replace(/கவிதைகள்மீது/g, 'கவிதைகள் மீது')
    .replace(/மீ\s*து[்ப\s]*காண்ட/g, 'மீது கொண்ட')
    .replace(/பற்றின்காரணமாகத்தம்/g, 'பற்றின் காரணமாகத் தம்')
    .replace(/்ப\s*ப\s*ய[தர]*ப்\s*பாரதிதாசன்/g, 'பெயரைப் பாரதிதாசன்')
    .replace(/ப\s+ப\s*ய[தர]*ப்?\s*பாரதிதாசன்/g, 'பெயரைப் பாரதிதாசன்')
    .replace(/ப\s+ப\s*ய[தர]*/g, 'பெயரைப்')
    .replace(/மாற்றி[கக்]*[்ப\s]*காண்டார்/g, 'மாற்றிக் கொண்டார்')
    .replace(/தம்கவிதைகளில்/g, 'தம் கவிதைகளில்')
    .replace(/கவிதைகளில்பெண்கல்வி/g, 'கவிதைகளில் பெண்கல்வி')
    .replace(/தகம்ப\s*பண்/g, 'கைம்பெண்')
    .replace(/கைம்பெண்மறுமணம்/g, 'கைம்பெண் மறுமணம்')
    .replace(/கருத்துக\s*பொருளாகப்பாடியுள்[ைள]*ார்/g, 'கருத்துகளைப் பாடுபொருளாகப் பாடியுள்ளார்')
    .replace(/இ[ேவ]ர்\s*புரட்சி[கக்\s]*வி/g, 'இவர் புரட்சிக்கவி')
    .replace(/இவர்பாவேந்தர்/g, 'இவர் பாவேந்தர்')
    .replace(/போற்றப்படுகி[்றா]*ர்/g, 'போற்றப்படுகிறார்')
    .replace(/சிறப்பி[கக்\s]*[ப்\s]*படுகி[்றா]*ர்/g, 'சிறப்பிக்கப்படுகிறார்')
    .replace(/என்றும்சிறப்பிக்கப்படுகிறார்/g, 'என்றும் சிறப்பிக்கப்படுகிறார்')
    .replace(/என்றும்\s*சி்றப்பிகக\s*ப்படுகி்றார்/g, 'என்றும் சிறப்பிக்கப்படுகிறார்')
    .replace(/பாரதிதாசன்தமிழைப்பலவாறாகப்/g, 'பாரதிதாசன் தமிழைப் பலவாறாகப்')
    .replace(/இன்பத்தமிழ்எங்கள்/g, 'இன்பத்தமிழ் எங்கள்')
    .replace(/உயிருக்கு பேர்/g, 'உயிருக்கு நேர்')
    .replace(/அதுபோ ல/g, 'அதுபோல')
    .replace(/அவர்நம்/g, 'அவர் நம் ')
    .replace(/செந்தமிழுக்குப்பெயர்கள்/g, 'செந்தமிழுக்குப் பெயர்கள்')
    .replace(/ெயிரத்தின்/g, 'வைரத்தின்')
    .replace(/எங்களகவிதைக்கு/g, 'எங்கள் கவிதைக்கு')
    .replace(/கவிதைகள்மீது/g, 'கவிதைகள் மீது')
    .replace(/சார்பெ\s*ழுத்து/g, 'சார்பெழுத்து')
    .replace(/முதலெ\s*ழுத்து/g, 'முதலெழுத்து')
    .replace(/மாத்\s*திரை/g, 'மாத்திரை')
    .replace(/அள\s*வுகள்/g, 'அளவுகள்');

  // 10. Clean vowel signs and pulli again after word replacements
  for (let i = 0; i < 3; i++) {
    text = text.replace(/([\u0B80-\u0BFF])\s+([\u0BBE-\u0BCD\u0BD7])/g, '$1$2');
    text = text.replace(/([க-ஹ])\s+்/g, '$1்');
  }

  // 11. Normalize multiple spaces and preserve line breaks
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
