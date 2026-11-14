/**
 * tamilUnicode.ts
 *
 * Backend Tamil Unicode NFC normalization and input sanitization helper.
 * Ensures all incoming API payloads, database writes, and JSON responses
 * preserve exact Tamil Unicode characters without NFD splitting,
 * invisible junk characters, or broken dependent vowel signs.
 */

export function normalizeTamilUnicode(raw: string): string {
  if (!raw) return raw;
  let text = String(raw).normalize('NFC');

  // Strip invisible junk characters (BOM, replacement char, zero-width space)
  text = text.replace(/[\uFEFF\uFFFD\u200B]/g, '');

  // Canonicalize split two-part Tamil dependent vowel signs
  text = text.replace(/\u0BC6\s*\u0BBE/g, '\u0BCA'); // ெ + ா -> ொ
  text = text.replace(/\u0BC7\s*\u0BBE/g, '\u0BCB'); // ே + ா -> ோ
  text = text.replace(/\u0BC6\s*\u0BD7/g, '\u0BCC'); // ெ + ௗ -> ௌ

  // Deduplicate accidental multiple consecutive pullis
  text = text.replace(/\u0BCD{2,}/g, '\u0BCD');

  // Remove accidental pulli directly following a dependent vowel sign
  text = text.replace(/([\u0BBE-\u0BCC\u0BD7])\u0BCD+/g, '$1');

  // Remove spurious spaces between a Tamil consonant and its dependent vowel sign/pulli
  for (let i = 0; i < 2; i++) {
    text = text.replace(/([\u0B95-\u0BB9])\s+([\u0BBE-\u0BCD\u0BD7])/g, '$1$2');
  }

  return text;
}

/**
 * Recursively normalizes string values in objects/arrays (e.g. req.body, req.query)
 * to Unicode NFC without altering numbers, booleans, nulls, or object structure.
 */
export function normalizePayloadUnicode<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeTamilUnicode(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizePayloadUnicode(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = normalizePayloadUnicode(v);
    }
    return out as T;
  }
  return value;
}
