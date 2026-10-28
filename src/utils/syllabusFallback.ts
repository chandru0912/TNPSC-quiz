/**
 * Client-Side Syllabus MCQ Generation & Fallback Engine
 * Ensures the Gemini AI Generator works seamlessly even on static hosts (like Vercel)
 * without requiring an active backend or database server.
 */

export interface GeneratedQuestionItem {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category?: string;
  subject?: string;
  classId?: number;
  unitId?: number;
  lessonTitle?: string;
  topic?: string;
  difficulty?: string;
  selected?: boolean;
}

export async function generateClientGeminiQuestions(
  apiKey: string,
  params: {
    category: string;
    subject: string;
    classId: number;
    unitId: number;
    unitTitle?: string;
    lessonTitle: string;
    topic: string;
    count: number;
    difficulty: string;
  }
): Promise<GeneratedQuestionItem[]> {
  const { category, subject, classId, unitId, unitTitle, lessonTitle, topic, count, difficulty } = params;

  const isTamil = subject.includes('Tamil') || subject.includes('தமிழ்');
  const isEnglish = subject.includes('English');
  const isAptitude = subject.includes('Aptitude') || subject.includes('Mental');

  let subjectDirective = 'Ensure strictly syllabus-relevant questions for TNPSC examination.';
  if (isTamil) {
    subjectDirective = 'The question text, options, and explanation MUST be written entirely in pure Tamil. Cover Samacheer Kalvi Tamil grammar, literature, or authors.';
  } else if (isEnglish) {
    subjectDirective = 'The question text, options, and explanation MUST be written in pure English. Cover grammar rules, vocabulary, literary works, or comprehension.';
  } else if (isAptitude) {
    subjectDirective = 'Provide authentic mathematical aptitude/reasoning questions with step-by-step numerical explanations.';
  }

  const prompt = `You are a Senior Question Paper Setter for the Tamil Nadu Public Service Commission (TNPSC).
Generate ${count} high-standard multiple choice questions (MCQs) for:
- Examination: ${category.toUpperCase()}
- Subject: ${subject}
- Standard / Class: ${classId}th Standard (Samacheer Kalvi)
- Unit: Unit ${unitId} ${unitTitle || ''}
- Lesson Title: "${lessonTitle}"
- Target Syllabus Topic: "${topic}"
- Target Difficulty: ${difficulty}

${subjectDirective}

Return strictly a valid JSON array of objects with no markdown code fences:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Detailed explanation with textbook context"
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content received from Gemini model');

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Unexpected format returned from Gemini');
  return parsed;
}

export function generateClientSyllabusFallback(params: {
  category: string;
  subject: string;
  classId: number;
  unitId: number;
  unitTitle?: string;
  lessonTitle: string;
  topic: string;
  count: number;
  difficulty: string;
}): GeneratedQuestionItem[] {
  const { category, subject, classId, unitId, unitTitle, lessonTitle, topic, count, difficulty } = params;

  const isTamil = subject.includes('Tamil') || subject.includes('தமிழ்');
  const isEnglish = subject.includes('English');
  const isAptitude = subject.includes('Aptitude') || subject.includes('Mental');

  const questions: GeneratedQuestionItem[] = [];

  for (let i = 1; i <= count; i++) {
    if (isTamil) {
      questions.push({
        question: `"${lessonTitle}" பாடப்பகுதியில் "${topic}" பற்றிய சரியான கூற்றைத் தேர்ந்தெடுக்க: [வினா ${i}]`,
        options: [
          `இப்பகுதி சமச்சீர் கல்வி தமிழ் பாடநூலில் (${classId}-ஆம் வகுப்பு) உள்ள அதிகாரப்பூர்வ விதிகளுக்கு உட்பட்டது`,
          'இக்கூற்று பொதுத்தமிழ் இலக்கிய வரலாற்று விதிகளுக்கு எதிரானது',
          'பொருத்தமற்ற இலக்கண விதியை மட்டும் குறிப்பது',
          'மேற்கண்ட எதுவும் இல்லை',
        ],
        correctAnswer: 0,
        explanation: `சமச்சீர் கல்வி ${classId}-ஆம் வகுப்பு பொதுத்தமிழ் பாடநூலில் "${lessonTitle}" பாடத்தில் "${topic}" பற்றிய விரிவான குறிப்புகள் மற்றும் வினாக்கள் கொடுக்கப்பட்டுள்ளன.`,
        category,
        subject,
        classId,
        unitId,
        lessonTitle,
        topic,
        difficulty,
        selected: true,
      });
    } else if (isEnglish) {
      questions.push({
        question: `In TNPSC General English for "${lessonTitle}", which of the following is correct regarding "${topic}"? [Question ${i}]`,
        options: [
          `It is systematically covered under the ${classId}th Standard syllabus guidelines for General English`,
          'It is an obsolete rule not recognized in standard English grammar',
          'It contradicts standard TNPSC General English syllabus norms',
          'None of the above',
        ],
        correctAnswer: 0,
        explanation: `As detailed in the ${classId}th Standard Samacheer Kalvi English textbook under the unit "${unitTitle || 'General English'}", "${topic}" is a primary syllabus component tested in TNPSC exams.`,
        category,
        subject,
        classId,
        unitId,
        lessonTitle,
        topic,
        difficulty,
        selected: true,
      });
    } else if (isAptitude) {
      questions.push({
        question: `In TNPSC Aptitude & Mental Ability under "${lessonTitle}", what is the key principle for solving problems on "${topic}"? [Question ${i}]`,
        options: [
          'Application of standard mathematical formulas, unitary methods, and step-by-step simplification',
          'Arbitrary estimation without dimensional consistency',
          'Ignoring decimal places and fractional proportions',
          'None of the above',
        ],
        correctAnswer: 0,
        explanation: `Under ${classId}th Standard mathematics curriculum, "${topic}" requires fundamental understanding of formulas, shortcut calculation techniques, and precision for TNPSC Preliminary examination.`,
        category,
        subject,
        classId,
        unitId,
        lessonTitle,
        topic,
        difficulty,
        selected: true,
      });
    } else {
      questions.push({
        question: `In the context of ${category.toUpperCase()} Unit ${unitId} (${subject}) under the lesson "${lessonTitle}", what is the primary significance of studying "${topic}"? [Question ${i}]`,
        options: [
          `It forms a core fundamental component of the ${classId}th Standard Samacheer Kalvi syllabus for TNPSC examination`,
          'It is an optional topic with no direct relevance to previous year questions',
          'It pertains exclusively to non-prescribed reference materials outside Tamil Nadu textbooks',
          'None of the above',
        ],
        correctAnswer: 0,
        explanation: `According to the official TNPSC ${category.toUpperCase()} syllabus and Samacheer Kalvi ${classId}th Standard curriculum, "${topic}" under "${lessonTitle}" provides essential conceptual foundations regularly tested in group examinations.`,
        category,
        subject,
        classId,
        unitId,
        lessonTitle,
        topic,
        difficulty,
        selected: true,
      });
    }
  }

  return questions;
}
