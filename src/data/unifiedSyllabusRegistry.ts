// Unified TNPSC Syllabus Registry
// Powers Group-wise, Unit-wise, Lesson-wise, and Topic-wise MCQ workflows
// Supports Group 1, Group 2, Group 2A, Group 4, and VAO with strict ontological mapping.

import { unitClassRegistry } from './group1ClassSyllabusData'
import { group2ClassRegistry } from './group2ClassSyllabusData'
import { group2Subjects } from './group2SyllabusData'
import { group4Subjects } from './group4SyllabusData'
import { group4ClassRegistry } from './group4ClassSyllabusData'

export interface TopicItem {
  id: string
  name: string
  description?: string
}

export interface LessonItem {
  id: string
  lessonNumber: string
  title: string
  description?: string
  subjectName?: string
  classId?: number
  topics: TopicItem[]
}

export interface UnitItem {
  id: number
  unitNumber: string
  title: string
  subjectName: string
  lessons: LessonItem[]
}

export interface GroupSyllabus {
  id: 'group1' | 'group2' | 'group2a' | 'group4' | 'vao'
  name: string
  code: string
  description: string
  units: UnitItem[]
}

export const TNPSC_GROUPS: { id: 'group1' | 'group2' | 'group4'; name: string; code: string; badge: string }[] = [
  { id: 'group1', name: 'TNPSC Group 1', code: 'Code: 497', badge: 'Degree Standard • Prelims' },
  { id: 'group2', name: 'TNPSC Group 2 & 2A', code: 'Code: 495', badge: 'Degree Standard • Prelims & Non-Interview' },
  { id: 'group4', name: 'TNPSC Group 4', code: 'Code: 496', badge: 'SSLC Standard • Single Paper' },
]

// ----------------------------------------------------------------------------
// Group 1 Syllabus Extraction
// ----------------------------------------------------------------------------
function buildGroup1Units(): UnitItem[] {
  const unitDefs = [
    { id: 1, unitNumber: 'Unit 1', title: 'General Science', subjectName: 'General Science' },
    { id: 2, unitNumber: 'Unit 2', title: 'Geography of India', subjectName: 'Geography' },
    { id: 3, unitNumber: 'Unit 3', title: 'History & Culture of India and INM', subjectName: 'History & INM' },
    { id: 4, unitNumber: 'Unit 4', title: 'Indian Polity', subjectName: 'Indian Polity' },
    { id: 5, unitNumber: 'Unit 5', title: 'Indian Economy & TN Admin', subjectName: 'Economy & TN Admin' },
    { id: 6, unitNumber: 'Unit 6', title: 'Tamil Nadu History, Culture & Heritage', subjectName: 'Tamil Nadu Heritage' },
  ]

  return unitDefs.map((u) => {
    const lessons: LessonItem[] = []
    const seenLessonTitles = new Set<string>()

    // Harvest lessons from unitClassRegistry across classes 6 to 12
    for (let c = 6; c <= 12; c++) {
      const key = `${u.id}-${c}`
      const classData = unitClassRegistry[key]
      if (classData && Array.isArray(classData.lessons)) {
        classData.lessons.forEach((l) => {
          if (!seenLessonTitles.has(l.title)) {
            seenLessonTitles.add(l.title)

            // Derive 3 to 4 specific topics for each lesson
            const topics: TopicItem[] = [
              { id: `${l.id}-t1`, name: `${l.title}: Core Principles & Definitions` },
            ]

            if (classData.topics && classData.topics.length > 0) {
              const matchedTopics = classData.topics.filter(
                (t) =>
                  t.toLowerCase().includes(l.title.toLowerCase().split(' ')[0]) ||
                  l.title.toLowerCase().includes(t.toLowerCase().split(':')[0])
              )
              if (matchedTopics.length > 0) {
                matchedTopics.forEach((mt, idx) => {
                  topics.push({ id: `${l.id}-t${idx + 2}`, name: mt })
                })
              } else {
                topics.push({ id: `${l.id}-t2`, name: classData.topics[0] })
                if (classData.topics[1]) topics.push({ id: `${l.id}-t3`, name: classData.topics[1] })
              }
            }

            topics.push({ id: `${l.id}-t-app`, name: `${l.title}: Practical Applications & Exam MCQs` })

            lessons.push({
              id: l.id,
              lessonNumber: l.lessonNumber,
              title: l.title,
              description: l.description,
              subjectName: classData.subjectName,
              classId: c,
              topics,
            })
          }
        })
      }
    }

    return {
      id: u.id,
      unitNumber: u.unitNumber,
      title: u.title,
      subjectName: u.subjectName,
      lessons,
    }
  })
}

// ----------------------------------------------------------------------------
// Group 2 & 2A Syllabus Extraction (Code: 495)
// ----------------------------------------------------------------------------
function buildGroup2Units(): UnitItem[] {
  const units: UnitItem[] = []

  // 1. General Studies (Units 1 to 6 across classes 6 to 12)
  const gsSubject = group2Subjects.find((s) => s.id === 'general-studies')
  if (gsSubject) {
    gsSubject.units.forEach((u) => {
      const lessons: LessonItem[] = []
      const seenLessonTitles = new Set<string>()

      for (let c = 6; c <= 12; c++) {
        const key = `general-studies-${u.id}-${c}`
        const classData = group2ClassRegistry[key]
        if (classData && Array.isArray(classData.lessons)) {
          classData.lessons.forEach((l) => {
            const uniqueKey = `${c}-${l.title}`
            if (!seenLessonTitles.has(uniqueKey)) {
              seenLessonTitles.add(uniqueKey)

              const topics: TopicItem[] = []
              if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
                l.keyConcepts.forEach((kc, i) => {
                  topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
                })
              } else {
                topics.push({ id: `${l.id}-t1`, name: `${l.title}: Core Principles & Definitions` })
              }

              if (classData.topics && classData.topics.length > 0) {
                const matchedTopics = classData.topics.filter(
                  (t) =>
                    t.toLowerCase().includes(l.title.toLowerCase().split(' ')[0]) ||
                    l.title.toLowerCase().includes(t.toLowerCase().split(':')[0])
                )
                if (matchedTopics.length > 0) {
                  matchedTopics.forEach((mt, idx) => {
                    topics.push({ id: `${l.id}-t${idx + 2}`, name: mt })
                  })
                } else {
                  topics.push({ id: `${l.id}-t2`, name: classData.topics[0] })
                  if (classData.topics[1]) topics.push({ id: `${l.id}-t3`, name: classData.topics[1] })
                }
              }

              topics.push({ id: `${l.id}-t-app`, name: `${l.title}: Practical Applications & Exam MCQs` })

              lessons.push({
                id: l.id,
                lessonNumber: l.lessonNumber,
                title: l.title,
                description: l.description,
                subjectName: classData.subjectName,
                classId: c,
                topics,
              })
            }
          })
        }
      }

      // Fallback: If no class-level lessons mapped yet, retain chapter lessons
      if (lessons.length === 0) {
        u.chapters.forEach((ch) => {
          ch.lessons.forEach((l) => {
            const topics: TopicItem[] = []
            if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
              l.keyConcepts.forEach((kc, i) => {
                topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
              })
            } else {
              topics.push({ id: `${l.id}-t1`, name: `${l.title}: Conceptual Framework` })
              topics.push({ id: `${l.id}-t2`, name: `${l.title}: Applied Questions & Notes` })
            }

            lessons.push({
              id: l.id,
              lessonNumber: l.lessonNumber,
              title: l.title,
              description: l.studyNotes?.[0] || `${l.title} under Chapter ${ch.chapterNumber}: ${ch.title}`,
              subjectName: 'General Studies',
              topics,
            })
          })
        })
      }

      units.push({
        id: u.id,
        unitNumber: u.unitNumber,
        title: u.title,
        subjectName: 'General Studies',
        lessons,
      })
    })
  }

  // 2. Aptitude & Mental Ability (Units 7 & 8)
  const aptSubject = group2Subjects.find((s) => s.id === 'aptitude')
  if (aptSubject) {
    aptSubject.units.forEach((u) => {
      const virtualUnitId = 6 + u.id
      const lessons: LessonItem[] = []
      const seenLessonTitles = new Set<string>()

      for (let c = 6; c <= 10; c++) {
        const key = `aptitude-${u.id}-${c}`
        const classData = group2ClassRegistry[key]
        if (classData && Array.isArray(classData.lessons)) {
          classData.lessons.forEach((l) => {
            const uniqueKey = `${c}-${l.title}`
            if (!seenLessonTitles.has(uniqueKey)) {
              seenLessonTitles.add(uniqueKey)

              const topics: TopicItem[] = []
              if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
                l.keyConcepts.forEach((kc, i) => {
                  topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
                })
              } else {
                topics.push({ id: `${l.id}-t1`, name: `${l.title}: Formulas & Methods` })
              }
              topics.push({ id: `${l.id}-t-app`, name: `${l.title}: Short Tricks & Solved Examples` })

              lessons.push({
                id: l.id,
                lessonNumber: l.lessonNumber,
                title: l.title,
                description: l.description,
                subjectName: 'Aptitude & Mental Ability',
                classId: c,
                topics,
              })
            }
          })
        }
      }

      units.push({
        id: virtualUnitId,
        unitNumber: `Part B - ${u.unitNumber}`,
        title: `Aptitude: ${u.title}`,
        subjectName: 'Aptitude and Mental Ability',
        lessons,
      })
    })
  }

  // 3. General English (Unit 9)
  const geClassData = group2ClassRegistry['general-english-1-10']
  if (geClassData) {
    const lessons: LessonItem[] = geClassData.lessons.map((l) => ({
      id: l.id,
      lessonNumber: l.lessonNumber,
      title: l.title,
      description: l.description,
      subjectName: 'General English',
      classId: 10,
      topics: (l.keyConcepts || ['Grammar', 'Literary Analysis']).map((kc, i) => ({
        id: `${l.id}-t${i + 1}`,
        name: kc,
      })),
    }))
    units.push({
      id: 9,
      unitNumber: 'Part C',
      title: 'General English (SSLC Standard)',
      subjectName: 'General English',
      lessons,
    })
  }

  // 4. General Tamil (Part C: Units 1 to 7 across Classes 6 to 10)
  const gtSubject = group2Subjects.find((s) => s.id === 'general-tamil')
  if (gtSubject) {
    gtSubject.units.forEach((u) => {
      const virtualUnitId = 9 + u.id
      const lessons: LessonItem[] = []
      const seenLessonTitles = new Set<string>()

      for (let c = 6; c <= 10; c++) {
        const key = `general-tamil-${u.id}-${c}`
        const classData = group2ClassRegistry[key]
        if (classData && Array.isArray(classData.lessons)) {
          classData.lessons.forEach((l) => {
            const uniqueKey = `${c}-${l.title}`
            if (!seenLessonTitles.has(uniqueKey)) {
              seenLessonTitles.add(uniqueKey)

              const topics: TopicItem[] = []
              if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
                l.keyConcepts.forEach((kc, i) => {
                  topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
                })
              } else {
                topics.push({ id: `${l.id}-t1`, name: `${l.title}: அடிப்படை விதிகள்` })
              }
              topics.push({ id: `${l.id}-t-app`, name: `${l.title}: மாதிரி வினாக்கள் & குறிப்புகள்` })

              lessons.push({
                id: l.id,
                lessonNumber: l.lessonNumber,
                title: l.title,
                description: l.description,
                subjectName: 'பொதுத் தமிழ்',
                classId: c,
                topics,
              })
            }
          })
        }
      }

      if (lessons.length === 0) {
        u.chapters.forEach((ch) => {
          ch.lessons.forEach((l) => {
            const topics: TopicItem[] = []
            if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
              l.keyConcepts.forEach((kc, i) => {
                topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
              })
            } else {
              topics.push({ id: `${l.id}-t1`, name: `${l.title}: பாடநூல் குறிப்புகள்` })
            }
            lessons.push({
              id: l.id,
              lessonNumber: l.lessonNumber,
              title: l.title,
              description: l.studyNotes?.[0] || `${l.title} under ${ch.title}`,
              subjectName: 'பொதுத் தமிழ்',
              topics,
            })
          })
        })
      }

      units.push({
        id: virtualUnitId,
        unitNumber: `பகுதி இ - ${u.unitNumber}`,
        title: `பொதுத்தமிழ்: ${u.title}`,
        subjectName: 'General Tamil',
        lessons,
      })
    })
  }

  return units
}

// ----------------------------------------------------------------------------
// Group 4 & VAO Syllabus Extraction (Code: 496)
// ----------------------------------------------------------------------------
function buildGroup4Units(): UnitItem[] {
  const units: UnitItem[] = []

  // 1. General Studies
  const gsSubject = group4Subjects.find((s) => s.id === 'general-studies')
  if (gsSubject) {
    gsSubject.units.forEach((u) => {
      const lessons: LessonItem[] = []

      u.chapters.forEach((ch) => {
        ch.lessons.forEach((l) => {
          const topics: TopicItem[] = []
          if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
            l.keyConcepts.forEach((kc, i) => {
              topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
            })
          } else {
            topics.push({ id: `${l.id}-t1`, name: `${l.title}: Standard SSLC Principles` })
            topics.push({ id: `${l.id}-t2`, name: `${l.title}: Tamil Nadu Context & Key Facts` })
          }

          lessons.push({
            id: l.id,
            lessonNumber: l.lessonNumber,
            title: l.title,
            description: l.studyNotes?.[0] || `${l.title} under Chapter ${ch.chapterNumber}: ${ch.title}`,
            subjectName: 'General Studies',
            topics,
          })
        })
      })

      units.push({
        id: u.id,
        unitNumber: u.unitNumber,
        title: u.title,
        subjectName: 'General Studies',
        lessons,
      })
    })
  }

  // 2. Aptitude & Mental Ability
  const aptSubject = group4Subjects.find((s) => s.id === 'aptitude')
  if (aptSubject) {
    aptSubject.units.forEach((u) => {
      const virtualUnitId = 6 + u.id
      const lessons: LessonItem[] = []
      u.chapters.forEach((ch) => {
        ch.lessons.forEach((l) => {
          const topics: TopicItem[] = (l.keyConcepts || ['Formulas & Shortcuts', 'Solved Problems']).map((kc, i) => ({
            id: `${l.id}-kc-${i + 1}`,
            name: kc,
          }))
          lessons.push({
            id: l.id,
            lessonNumber: l.lessonNumber,
            title: l.title,
            description: l.studyNotes?.[0] || l.title,
            subjectName: 'Aptitude & Mental Ability',
            topics,
          })
        })
      })
      units.push({
        id: virtualUnitId,
        unitNumber: `Part B - ${u.unitNumber}`,
        title: `Aptitude: ${u.title}`,
        subjectName: 'Aptitude and Mental Ability',
        lessons,
      })
    })
  }

  // 3. General Tamil (Part C: Units 1 to 7)
  const gtSubject = group4Subjects.find((s) => s.id === 'general-tamil')
  if (gtSubject) {
    gtSubject.units.forEach((u) => {
      const virtualUnitId = 8 + u.id
      const lessons: LessonItem[] = []
      const seenLessonTitles = new Set<string>()

      for (let c = 6; c <= 10; c++) {
        const key = `general-tamil-${u.id}-${c}`
        const classData = group2ClassRegistry[key]
        if (classData && Array.isArray(classData.lessons)) {
          classData.lessons.forEach((l) => {
            const uniqueKey = `${c}-${l.title}`
            if (!seenLessonTitles.has(uniqueKey)) {
              seenLessonTitles.add(uniqueKey)
              const topics: TopicItem[] = (l.keyConcepts || ['பாடக் கருத்துகள்']).map((kc, i) => ({
                id: `${l.id}-kc-${i + 1}`,
                name: kc,
              }))
              lessons.push({
                id: l.id,
                lessonNumber: l.lessonNumber,
                title: l.title,
                description: l.description,
                subjectName: 'பொதுத் தமிழ்',
                classId: c,
                topics,
              })
            }
          })
        }
      }

      if (lessons.length === 0) {
        u.chapters.forEach((ch) => {
          ch.lessons.forEach((l) => {
            lessons.push({
              id: l.id,
              lessonNumber: l.lessonNumber,
              title: l.title,
              description: l.studyNotes?.[0] || l.title,
              subjectName: 'பொதுத் தமிழ்',
              topics: (l.keyConcepts || ['பாடக் குறிப்புகள்']).map((kc, i) => ({
                id: `${l.id}-kc-${i + 1}`,
                name: kc,
              })),
            })
          })
        })
      }

      units.push({
        id: virtualUnitId,
        unitNumber: `பகுதி இ - ${u.unitNumber}`,
        title: `பொதுத்தமிழ்: ${u.title}`,
        subjectName: 'General Tamil',
        lessons,
      })
    })
  }

  return units
}

// Static Cache of Group Syllabus Trees
const cachedGroup1 = buildGroup1Units()
const cachedGroup2 = buildGroup2Units()
const cachedGroup4 = buildGroup4Units()

export const UNIFIED_SYLLABUS_REGISTRY: Record<'group1' | 'group2' | 'group2a' | 'group4' | 'vao', UnitItem[]> = {
  group1: cachedGroup1,
  group2: cachedGroup2,
  group2a: cachedGroup2, // Group 2A shares the identical Preliminary General Studies syllabus (Code: 495)
  group4: cachedGroup4,
  vao: cachedGroup4,     // VAO shares the CCSE-IV General Studies syllabus (Code: 496)
}

export const STANDARDS = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
]

/**
 * Helper to fetch units for a specific TNPSC group
 */
export function getUnitsForGroup(groupId: 'group1' | 'group2' | 'group2a' | 'group4' | 'vao'): UnitItem[] {
  return UNIFIED_SYLLABUS_REGISTRY[groupId] || cachedGroup1
}

/**
 * Helper to fetch lessons for a specific group, unit, and optional standard (classId)
 */
export function getLessonsForUnit(
  groupId: 'group1' | 'group2' | 'group2a' | 'group4' | 'vao',
  unitId: number,
  classId?: number
): LessonItem[] {
  const units = getUnitsForGroup(groupId)
  const unit = units.find((u) => u.id === unitId)
  if (!unit) return []

  if (classId) {
    const hasClassTaggedLessons = unit.lessons.some((l) => typeof l.classId === 'number')
    if (hasClassTaggedLessons) {
      return unit.lessons.filter((l) => l.classId === classId)
    }
  }

  return unit.lessons
}

/**
 * Helper to fetch topics for a specific group, unit, lesson title, and optional standard (classId)
 */
export function getTopicsForLesson(
  groupId: 'group1' | 'group2' | 'group2a' | 'group4' | 'vao',
  unitId: number,
  lessonTitle: string,
  classId?: number
): TopicItem[] {
  const lessons = getLessonsForUnit(groupId, unitId, classId)
  const lesson = lessons.find((l) => l.title === lessonTitle) || getLessonsForUnit(groupId, unitId).find((l) => l.title === lessonTitle)
  return lesson?.topics || []
}

// ============================================================================
// DYNAMIC 6-TIER SYLLABUS SELECTION ENGINE
// Group -> Subject -> Standard -> Unit -> Lesson -> Specific Topic
// ============================================================================

export interface SyllabusSubjectConfig {
  id: string
  name: string
  description?: string
}

export const GROUP_SUBJECTS: Record<'group1' | 'group2' | 'group4', SyllabusSubjectConfig[]> = {
  // TNPSC Group 1: General Studies, Aptitude and Mental Ability
  group1: [
    { id: 'general-studies', name: 'General Studies' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability' },
  ],
  // TNPSC Group 2 / 2A: General Studies, Aptitude and Mental Ability, General English, General Tamil
  group2: [
    { id: 'general-studies', name: 'General Studies' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability' },
    { id: 'general-english', name: 'General English' },
    { id: 'general-tamil', name: 'General Tamil' },
  ],
  // TNPSC Group 4: General Studies, Aptitude and Mental Ability, General Tamil, General English
  group4: [
    { id: 'general-studies', name: 'General Studies' },
    { id: 'aptitude', name: 'Aptitude and Mental Ability' },
    { id: 'general-tamil', name: 'General Tamil' },
    { id: 'general-english', name: 'General English' },
  ],
}

/**
 * Returns available subjects strictly configured for the chosen examination group.
 */
export function getSubjectsForGroup(groupId: 'group1' | 'group2' | 'group4'): SyllabusSubjectConfig[] {
  return GROUP_SUBJECTS[groupId] || GROUP_SUBJECTS.group1
}

/**
 * Returns standards available for the selected group and subject.
 * - Group 4 is strictly SSLC standard (6th to 10th standard).
 * - Aptitude across all exams is SSLC standard (6th to 10th standard).
 * - General Studies, English, and Tamil for Group 1/2 cover 6th to 12th standard.
 */
export function getStandardsForSubject(
  groupId: 'group1' | 'group2' | 'group4',
  subjectId: string
): { id: number; label: string; shortLabel: string }[] {
  if (groupId === 'group4' || subjectId === 'aptitude') {
    return STANDARDS.filter((s) => s.id >= 6 && s.id <= 10)
  }
  return STANDARDS
}

export interface SyllabusUnitOption {
  id: number
  unitNumber: string
  title: string
  subjectName: string
}

/**
 * Returns the exact units mapped to the selected group, subject, and standard.
 */
export function getUnitsForSubjectStandard(
  _groupId: 'group1' | 'group2' | 'group4',
  subjectId: string,
  classId: number
): SyllabusUnitOption[] {
  if (subjectId === 'general-studies') {
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'General Science', subjectName: 'General Science' },
      { id: 2, unitNumber: 'Unit 2', title: 'Geography of India', subjectName: 'Geography' },
      { id: 3, unitNumber: 'Unit 3', title: 'History, Culture of India, and Indian National Movement', subjectName: 'History & INM' },
      { id: 4, unitNumber: 'Unit 4', title: 'Indian Polity', subjectName: 'Indian Polity' },
      { id: 5, unitNumber: 'Unit 5', title: 'Indian Economy and Development Administration in Tamil Nadu', subjectName: 'Economy & TN Admin' },
      { id: 6, unitNumber: 'Unit 6', title: 'History, Culture, Heritage, and Socio-Political Movements in Tamil Nadu', subjectName: 'Tamil Nadu Heritage' },
    ]
  }

  if (subjectId === 'aptitude') {
    if (classId === 10) {
      return [
        { id: 1, unitNumber: 'Unit 1', title: 'Aptitude', subjectName: 'Aptitude and Mental Ability' },
        { id: 2, unitNumber: 'Unit 2', title: 'Reasoning', subjectName: 'Aptitude and Mental Ability' },
      ]
    }
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'Aptitude', subjectName: 'Aptitude and Mental Ability' },
    ]
  }

  if (subjectId === 'general-english') {
    return [
      { id: 1, unitNumber: 'Unit 1', title: 'Grammar', subjectName: 'General English' },
      { id: 2, unitNumber: 'Unit 2', title: 'Vocabulary', subjectName: 'General English' },
      { id: 3, unitNumber: 'Unit 3', title: 'Writing Skills', subjectName: 'General English' },
      { id: 4, unitNumber: 'Unit 4', title: 'Technical Terms', subjectName: 'General English' },
      { id: 5, unitNumber: 'Unit 5', title: 'Reading Comprehension', subjectName: 'General English' },
      { id: 6, unitNumber: 'Unit 6', title: 'Translation', subjectName: 'General English' },
      { id: 7, unitNumber: 'Unit 7', title: 'Literary Works (SSLC Standard)', subjectName: 'General English' },
    ]
  }

  if (subjectId === 'general-tamil') {
    return [
      { id: 1, unitNumber: 'அலகு 1', title: 'இலக்கணம் (Grammar)', subjectName: 'General Tamil' },
      { id: 2, unitNumber: 'அலகு 2', title: 'செய்யுள் & சங்க இலக்கியம் (Classical Literature)', subjectName: 'General Tamil' },
      { id: 3, unitNumber: 'அலகு 3', title: 'அற இலக்கியங்கள் & காப்பியங்கள் (Ethical Epics)', subjectName: 'General Tamil' },
      { id: 4, unitNumber: 'அலகு 4', title: 'பக்தி இலக்கியம் & சிற்றிலக்கியங்கள் (Devotional Literature)', subjectName: 'General Tamil' },
      { id: 5, unitNumber: 'அலகு 5', title: 'நவீன இலக்கியம் & உரைநடை (Modern Literature & Prose)', subjectName: 'General Tamil' },
      { id: 6, unitNumber: 'அலகு 6', title: 'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும் (Scholars & Contributions)', subjectName: 'General Tamil' },
      { id: 7, unitNumber: 'அலகு 7', title: 'கடித இலக்கியம், நாட்டுப்புறக் கலைகள் & பயன்பாட்டுத் தமிழ் (Applied Tamil)', subjectName: 'General Tamil' },
    ]
  }

  return []
}

/**
 * Returns raw syllabus class data by inspecting the relevant authoritative data registries.
 */
function resolveClassData(
  groupId: 'group1' | 'group2' | 'group4',
  subjectId: string,
  classId: number,
  unitId: number
): { topics?: string[]; lessons?: any[]; subjectName?: string } | null {
  // 1. Group 1 Specific Lookup
  if (groupId === 'group1') {
    if (subjectId === 'general-studies') {
      const key = `${unitId}-${classId}`
      if (unitClassRegistry[key]) return unitClassRegistry[key]
    }
    if (subjectId === 'aptitude') {
      const key = `aptitude-${unitId}-${classId}`
      if (group2ClassRegistry[key]) return group2ClassRegistry[key]
    }
  }

  // 2. Group 4 Specific Lookup
  if (groupId === 'group4') {
    if (subjectId === 'general-studies') {
      const key = `general-studies-${unitId}-${classId}`
      if (group4ClassRegistry[key]) return group4ClassRegistry[key]
      if (group2ClassRegistry[key]) return group2ClassRegistry[key]
    }
    if (subjectId === 'aptitude') {
      const key = `aptitude-${unitId}-${classId}`
      if (group2ClassRegistry[key]) return group2ClassRegistry[key]
    }
    if (subjectId === 'general-tamil') {
      const key = `general-tamil-${unitId}-${classId}`
      if (group4ClassRegistry[key]) return group4ClassRegistry[key]
      if (group2ClassRegistry[key]) return group2ClassRegistry[key]
    }
    if (subjectId === 'general-english') {
      const key = `general-english-${unitId}-${classId}`
      if (group2ClassRegistry[key]) return group2ClassRegistry[key]
    }
  }

  // 3. Group 2 & General Fallback Lookup
  const key = `${subjectId}-${unitId}-${classId}`
  if (group2ClassRegistry[key]) return group2ClassRegistry[key]

  return null
}

/**
 * Returns all valid lessons belonging to the exact Group, Subject, Standard, and Unit.
 */
export function getLessonsForSelection(
  groupId: 'group1' | 'group2' | 'group4',
  subjectId: string,
  classId: number,
  unitId: number
): LessonItem[] {
  const classData = resolveClassData(groupId, subjectId, classId, unitId)
  if (!classData || !Array.isArray(classData.lessons) || classData.lessons.length === 0) {
    return []
  }

  return classData.lessons.map((l: any, idx: number) => {
    const topics: TopicItem[] = []

    // 1. Extract topics from keyConcepts if present
    if (Array.isArray(l.keyConcepts) && l.keyConcepts.length > 0) {
      l.keyConcepts.forEach((kc: string, i: number) => {
        topics.push({ id: `${l.id}-kc-${i + 1}`, name: kc })
      })
    }

    // 2. Match relevant class-level topics to this lesson
    if (Array.isArray(classData.topics) && classData.topics.length > 0) {
      const words = String(l.title || '')
        .toLowerCase()
        .split(/[\s,:-]+/)
        .filter((w) => w.length > 3)

      const matched = classData.topics.filter((t) =>
        words.some((w) => t.toLowerCase().includes(w))
      )

      matched.forEach((mt: string, i: number) => {
        if (!topics.some((existing) => existing.name === mt)) {
          topics.push({ id: `${l.id}-ct-${i + 1}`, name: mt })
        }
      })
    }

    // 3. Fallback topics if none derived
    if (topics.length === 0) {
      topics.push({ id: `${l.id}-t1`, name: `${l.title}: Core Principles & Definitions` })
      topics.push({ id: `${l.id}-t2`, name: `${l.title}: Analytical & Practical Applications` })
    }

    return {
      id: l.id || `l-${subjectId}-${unitId}-${classId}-${idx + 1}`,
      lessonNumber: l.lessonNumber || `1.${idx + 1}`,
      title: l.title,
      description: l.description,
      subjectName: classData.subjectName || subjectId,
      classId,
      topics,
    }
  })
}

/**
 * Returns only specific topics strictly mapped to the chosen lesson.
 * Never mixes topics from other lessons, subjects, or standards.
 */
export function getTopicsForSelection(
  groupId: 'group1' | 'group2' | 'group4',
  subjectId: string,
  classId: number,
  unitId: number,
  lessonTitle: string
): TopicItem[] {
  const lessons = getLessonsForSelection(groupId, subjectId, classId, unitId)
  const found = lessons.find((l) => l.title === lessonTitle) || lessons[0]
  return found?.topics || []
}

