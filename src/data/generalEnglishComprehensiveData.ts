// Comprehensive TNPSC Group 2 & 2A General English Syllabus Data
// 100% Comprehensive Coverage across Units 1 to 7 matching the official syllabus
// Official Syllabus Code: 495 / SSLC Standard (100 Questions)
// Covers all lessons, subtopics, study notes, key concepts, and MCQs

import type { Group2Unit } from './group2SyllabusData'

export const group2GeneralEnglishUnits: Group2Unit[] = [
  {
    "id": 1,
    "unitNumber": "Unit I",
    "title": "Grammar",
    "questionCount": 25,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Parts of speech, Concord, Tense, Active voice and passive voice",
      "Types of sentences: Statement, Interrogative, Imperative, Exclamatory and Transformations (Statements into Imperatives, Interrogatives into Statements, Assertives into Negatives, Exclamatory into Statement, Imperatives into Inquisitive Interrogatives, Imperatives into Appreciative Statements)",
      "Verbs: Main Verbs and Auxiliary Verbs, Regular and Irregular Verbs, Infinitives, Gerunds, Participles",
      "Question tags, Sentence patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA), Simple, Compound and Complex sentences",
      "Phrases and clauses, Degrees of comparison (Positive, Comparative, Superlative), Direct into Indirect and Indirect to Direct, Synthesis of sentences, Punctuations"
    ],
    "chapters": [
      {
        "id": "ge-u1-c1",
        "chapterNumber": 1,
        "title": "Parts of Speech, Concord & Tense Forms",
        "lessons": [
          {
            "id": "ge-u1-c1-l1",
            "lessonNumber": "1.1",
            "title": "Parts of Speech & Functional Word Classes",
            "duration": "35 mins",
            "keyConcepts": [
              "8 Parts of Speech: Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection",
              "Nouns: Common, Proper, Collective, Abstract, Material",
              "Adjectives vs Adverbs: Modifying nouns vs modifying verbs/adjectives",
              "Prepositions of Time, Place, and Direction"
            ],
            "studyNotes": [
              "A word's part of speech depends on its syntactic function in a sentence, not its form alone (e.g., 'fast' in 'a fast train' is an adjective, but in 'he ran fast' is an adverb).",
              "Collective nouns take singular verbs when considered as a unified body ('The committee has submitted its report') and plural verbs when individuals act separately ('The committee were divided in their votes').",
              "Prepositions show relational links between a noun/pronoun and other elements: 'between' for two entities, 'among' for three or more."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-1-1",
                "question": "Identify the part of speech of the underlined word: 'She looked <u>above</u> at the sparkling stars.'",
                "options": [
                  "Preposition",
                  "Adverb",
                  "Noun",
                  "Conjunction"
                ],
                "correctAnswer": 1,
                "explanation": "'Above' modifies the verb 'looked' by indicating where she looked, functioning as an adverb of place."
              },
              {
                "id": "ge-mcq-1-1-2",
                "question": "Which of the following sentences correctly uses the preposition 'between'?",
                "options": [
                  "The prize was divided between the five students.",
                  "There is a bilateral treaty between India and France.",
                  "He distributed the sweets between all the children in the hall.",
                  "The misunderstanding between the members of the club was resolved."
                ],
                "correctAnswer": 1,
                "explanation": "'Between' is used when referring to two distinct parties, such as India and France in a bilateral treaty."
              }
            ]
          },
          {
            "id": "ge-u1-c1-l2",
            "lessonNumber": "1.2",
            "title": "Subject-Verb Agreement (Rules of Concord & Exceptions)",
            "duration": "40 mins",
            "keyConcepts": [
              "Singular subject takes singular verb; plural subject takes plural verb",
              "Parenthetical expressions: 'as well as', 'along with', 'together with' do not alter grammatical number",
              "Correlative conjunctions: 'either...or', 'neither...nor' follow the proximity rule",
              "Indefinite pronouns: 'each', 'every', 'everyone', 'neither of' take singular verbs"
            ],
            "studyNotes": [
              "When subjects are joined by phrases like 'along with', 'as well as', 'accompanied by', the verb agrees with the primary/first subject: 'The teacher along with her students is visiting the observatory.'",
              "In 'either...or' and 'neither...nor', the verb agrees with the nearer subject: 'Neither the principal nor the teachers were present.'",
              "Expressions like 'Each of', 'Either of', 'Neither of', 'One of' are invariably followed by a plural noun but take a singular verb: 'One of the candidates has cleared the prelims.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-1-3",
                "question": "Fill in the blank with the appropriate verb: 'Neither the manager nor his assistants ______ present at the morning briefing.'",
                "options": [
                  "was",
                  "were",
                  "is",
                  "has been"
                ],
                "correctAnswer": 1,
                "explanation": "When connected by 'neither...nor', the verb agrees with the closer subject ('assistants', plural), requiring 'were'."
              },
              {
                "id": "ge-mcq-1-1-4",
                "question": "Identify the grammatically correct sentence:",
                "options": [
                  "The Chief Minister, along with his cabinet colleagues, have arrived at the venue.",
                  "The Chief Minister, along with his cabinet colleagues, has arrived at the venue.",
                  "The Chief Minister, along with his cabinet colleagues, were arrived at the venue.",
                  "The Chief Minister, along with his cabinet colleagues, are arriving yesterday."
                ],
                "correctAnswer": 1,
                "explanation": "Phrases introduced by 'along with' are parenthetical; the true subject is 'The Chief Minister' (singular), which takes the singular verb 'has arrived'."
              }
            ]
          },
          {
            "id": "ge-u1-c1-l3",
            "lessonNumber": "1.3",
            "title": "Tense Forms & Time Aspects (12 Tenses & Usage)",
            "duration": "45 mins",
            "keyConcepts": [
              "Present, Past, Future across Simple, Continuous, Perfect, and Perfect Continuous aspects",
              "Habitual actions, universal truths, and scientific principles require Simple Present",
              "Actions completed before another past event require Past Perfect (had + V3)",
              "Future time markers and conditional clauses"
            ],
            "studyNotes": [
              "Universal truths and habitual actions always use the Simple Present: 'The earth rotates on its axis.'",
              "When two actions occurred in the past, the earlier completed action takes Past Perfect, while the subsequent action takes Simple Past: 'The train had departed before we reached the railway platform.'",
              "'Since' denotes a specific starting point in time, while 'for' denotes the duration/period of time with Perfect Continuous tenses: 'She has been studying since 6 AM / for three hours.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-1-5",
                "question": "Choose the correct tense form: 'By the time the rescue team arrived, the flood waters ______.'",
                "options": [
                  "receded",
                  "had receded",
                  "have receded",
                  "were receding"
                ],
                "correctAnswer": 1,
                "explanation": "The receding of flood waters occurred before the arrival of the rescue team in the past, necessitating Past Perfect ('had receded')."
              },
              {
                "id": "ge-mcq-1-1-6",
                "question": "Select the sentence with the correct tense usage:",
                "options": [
                  "He is living in Chennai since 2015.",
                  "He has been living in Chennai since 2015.",
                  "He lived in Chennai since 2015.",
                  "He was living in Chennai for 2015."
                ],
                "correctAnswer": 1,
                "explanation": "An action starting in the past and continuing into the present requires the Present Perfect Continuous tense ('has been living')."
              }
            ]
          },
          {
            "id": "ge-u1-c1-l4",
            "lessonNumber": "1.4",
            "title": "Active and Passive Voice (All Tense Shifts & Imperatives)",
            "duration": "40 mins",
            "keyConcepts": [
              "Voice transformation rules: Subject becomes Object (preceded by 'by'), Object becomes Subject",
              "Verb shift: Appropriate form of 'be' + Past Participle (V3)",
              "Imperative sentences into Passive: 'Let + Object + be + V3' or 'You are requested / advised / ordered to'",
              "Tenses that do not form passive: Present/Past/Future Perfect Continuous, and Future Continuous"
            ],
            "studyNotes": [
              "Simple Present: 'writes' => 'is/am/are written'; Simple Past: 'wrote' => 'was/were written'; Present Perfect: 'has written' => 'has been written'.",
              "Imperatives: 'Open the door' => 'Let the door be opened' or 'You are ordered to open the door.'",
              "Prepositional verbs retain their prepositions: 'They laughed at the clown' => 'The clown was laughed at by them.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-1-7",
                "question": "Change into Passive Voice: 'The storm damaged several coastal cottages.'",
                "options": [
                  "Several coastal cottages had been damaged by the storm.",
                  "Several coastal cottages were damaged by the storm.",
                  "Several coastal cottages are damaged by the storm.",
                  "Several coastal cottages were being damaged by the storm."
                ],
                "correctAnswer": 1,
                "explanation": "The active verb 'damaged' is Simple Past; its passive equivalent is 'were damaged' (agreeing with plural 'cottages')."
              },
              {
                "id": "ge-mcq-1-1-8",
                "question": "Convert the imperative sentence to Passive Voice: 'Obey traffic regulations.'",
                "options": [
                  "Traffic regulations must obey you.",
                  "Let traffic regulations be obeyed.",
                  "Traffic regulations were obeyed by you.",
                  "You obey traffic regulations."
                ],
                "correctAnswer": 1,
                "explanation": "Imperatives are converted to passive using the formula 'Let + object + be + past participle (V3)' => 'Let traffic regulations be obeyed.'"
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u1-c2",
        "chapterNumber": 2,
        "title": "Verb Classifications & Non-Finite Verbs",
        "lessons": [
          {
            "id": "ge-u1-c2-l1",
            "lessonNumber": "1.5",
            "title": "Main Verbs & Auxiliary Verbs (Primary & Modals)",
            "duration": "35 mins",
            "keyConcepts": [
              "Primary Auxiliaries: Be (am, is, are, was, were), Have (has, have, had), Do (do, does, did)",
              "Modal Auxiliaries: Can, could, may, might, will, would, shall, should, must",
              "Semi-Modals / Quasi-Modals: Ought to, used to, need, dare",
              "Expressing ability, permission, obligation, necessity, possibility"
            ],
            "studyNotes": [
              "Primary auxiliaries can function either as helping verbs ('She is reading') or as main verbs ('She is a doctor').",
              "Modals do not change form with person or number and are always followed by base form (V1).",
              "'Ought to' indicates moral obligation: 'We ought to respect our national symbols.' 'Used to' indicates discontinued past habits."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-2-1",
                "question": "Choose the appropriate modal verb: 'You ______ submit the application before 5:00 PM today; otherwise, it will be rejected.'",
                "options": [
                  "might",
                  "must",
                  "can",
                  "would"
                ],
                "correctAnswer": 1,
                "explanation": "'Must' conveys strict obligation and necessity required by official deadlines."
              },
              {
                "id": "ge-mcq-1-2-2",
                "question": "In the sentence 'He used to walk five miles every morning', 'used to' functions as a:",
                "options": [
                  "Primary Auxiliary",
                  "Semi-Modal Auxiliary",
                  "Transitive Main Verb",
                  "Subordinating Conjunction"
                ],
                "correctAnswer": 1,
                "explanation": "'Used to' is a semi-modal auxiliary indicating a past habitual action."
              }
            ]
          },
          {
            "id": "ge-u1-c2-l2",
            "lessonNumber": "1.6",
            "title": "Regular and Irregular Verbs & Verb Conjugations",
            "duration": "30 mins",
            "keyConcepts": [
              "Regular Verbs: Form past and past participle by adding -d or -ed (walk, walked, walked)",
              "Irregular Verbs: Change vowels or have identical forms across V1, V2, V3 (sing, sang, sung; cut, cut, cut)",
              "Easily confused verbs: lie/lay, rise/raise, fall/fell",
              "Transitive vs Intransitive verbs"
            ],
            "studyNotes": [
              "Lie (rest/recline): lie, lay, lain, lying (Intransitive). Lay (place/put down): lay, laid, laid, laying (Transitive - requires an object).",
              "Rise (move upwards): rise, rose, risen (Intransitive). Raise (lift something): raise, raised, raised (Transitive).",
              "Irregular verbs with identical three forms: bet, burst, cast, cost, cut, hit, hurt, let, put, set, shut, split, spread."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-2-3",
                "question": "Select the correct verb to complete the sentence: 'The patient has ______ in bed for over two days.'",
                "options": [
                  "laid",
                  "lain",
                  "lied",
                  "lying"
                ],
                "correctAnswer": 1,
                "explanation": "The verb 'to lie' (recline) has forms lie, lay, lain. Following 'has', the past participle 'lain' is correct."
              },
              {
                "id": "ge-mcq-1-2-4",
                "question": "Which of the following is an irregular verb that maintains the identical form in V1, V2, and V3?",
                "options": [
                  "Freeze",
                  "Spread",
                  "Grow",
                  "Drive"
                ],
                "correctAnswer": 1,
                "explanation": "'Spread' retains the exact same spelling and pronunciation across present, past, and past participle (spread, spread, spread)."
              }
            ]
          },
          {
            "id": "ge-u1-c2-l3",
            "lessonNumber": "1.7",
            "title": "Non-Finite Verbs: Infinitives, Gerunds & Participles",
            "duration": "45 mins",
            "keyConcepts": [
              "Infinitives: 'to + base verb' (To err is human) and Bare Infinitives (make, let, bid)",
              "Gerund: 'verb + ing' functioning as a verbal noun (Swimming is good exercise)",
              "Present Participle: 'verb + ing' functioning as a verbal adjective (a barking dog)",
              "Past Participle: 'verb + ed/en' functioning as an adjective (a broken vase)"
            ],
            "studyNotes": [
              "Verbs followed by Gerunds: admit, avoid, consider, delay, deny, enjoy, finish, postpone, practice, risk, suggest.",
              "Verbs followed by Infinitives: agree, decide, hope, manage, plan, promise, refuse, threaten, wish.",
              "Bare Infinitive (without 'to') follows modal auxiliaries and verbs of perception: 'I saw him enter the hall' (not 'to enter')."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-2-5",
                "question": "Identify the function of 'Reading' in 'Reading enhances analytical thinking':",
                "options": [
                  "Finite Verb",
                  "Gerund functioning as Subject",
                  "Present Participle functioning as Adjective",
                  "Infinitive"
                ],
                "correctAnswer": 1,
                "explanation": "'Reading' is formed from 'read + ing' and functions as the noun subject of the sentence, making it a Gerund."
              },
              {
                "id": "ge-mcq-1-2-6",
                "question": "Fill in the blank with the appropriate non-finite verb: 'The teacher made the students ______ the passage silently.'",
                "options": [
                  "to read",
                  "read",
                  "reading",
                  "having read"
                ],
                "correctAnswer": 1,
                "explanation": "The causative verb 'make' is followed by a bare infinitive without 'to': 'made the students read'."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u1-c3",
        "chapterNumber": 3,
        "title": "Sentence Types, Question Tags & Transformations",
        "lessons": [
          {
            "id": "ge-u1-c3-l1",
            "lessonNumber": "1.8",
            "title": "Sentence Types: Statement, Interrogative, Imperative & Exclamatory",
            "duration": "35 mins",
            "keyConcepts": [
              "Declarative / Statement: States facts, opinions, or ideas, ending with a period",
              "Interrogative: Asks direct questions (Wh- questions and Yes/No questions), ending with a question mark",
              "Imperative: Expresses commands, requests, advice, or prohibitions with an implied subject 'You'",
              "Exclamatory: Expresses strong or sudden emotions, ending with an exclamation mark"
            ],
            "studyNotes": [
              "Declarative word order: Subject + Verb + Complement/Object.",
              "Interrogative word order: Auxiliary + Subject + Main Verb (Yes/No) or Wh-word + Auxiliary + Subject + Main Verb.",
              "Imperatives typically begin with base verb (V1): 'Please maintain silence' or 'Do not step on the grass.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-3-1",
                "question": "Identify the type of sentence: 'How wonderfully the musicians played tonight!'",
                "options": [
                  "Declarative Sentence",
                  "Imperative Sentence",
                  "Exclamatory Sentence",
                  "Interrogative Sentence"
                ],
                "correctAnswer": 2,
                "explanation": "The sentence conveys intense admiration and emotion, opening with 'How' and ending with an exclamation mark, making it Exclamatory."
              },
              {
                "id": "ge-mcq-1-3-2",
                "question": "Which of the following is an imperative sentence?",
                "options": [
                  "Will you pass the salt?",
                  "Kindly submit the verified documents at counter number four.",
                  "She submitted her certificates yesterday.",
                  "What a splendid presentation it was!"
                ],
                "correctAnswer": 1,
                "explanation": "'Kindly submit...' expresses a polite request with an understood subject '(You)', which characterizes an Imperative sentence."
              }
            ]
          },
          {
            "id": "ge-u1-c3-l2",
            "lessonNumber": "1.9",
            "title": "Sentence Transformations (Assertive, Negative, Interrogative & Exclamatory)",
            "duration": "45 mins",
            "keyConcepts": [
              "Affirmative to Negative without altering meaning (using antonyms or 'fail to')",
              "Exclamatory to Assertive: 'What a beautiful scene!' => 'It is a very beautiful scene'",
              "Interrogative to Assertive: 'Who does not love his motherland?' => 'Everyone loves his motherland'",
              "Imperative to Inquisitive Interrogative / Appreciative Statement"
            ],
            "studyNotes": [
              "Affirmative into Negative without change of meaning: 'He is honest' => 'He is not dishonest'. 'I remembered your advice' => 'I did not forget your advice'.",
              "Exclamatory into Assertive: Replace 'How/What' with intensifiers like 'very', 'truly', or 'great': 'What an extraordinary achievement!' => 'It is a truly extraordinary achievement.'",
              "Interrogative into Assertive: Rhetorical questions imply their opposite assertion: 'Can a leopard change its spots?' => 'A leopard cannot change its spots.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-3-3",
                "question": "Transform into Assertive: 'Who can doubt the integrity of APJ Abdul Kalam?'",
                "options": [
                  "Anyone can doubt the integrity of APJ Abdul Kalam.",
                  "No one can doubt the integrity of APJ Abdul Kalam.",
                  "Some people doubt the integrity of APJ Abdul Kalam.",
                  "APJ Abdul Kalam had great integrity."
                ],
                "correctAnswer": 1,
                "explanation": "A positive rhetorical question ('Who can doubt...?') transforms into a negative universal assertion ('No one can doubt...')."
              },
              {
                "id": "ge-mcq-1-3-4",
                "question": "Transform into Negative without changing the meaning: 'All the members supported the proposal.'",
                "options": [
                  "No member opposed the proposal.",
                  "All members did not support the proposal.",
                  "Some members opposed the proposal.",
                  "None supported the proposal."
                ],
                "correctAnswer": 0,
                "explanation": "'All supported' is equivalent in meaning to 'No member opposed', preserving meaning while introducing a negative structure."
              }
            ]
          },
          {
            "id": "ge-u1-c3-l3",
            "lessonNumber": "1.10",
            "title": "Question Tags (Positive, Negative & Special Exceptions)",
            "duration": "35 mins",
            "keyConcepts": [
              "Positive statement takes a negative tag; negative statement takes a positive tag",
              "Tag comprises: Auxiliary Verb + Pronoun",
              "Special case 'I am': Tag is 'aren't I?' (or 'am I?' if negative 'I am not')",
              "Imperatives: 'Let's...' takes 'shall we?'; commands take 'will you?' / 'won't you?'",
              "Negative words ('hardly', 'scarcely', 'barely', 'seldom', 'never') take positive tags"
            ],
            "studyNotes": [
              "'I am late, aren't I?' (not 'amn't I'). 'I am not guilty, am I?'",
              "'Let us begin the session, shall we?'",
              "'He seldom visits his native village, does he?' (Since 'seldom' is semantically negative, the tag must be positive).",
              "'Everyone has arrived, haven't they?' (Indefinite pronouns like 'everyone', 'somebody' take plural pronoun 'they' in the tag)."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-3-5",
                "question": "Select the correct question tag: 'She rarely speaks in public, ______?'",
                "options": [
                  "doesn't she",
                  "does she",
                  "isn't she",
                  "is she"
                ],
                "correctAnswer": 1,
                "explanation": "'Rarely' has a negative connotation; hence the sentence requires a positive question tag: 'does she?'"
              },
              {
                "id": "ge-mcq-1-3-6",
                "question": "Choose the correct tag: 'Let us celebrate the success, ______?'",
                "options": [
                  "will we",
                  "shall we",
                  "should we",
                  "can we"
                ],
                "correctAnswer": 1,
                "explanation": "Suggestions beginning with 'Let us' or 'Let's' take the conventional question tag 'shall we?'."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u1-c4",
        "chapterNumber": 4,
        "title": "Sentence Syntax, Synthesis, Clauses & Punctuations",
        "lessons": [
          {
            "id": "ge-u1-c4-l1",
            "lessonNumber": "1.11",
            "title": "Sentence Patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA) & Synthesis",
            "duration": "40 mins",
            "keyConcepts": [
              "Components: S (Subject), V (Verb), O (Direct Object), IO (Indirect Object), DO (Direct Object), C (Complement), A (Adjunct)",
              "Patterns: SV, SVO, SVIODO, SVDOIO, SVC, SVOC, SVA, SVOA, SVOCA",
              "Complements complete the sense of linking verbs or describe the object",
              "Adjuncts answer How, When, Where, Why and can be omitted without grammatical collapse"
            ],
            "studyNotes": [
              "'The child slept' => SV. 'They painted the house white' => SVOC ('white' is Object Complement describing 'the house').",
              "'My father gave me a fountain pen' => S + V + IO + DO (IO answers 'to whom?', DO answers 'what?').",
              "'The train arrived late' => SVA ('late' is an Adjunct answering 'when/how?')."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-4-1",
                "question": "Identify the sentence pattern of: 'The committee elected Dr. Radhakrishnan President.'",
                "options": [
                  "S + V + IO + DO",
                  "S + V + O + C",
                  "S + V + O + A",
                  "S + V + C + A"
                ],
                "correctAnswer": 1,
                "explanation": "'The committee' (S) 'elected' (V) 'Dr. Radhakrishnan' (O) 'President' (C - Object Complement describing who he became)."
              },
              {
                "id": "ge-mcq-1-4-2",
                "question": "What is the pattern of: 'He walked briskly in the morning'?",
                "options": [
                  "S + V + A + A",
                  "S + V + O + A",
                  "S + V + C + A",
                  "S + V + IO + DO"
                ],
                "correctAnswer": 0,
                "explanation": "'He' (S) 'walked' (V) 'briskly' (A - Manner) 'in the morning' (A - Time) => S + V + A + A."
              }
            ]
          },
          {
            "id": "ge-u1-c4-l2",
            "lessonNumber": "1.12",
            "title": "Simple, Compound, Complex Sentences & Clauses",
            "duration": "45 mins",
            "keyConcepts": [
              "Simple: One independent clause with a single finite verb ('On seeing the police, the thief ran away')",
              "Compound: Two or more independent clauses joined by coordinating conjunctions FANBOYS ('The thief saw the police and he ran away')",
              "Complex: One independent clause and one or more dependent clauses joined by subordinating conjunctions ('When the thief saw the police, he ran away')",
              "Noun clauses, Adjective (Relative) clauses, Adverbial clauses (Condition, Reason, Time)"
            ],
            "studyNotes": [
              "Coordinating conjunctions (FANBOYS): For, And, Nor, But, Or, Yet, So.",
              "Subordinating conjunctions: Although, Because, Since, Unless, If, When, While, As soon as.",
              "Conditionals: Type 1 (If + Present => will + V1), Type 2 (If + Past => would + V1), Type 3 (If + had + V3 => would have + V3)."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-4-3",
                "question": "Transform into Complex sentence: 'In spite of his poverty, he is exceptionally honest.'",
                "options": [
                  "He is poor but he is exceptionally honest.",
                  "Though he is poor, he is exceptionally honest.",
                  "Being poor, he is honest.",
                  "He is honest despite poverty."
                ],
                "correctAnswer": 1,
                "explanation": "'Though he is poor' is a subordinate adverbial clause of concession, forming a Complex sentence with the main clause 'he is exceptionally honest'."
              },
              {
                "id": "ge-mcq-1-4-4",
                "question": "Complete the conditional clause: 'If she had informed me earlier, I ______ necessary arrangements.'",
                "options": [
                  "will make",
                  "would make",
                  "would have made",
                  "had made"
                ],
                "correctAnswer": 2,
                "explanation": "Third conditional (past unreal condition): 'If + had + past participle' in the if-clause requires 'would have + past participle' in the result clause."
              }
            ]
          },
          {
            "id": "ge-u1-c4-l3",
            "lessonNumber": "1.13",
            "title": "Degrees of Comparison, Direct/Indirect Speech & Punctuation Rules",
            "duration": "45 mins",
            "keyConcepts": [
              "Degrees of Comparison: Positive (as...as), Comparative (...er than / more... than), Superlative (the ...est / the most...)",
              "Direct to Indirect Speech: Reporting verb shifts, tense backshifts, pronoun and time/place adverb shifts",
              "Universal truths and habitual actions retain original tense in indirect speech",
              "Punctuation: Capitalization, apostrophe in possessives/contractions, comma, semicolon, colon, hyphen, quotation marks"
            ],
            "studyNotes": [
              "Model 1: 'No other poet is as great as Shakespeare' (Positive) <=> 'Shakespeare is greater than any other poet' (Comparative) <=> 'Shakespeare is the greatest poet' (Superlative).",
              "Model 2: 'Very few metals are as useful as iron' (Positive) <=> 'Iron is more useful than most other metals' (Comparative) <=> 'Iron is one of the most useful metals' (Superlative).",
              "Direct to Indirect: 'He said, \"The sun rises in the east\"' => 'He said that the sun rises in the east' (no tense change for universal truth)."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-1-4-5",
                "question": "Transform into Comparative Degree: 'Mount Everest is the highest peak in the world.'",
                "options": [
                  "Mount Everest is higher than any other peak in the world.",
                  "No other peak in the world is higher than Mount Everest.",
                  "Mount Everest is as high as any peak in the world.",
                  "Very few peaks in the world are higher than Mount Everest."
                ],
                "correctAnswer": 0,
                "explanation": "The superlative 'the highest peak' transforms into comparative as 'higher than any other peak in the world'."
              },
              {
                "id": "ge-mcq-1-4-6",
                "question": "Choose the correctly punctuated sentence:",
                "options": [
                  "She said \"where are you going, Ramesh?\"",
                  "She said, \"Where are you going, Ramesh?\"",
                  "She said, \"where are you going Ramesh\"?",
                  "She said \"Where are you going Ramesh?\""
                ],
                "correctAnswer": 1,
                "explanation": "A comma precedes the opening quotation mark; direct speech begins with a capital letter; a comma separates the vocative noun 'Ramesh', and the question mark stays inside quotes."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 2,
    "unitNumber": "Unit II",
    "title": "Vocabulary",
    "questionCount": 15,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Synonyms, Antonyms, Homonyms, Homophones",
      "Collocations, Idioms & Phrases, Phrasal verbs",
      "Spelling of words, Correct usage of words, One word substitution, Word creation",
      "Singular and plural (including Zero plural), Derivatives, Abbreviations",
      "British and American English, Compound words and Figures of speech"
    ],
    "chapters": [
      {
        "id": "ge-u2-c1",
        "chapterNumber": 1,
        "title": "Lexical Semantics, Pairs & Word Formations",
        "lessons": [
          {
            "id": "ge-u2-c1-l1",
            "lessonNumber": "2.1",
            "title": "Synonyms and Antonyms (Contextual & Textbook Words)",
            "duration": "35 mins",
            "keyConcepts": [
              "Contextual Synonyms from prescribed Tamil Nadu SCERT English textbooks",
              "Antonyms formed by prefixation (un-, in-, dis-, mis-, non-, ir-, il-)",
              "Gradable vs Complementary antonyms",
              "Connotation vs Denotation in word selection"
            ],
            "studyNotes": [
              "Always infer the meaning from the context of the sentence; a word may have diverse synonyms depending on its usage (e.g., 'grave' can mean 'serious' or 'tomb').",
              "Common textbook words: 'Placid' = calm/serene; 'Frugal' = economical/thrifty; 'Audacious' = bold/daring (Antonym: timid/cowardly); 'Obsolete' = outdated/archaic (Antonym: contemporary/modern).",
              "Prefix-based antonyms: legal -> illegal; rational -> irrational; pure -> impure; legible -> illegible; reverent -> irreverent."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-1-1",
                "question": "Choose the exact synonym of the underlined word: 'The ascetic lived an <u>austere</u> life in the mountain sanctuary.'",
                "options": [
                  "Luxurious",
                  "Strict and simple",
                  "Extravagant",
                  "Chaotic"
                ],
                "correctAnswer": 1,
                "explanation": "'Austere' means severely simple, unadorned, or strictly disciplined without comforts."
              },
              {
                "id": "ge-mcq-2-1-2",
                "question": "Identify the antonym of the word 'BENEVOLENT':",
                "options": [
                  "Generous",
                  "Altruistic",
                  "Malevolent",
                  "Compassionate"
                ],
                "correctAnswer": 2,
                "explanation": "'Benevolent' means well-wishing, kind, and charitable; its direct antonym is 'Malevolent' (spiteful or wishing harm)."
              }
            ]
          },
          {
            "id": "ge-u2-c1-l2",
            "lessonNumber": "2.2",
            "title": "Homonyms and Homophones (Confusing Pairs & Nuances)",
            "duration": "35 mins",
            "keyConcepts": [
              "Homophones: Words with the same sound/pronunciation but different spelling and meaning (altar/alter, principal/principle)",
              "Homonyms: Words with the same sound and spelling but different meanings (bear, bank, ring)",
              "Homographs: Words with the same spelling but different pronunciation and meaning (lead/lead, tear/tear)",
              "Frequently tested pairs: complement/compliment, stationary/stationery, council/counsel"
            ],
            "studyNotes": [
              "'Principal' = head of an institution or main sum of money; 'Principle' = fundamental truth, moral rule.",
              "'Stationary' (with 'a') = fixed, not moving; 'Stationery' (with 'e' as in paper/pen) = writing materials.",
              "'Compliment' = praise or regards; 'Complement' = that which completes or enhances another thing."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-1-3",
                "question": "Fill in the blank with the appropriate word: 'The scientist explained the scientific ______ governing thermodynamics.'",
                "options": [
                  "principals",
                  "principles",
                  "principle's",
                  "principality"
                ],
                "correctAnswer": 1,
                "explanation": "'Principles' refers to fundamental scientific laws or rules of operation."
              },
              {
                "id": "ge-mcq-2-1-4",
                "question": "Select the sentence with the correct homophone usage:",
                "options": [
                  "The truck rammed into a stationery bus.",
                  "The truck rammed into a stationary bus.",
                  "He bought notebooks from the stationary shop.",
                  "The bus remained stationery at the terminal."
                ],
                "correctAnswer": 1,
                "explanation": "'Stationary' means motionless or standing still, which correctly describes the vehicle."
              }
            ]
          },
          {
            "id": "ge-u2-c1-l3",
            "lessonNumber": "2.3",
            "title": "Singular, Plural & Zero Plural Nouns (Irregular & Foreign Plurals)",
            "duration": "35 mins",
            "keyConcepts": [
              "Regular plurals (-s, -es, -ies)",
              "Irregular plurals: foot/feet, tooth/teeth, goose/geese, mouse/mice, ox/oxen",
              "Zero Plural (words that do not change form in plural): sheep, deer, cattle, aircraft, salmon, trout, species, series",
              "Foreign plurals (Latin & Greek): alumnus/alumni, crisis/crises, criterion/criteria, phenomenon/ phenomena, datum/data, radius/radii"
            ],
            "studyNotes": [
              "Zero plural nouns retain identical singular and plural forms: 'one sheep' => 'ten sheep'; 'a rare species' => 'many species'.",
              "Nouns always singular in form and use: furniture, luggage, information, advice, machinery, scenery, poetry, baggage (never 'furnitures' or 'informations').",
              "Nouns plural in form but singular in meaning: physics, mathematics, news, economics, politics, civics, measles, billiards (takes singular verb: 'The news is true')."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-1-5",
                "question": "Which of the following nouns exhibits a 'Zero Plural' (identical singular and plural form)?",
                "options": [
                  "Crisis",
                  "Deer",
                  "Ox",
                  "Phenomenon"
                ],
                "correctAnswer": 1,
                "explanation": "'Deer' has no separate plural ending; its plural form remains 'deer' (Zero Plural)."
              },
              {
                "id": "ge-mcq-2-1-6",
                "question": "What is the plural form of the Greek-derived noun 'Criterion'?",
                "options": [
                  "Criterions",
                  "Criteria",
                  "Criterias",
                  "Criterium"
                ],
                "correctAnswer": 1,
                "explanation": "Nouns ending in -on of Greek origin form their plural with -a: criterion -> criteria; phenomenon -> phenomena."
              }
            ]
          },
          {
            "id": "ge-u2-c1-l4",
            "lessonNumber": "2.4",
            "title": "Word Creation, Derivatives (Prefixes, Suffixes) & Compound Words",
            "duration": "40 mins",
            "keyConcepts": [
              "Prefixes modifying meaning: re- (again), pre- (before), post- (after), anti- (against), auto- (self), poly- (many), semi- (half)",
              "Suffixes creating word classes: -tion/-ment/-ness/-ity (Nouns); -ify/-ize/-en (Verbs); -ful/-less/-able/-ous (Adjectives); -ly (Adverbs)",
              "Compound word patterns: Noun + Noun (sunlight), Noun + Verb (sunset), Gerund + Noun (washing machine), Adjective + Noun (blackboard), Preposition + Noun (underworld)"
            ],
            "studyNotes": [
              "Derivatives are formed by adding morphemes (affixes) to base root words: 'child' -> 'childish' (adjective), 'childhood' (abstract noun).",
              "Compound words combine two distinct lexical bases to create a new semantic unit: 'greenhouse', 'waterfall', 'postman'.",
              "Hyphenated compound nouns in pluralize the headword: 'passer-by' -> 'passers-by'; 'son-in-law' -> 'sons-in-law'; 'commander-in-chief' -> 'commanders-in-chief'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-1-7",
                "question": "Identify the grammatical combination used in the compound word 'SEWING MACHINE':",
                "options": [
                  "Noun + Noun",
                  "Gerund + Noun",
                  "Adjective + Verb",
                  "Adverb + Noun"
                ],
                "correctAnswer": 1,
                "explanation": "'Sewing' is a gerund (verb + ing functioning as noun/qualifier) and 'machine' is a noun, forming Gerund + Noun."
              },
              {
                "id": "ge-mcq-2-1-8",
                "question": "What is the correct plural form of the compound word 'Brother-in-law'?",
                "options": [
                  "Brother-in-laws",
                  "Brothers-in-law",
                  "Brothers-in-laws",
                  "Brother-ins-law"
                ],
                "correctAnswer": 1,
                "explanation": "In compound nouns composed of a noun followed by a prepositional phrase, the plural suffix '-s' is added to the principal noun: 'Brothers-in-law'."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u2-c2",
        "chapterNumber": 2,
        "title": "Idiomatic Expressions, Phrasal Verbs & Collocations",
        "lessons": [
          {
            "id": "ge-u2-c2-l1",
            "lessonNumber": "2.5",
            "title": "Idioms & Phrases with Meanings and Usage",
            "duration": "40 mins",
            "keyConcepts": [
              "Definition of an idiom: Figurative, non-literal meaning understood through cultural convention",
              "High-frequency animal idioms: 'a dark horse' (unexpected winner), 'a bull in a china shop' (clumsy person), 'let the cat out of the bag' (reveal a secret)",
              "Color idioms: 'out of the blue' (unexpectedly), 'in the pink of health' (optimal fitness), 'see red' (furious)",
              "Action idioms: 'burn the midnight oil' (study late), 'at the eleventh hour' (at the last moment), 'burn the candle at both ends' (overwork)"
            ],
            "studyNotes": [
              "'Beat around the bush': Discussing a matter without coming directly to the central point.",
              "'Bite the bullet': To endure a painful or grim situation with fortitude and courage.",
              "'Piece of cake': An exceptionally easy task or assignment.",
              "'Blessing in disguise': A misfortune that unexpectedly produces beneficial outcomes."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-2-1",
                "question": "What is the meaning of the idiom 'to burn the midnight oil'?",
                "options": [
                  "To cause accidental fire",
                  "To study or work late into the night",
                  "To waste precious resources",
                  "To sleep early"
                ],
                "correctAnswer": 1,
                "explanation": "'Burn the midnight oil' refers to staying awake and working diligently late into the night."
              },
              {
                "id": "ge-mcq-2-2-2",
                "question": "Choose the correct idiom to express an unexpected, sudden occurrence: 'The news of the promotion came ______.'",
                "options": [
                  "out of the blue",
                  "in black and white",
                  "with flying colours",
                  "at the drop of a hat"
                ],
                "correctAnswer": 0,
                "explanation": "'Out of the blue' is an idiom meaning completely unexpected or without any prior warning."
              }
            ]
          },
          {
            "id": "ge-u2-c2-l2",
            "lessonNumber": "2.6",
            "title": "Phrasal Verbs (Separable & Inseparable Particles)",
            "duration": "40 mins",
            "keyConcepts": [
              "Structure: Verb + Preposition or Verb + Adverb particle",
              "Verbs with 'Call': call off (cancel), call on (visit a person), call at (visit a place), call for (require/demand)",
              "Verbs with 'Look': look into (investigate), look after (take care of), look down upon (despise), look forward to (anticipate with pleasure)",
              "Verbs with 'Put': put off (postpone), put out (extinguish), put up with (tolerate), put on (wear)"
            ],
            "studyNotes": [
              "'Call off' vs 'Put off': 'Call off' means to permanently cancel an event, whereas 'put off' means to postpone or reschedule it.",
              "'Look into': The police are looking into the burglary (investigating).",
              "'Look forward to' is followed by a gerund (verb+ing): 'I look forward to meeting you' (not 'meet you').",
              "'Give up' = surrender or abandon a habit; 'Give in' = yield or submit to pressure."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-2-3",
                "question": "The match was ______ due to incessant heavy rainfall.",
                "options": [
                  "called off",
                  "called out",
                  "called for",
                  "called upon"
                ],
                "correctAnswer": 0,
                "explanation": "'Called off' means cancelled, which is the standard term when a sporting fixture is terminated due to weather."
              },
              {
                "id": "ge-mcq-2-2-4",
                "question": "Select the phrasal verb that means 'to investigate': 'The Special Investigation Team was constituted to ______ the cyber scam.'",
                "options": [
                  "look after",
                  "look into",
                  "look down upon",
                  "look for"
                ],
                "correctAnswer": 1,
                "explanation": "'Look into' signifies to examine, inspect, or investigate facts systematically."
              }
            ]
          },
          {
            "id": "ge-u2-c2-l3",
            "lessonNumber": "2.7",
            "title": "Collocations (Verb-Noun, Adjective-Noun Combinations)",
            "duration": "30 mins",
            "keyConcepts": [
              "Collocation definition: Natural co-occurrence of words that sound right to native speakers",
              "Do vs Make: 'make a decision', 'make an effort', 'make a mistake' vs 'do homework', 'do business', 'do one's duty'",
              "Adjective + Noun: 'heavy traffic', 'torrential rain', 'blissful ignorance', 'vivid imagination'",
              "Verb + Preposition collocations: 'abide by', 'adhere to', 'comply with', 'abstain from'"
            ],
            "studyNotes": [
              "One says 'heavy rain' (not 'strong rain'); 'fast food' (not 'quick food'); 'quick meal' (not 'fast meal').",
              "Legal/administrative collocations: 'pass a resolution', 'file an affidavit', 'reach a consensus', 'deliver a verdict'.",
              "Prepositional collocations: 'accused of', 'acquitted of', 'capable of', 'congratulate on', 'prevent from'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-2-5",
                "question": "Choose the correct collocation: 'The committee was unable to ______ a final decision today.'",
                "options": [
                  "do",
                  "make",
                  "create",
                  "build"
                ],
                "correctAnswer": 1,
                "explanation": "In English, one 'makes a decision', forming an established verb-noun collocation."
              },
              {
                "id": "ge-mcq-2-2-6",
                "question": "Fill in the correct adjective collocation: 'Motorists experienced delays owing to ______ rain in the city.'",
                "options": [
                  "big",
                  "deep",
                  "torrential",
                  "thick"
                ],
                "correctAnswer": 2,
                "explanation": "'Torrential rain' is the standard, natural collocation used to denote extraordinarily heavy downpours."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u2-c3",
        "chapterNumber": 3,
        "title": "Specialized Vocabulary, Orthography & Linguistic Varieties",
        "lessons": [
          {
            "id": "ge-u2-c3-l1",
            "lessonNumber": "2.8",
            "title": "One Word Substitutions (Persons, Sciences, Terms)",
            "duration": "40 mins",
            "keyConcepts": [
              "Fields of study: Numismatics (coins), Philately (stamps), Ornithology (birds), Entomology (insects), Paleontology (fossils)",
              "Types of persons: Philanthropist (lover of mankind), Misanthrope (hater of mankind), Polyglot (knows multiple languages), Optimist/Pessimist",
              "Government types: Autocracy, Democracy, Oligarchy, Bureaucracy, Plutocracy (rule by wealthy)",
              "Medical specialists: Dermatologist, Ophthalmologist, Cardiologist, Pediatrician, Neurologist"
            ],
            "studyNotes": [
              "'Infallible' = one who never makes mistakes; 'Invincible' = too powerful to be defeated.",
              "'Egoist' = selfish person; 'Egotist' = talks excessively about oneself.",
              "'Omniscient' = knowing everything; 'Omnipotent' = all-powerful; 'Omnipresent' = present everywhere.",
              "'Teetotaler' = a person who completely abstains from alcoholic beverages."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-3-1",
                "question": "What is the one-word substitution for 'A person who collects or studies postage stamps'?",
                "options": [
                  "Numismatist",
                  "Philatelist",
                  "Cartographer",
                  "Anthropologist"
                ],
                "correctAnswer": 1,
                "explanation": "A 'Philatelist' is someone who collects and studies postage stamps."
              },
              {
                "id": "ge-mcq-2-3-2",
                "question": "A government conducted by the wealthy class of citizens is known as:",
                "options": [
                  "Aristocracy",
                  "Plutocracy",
                  "Oligarchy",
                  "Theocracy"
                ],
                "correctAnswer": 1,
                "explanation": "'Plutocracy' (from Greek ploutos = wealth + kratos = power) denotes governance by the wealthy."
              }
            ]
          },
          {
            "id": "ge-u2-c3-l2",
            "lessonNumber": "2.9",
            "title": "Spelling Rules, Word Usage, Abbreviations & Acronyms",
            "duration": "35 mins",
            "keyConcepts": [
              "Spelling rules: 'i before e except after c' (receive, deceive vs believe, relief)",
              "Silent letters: subtle, doubt, gnaw, mnemonic, pseudo, knight, aisle",
              "Frequently misspelled words: Accommodation, Commission, Bureaucracy, Conscientious, Millennium, Questionnaire, Separate",
              "Abbreviations vs Acronyms (UNESCO, ISRO, TNPSC, WHO, IMF, e.g., i.e., etc.)"
            ],
            "studyNotes": [
              "'Separate' has 'a' in the middle (remember: 'there is a rat in separate').",
              "'Accommodation' features double 'c' and double 'm'.",
              "'e.g.' stands for Latin 'exempli gratia' (for example); 'i.e.' stands for Latin 'id est' (that is).",
              "'Acronym' is pronounced as a single word (e.g., NASA, LASER, RADAR), while an 'Initialism' is pronounced letter by letter (e.g., TNPSC, BBC)."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-3-3",
                "question": "Select the word with the correct spelling:",
                "options": [
                  "Accomodation",
                  "Acommodation",
                  "Accommodation",
                  "Accomadation"
                ],
                "correctAnswer": 2,
                "explanation": "'Accommodation' is spelled with double 'c' and double 'm'."
              },
              {
                "id": "ge-mcq-2-3-4",
                "question": "The Latin abbreviation 'i.e.' stands for:",
                "options": [
                  "In essence",
                  "Id est",
                  "In example",
                  "Index entry"
                ],
                "correctAnswer": 1,
                "explanation": "'i.e.' is an abbreviation for the Latin phrase 'id est', translating to 'that is'."
              }
            ]
          },
          {
            "id": "ge-u2-c3-l3",
            "lessonNumber": "2.10",
            "title": "British and American English Equivalents & Figures of Speech",
            "duration": "40 mins",
            "keyConcepts": [
              "Vocabulary pairs: Flat (UK) / Apartment (US); Lift (UK) / Elevator (US); Petrol (UK) / Gasoline (US); Boot (UK) / Trunk (US)",
              "Spelling variations: -our vs -or (colour/color); -re vs -er (theatre/theater); -ise vs -ize (organise/organize); -ence vs -ense (defence/defense)",
              "Figures of speech in vocabulary: Simile, Metaphor, Personification, Oxymoron, Hyperbole, Onomatopoeia",
              "Idiomatic lexical figures: 'bittersweet' (oxymoron), 'buzzing bees' (onomatopoeia)"
            ],
            "studyNotes": [
              "UK vs US vocabulary: Bonnet / Hood; Biscuit / Cookie; Autumn / Fall; Pavement / Sidewalk; Dustbin / Garbage can; Queue / Line; Lorry / Truck.",
              "Oxymoron joins two contradictory terms: 'deafening silence', 'open secret', 'original copy'.",
              "Hyperbole uses deliberate exaggeration: 'I have told you a million times'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-2-3-5",
                "question": "What is the American English equivalent for the British word 'PAVEMENT'?",
                "options": [
                  "Footpath",
                  "Sidewalk",
                  "Driveway",
                  "Kerb"
                ],
                "correctAnswer": 1,
                "explanation": "In American English, the pedestrian pathway known as 'pavement' in British English is called 'sidewalk'."
              },
              {
                "id": "ge-mcq-2-3-6",
                "question": "Identify the figure of speech in the phrase 'A DEAFENING SILENCE':",
                "options": [
                  "Simile",
                  "Oxymoron",
                  "Personification",
                  "Hyperbole"
                ],
                "correctAnswer": 1,
                "explanation": "An 'Oxymoron' places two mutually contradictory or opposing words ('deafening' and 'silence') side-by-side for rhetorical effect."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 3,
    "unitNumber": "Unit III",
    "title": "Writing Skills",
    "questionCount": 10,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Letter writing (formal and informal) – Types of Letters (Multiple Choice Question)",
      "Jumbled sentences, Finding out the right order of sentences",
      "Making queries (Multiple Choice Question)",
      "Inferences, Blanks, Substitutions"
    ],
    "chapters": [
      {
        "id": "ge-u3-c1",
        "chapterNumber": 1,
        "title": "Letter Writing Formats & Principles",
        "lessons": [
          {
            "id": "ge-u3-c1-l1",
            "lessonNumber": "3.1",
            "title": "Formal Letters: Structure, Salutations & Subscriptions",
            "duration": "40 mins",
            "keyConcepts": [
              "Formal letter categories: Official correspondence, Letters to Editors, Job Applications, Business inquiries, Complaints",
              "Essential components in order: Sender's Address, Date, Receiver's Designation & Address, Subject line, Reference, Salutation, Body (Intro, Detail, Conclusion), Complimentary Close (Subscription), Signature & Name",
              "Salutations: 'Sir/Madam', 'Dear Sir/Madam' (never 'Respected Sir' in modern standard format)",
              "Subscription rules: 'Yours faithfully' (when recipient is unnamed/Sir), 'Yours sincerely' (when recipient is addressed by name, e.g., Dear Mr. Sharma)",
              "No apostrophe in 'Yours': 'Yours faithfully', never 'Your's'"
            ],
            "studyNotes": [
              "Date format: 27 October 2026 or October 27, 2026 (avoid ambiguous numerical notations like 27/10/26 in formal bodies).",
              "In job applications, the Curriculum Vitae / Resume / Bio-data forms an enclosure.",
              "Letters to Editors express civic or public concerns, usually concluding with: 'I request the authorities concerned to take necessary action through the esteemed columns of your daily.'"
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-3-1-1",
                "question": "Which of the following complimentary closes is grammatically and conventionally correct for a formal letter?",
                "options": [
                  "Your's faithfully",
                  "Yours faithfully",
                  "Yours' faithfully",
                  "Your faithfully"
                ],
                "correctAnswer": 1,
                "explanation": "'Yours' is a possessive pronoun that never takes an apostrophe. 'Yours faithfully' is the correct formal subscription."
              },
              {
                "id": "ge-mcq-3-1-2",
                "question": "When writing a formal complaint to the Commissioner of Municipal Corporation, which of the following is the most appropriate salutation?",
                "options": [
                  "Hey Commissioner",
                  "Dear Sir / Madam",
                  "Dearest Friend",
                  "To Whomsoever It May Concern"
                ],
                "correctAnswer": 1,
                "explanation": "'Dear Sir / Madam' or 'Sir / Madam' is the formal, respectful salutation standard in administrative communication."
              }
            ]
          },
          {
            "id": "ge-u3-c1-l2",
            "lessonNumber": "3.2",
            "title": "Informal Letters: Social & Personal Conventions",
            "duration": "30 mins",
            "keyConcepts": [
              "Informal letters written to parents, relatives, siblings, close friends",
              "Omission of Receiver's full designation address and formal Subject line",
              "Conversational, warm, and cordial tone",
              "Informal subscriptions: 'Yours affectionately', 'Yours lovingly', 'Your friend', 'With warm regards'"
            ],
            "studyNotes": [
              "Unlike formal letters, an informal letter does not require a 'Subject' heading.",
              "Salutation format: 'Dear Father', 'My dear Mother', 'Dear Anita'.",
              "Subscription for parents and elders: 'Yours affectionately' or 'Your loving son/daughter'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-3-1-3",
                "question": "Which component is deliberately omitted in an informal letter to a close family friend?",
                "options": [
                  "Date",
                  "Subject Line",
                  "Salutation",
                  "Sender's Address"
                ],
                "correctAnswer": 1,
                "explanation": "Informal personal letters do not include a formal 'Subject' line."
              },
              {
                "id": "ge-mcq-3-1-4",
                "question": "Select the most appropriate subscription for a letter written to your younger brother:",
                "options": [
                  "Yours faithfully",
                  "Yours lovingly",
                  "Yours obediently",
                  "With formal regards"
                ],
                "correctAnswer": 1,
                "explanation": "'Yours lovingly' or 'Yours affectionately' conveys personal affection appropriate for siblings and family members."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u3-c2",
        "chapterNumber": 2,
        "title": "Sentence Coherence, Queries & Logic",
        "lessons": [
          {
            "id": "ge-u3-c2-l1",
            "lessonNumber": "3.3",
            "title": "Jumbled Sentences & Logical Sequencing Techniques",
            "duration": "40 mins",
            "keyConcepts": [
              "Identifying the Opening Sentence (Independent subject, thematic introduction, absence of antecedent pronouns like 'He', 'They', 'This')",
              "Noun-Pronoun Chains: A noun in sentence A introduces a subject referred to by pronouns (he, it, they) in subsequent sentences",
              "Chronological & Transition Markers: First, initially, subsequently, meanwhile, finally, therefore, however",
              "Identifying Mandatory Pairs (conjunctions like 'not only... but also', 'on one hand... on the other hand')"
            ],
            "studyNotes": [
              "Examine introductory indicators: Sentences beginning with 'However', 'Therefore', 'Thus', 'Meanwhile' are rarely the opening sentence.",
              "Chronological sequence: Cause always precedes effect; problem precedes solution; historical events follow chronological dates.",
              "Look for acronym expansions: A sentence explaining an acronym (e.g., 'Indian Space Research Organisation (ISRO)') precedes one using just 'ISRO'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-3-2-1",
                "question": "Arrange the jumbled sentences into a coherent paragraph:\nP: They returned home with joyful memories.\nQ: The children planned an excursion to the botanical gardens.\nR: Throughout the afternoon, they explored exotic flora and rare plants.\nS: On Saturday morning, their school bus departed promptly.",
                "options": [
                  "Q - S - R - P",
                  "S - Q - R - P",
                  "Q - R - S - P",
                  "P - R - S - Q"
                ],
                "correctAnswer": 0,
                "explanation": "Q introduces the plan, S describes the departure, R portrays the activity at the garden, and P concludes the return home: Q-S-R-P."
              },
              {
                "id": "ge-mcq-3-2-2",
                "question": "In ordering a paragraph, which of the following sentences cannot serve as an opening sentence?",
                "options": [
                  "Renewable energy is the key to combating global climate change.",
                  "Consequently, the government announced fresh subsidies for solar installations.",
                  "Dr. A.P.J. Abdul Kalam was born in Rameswaram, Tamil Nadu.",
                  "Water is an indispensable resource for all biological life."
                ],
                "correctAnswer": 1,
                "explanation": "'Consequently' is a causal transition word that refers back to preceding ideas, so it cannot initiate an independent paragraph."
              }
            ]
          },
          {
            "id": "ge-u3-c2-l2",
            "lessonNumber": "3.4",
            "title": "Making Queries, Inferences, Blanks & Lexical Substitutions",
            "duration": "40 mins",
            "keyConcepts": [
              "Formulating polite queries in professional and administrative contexts: 'Could you please clarify...', 'May I request information regarding...'",
              "Information-seeking patterns: Timetable inquiries, fee structures, application statuses",
              "Logical Inference: Drawing valid conclusions strictly backed by factual premises",
              "Contextual cloze blanks and appropriate lexical substitutions"
            ],
            "studyNotes": [
              "Polite queries use modals 'Could', 'Would', 'May' rather than blunt imperatives or 'Can': 'Could you please let me know the status of my petition?'",
              "An inference is an deduction drawn from evidence; avoid assumptions that introduce extraneous facts not supported by the prompt.",
              "Vocabulary substitutions require matching both semantic meaning and grammatical category (noun for noun, verb for verb)."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-3-2-3",
                "question": "Which of the following is the most polite and professional query to request administrative information?",
                "options": [
                  "Tell me the exam schedule immediately.",
                  "I want the schedule now.",
                  "Could you kindly furnish the revised schedule of the upcoming examinations?",
                  "Give the examination schedule."
                ],
                "correctAnswer": 2,
                "explanation": "'Could you kindly furnish...' maintains appropriate professional courtesy and polite modal phrasing."
              },
              {
                "id": "ge-mcq-3-2-4",
                "question": "Based on the sentence: 'The reservoir levels have touched a historic low of 8%, prompting authorities to ration tap supply', what is the logical inference?",
                "options": [
                  "The region is facing severe drought and water scarcity.",
                  "The reservoir was emptied deliberately for cleaning.",
                  "The authorities are constructing new reservoirs.",
                  "Rainfall in the coming month will be abundant."
                ],
                "correctAnswer": 0,
                "explanation": "Historic low water levels coupled with rationing directly and logically imply acute water scarcity."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 4,
    "unitNumber": "Unit IV",
    "title": "Technical Terms",
    "questionCount": 10,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Administrative Terms, Department related, General and Official terms",
      "Official Correspondence (only basics)"
    ],
    "chapters": [
      {
        "id": "ge-u4-c1",
        "chapterNumber": 1,
        "title": "Administrative & Departmental Terminology",
        "lessons": [
          {
            "id": "ge-u4-c1-l1",
            "lessonNumber": "4.1",
            "title": "High-Frequency Administrative & Official Terms",
            "duration": "35 mins",
            "keyConcepts": [
              "Affidavit = A sworn written statement of facts made voluntarily under oath before an authorized magistrate or notary",
              "Gazette = Official public journal published by the government to record statutory enactments, rules, and appointments",
              "Notification = A formal executive announcement having legal force published in the Gazette",
              "Disciplinary Action = Formal proceedings instituted against an employee for breach of conduct rules",
              "Discrepancy = Inconsistency, variance, or lack of agreement between two sets of official records",
              "Ex-officio = Holding an office or position by virtue of holding another primary office",
              "Quorum = The minimum attendance of members required to constitute a valid meeting",
              "Ad hoc = Constituted for a specific, particular purpose or temporary objective",
              "Suo motu = An action taken by a court or authority on its own initiative without a formal complaint"
            ],
            "studyNotes": [
              "Administrative vocabulary forms an essential part of governance and civil administration operations.",
              "Key definitions: 'Vigilance' = Watchfulness and systemic oversight against corruption; 'Superannuation' = Retirement from service upon reaching the prescribed statutory age limit; 'Tenure' = Period of holding an official post.",
              "'Sub judice' = Under judicial consideration and therefore prohibited from public discussion; 'De jure' = Existing according to lawful right; 'De facto' = Existing in actual fact or practice."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-4-1-1",
                "question": "What is the official definition of the administrative term 'QUORUM'?",
                "options": [
                  "The minimum number of members required to be present to validate official proceedings",
                  "A legislative resolution passed by a two-thirds majority",
                  "A formal publication in the government gazette",
                  "The superannuation age of a civil servant"
                ],
                "correctAnswer": 0,
                "explanation": "'Quorum' denotes the minimum attendance of members required to be present at a meeting to validate transactions and pass official decisions."
              },
              {
                "id": "ge-mcq-4-1-2",
                "question": "The administrative term 'AD HOC' denotes:",
                "options": [
                  "A permanent civil post",
                  "Formed for a particular purpose or temporary need",
                  "An ex-officio appointment",
                  "A discretionary government grant"
                ],
                "correctAnswer": 1,
                "explanation": "'Ad hoc' is a Latin administrative term designating an arrangement formed for a particular purpose or temporary need."
              }
            ]
          },
          {
            "id": "ge-u4-c1-l2",
            "lessonNumber": "4.2",
            "title": "Departmental Governance Terminology (Revenue, Police, Finance & Judiciary)",
            "duration": "40 mins",
            "keyConcepts": [
              "Revenue Terms: Patta (Legal record of land ownership), Chitta (Village register detailing land categorization), Jamabandi (Annual audit and settlement of village revenue records), Encroachment (Unauthorized occupation of government land), Mutation (Formal transfer of title in revenue registers)",
              "Judiciary Terms: Plaintiff (Party instituting a civil suit), Defendant (Party against whom relief is sought), Injunction (Judicial order restraining or commanding specific acts), Bail (Provisional release of an accused person on security), Subpoena (Writ summoning a witness to testify)",
              "Finance Terms: Appropriation (Statutory allocation of funds by legislature for specified purposes), Deficit (Excess of expenditure over revenue), Audit (Systematic scrutiny of accounts by statutory authorities), Revenue Expenditure (Operational expenditure without creating permanent physical assets)",
              "Police Terms: Cognizable Offence (An offence for which a police officer may arrest without a warrant), Charge Sheet (Final investigative report submitted to magistrate), Inquest (Judicial inquiry into the cause of sudden or suspicious death)"
            ],
            "studyNotes": [
              "'Jamabandi' refers to the annual settlement and auditing of village accounts conducted by the Revenue Divisional Officer / District Collector.",
              "'Cognizable offence' empowers the police to initiate an investigation and make arrests without requiring a prior warrant from a magistrate.",
              "'Injunction' is an equitable remedy designed to prevent irreparable injury by restraining destructive actions."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-4-1-3",
                "question": "In Revenue Administration, the annual inspection and settlement of village accounts is termed as:",
                "options": [
                  "Jamabandi",
                  "Mutation",
                  "Inquest",
                  "Survey"
                ],
                "correctAnswer": 0,
                "explanation": "'Jamabandi' is the traditional revenue administrative term for the annual audit and settlement of village land records."
              },
              {
                "id": "ge-mcq-4-1-4",
                "question": "What is the legal definition of 'INJUNCTION' in administrative and judicial practice?",
                "options": [
                  "A court order restraining a party from doing a specified act",
                  "A monetary bail deposit for accused release",
                  "A police charge sheet filed after investigation",
                  "A sworn written declaration on stamp paper"
                ],
                "correctAnswer": 0,
                "explanation": "A judicial 'Injunction' is an equitable remedy in the form of a court order compelling a party to refrain from specific acts."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u4-c2",
        "chapterNumber": 2,
        "title": "Official Correspondence Basics",
        "lessons": [
          {
            "id": "ge-u4-c2-l1",
            "lessonNumber": "4.3",
            "title": "Official Correspondence Types: Memorandum, Endorsement & Circular",
            "duration": "35 mins",
            "keyConcepts": [
              "Official Memorandum (OM): Internal government communication between departments, written in third person without salutation or subscription",
              "Endorsement: Recording notes or forwarding orders on the same document or file to subordinate offices",
              "Circular: Instructions or orders issued simultaneously to multiple offices or departments for general guidance",
              "Government Notification: Published in the official Gazette to inform the general public of statutory orders, rules, or appointments"
            ],
            "studyNotes": [
              "Official Memorandums do not begin with 'Dear Sir' or end with 'Yours faithfully'; they carry only the signatory's name and designation.",
              "Endorsements are commonly used when forwarding copies 'for information and necessary action'.",
              "Gazette Notifications carry statutory legal force upon publication."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-4-2-1",
                "question": "Which form of official communication is written strictly in the third person without formal salutation or subscription?",
                "options": [
                  "Demi-Official (D.O.) Letter",
                  "Official Memorandum (O.M.)",
                  "Personal Letter",
                  "Press Release"
                ],
                "correctAnswer": 1,
                "explanation": "An Official Memorandum (O.M.) is framed in the third person and omits both salutation and complimentary close."
              },
              {
                "id": "ge-mcq-4-2-2",
                "question": "When statutory rules or executive appointments are officially promulgated to the public, they are published through a:",
                "options": [
                  "Demi-Official Letter",
                  "Gazette Notification",
                  "Office Note",
                  "Endorsement slip"
                ],
                "correctAnswer": 1,
                "explanation": "Official promulgations and statutory rules are published through a Notification in the Government Gazette."
              }
            ]
          },
          {
            "id": "ge-u4-c2-l2",
            "lessonNumber": "4.4",
            "title": "Demi-Official (D.O.) Letters, Office Orders & Drafting Conventions",
            "duration": "35 mins",
            "keyConcepts": [
              "Demi-Official (D.O.) Letter: Used between officers of equal or comparable rank to draw personal attention to urgent matters",
              "D.O. Letter conventions: Begins with 'Dear Shri/Ms...' and ends with 'Yours sincerely'",
              "Office Order: Communicates internal decisions affecting employees (transfers, postings, leave grants, sanctions)",
              "Drafting rules: Accuracy, brevity, lucidity, avoidance of ambiguities, proper file reference numbering"
            ],
            "studyNotes": [
              "A D.O. letter creates personal rapport between administrators, accelerating inter-departmental action.",
              "Office Orders are binding administrative instructions regarding postings, transfers, and duties within a department.",
              "U.O. (Unofficial) Note is an internal file noting exchanged between departments for seeking views or concurrences."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-4-2-3",
                "question": "Which form of correspondence is used between two senior administrators to draw urgent personal attention?",
                "options": [
                  "Demi-Official (D.O.) Letter",
                  "Gazette Notification",
                  "Circular",
                  "Subpoena"
                ],
                "correctAnswer": 0,
                "explanation": "A Demi-Official (D.O.) letter is drafted in personal terms between officers to expedite matters of urgency."
              },
              {
                "id": "ge-mcq-4-2-4",
                "question": "An administrative order regarding internal staff postings, transfers, and leave grants is known as an:",
                "options": [
                  "Office Order",
                  "Press Release",
                  "Un-Official Note",
                  "Affidavit"
                ],
                "correctAnswer": 0,
                "explanation": "An Office Order is the standard departmental instrument communicating postings, transfers, and internal establishment sanctions."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 5,
    "unitNumber": "Unit V",
    "title": "Reading Comprehension",
    "questionCount": 20,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Unseen passages (News Paper, Headlines, Editorials, Government related News)",
      "Question Types: Strong question, Weak question, Match the following, Sentence Completion",
      "Ascertainment of facts (Multiple Choice Question) - Choose the best response"
    ],
    "chapters": [
      {
        "id": "ge-u5-c1",
        "chapterNumber": 1,
        "title": "Media Texts & Public Passages Analysis",
        "lessons": [
          {
            "id": "ge-u5-c1-l1",
            "lessonNumber": "5.1",
            "title": "Newspaper Reports, Headlines & Editorial Analysis",
            "duration": "40 mins",
            "keyConcepts": [
              "Inverted Pyramid structure of journalistic reporting (Lead paragraph answers 5 Ws and 1 H: Who, What, When, Where, Why, How)",
              "Headline syntax: Omission of auxiliary verbs and articles, use of present tense for past events, infinitive for future events",
              "Editorial tone: Analytical, critical, persuasive, evaluative, cautiously optimistic",
              "Extracting the Central Idea / Thesis statement"
            ],
            "studyNotes": [
              "Headline grammar: 'Cabinet Approves New Welfare Scheme' (Present tense indicates a recent past decision); 'PM to Visit Chennai Tomorrow' (Infinitive 'to visit' denotes future action).",
              "Editorial comprehension involves distinguishing the author's subjective stance and normative recommendations from objective facts cited.",
              "Skimming provides a high-level conceptual map, while scanning locates specific data points, dates, and names."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-5-1-1",
                "question": "In newspaper headline style, which tense is conventionally employed to report an action that occurred yesterday?",
                "options": [
                  "Past Perfect Tense",
                  "Simple Present Tense",
                  "Future Continuous Tense",
                  "Past Continuous Tense"
                ],
                "correctAnswer": 1,
                "explanation": "Journalistic headline convention utilizes the Simple Present Tense to impart immediacy and freshness to recent past events."
              },
              {
                "id": "ge-mcq-5-1-2",
                "question": "When an editorial passage discusses public transit bottlenecks and suggests structural policy reforms, what is the author's primary tone?",
                "options": [
                  "Fictional and Playful",
                  "Analytical and Constructive",
                  "Satirical and Cynical",
                  "Nostalgic"
                ],
                "correctAnswer": 1,
                "explanation": "Editorials addressing public policy and infrastructure deficits with reasoned alternatives exhibit an 'Analytical and Constructive' tone."
              }
            ]
          },
          {
            "id": "ge-u5-c1-l2",
            "lessonNumber": "5.2",
            "title": "Government News, Public Policy Schemes & Analytical Reports",
            "duration": "40 mins",
            "keyConcepts": [
              "Understanding developmental metrics: Target beneficiaries, budgetary allocations, implementation agencies",
              "Interpreting quantitative tables, charts, and policy summaries in unseen texts",
              "Identifying cause-and-effect relationships in public health, education, and economic news",
              "Contextualizing acronyms of state and national welfare schemes"
            ],
            "studyNotes": [
              "Government news passages frequently test factual recall and direct causal links (e.g., scheme objectives, financial outlays, target demographic).",
              "Read the questions before deep-diving into statistical passages to target specific quantitative data points efficiently.",
              "Watch out for qualifier words: 'all', 'only', 'exclusively', 'primarily', 'partially', which often define true vs false statements."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-5-1-3",
                "question": "In analyzing a government scheme report, the phrase 'Target Beneficiaries' refers to:",
                "options": [
                  "The funding international banks",
                  "The specific demographic or socio-economic group intended to receive benefits",
                  "The administrative staff executing the project",
                  "The private software vendors"
                ],
                "correctAnswer": 1,
                "explanation": "'Target Beneficiaries' designates the exact segment of citizens or society for whose welfare the policy is crafted."
              },
              {
                "id": "ge-mcq-5-1-4",
                "question": "Which reading technique is most effective when searching for a specific statistical figure or year in a lengthy government survey report?",
                "options": [
                  "Skimming",
                  "Scanning",
                  "Intensive Reading",
                  "Extensive Reading"
                ],
                "correctAnswer": 1,
                "explanation": "'Scanning' is the reading strategy used to swiftly search a passage for specific isolated details, numbers, or terms."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u5-c2",
        "chapterNumber": 2,
        "title": "Question Typology & Critical Reasoning",
        "lessons": [
          {
            "id": "ge-u5-c2-l1",
            "lessonNumber": "5.3",
            "title": "Strong Question vs Weak Question Identification & Fallacies",
            "duration": "40 mins",
            "keyConcepts": [
              "Strong Questions / Arguments: Directly relevant, logically sound, supported by factual evidence, touching the root cause",
              "Weak Questions / Arguments: Superficial, trivial, emotionally biased, vague, based on flawed assumptions or personal prejudice",
              "Logical Fallacies: Circular reasoning, false dilemma, ad hominem attacks, hasty generalization",
              "Evaluating argumentative strength in reading comprehension texts"
            ],
            "studyNotes": [
              "A 'Strong' question probes substantial underlying causes or systemic outcomes: 'How does groundwater depletion impact agricultural yield and food security?'",
              "A 'Weak' question dwells on subjective trivialities or unverified opinions: 'Why don't all farmers simply migrate to cities?'",
              "In TNPSC reading questions, strong arguments must be both factually coherent and deeply relevant to the central proposition."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-5-2-1",
                "question": "Statement: 'Should all major rivers in the country be interlinked?' Which of the following represents a STRONG argument?",
                "options": [
                  "Yes, because it will optimize water distribution, mitigate recurrent regional floods, and provide irrigation to drought-prone zones.",
                  "No, because people in ancient times did not interlink rivers.",
                  "Yes, because other nations might feel proud of our technology.",
                  "No, because the names of the rivers sound very poetic individually."
                ],
                "correctAnswer": 0,
                "explanation": "Argument 1 is strong because it addresses practical, hydrological, agricultural, and socio-economic realities with logical cause-and-effect reasoning."
              },
              {
                "id": "ge-mcq-5-2-2",
                "question": "Which characteristic makes an argument WEAK in comprehension analysis?",
                "options": [
                  "It is supported by verified empirical statistics.",
                  "It addresses the core constitutional premise directly.",
                  "It is based purely on emotional bias, triviality, or broad generalization without evidence.",
                  "It demonstrates logical consistency."
                ],
                "correctAnswer": 2,
                "explanation": "Weak arguments rely on personal bias, vague assumptions, or trivial tangents rather than factual and substantive evidence."
              }
            ]
          },
          {
            "id": "ge-u5-c2-l2",
            "lessonNumber": "5.4",
            "title": "Fact Ascertainment, Sentence Completion & Match the Following",
            "duration": "45 mins",
            "keyConcepts": [
              "Ascertainment of Facts: Distinguishing verified statements explicitly asserted in the text from unverified extrapolations",
              "Sentence Completion: Selecting options that preserve semantic continuity, syntactic harmony, and authorial stance",
              "Match the Following: Correlating causes with effects, authors/speakers with quotes, terms with contextual definitions",
              "Elimination technique for tricky multi-statement comprehension questions"
            ],
            "studyNotes": [
              "When answering 'Choose the best response based on the passage', avoid bringing outside world knowledge that contradicts the text.",
              "Sentence completion requires both grammatical concordance and contextual resonance.",
              "Cross-verify each matched pair in multi-column match questions to ensure zero contradiction."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-5-2-3",
                "question": "Passage extract: 'Though digital payments surged by 65%, cybersecurity awareness among rural users remains inadequate.' Which statement is a verified fact?",
                "options": [
                  "Digital payments grew significantly, but rural cyber awareness requires improvement.",
                  "Digital payments have completely replaced cash across all rural hamlets.",
                  "Cybercrime in rural areas has tripled this fiscal year.",
                  "Urban citizens do not utilize digital transaction modes."
                ],
                "correctAnswer": 0,
                "explanation": "The first statement reflects precisely the explicit factual assertion of the passage without unsupported extrapolation."
              },
              {
                "id": "ge-mcq-5-2-4",
                "question": "Complete the sentence logically: 'Unless stringent measures are enforced to curb industrial effluents, ______.'",
                "options": [
                  "river ecology will witness progressive rejuvenation",
                  "water contamination will continue to endanger aquatic biodiversity",
                  "industrial profits will triple automatically",
                  "rainfall levels will double across coastal belts"
                ],
                "correctAnswer": 1,
                "explanation": "'Unless... enforced' sets up a negative condition; failure to curb toxic effluents logically results in sustained environmental contamination."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 6,
    "unitNumber": "Unit VI",
    "title": "Translation",
    "questionCount": 5,
    "standard": "SSLC Standard (10th Standard)",
    "officialTopics": [
      "Word Translation, Sentence Translation",
      "Tense related translation tasks, Tense / Voice related tasks"
    ],
    "chapters": [
      {
        "id": "ge-u6-c1",
        "chapterNumber": 1,
        "title": "Lexical & Syntactic Translation",
        "lessons": [
          {
            "id": "ge-u6-c1-l1",
            "lessonNumber": "6.1",
            "title": "Word-to-Word & Contextual Translation (Equivalence & Register)",
            "duration": "30 mins",
            "keyConcepts": [
              "Equivalence in translation: Formal equivalence (literal fidelity) vs Dynamic / Functional equivalence (meaning fidelity)",
              "Literal translation pitfalls and false friends in multilingual contexts",
              "Official governance terminology: 'Resolution' = Formal proposal adopted by a body; 'Consensus' = General agreement; 'Remuneration' = Financial compensation for service",
              "Translating institutional titles, cultural metaphors, and administrative registers accurately"
            ],
            "studyNotes": [
              "Literal word-for-word translation frequently fails for idioms: Idiomatic expressions must be translated by dynamic equivalence to convey true cultural meaning.",
              "'Postponed' means deferred to a future date, whereas 'Cancelled' means completely annulled or terminated.",
              "'Transparency' in administrative contexts denotes open, visible governance; 'Accountability' denotes responsibility to explain decisions and answer to the public."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-6-1-1",
                "question": "In administrative and legal terminology, which English phrase accurately corresponds to a mechanism established for receiving and resolving citizen complaints?",
                "options": [
                  "Public Grievance Redressal Mechanism",
                  "Civil Service Examination Procedure",
                  "Public Finance Auditing System",
                  "Legislative Assembly Resolution"
                ],
                "correctAnswer": 0,
                "explanation": "'Public Grievance Redressal Mechanism' is the official standard designation for institutional systems created to resolve complaints and grievances from the public."
              },
              {
                "id": "ge-mcq-6-1-2",
                "question": "In good governance, the administrative concept of 'Transparency' is formally defined as:",
                "options": [
                  "Operating in an open, clear, and accessible manner without hidden agendas",
                  "Maintaining strict confidentiality of public records",
                  "Strict obedience to senior executive orders",
                  "Arbitrary decision-making by authorities"
                ],
                "correctAnswer": 0,
                "explanation": "'Transparency' denotes open, ethical governance wherein official actions, budgetary allocations, and decisions are open and verifiable by the citizenry."
              }
            ]
          },
          {
            "id": "ge-u6-c1-l2",
            "lessonNumber": "6.2",
            "title": "Syntactic Structural Shifts: SVO Syntax & Word Order Transformations",
            "duration": "35 mins",
            "keyConcepts": [
              "Word Order divergence: English follows Subject-Verb-Object (SVO) sequence; head-final languages follow Subject-Object-Verb (SOV) sequence",
              "Placement of Adjectives, Adverbs, and Relative Clauses across syntactic structures",
              "Prepositions in English vs Postpositional suffixes in head-final syntax (e.g., 'on the table', 'in the city', 'with integrity')",
              "Maintaining clarity, grammatical agreement, and natural cadence in translated sentences"
            ],
            "studyNotes": [
              "English canonical word order: Subject (S) + Finite Verb (V) + Object (O) + Adverbial Modifier (A).",
              "When translating into SOV syntax, the finite verb moves to the terminal sentence position, with case relations marked by suffixes or postpositions.",
              "Care must be exercised so that grammatical case, tense aspect, and voice are systematically preserved."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-6-1-3",
                "question": "When translating English sentences following Subject-Verb-Object (SVO) order into Subject-Object-Verb (SOV) structures, what is the primary syntactic transformation?",
                "options": [
                  "The finite verb is transposed to the final sentence position after the object",
                  "The subject must always be deleted from the sentence",
                  "Prepositions remain unchanged before nouns",
                  "The object is placed before the subject"
                ],
                "correctAnswer": 0,
                "explanation": "In SOV syntactic structures, the finite verb moves to the terminal sentence position following both the subject and the object."
              },
              {
                "id": "ge-mcq-6-1-4",
                "question": "Which of the following demonstrates the standard grammatical word order for an active declarative sentence in English?",
                "options": [
                  "The students are working hard for the examination.",
                  "The students hard working examination for.",
                  "For examination students working hard.",
                  "Examination working hard the students."
                ],
                "correctAnswer": 0,
                "explanation": "Standard English declarative syntax strictly follows Subject ('The students') + Verb ('are working') + Manner ('hard') + Prepositional Object ('for the examination')."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u6-c2",
        "chapterNumber": 2,
        "title": "Tense & Voice Translation Systems",
        "lessons": [
          {
            "id": "ge-u6-c2-l1",
            "lessonNumber": "6.3",
            "title": "Tense-Related Translation Tasks across Past, Present & Future",
            "duration": "35 mins",
            "keyConcepts": [
              "Translating Present Continuous: Expressing ongoing present action with appropriate auxiliary and participle",
              "Translating Present Perfect: Indicating an immediate or relevant past completion with present consequence",
              "Translating Past Continuous: Depicting an action in progress in the past interrupted by another event",
              "Translating Future Perfect: Denoting an action that will be completed prior to a designated future time"
            ],
            "studyNotes": [
              "Aspectual nuances must be preserved: Simple Present (habitual/general fact) differs from Present Continuous (action happening at the moment of speech).",
              "Conditional tenses: 'If the rainfall fails, the administration will implement emergency water supplies.'",
              "Ensure consistency between time adverbials ('just now', 'yesterday', 'next week') and the corresponding verb tense form."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-6-2-1",
                "question": "Identify the tense aspect of the sentence: 'The international conference has just concluded':",
                "options": [
                  "Present Perfect Tense indicating an immediate past completion",
                  "Simple Future Tense indicating an upcoming event",
                  "Past Continuous Tense indicating an ongoing past event",
                  "Present Continuous Tense indicating current action"
                ],
                "correctAnswer": 0,
                "explanation": "'Has just concluded' employs the auxiliary 'has' with the past participle 'concluded' to signify the Present Perfect aspect of immediate completion."
              },
              {
                "id": "ge-mcq-6-2-2",
                "question": "Choose the grammatically accurate English sentence indicating a scheduled executive policy announcement next month:",
                "options": [
                  "The government will release a new policy next month.",
                  "The government released a new policy next month.",
                  "The government has released a new policy next month.",
                  "The government was releasing a new policy next month."
                ],
                "correctAnswer": 0,
                "explanation": "Future events scheduled for 'next month' require the future modal auxiliary 'will' with base verb: 'will release'."
              }
            ]
          },
          {
            "id": "ge-u6-c2-l2",
            "lessonNumber": "6.4",
            "title": "Active and Passive Voice Translation Tasks",
            "duration": "35 mins",
            "keyConcepts": [
              "Passive voice markers: Form of auxiliary 'be' + Past Participle (V3) + optional prepositional by-phrase",
              "Active Voice: Subject acts as the direct agent of the verb ('The Governor presented the national awards')",
              "Passive Voice: Subject undergoes the action of the verb ('The national awards were presented by the Governor')",
              "Official gazettes, notifications, and administrative records predominantly rely on impersonal passive constructions ('It is hereby notified that...')"
            ],
            "studyNotes": [
              "In official administrative registers, passive voice is frequently employed to emphasize the action or outcome rather than the individual agent.",
              "When converting active sentences to passive, the tense of the original verb is preserved via the auxiliary 'be' (e.g. 'inaugurated' => 'was inaugurated').",
              "'It has been resolved that...' serves as a standard preamble for official meeting resolutions."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-6-2-3",
                "question": "In passive voice translation tasks, what grammatical transformation occurs to the active sentence: 'The Chief Minister inaugurated the new bridge yesterday'?",
                "options": [
                  "The new bridge was inaugurated by the Chief Minister yesterday.",
                  "The Chief Minister was inaugurated by the new bridge yesterday.",
                  "The new bridge inaugurated the Chief Minister yesterday.",
                  "The Chief Minister has been inaugurating the new bridge yesterday."
                ],
                "correctAnswer": 0,
                "explanation": "In passive voice, the active object ('the new bridge') becomes the grammatical subject, followed by 'was inaugurated by' and the agent."
              },
              {
                "id": "ge-mcq-6-2-4",
                "question": "Select the sentence correctly structured in the passive voice:",
                "options": [
                  "This official document was verified by the competent authorities.",
                  "This official document verifying the competent authorities.",
                  "Authorities was verify this official document.",
                  "This official document has verifying competent authorities."
                ],
                "correctAnswer": 0,
                "explanation": "'This official document was verified by...' correctly follows the passive structure: Subject + Past form of 'be' + Past Participle + by-agent."
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": 7,
    "unitNumber": "Unit VII",
    "title": "Literary Works",
    "questionCount": 15,
    "standard": "SSLC Standard (School Textbooks)",
    "officialTopics": [
      "Figures of Speech; Appreciation and Analysis of Poetry; Lines of Significance",
      "30 Prescribed Poems: I Dream of Spices – Raj Arumugam; The Crocodile – Lewis Carroll; Teamwork – Edgar Albert Guest; From a Railway Carriage – Robert Louis Balfour Stevenson; A Tragic Story – William Makepeace Thackeray; Sea Fever – John Masefield; Courage – Edgar Albert Guest; The Age of Chivalry – George Krokos; Wandering Singers – Sarojini Naidu; The Listeners – Walter de la Mare; Your Space – David Bates; Special Hero – Christine M. Kerschen; Stopping by Woods on a Snowy Evening – Robert Frost; Leisure – William Henry Davies; A Poison Tree – William Blake; The Power of a Smile – Tupac Shakur; On Killing a Tree – Gieve Patel; Advice from a Tree – Ilan Shamir; The Spider and The Fly – Mary Howitt; Never Trust a Mirror – Erin Hanson; The River – Caroline Ann Bowles / Ilan Shamir; Nature the Gentlest Mother – Emily Dickinson; The Comet – Norman Littleford; The Star – Jane Taylor; The Stick-Together Families – Edgar Albert Guest; Memories of My Dad – Rebecca D. Cook; Life – Henry Van Dyke; The Grumble Family – L.M. Montgomery; The Secret of the Machines – Rudyard Kipling; The House on Elm Street – Nadia Bush.",
      "29 Prescribed Prose Works: His First Flight – Liam O’ Flaherty; The Night the Ghost Got In – James Grover Thurber; Empowered Women Navigating the World; The Attic – Satyajit Ray; Tech Bloomers; The Last Lesson – Alphonse Daudet; The Dying Detective – Arthur Conan Doyle; Learning The Game – Sachin Ramesh Tendulkar; I Can’t Climb Trees Anymore – Ruskin Bond; Old Man River – Dorothy Deming (Drama); Seventeen Oranges – Bill Naughton; Water – The Elixir of Life – Sir C.V. Raman; From Zero to Infinity – Biography of Srinivasa Ramanujan; A Birthday Letter – Jawaharlal Nehru; The Nose Jewel – C. Rajagopalachari; Hobby – Turns A Successful Career; Sir Isaac Newton – The Ingenious Scientist – Nathaniel Hawthorne; My Reminiscence – Rabindranath Tagore; Sea Turtles – Shekhar Dattatri; When the Trees Walked – Ruskin Bond; A Visitor from Distant Lands; Sports Stars – Mithali Dorai Raj; The Last Stone Carver – Sigrun Srivastav; Eidgah – Munshi Premchand; The Wind on Haunted Hill – Ruskin Bond; A Prayer to the Teacher – Subroto Bagchi; The Tempest – Tales From Shakespeare; A Hunter Turned Naturalist – Jim Corbett; The Cat and the Painkiller – Mark Twain."
    ],
    "chapters": [
      {
        "id": "ge-u7-c1",
        "chapterNumber": 1,
        "title": "Prescribed Poetry Collection I (Poems 1 to 15)",
        "lessons": [
          {
            "id": "ge-u7-c1-l1",
            "lessonNumber": "7.1",
            "title": "Prescribed Poems 1 to 8: Nature, Courage, Rhythm & Ballads",
            "duration": "45 mins",
            "keyConcepts": [
              "1. 'I Dream of Spices' – Raj Arumugam (Muthu's market errand for cinnamon, cardamom, ginger and garlic, returning with sesame seeds and onions)",
              "2. 'The Crocodile' – Lewis Carroll (Parody of Isaac Watts, crocodile on the Nile grinning cheerfully and pouring water on golden scales)",
              "3. 'Teamwork' – Edgar Albert Guest (Cooperation, camaraderie, selfless contribution over individual glory)",
              "4. 'From a Railway Carriage' – Robert Louis Stevenson (Fast rhythm of train journey: 'Faster than fairies, faster than witches', rhyming couplets)",
              "5. 'A Tragic Story' – William Makepeace Thackeray (Humorous ballad about a sage and his revolving pigtail)",
              "6. 'Sea Fever' – John Masefield ('I must go down to the seas again, to the lonely sea and the sky', vagrant gypsy life)",
              "7. 'Courage' – Edgar Albert Guest (True courage as an enduring moral virtue, not a sudden flash)",
              "8. 'The Age of Chivalry' – George Krokos (Knights of old, honor, virtue, and timeless moral codes)"
            ],
            "studyNotes": [
              "John Masefield was Poet Laureate of the United Kingdom; 'Sea Fever' uses rhythm mimicking ocean swells.",
              "Robert Louis Stevenson: 'From a Railway Carriage' captures visual vignettes seen from a moving train ('Here is a child who clambers and scrambles... Each a glimpse and gone forever!').",
              "Edgar Guest was known as 'The People's Poet'; emphasizes collective spirit in 'Teamwork' and perseverance in 'Courage'."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-1-1",
                "question": "Who wrote the famous line 'I must go down to the seas again, to the lonely sea and the sky'?",
                "options": [
                  "Robert Frost",
                  "John Masefield",
                  "William Blake",
                  "Walter de la Mare"
                ],
                "correctAnswer": 1,
                "explanation": "The line opens the celebrated poem 'Sea Fever' authored by John Masefield."
              },
              {
                "id": "ge-mcq-7-1-2",
                "question": "In Raj Arumugam's poem 'I Dream of Spices', what was Muthu asked to buy from the market by his mother?",
                "options": [
                  "Cinnamon, cardamom, ginger and garlic",
                  "Sesame seeds, onions, tomatoes and pickles",
                  "Pepper, coriander, cumin and cloves",
                  "Rice, wheat, sugar and salt"
                ],
                "correctAnswer": 0,
                "explanation": "Muthu's mother sent him to buy 'cinnamon, cardamom, ginger and garlic', but he daydreamed and returned with sesame seeds and onions."
              }
            ]
          },
          {
            "id": "ge-u7-c1-l2",
            "lessonNumber": "7.2",
            "title": "Prescribed Poems 9 to 15: Wandering Singers to A Poison Tree",
            "duration": "45 mins",
            "keyConcepts": [
              "9. 'Wandering Singers' – Sarojini Naidu (Folk minstrels: 'All men are our kindred, the world is our home', lute music)",
              "10. 'The Listeners' – Walter de la Mare ('Is there anybody there? said the Traveller', phantom listeners in dark forest)",
              "11. 'Your Space' – David Bates (Treating everyone with gentleness and respecting individual dignity)",
              "12. 'Special Hero' – Christine M. Kerschen (Tribute to fatherly affection and unconditional protective care)",
              "13. 'Stopping by Woods on a Snowy Evening' – Robert Frost ('The woods are lovely, dark and deep, / But I have promises to keep, / And miles to go before I sleep')",
              "14. 'Leisure' – William Henry Davies ('What is this life if, full of care, / We have no time to stand and stare')",
              "15. 'A Poison Tree' – William Blake (Wrath harbored against a foe grows into a deceptive poison apple; antithesis and metaphor)"
            ],
            "studyNotes": [
              "Robert Frost: The repeating final lines 'And miles to go before I sleep' signify life's duties and social commitments before death.",
              "William Blake in 'A Poison Tree' contrasts expressing anger to a friend (anger ends) with concealing anger from a foe (anger grows into deadly poison).",
              "Sarojini Naidu ('The Nightingale of India') highlights the pan-human brotherhood of folk singers roaming with lutes."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-1-3",
                "question": "Identify the author of the lines: 'What is this life if, full of care, / We have no time to stand and stare?'",
                "options": [
                  "William Henry Davies",
                  "Robert Frost",
                  "William Wordsworth",
                  "Emily Dickinson"
                ],
                "correctAnswer": 0,
                "explanation": "These memorable opening lines belong to the poem 'Leisure' composed by William Henry Davies."
              },
              {
                "id": "ge-mcq-7-1-4",
                "question": "In William Blake's 'A Poison Tree', what grew from the speaker's harboured wrath and deceitful tears?",
                "options": [
                  "A golden rose",
                  "A bright poison apple",
                  "A thorny briar",
                  "A sweet cherry"
                ],
                "correctAnswer": 1,
                "explanation": "The wrath nourished by tears and sunned with smiles blossomed into an apple bright, tempting the enemy."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u7-c2",
        "chapterNumber": 2,
        "title": "Prescribed Poetry Collection II (Poems 16 to 30)",
        "lessons": [
          {
            "id": "ge-u7-c2-l1",
            "lessonNumber": "7.3",
            "title": "Prescribed Poems 16 to 23: Environmental Ethics, Moral Parables & Cosmos",
            "duration": "45 mins",
            "keyConcepts": [
              "16. 'The Power of a Smile' – Tupac Shakur (Healing power of genuine positivity and inner strength)",
              "17. 'On Killing a Tree' – Gieve Patel (Ironical poem showing that a simple jab of a knife cannot kill a tree; its roots must be pulled out completely)",
              "18. 'Advice from a Tree' – Ilan Shamir (Stand tall and proud, go out on a limb, remember your roots, drink plenty of water)",
              "19. 'The Spider and The Fly' – Mary Howitt ('Will you walk into my parlour? said the Spider to the Fly'; cautionary tale against flattery)",
              "20. 'Never Trust a Mirror' – Erin Hanson (True beauty is inner essence, compassion, and thoughts, not superficial reflection)",
              "21. 'The River' – Caroline Ann Bowles / Ilan Shamir (River journey mirroring life stages: childhood, youth, maturity, eternity in ocean)",
              "22. 'Nature the Gentlest Mother' – Emily Dickinson (Personification of Nature tenderly caring for all flora and fauna)",
              "23. 'The Comet' – Norman Littleford (Magnificent celestial journey of a comet speeding through space)"
            ],
            "studyNotes": [
              "Gieve Patel, a medical doctor and poet, depicts the cruel systematic uprooting, browning, and hardening required to kill a tree.",
              "Mary Howitt's 'The Spider and The Fly' is one of the most celebrated moral fables in English literature warning against treacherous vanity.",
              "Emily Dickinson uses gentle personification to portray Nature as a soothing maternal figure resting her household at dusk."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-2-1",
                "question": "Who wrote the famous cautionary poem opening with 'Will you walk into my parlour? said the Spider to the Fly'?",
                "options": [
                  "Mary Howitt",
                  "Jane Taylor",
                  "Erin Hanson",
                  "Emily Dickinson"
                ],
                "correctAnswer": 0,
                "explanation": "The poem 'The Spider and the Fly' was composed by Mary Howitt as a moral warning against flattering deceivers."
              },
              {
                "id": "ge-mcq-7-2-2",
                "question": "According to Gieve Patel in 'On Killing a Tree', what is the most sensitive part of the tree that anchors it to the earth?",
                "options": [
                  "The green boughs",
                  "The root hidden in the earth cave",
                  "The bark",
                  "The leaves"
                ],
                "correctAnswer": 1,
                "explanation": "The root, hidden white and wet inside the earth cave for years, is the most sensitive and vital source of the tree's strength."
              }
            ]
          },
          {
            "id": "ge-u7-c2-l2",
            "lessonNumber": "7.4",
            "title": "Prescribed Poems 24 to 30: The Star to The House on Elm Street",
            "duration": "45 mins",
            "keyConcepts": [
              "24. 'The Star' – Jane Taylor ('Twinkle, twinkle, little star, / How I wonder what you are!')",
              "25. 'The Stick-Together Families' – Edgar Albert Guest (Glories of united families supporting each other through life's trials)",
              "26. 'Memories of My Dad' – Rebecca D. Cook (Poignant reflection on a father's guiding wisdom and enduring love)",
              "27. 'Life' – Henry Van Dyke (Sonnet advocating living life with courage, forward zest, and without regrets: 'Let me but live my life from year to year')",
              "28. 'The Grumble Family' – L.M. Montgomery (Satirizing perpetual complainers who live on 'Complaining Street' in the city of 'Never-Are-Satisfied')",
              "29. 'The Secret of the Machines' – Rudyard Kipling (Industrial machines: 'We were taken from the ore-bed and the mine... We can pull and haul and push and lift and drive')",
              "30. 'The House on Elm Street' – Nadia Bush (Atmospheric mystery of an enigmatic deserted house standing alone)"
            ],
            "studyNotes": [
              "Rudyard Kipling personifies modern machinery in 'The Secret of the Machines', concluding that though machines possess immense physical power, they are 'nothing more than children of your brain' and lack moral law/feeling.",
              "Henry Van Dyke's 'Life' is a Petrarchan sonnet that emphasizes optimism: 'So let the way wind up the hill or down... Still seeking what I sought when but a boy'.",
              "L.M. Montgomery's 'The Grumble Family' teaches the psychological lesson to avoid the infectious habit of grumbling."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-2-3",
                "question": "In Rudyard Kipling's 'The Secret of the Machines', what vital warning do the machines give to humanity?",
                "options": [
                  "They need fuel to survive.",
                  "They have no moral law and cannot forgive a lie or human error.",
                  "They will rule the planet.",
                  "They refuse to pull and haul."
                ],
                "correctAnswer": 1,
                "explanation": "The machines warn: 'Remember, please, the Law by which we live, / We are not built to comprehend a lie, / We can neither love nor pity nor forgive.'"
              },
              {
                "id": "ge-mcq-7-2-4",
                "question": "Where does the 'Grumble Family' live according to L.M. Montgomery?",
                "options": [
                  "Complaining Street in the city of Never-Are-Satisfied",
                  "Elm Street",
                  "Baker Street",
                  "Sunny Valley"
                ],
                "correctAnswer": 0,
                "explanation": "L.M. Montgomery humorously places them on 'Complaining Street' by the River of Discontent in the city of 'Never-Are-Satisfied'."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u7-c3",
        "chapterNumber": 3,
        "title": "Prescribed Prose Collection I (Prose 1 to 15)",
        "lessons": [
          {
            "id": "ge-u7-c3-l1",
            "lessonNumber": "7.5",
            "title": "Prescribed Prose 1 to 5: His First Flight to Tech Bloomers",
            "duration": "45 mins",
            "keyConcepts": [
              "1. 'His First Flight' – Liam O’ Flaherty (Young seagull overcoming fear of flight motivated by maternal hunger trick)",
              "2. 'The Night the Ghost Got In' – James Grover Thurber (Hilarious nocturnal chaos involving imaginary ghost, bodkin shoes, grandfather and police)",
              "3. 'Empowered Women Navigating the World' (All-women Indian Navy crew of INSV Tarini circumnavigating the globe - Navika Sagar Parikrama under Lt Cdr Vartika Joshi)",
              "4. 'The Attic' – Satyajit Ray (Aditya returning to his native ancestral home after 29 years to return a medal stolen in childhood from Sasanka Sanyal)",
              "5. 'Tech Bloomers' (Assistive technology transforming lives of differently-abled people like Alisha and David)"
            ],
            "studyNotes": [
              "Liam O'Flaherty's 'His First Flight' represents the universal truth that taking the first step requires courage and necessity.",
              "Navika Sagar Parikrama was the historic mission by 6 Indian female naval officers circumnavigating 21,600 nautical miles.",
              "Satyajit Ray's 'The Attic' touches upon guilt, redemption, and human dignity."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-3-1",
                "question": "In Liam O'Flaherty's 'His First Flight', what prompted the young seagull to finally dive off the ledge?",
                "options": [
                  "Sight of a hawk",
                  "His mother showing a piece of fish",
                  "A gust of strong wind",
                  "A push by his siblings"
                ],
                "correctAnswer": 1,
                "explanation": "Maddened by hunger, the young seagull dived at the fish held by his mother, which forced his wings to spread and initiate flight."
              },
              {
                "id": "ge-mcq-7-3-2",
                "question": "Who was the skipper and leader of the all-women Indian Navy crew on INSV Tarini?",
                "options": [
                  "Lt Cdr Vartika Joshi",
                  "Lt Pratibha Jamwal",
                  "Lt Aishwarya Boddapati",
                  "Lt Shougrakpam Vijaya Devi"
                ],
                "correctAnswer": 0,
                "explanation": "Lieutenant Commander Vartika Joshi commanded the historic Navika Sagar Parikrama mission aboard INSV Tarini."
              }
            ]
          },
          {
            "id": "ge-u7-c3-l2",
            "lessonNumber": "7.6",
            "title": "Prescribed Prose 6 to 10: The Last Lesson to Old Man River",
            "duration": "45 mins",
            "keyConcepts": [
              "6. 'The Last Lesson' – Alphonse Daudet (Prussian annexation of Alsace-Lorraine; M. Hamel's emotional final French class; linguistic pride)",
              "7. 'The Dying Detective' – Arthur Conan Doyle (Sherlock Holmes feigning deadly Tarpaunli fever to trap Culverton Smith into a confession for Victor Savage's murder)",
              "8. 'Learning The Game' – Sachin Ramesh Tendulkar (Early cricket coaching under Ramakant Achrekar at Shivaji Park, one-rupee coin challenge, bus travel)",
              "9. 'I Can’t Climb Trees Anymore' – Ruskin Bond (Nostalgic return to childhood house in Dehradun, meeting a young girl, retrieving iron cross from jackfruit tree)",
              "10. 'Old Man River' – Dorothy Deming (One-act drama portraying children stranded during a flash flood, demonstrating presence of mind and Red Cross rescue)"
            ],
            "studyNotes": [
              "Alphonse Daudet: M. Hamel's patriotic statement: 'When a people are enslaved, as long as they hold fast to their language it is as if they had the key to their prison.' Writes 'Vive La France!'.",
              "Arthur Conan Doyle: Holmes uses Watson's sincere ignorance to make his illness convincing to Culverton Smith.",
              "Sachin Tendulkar attributes his cricket stamina to Coach Achrekar placing a one-rupee coin on the stumps during net practice."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-3-3",
                "question": "In 'The Last Lesson' by Alphonse Daudet, what were the final words written by M. Hamel on the blackboard?",
                "options": [
                  "Vive La France!",
                  "Au Revoir!",
                  "Liberté, Égalité, Fraternité",
                  "Adieu Alsace"
                ],
                "correctAnswer": 0,
                "explanation": "Overcome with patriotic emotion, M. Hamel took a piece of chalk and wrote as large as he could: 'Vive La France!' (Long Live France!)."
              },
              {
                "id": "ge-mcq-7-3-4",
                "question": "Who was Sachin Tendulkar's revered childhood cricket coach mentioned in 'Learning The Game'?",
                "options": [
                  "Ramakant Achrekar",
                  "Ajit Tendulkar",
                  "Sunil Gavaskar",
                  "Kapil Dev"
                ],
                "correctAnswer": 0,
                "explanation": "Sachin received his foundational coaching at Shivaji Park from the legendary coach Ramakant Achrekar."
              }
            ]
          },
          {
            "id": "ge-u7-c3-l3",
            "lessonNumber": "7.7",
            "title": "Prescribed Prose 11 to 15: Seventeen Oranges to The Nose Jewel",
            "duration": "45 mins",
            "keyConcepts": [
              "11. 'Seventeen Oranges' – Bill Naughton (Narrator caught stealing seventeen oranges at the docks, swallows them all—pips and peels—to destroy evidence before Policeman Pongo)",
              "12. 'Water – The Elixir of Life' – Sir C.V. Raman (Water as the true nectar of life; soil erosion, silt deposition, check dams, afforestation, harnessing waterways)",
              "13. 'From Zero to Infinity' (Biography of mathematical genius Srinivasa Ramanujan, Hardy-Ramanujan number 1729, mock theta functions)",
              "14. 'A Birthday Letter' – Jawaharlal Nehru (Letter written from Naini Central Prison on Indira's 13th birthday, praising Joan of Arc, truthfulness, and Gandhi's satyagraha)",
              "15. 'The Nose Jewel' – C. Rajagopalachari (Male and female sparrow discussion in Ramayya's house roof; diamond mucku-thi discarded in muck-heap causing police suspicion)"
            ],
            "studyNotes": [
              "Sir C.V. Raman highlights the Libyan desert vs the fertile Nile Valley in Egypt, created entirely by the silt-laden waters of the River Nile.",
              "Number 1729: Smallest number expressible as the sum of two cubes in two different ways (1^3 + 12^3 = 10^3 + 9^3).",
              "Rajagopalachari's 'The Nose Jewel' offers a moral lesson that coveting others' wealth breeds lifelong dread and remorse."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-3-5",
                "question": "According to Sir C.V. Raman in 'Water – The Elixir of Life', which river created the fertile soil of Egypt out of the desert?",
                "options": [
                  "River Nile",
                  "River Amazon",
                  "River Danube",
                  "River Ganges"
                ],
                "correctAnswer": 0,
                "explanation": "Sir C.V. Raman notes that Egypt was made by its river; the ancient civilization was sustained by the life-giving waters of the Nile."
              },
              {
                "id": "ge-mcq-7-3-6",
                "question": "What is the mathematical significance of the Hardy-Ramanujan number 1729?",
                "options": [
                  "The largest prime number known in the 20th century",
                  "The smallest number expressible as the sum of two cubes in two different ways",
                  "The ratio of a circle's diameter to its perimeter",
                  "The base of natural logarithms"
                ],
                "correctAnswer": 1,
                "explanation": "1729 is the smallest integer expressible as the sum of two cubes in two distinct ways (1729 = 1^3 + 12^3 = 9^3 + 10^3)."
              }
            ]
          }
        ]
      },
      {
        "id": "ge-u7-c4",
        "chapterNumber": 4,
        "title": "Prescribed Prose Collection II & Poetic Devices",
        "lessons": [
          {
            "id": "ge-u7-c4-l1",
            "lessonNumber": "7.8",
            "title": "Prescribed Prose 16 to 22: Hobby to Sports Stars",
            "duration": "45 mins",
            "keyConcepts": [
              "16. 'Hobby – Turns A Successful Career' (Mani, Ajay Kumar Garg miniature artist, Ilavazhagi carrom champion)",
              "17. 'Sir Isaac Newton – The Ingenious Scientist' – Nathaniel Hawthorne (Newton's childhood windmills, water clocks, sundials, universal gravitation)",
              "18. 'My Reminiscence' – Rabindranath Tagore (Tagore's nostalgic memories of the riverside villa on the Ganges at Chandernagore)",
              "19. 'Sea Turtles' – Shekhar Dattatri (Seven species of sea turtles; Olive Ridley mass nesting / Arribada on Odisha coast)",
              "20. 'When the Trees Walked' – Ruskin Bond (Grandfather planting saplings in the rocky dry riverbed; affection for banyan and peepul trees)",
              "21. 'A Visitor from Distant Lands' (History of vegetables: Chilies brought to India by Portuguese via Vasco da Gama; potatoes, tomatoes)",
              "22. 'Sports Stars' (Mithali Dorai Raj, Smriti Mandhana, Harmanpreet Kaur and the revolution in Indian women's cricket)"
            ],
            "studyNotes": [
              "Ajay Kumar Garg: Differently-abled artist trained by Shri Ashua, awarded by Dr. APJ Abdul Kalam.",
              "Olive Ridley turtles practice 'Arribada' (mass nesting), where thousands of females lay eggs on sandy beaches simultaneously.",
              "Nathaniel Hawthorne highlights Newton's boyhood curiosity in constructing a working miniature windmill powered by a mouse."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-4-1",
                "question": "What is the mass nesting phenomenon of Olive Ridley sea turtles along the coast called?",
                "options": [
                  "Arribada",
                  "Metamorphosis",
                  "Echolocation",
                  "Hibernation"
                ],
                "correctAnswer": 0,
                "explanation": "'Arribada' is the Spanish term specifically used to designate the mass arribal and simultaneous egg-laying of Olive Ridley turtles."
              },
              {
                "id": "ge-mcq-7-4-2",
                "question": "In 'Sir Isaac Newton' by Nathaniel Hawthorne, what curious animal did young Isaac place inside his windmill model to turn the sails?",
                "options": [
                  "A pet hamster",
                  "A mouse called 'The Miller'",
                  "A tiny sparrow",
                  "A squirrel"
                ],
                "correctAnswer": 1,
                "explanation": "Newton harnessed a small mouse, humorously dubbed 'The Miller', whose attempts to reach grain turned the windmill sails."
              }
            ]
          },
          {
            "id": "ge-u7-c4-l2",
            "lessonNumber": "7.9",
            "title": "Prescribed Prose 23 to 29: The Last Stone Carver to The Cat and the Painkiller",
            "duration": "45 mins",
            "keyConcepts": [
              "23. 'The Last Stone Carver' – Sigrun Srivastav (Old master craftsman sculpting Krishna statue, abandoned by son Gopal, but found assisted by servant boy Salim)",
              "24. 'Eidgah' – Munshi Premchand (Young orphan Hamid with three paise buys a pair of tongs / chimta for his grandmother Amina instead of toys and sweets)",
              "25. 'The Wind on Haunted Hill' – Ruskin Bond (Usha, Suresh, and Binya caught in a fierce thunderstorm in ruins on Haunted Hill)",
              "26. 'A Prayer to the Teacher' – Subroto Bagchi (Address to educators advocating empathy, ecological consciousness, resilience, and ethical questioning)",
              "27. 'The Tempest' – Tales From Shakespeare (Prospero, Miranda, Ariel, Caliban, Ferdinand, shipwreck on enchanted island)",
              "28. 'A Hunter Turned Naturalist' – Jim Corbett (Corbett's transformation from hunter to conservationist; shooting man-eaters of Kumaon with camera)",
              "29. 'The Cat and the Painkiller' – Mark Twain (Tom Sawyer administering Aunt Polly's foul patent medicine to Peter the cat, causing comic frenzy)"
            ],
            "studyNotes": [
              "Munshi Premchand's 'Eidgah' captures deep filial empathy: Hamid notices his grandmother burns her fingers on the iron griddle and sacrifices his festive treats.",
              "Subroto Bagchi emphasizes: 'Teach me to appreciate beauty in diversity, and let me learn to stand alone against popular consensus when truth demands it.'",
              "Mark Twain extracts this hilarious episode from 'The Adventures of Tom Sawyer', portraying Tom's reaction to Aunt Polly's quack therapies."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-4-3",
                "question": "In Munshi Premchand's 'Eidgah', what does young Hamid buy at the fair with his three paise?",
                "options": [
                  "A clay soldier",
                  "A pair of iron tongs (chimta)",
                  "A bag of sesame sweets",
                  "A whistle"
                ],
                "correctAnswer": 1,
                "explanation": "Hamid thoughtfully buys a pair of tongs to protect his grandmother Amina's fingers from getting burned while baking rotis."
              },
              {
                "id": "ge-mcq-7-4-4",
                "question": "In Mark Twain's 'The Cat and the Painkiller', what was the name of Aunt Polly's yellow cat?",
                "options": [
                  "Tom",
                  "Peter",
                  "Oliver",
                  "Cheshire"
                ],
                "correctAnswer": 1,
                "explanation": "Aunt Polly's cat was named Peter, who somersaulted wildly around the room after swallowing the painkiller."
              }
            ]
          },
          {
            "id": "ge-u7-c4-l3",
            "lessonNumber": "7.10",
            "title": "Figures of Speech, Appreciation & Poetic Devices Analysis across SSLC Works",
            "duration": "45 mins",
            "keyConcepts": [
              "Figures of Speech in Prescribed Poems: Simile, Metaphor, Personification, Alliteration, Assonance, Onomatopoeia, Hyperbole, Anaphora",
              "Rhyme Scheme analysis across prescribed stanzas (e.g., AABA in Frost's 'Stopping by Woods')",
              "Lines of Significance identification: Attributing famous lines to poem and poet",
              "Appreciation questions: Tone, imagery, symbolism, message, and structural devices"
            ],
            "studyNotes": [
              "Alliteration: Repetition of consonant sounds at the start of words ('Faster than fairies, faster than witches').",
              "Personification: Giving human qualities to non-human things ('The sea is a hungry dog', 'The wind stood up and gave a shout').",
              "Anaphora: Repetition of words at the start of successive lines ('We can pull and haul and push and lift and drive / We can print and plough and weave and heat and light').",
              "Metaphor: Direct implicit comparison without 'like' or 'as' ('The road was a ribbon of moonlight')."
            ],
            "practiceQuestions": [
              {
                "id": "ge-mcq-7-4-5",
                "question": "Identify the figure of speech in the line: 'Faster than fairies, faster than witches':",
                "options": [
                  "Alliteration",
                  "Simile",
                  "Metaphor",
                  "Oxymoron"
                ],
                "correctAnswer": 0,
                "explanation": "The repetition of the initial consonant 'f' sound in 'faster than fairies' exemplifies Alliteration."
              },
              {
                "id": "ge-mcq-7-4-6",
                "question": "What is the rhyme scheme of the first stanza of Robert Frost's 'Stopping by Woods on a Snowy Evening'?\n'Whose woods these are I think I know. (a)\nHis house is in the village though; (a)\nHe will not see me stopping here (b)\nTo watch his woods fill up with snow. (a)'",
                "options": [
                  "A B A B",
                  "A A B A",
                  "A A B B",
                  "A B B A"
                ],
                "correctAnswer": 1,
                "explanation": "Lines 1, 2, and 4 rhyme ('know', 'though', 'snow'), while line 3 ('here') differs, creating the classic Frostian chain rhyme AABA."
              }
            ]
          }
        ]
      }
    ]
  }
]
