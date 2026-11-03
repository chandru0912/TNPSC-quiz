/**
 * Textbook Topic and Structural Concept Extraction Service
 * Strictly shared across Anthropic Claude AI and Google Gemini AI.
 * 
 * Analyzes verified extracted textbook content to extract:
 * 1. Primary lesson sections and headings
 * 2. Key concepts, definitions, and technical terms
 * 3. Tables and chronological events
 * 4. Structured coverage guidance for prompt generation
 */

export interface ExtractedTopicSummary {
  headings: string[];
  keyTerms: string[];
  hasChronology: boolean;
  hasComparisons: boolean;
  hasDefinitions: boolean;
  estimatedTopicCount: number;
  coverageGuidance: string;
}

export class TopicExtractionService {
  /**
   * Analyzes verified textbook text and extracts structural topics and subheadings.
   */
  public static extractTopics(content: string, lessonTitle: string): ExtractedTopicSummary {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const headings: string[] = [];
    const keyTerms: Set<string> = new Set();

    // Regex patterns for headings in Tamil & English textbooks:
    // e.g. "1.1 Introduction", "Unit 2: ...", "அறிமுகம்", "முக்கிய குறிப்புகள்"
    const headingPatterns = [
      /^(\d+(\.\d+)*)\s+([A-Za-z\u0B80-\u0BFF\s]{3,60})$/,
      /^[A-Z\u0B80-\u0BFF\s]{4,50}:$/,
      /^(அறிமுகம்|வரலாறு|முக்கியத்துவம்|பண்புகள்|வகைகள்|பயன்கள்|முடிவுரை)/,
      /^(Introduction|Background|Characteristics|Types|Classification|Functions|Summary)/i,
    ];

    let hasChronology = false;
    let hasComparisons = false;
    let hasDefinitions = false;

    // Detect chronological indicators (years, BC/AD, நூற்றாண்டு)
    if (/(?:\b\d{3,4}\s*(?:BC|AD|CE|BCE)\b|\b(?:1[0-9]|20)\d{2}\b|நூற்றாண்டு|ஆண்டு)/i.test(content)) {
      hasChronology = true;
    }

    // Detect comparisons (difference between, vs, வேறுபாடுகள், ஒப்பீடு)
    if (/(?:difference between|versus|\bvs\b|compare|வேறுபாடு|ஒப்பீடு)/i.test(content)) {
      hasComparisons = true;
    }

    // Detect definitions (is defined as, means, எனப்படும், குறிக்கிறது)
    if (/(?:is defined as|refers to|means|எனப்படும்|குறிப்பது|வரையறை)/i.test(content)) {
      hasDefinitions = true;
    }

    for (const line of lines) {
      if (line.length >= 4 && line.length <= 80) {
        for (const pat of headingPatterns) {
          if (pat.test(line)) {
            if (!headings.includes(line)) {
              headings.push(line);
            }
            break;
          }
        }
      }

      // Collect bold or highlighted keywords
      const termMatches = line.match(/\*\*([^*]+)\*\*|“([^”]+)”|"([^"]+)"/g);
      if (termMatches) {
        for (const m of termMatches) {
          const clean = m.replace(/[*“"”]/g, '').trim();
          if (clean.length > 2 && clean.length < 40) {
            keyTerms.add(clean);
          }
        }
      }
    }

    if (headings.length === 0) {
      headings.push(lessonTitle);
    }

    const estimatedTopicCount = Math.max(1, headings.length);
    const keyTermsArray = Array.from(keyTerms).slice(0, 15);

    const guidanceParts: string[] = [
      `Cover each of the identified lesson topics: ${headings.slice(0, 8).join(', ')}.`,
      `Distribute questions across all subtopics without skipping any section.`,
    ];

    if (hasDefinitions) {
      guidanceParts.push('Include definition-based questions testing exact terminology.');
    }
    if (hasChronology) {
      guidanceParts.push('Include chronological order / timeline questions testing key dates and sequence.');
    }
    if (hasComparisons) {
      guidanceParts.push('Include comparison-based questions contrasting related concepts.');
    }

    return {
      headings: headings.slice(0, 12),
      keyTerms: keyTermsArray,
      hasChronology,
      hasComparisons,
      hasDefinitions,
      estimatedTopicCount,
      coverageGuidance: guidanceParts.join(' '),
    };
  }
}

