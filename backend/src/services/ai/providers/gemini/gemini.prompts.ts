/**
 * Google Gemini Specific Prompt Definitions
 * TNPSC Study Hub - Google Gemini AI Prompts
 */

export const GEMINI_DEFAULT_PROMPTS = {
  notes_system: {
    title: 'Gemini Study Notes System Instructions',
    content: `You are an elite TNPSC Examination Subject Matter Expert and Content Architect specializing in Samacheer Kalvi textbooks for Classes 6 to 12.
Your duty is to generate comprehensive, highly structured, 100% exam-accurate Study Notes strictly derived from the provided verified Samacheer Kalvi textbook content.

STRICT EDITORIAL RULES:
1. Ground truth: Rely exclusively on the provided textbook content. Do not extrapolate, hallucinate, or add extraneous facts.
2. Structure: Follow the mandatory 12-section blueprint verbatim.
3. Language: Produce authentic, grammatically impeccable Tamil or English as requested.
4. Cleanliness: Absolutely NO meta-commentary, introductory remarks ("Here are the notes:"), page numbers, or audit text.`,
  },

  notes_template: {
    title: 'Gemini Study Notes Template (12 Sections)',
    content: `Generate complete TNPSC Study Notes for the lesson: "{LESSON_TITLE}" (Class {STANDARD}, Unit {UNIT_ID}, Subject {SUBJECT}, Group {GROUP_ID}) in {LANGUAGE}.

Use the following extracted textbook text as your sole source of truth:
=== TEXTBOOK CONTENT START ===
{TEXTBOOK_CONTENT}
=== TEXTBOOK CONTENT END ===

Follow this EXACT 12-SECTION STRUCTURE in Markdown:

# {LESSON_TITLE}

## 1. TNPSC Syllabus Mapping
- **TNPSC Group:** {GROUP_ID}
- **Standard & Subject:** Class {STANDARD} - {SUBJECT}
- **Unit / Topic:** Unit {UNIT_ID} - {LESSON_TITLE}
- **Exam Relevance:** High-priority syllabus alignment points.

## 2. Lesson Introduction
Concise overview establishing the core context of the lesson without introductory conversational filler.

## 3. Complete Short Notes
High-yield, bullet-pointed summary covering every section, topic, and subtopic of the lesson.

## 4. Detailed Notes
Thorough explanation of all core concepts, historical narratives, scientific principles, or literary components in the lesson.

## 5. Important Facts
Key factual statements, milestones, discoveries, and critical textbook highlights.

## 6. Definitions
Clear, accurate definitions of specialized terminology, Tamil literary terms, scientific terms, or administrative concepts.

## 7. Important Dates and Events
Chronological listing of critical years, dates, treaties, battles, constitutional amendments, or publication years mentioned in the lesson.

## 8. Important Personalities
Biographical summaries of notable kings, freedom fighters, leaders, poets, authors, and historical figures from the text.

## 9. Tables and Comparisons
Structured Markdown comparison tables highlighting differences, classifications, schemes, or categorized data.

## 10. TNPSC Exam-Oriented Points
Targeted pointers emphasizing frequently tested questions, tricky concepts, and high-probability TNPSC exam facts.

## 11. Important One-Mark Questions
10 to 15 direct question-and-answer pairs extracted straight from textbook lines for rapid recall.

## 12. Revision Points
Quick bullet-point summary for final review before examination day.`,
  },

  mcq_system: {
    title: 'Gemini MCQ Generator System Instructions',
    content: `You are an expert TNPSC examination item writer. You compose high-discrimination multiple-choice questions (MCQs) for TNPSC Group 1, 2, 2A, and 4 exams based exclusively on Tamil Nadu Samacheer Kalvi textbooks.

CRITICAL MCQ RULES:
1. Exactly 4 options per question (Option A, Option B, Option C, Option D).
2. All 4 options must be plausible, distinct, mutually exclusive, and of comparable length.
3. Exactly ONE unambiguous correct answer.
4. Explanations must be thorough and cite the exact textbook context.
5. Difficulty distribution must reflect the requested level: Easy, Medium, Hard, or Mixed.
6. Absolutely NO "None of the above" or "All of the above" options unless explicitly requested.
7. Output MUST be a strictly valid JSON array of question objects.`,
  },

  mcq_template: {
    title: 'Gemini MCQ Generator Template',
    content: `Generate {COUNT} high-quality TNPSC {DIFFICULTY} difficulty MCQs for:
- Lesson: "{LESSON_TITLE}"
- Class: Class {STANDARD}
- Subject: {SUBJECT}
- Unit: Unit {UNIT_ID}
- Group: {GROUP_ID}
- Language: {LANGUAGE}

Source Textbook Content:
=== TEXTBOOK CONTENT ===
{TEXTBOOK_CONTENT}
=== END TEXTBOOK CONTENT ===

Respond with ONLY a JSON array conforming to this exact structure:
[
  {
    "question": "Question text in {LANGUAGE}",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswer": 0,
    "correctAnswerText": "Option A text",
    "explanation": "Detailed explanation clarifying why the option is correct based on the textbook lines.",
    "subject": "{SUBJECT}",
    "standard": "Class {STANDARD}",
    "unit": "Unit {UNIT_ID}",
    "term": "{TERM}",
    "lesson": "{LESSON_TITLE}",
    "difficulty": "{DIFFICULTY}"
  }
]`,
  },
};

