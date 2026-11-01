/**
 * tamilUnicodeCleaner.ts
 *
 * Authoritative Tamil Unicode Normalizer and Cleaner.
 * 
 * Standards & Fixes:
 * 1. Unicode NFC Normalization:
 *    Ensures standard Unicode NFC representation for all Tamil and Latin characters.
 * 2. Invisible / Corrupt Character Stripping:
 *    Removes byte order marks (\uFEFF), replacement characters (\uFFFD),
 *    and unneeded zero-width characters (\u200B).
 * 3. Split Vowel Canonicalization:
 *    Normalizes two-part dependent vowel signs to single Unicode points:
 *    - ெ (U+0BC6) + ா (U+0BBE) -> ொ (U+0BCA)
 *    - ே (U+0BC7) + ா (U+0BBE) -> ோ (U+0BCB)
 *    - ெ (U+0BC6) + ௗ (U+0BD7) -> ௌ (U+0BCC)
 * 4. Deduplicate multiple consecutive pullis:
 *    - \u0BCD{2,} -> \u0BCD
 * 5. Remove accidental pulli directly following a dependent vowel sign:
 *    - e.g. ா + ் -> ா (dependent vowel signs cannot take pulli)
 * 6. Remove spurious spaces between base consonants and dependent vowel signs or pulli:
 *    - e.g. க + space + ா -> கா (dependent vowel signs can never start a word)
 *    - e.g. க + space + ் -> க் (pulli can never start a word)
 * 7. PRESERVES legitimate word boundaries:
 *    - Strictly preserves spaces between distinct words (e.g. "சமச்சீர் கல்வி", "ஆகியோர் கலைகளை", "நானிலம் படைத்தவன்" are preserved intact!).
 * 8. Preserves numbers, Latin terms, punctuation, and markdown formatting.
 */

export function cleanTamilUnicodeText(raw: string): string {
  if (!raw) return '';
  let text = String(raw).normalize('NFC');

  // 1. Remove invisible junk characters (BOM, replacement characters, zero-width spaces)
  text = text.replace(/[\uFEFF\uFFFD\u200B]/g, '');

  // 2. Canonicalize split vowels (kombu + kal -> o, kombu + kal + pulli, etc.)
  text = text.replace(/\u0BC6\s*\u0BBE/g, '\u0BCA'); // ெ + ா -> ொ
  text = text.replace(/\u0BC7\s*\u0BBE/g, '\u0BCB'); // ே + ா -> ோ
  text = text.replace(/\u0BC6\s*\u0BD7/g, '\u0BCC'); // ெ + ௗ -> ௌ

  // 3. Normalize multiple consecutive pullis to single pulli
  text = text.replace(/\u0BCD{2,}/g, '\u0BCD');

  // 4. Remove pulli immediately following a dependent vowel sign (e.g. ா + ் -> ா)
  // Dependent vowel signs: U+0BBE to U+0BCC, and U+0BD7 (excluding U+0BCD pulli)
  text = text.replace(/([\u0BBE-\u0BCC\u0BD7])\u0BCD+/g, '$1');

  // 5. Remove spurious spaces immediately before dependent vowel signs and pulli
  // (A dependent vowel sign or pulli can never start a word, so space before it is always an artifact)
  for (let i = 0; i < 2; i++) {
    text = text.replace(/([க-ஹ])\s+([\u0BBE-\u0BCD\u0BD7])/g, '$1$2');
  }

  // 6. Normalize multiple horizontal spaces while preserving line breaks
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Dedicated InDesign PDF CMap & Syllable repair for raw Tamil textbook extraction.
 * Only applied during PDF parsing, never on generated notes or user input.
 */
export function repairInDesignPdfArtifacts(raw: string): string {
  if (!raw) return '';
  let text = cleanTamilUnicodeText(raw);

  // tntextbooks.in InDesign 8-bit font glyph corruptions
  return text
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
    .replace(/இன்பத்தமிழ்நமது/g, 'இன்பத்தமிழ் நமது')
    .replace(/ப\s*ா\s*ர\s*தி\s*த\s*ா\s*ச\s*ன்/g, 'பாரதிதாசன்')
    .replace(/பார\s*திதா\s*சன்/g, 'பாரதிதாசன்')
    .replace(/பாரதிதாசன்தமிழைப்பலவாறா\s*்க\s*ப்?\s*போற்றுகி\s*்றார்/g, 'பாரதிதாசன் தமிழைப் பலவாறாகப் போற்றுகிறார்')
    .replace(/பாரதிதாசன்தமிழைப்/g, 'பாரதிதாசன் தமிழைப் ')
    .replace(/போற்றுகி\s*்றார்/g, 'போற்றுகிறார்')
    .replace(/பலவாறா\s*்க\s*ப்/g, 'பலவாறாகப்')
    .replace(/குைந்ழதழயச்\s*்?\s*ச\s*ல்லமா\s*்க\s*க்\s*்கா\s*ஞ்சுவதும்/g, 'குழந்தையைச் செல்லமாகக் கொஞ்சுவதும்')
    .replace(/குைந்ழதழய/g, 'குழந்தையை')
    .replace(/ச\s*ல்லமா\s*்க/g, 'செல்லமாக')
    .replace(/க்\s*்கா\s*ஞ்சுவதும்/g, 'கொஞ்சுவதும்')
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
    .replace(/ெளர்த\s*மிழ்/g, 'வளர்தமிழ்')
    .replace(/வளர்த\s*மிழ்/g, 'வளர்தமிழ்')
    .replace(/உதைபதட\s*உலகம்/g, 'உரைநடை உலகம்')
    .replace(/உதைபதட/g, 'உரைநடை')
    .replace(/தமாழி/g, 'மொழி')
    .replace(/இைழம/g, 'இளமை')
    .replace(/வைழம/g, 'வளமை')
    .replace(/சீர்ழம/g, 'சீர்மை')
    .replace(/சொதரிந்து\s*சொதளிநோெோம்/g, 'தெரிந்து தெளிவோம்')
    .replace(/நோமற்நோகோள்/g, 'மேற்கோள்')
    .replace(/ெளர்சொ?மோழி/g, 'வளர்மொழி')
    .replace(/ெளதம\s*சொ?மோழி/g, 'வளமைமொழி')
    .replace(/எளிய\s*சொ?மோழி/g, 'எளியமொழி')
    .replace(/சீர்தம\s*சொ?மோழி/g, 'சீர்மைமொழி')
    .replace(/புதுதம\s*சொ?மோழி/g, 'புதுமைமொழி')
    .replace(/அறிவியல்சொ?தோழில்நுட்்ப\s*சொ?மோழி/g, 'அறிவியல் தொழில்நுட்ப மொழி')
    .replace(/தோெை\s*இதலப்சொ?்பயர்கள்/g, 'தாவர இலைப்பெயர்கள்')
    .replace(/தமிழ்\s*எண்்கழை\s*அறிவோம்/g, 'தமிழ் எண்களை அறிவோம்')
    .replace(/ஒளி\s*பி்றந்த\s*து/g, 'ஒளி பிறந்தது')
    .replace(/பி்றந்த\s*து/g, 'பிறந்தது')
    .replace(/அப்துல்\s*்கலாம்/g, 'அப்துல் கலாம்')
    .replace(/லிலியன்வாட்சன்/g, 'லிலியன் வாட்சன்')
    .replace(/கார்பன்\s*இழை/g, 'கார்பன் இழை')
    .replace(/செயற்கைக்\s*கால்கள்/g, 'செயற்கைக் கால்கள்');
}

/**
 * Strips PDF page references, internal IDs, and technical audit tags from notes markdown.
 */
export function stripPageNumbersAndInternalMetadata(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\s*\[\s*(?:பக்கம்|பக்கங்கள்|பக்|Page|Pages)[\s:]*[\d\s,–-]+\]/gi, '')
    .replace(/\s*\(\s*(?:பக்கம்|பக்கங்கள்|பக்|Page|Pages)[\s:]*[\d\s,–-]+\)/gi, '')
    .replace(/\s*\[\s*(?:ID|CHUNK|EXTRACT|TOPIC_ID)[\s:]*[^\]]+\]/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}
