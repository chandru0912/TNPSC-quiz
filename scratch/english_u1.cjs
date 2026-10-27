// Unit 1: Grammar (25 Questions)
module.exports = {
  id: 1,
  unitNumber: "Unit I",
  title: "Grammar",
  questionCount: 25,
  standard: "SSLC Standard (10th Standard)",
  officialTopics: [
    "Parts of speech, Concord, Tense, Active voice and passive voice",
    "Types of sentences: Statement, Interrogative, Imperative, Exclamatory and Transformations (Statements into Imperatives, Interrogatives into Statements, Assertives into Negatives, Exclamatory into Statement, Imperatives into Inquisitive Interrogatives, Imperatives into Appreciative Statements)",
    "Verbs: Main Verbs and Auxiliary Verbs, Regular and Irregular Verbs, Infinitives, Gerunds, Participles",
    "Question tags, Sentence patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA), Simple, Compound and Complex sentences",
    "Phrases and clauses, Degrees of comparison (Positive, Comparative, Superlative), Direct into Indirect and Indirect to Direct, Synthesis of sentences, Punctuations"
  ],
  chapters: [
    {
      id: "ge-u1-c1",
      chapterNumber: 1,
      title: "Parts of Speech, Concord & Tense Forms",
      lessons: [
        {
          id: "ge-u1-c1-l1",
          lessonNumber: "1.1",
          title: "Parts of Speech & Functional Word Classes",
          duration: "35 mins",
          keyConcepts: [
            "8 Parts of Speech: Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection",
            "Nouns: Common, Proper, Collective, Abstract, Material",
            "Adjectives vs Adverbs: Modifying nouns vs modifying verbs/adjectives",
            "Prepositions of Time, Place, and Direction"
          ],
          studyNotes: [
            "A word's part of speech depends on its syntactic function in a sentence, not its form alone (e.g., 'fast' in 'a fast train' is an adjective, but in 'he ran fast' is an adverb).",
            "Collective nouns take singular verbs when considered as a unified body ('The committee has submitted its report') and plural verbs when individuals act separately ('The committee were divided in their votes').",
            "Prepositions show relational links between a noun/pronoun and other elements: 'between' for two entities, 'among' for three or more."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-1-1",
              question: "Identify the part of speech of the underlined word: 'She looked <u>above</u> at the sparkling stars.'",
              options: ["Preposition", "Adverb", "Noun", "Conjunction"],
              correctAnswer: 1,
              explanation: "'Above' modifies the verb 'looked' by indicating where she looked, functioning as an adverb of place."
            },
            {
              id: "ge-mcq-1-1-2",
              question: "Which of the following sentences correctly uses the preposition 'between'?",
              options: [
                "The prize was divided between the five students.",
                "There is a bilateral treaty between India and France.",
                "He distributed the sweets between all the children in the hall.",
                "The misunderstanding between the members of the club was resolved."
              ],
              correctAnswer: 1,
              explanation: "'Between' is used when referring to two distinct parties, such as India and France in a bilateral treaty."
            }
          ]
        },
        {
          id: "ge-u1-c1-l2",
          lessonNumber: "1.2",
          title: "Subject-Verb Agreement (Rules of Concord & Exceptions)",
          duration: "40 mins",
          keyConcepts: [
            "Singular subject takes singular verb; plural subject takes plural verb",
            "Parenthetical expressions: 'as well as', 'along with', 'together with' do not alter grammatical number",
            "Correlative conjunctions: 'either...or', 'neither...nor' follow the proximity rule",
            "Indefinite pronouns: 'each', 'every', 'everyone', 'neither of' take singular verbs"
          ],
          studyNotes: [
            "When subjects are joined by phrases like 'along with', 'as well as', 'accompanied by', the verb agrees with the primary/first subject: 'The teacher along with her students is visiting the observatory.'",
            "In 'either...or' and 'neither...nor', the verb agrees with the nearer subject: 'Neither the principal nor the teachers were present.'",
            "Expressions like 'Each of', 'Either of', 'Neither of', 'One of' are invariably followed by a plural noun but take a singular verb: 'One of the candidates has cleared the prelims.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-1-3",
              question: "Fill in the blank with the appropriate verb: 'Neither the manager nor his assistants ______ present at the morning briefing.'",
              options: ["was", "were", "is", "has been"],
              correctAnswer: 1,
              explanation: "When connected by 'neither...nor', the verb agrees with the closer subject ('assistants', plural), requiring 'were'."
            },
            {
              id: "ge-mcq-1-1-4",
              question: "Identify the grammatically correct sentence:",
              options: [
                "The Chief Minister, along with his cabinet colleagues, have arrived at the venue.",
                "The Chief Minister, along with his cabinet colleagues, has arrived at the venue.",
                "The Chief Minister, along with his cabinet colleagues, were arrived at the venue.",
                "The Chief Minister, along with his cabinet colleagues, are arriving yesterday."
              ],
              correctAnswer: 1,
              explanation: "Phrases introduced by 'along with' are parenthetical; the true subject is 'The Chief Minister' (singular), which takes the singular verb 'has arrived'."
            }
          ]
        },
        {
          id: "ge-u1-c1-l3",
          lessonNumber: "1.3",
          title: "Tense Forms & Time Aspects (12 Tenses & Usage)",
          duration: "45 mins",
          keyConcepts: [
            "Present, Past, Future across Simple, Continuous, Perfect, and Perfect Continuous aspects",
            "Habitual actions, universal truths, and scientific principles require Simple Present",
            "Actions completed before another past event require Past Perfect (had + V3)",
            "Future time markers and conditional clauses"
          ],
          studyNotes: [
            "Universal truths and habitual actions always use the Simple Present: 'The earth rotates on its axis.'",
            "When two actions occurred in the past, the earlier completed action takes Past Perfect, while the subsequent action takes Simple Past: 'The train had departed before we reached the railway platform.'",
            "'Since' denotes a specific starting point in time, while 'for' denotes the duration/period of time with Perfect Continuous tenses: 'She has been studying since 6 AM / for three hours.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-1-5",
              question: "Choose the correct tense form: 'By the time the rescue team arrived, the flood waters ______.'",
              options: ["receded", "had receded", "have receded", "were receding"],
              correctAnswer: 1,
              explanation: "The receding of flood waters occurred before the arrival of the rescue team in the past, necessitating Past Perfect ('had receded')."
            },
            {
              id: "ge-mcq-1-1-6",
              question: "Select the sentence with the correct tense usage:",
              options: [
                "He is living in Chennai since 2015.",
                "He has been living in Chennai since 2015.",
                "He lived in Chennai since 2015.",
                "He was living in Chennai for 2015."
              ],
              correctAnswer: 1,
              explanation: "An action starting in the past and continuing into the present requires the Present Perfect Continuous tense ('has been living')."
            }
          ]
        },
        {
          id: "ge-u1-c1-l4",
          lessonNumber: "1.4",
          title: "Active and Passive Voice (All Tense Shifts & Imperatives)",
          duration: "40 mins",
          keyConcepts: [
            "Voice transformation rules: Subject becomes Object (preceded by 'by'), Object becomes Subject",
            "Verb shift: Appropriate form of 'be' + Past Participle (V3)",
            "Imperative sentences into Passive: 'Let + Object + be + V3' or 'You are requested / advised / ordered to'",
            "Tenses that do not form passive: Present/Past/Future Perfect Continuous, and Future Continuous"
          ],
          studyNotes: [
            "Simple Present: 'writes' => 'is/am/are written'; Simple Past: 'wrote' => 'was/were written'; Present Perfect: 'has written' => 'has been written'.",
            "Imperatives: 'Open the door' => 'Let the door be opened' or 'You are ordered to open the door.'",
            "Prepositional verbs retain their prepositions: 'They laughed at the clown' => 'The clown was laughed at by them.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-1-7",
              question: "Change into Passive Voice: 'The storm damaged several coastal cottages.'",
              options: [
                "Several coastal cottages had been damaged by the storm.",
                "Several coastal cottages were damaged by the storm.",
                "Several coastal cottages are damaged by the storm.",
                "Several coastal cottages were being damaged by the storm."
              ],
              correctAnswer: 1,
              explanation: "The active verb 'damaged' is Simple Past; its passive equivalent is 'were damaged' (agreeing with plural 'cottages')."
            },
            {
              id: "ge-mcq-1-1-8",
              question: "Convert the imperative sentence to Passive Voice: 'Obey traffic regulations.'",
              options: [
                "Traffic regulations must obey you.",
                "Let traffic regulations be obeyed.",
                "Traffic regulations were obeyed by you.",
                "You obey traffic regulations."
              ],
              correctAnswer: 1,
              explanation: "Imperatives are converted to passive using the formula 'Let + object + be + past participle (V3)' => 'Let traffic regulations be obeyed.'"
            }
          ]
        }
      ]
    },
    {
      id: "ge-u1-c2",
      chapterNumber: 2,
      title: "Verb Classifications & Non-Finite Verbs",
      lessons: [
        {
          id: "ge-u1-c2-l1",
          lessonNumber: "1.5",
          title: "Main Verbs & Auxiliary Verbs (Primary & Modals)",
          duration: "35 mins",
          keyConcepts: [
            "Primary Auxiliaries: Be (am, is, are, was, were), Have (has, have, had), Do (do, does, did)",
            "Modal Auxiliaries: Can, could, may, might, will, would, shall, should, must",
            "Semi-Modals / Quasi-Modals: Ought to, used to, need, dare",
            "Expressing ability, permission, obligation, necessity, possibility"
          ],
          studyNotes: [
            "Primary auxiliaries can function either as helping verbs ('She is reading') or as main verbs ('She is a doctor').",
            "Modals do not change form with person or number and are always followed by base form (V1).",
            "'Ought to' indicates moral obligation: 'We ought to respect our national symbols.' 'Used to' indicates discontinued past habits."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-2-1",
              question: "Choose the appropriate modal verb: 'You ______ submit the application before 5:00 PM today; otherwise, it will be rejected.'",
              options: ["might", "must", "can", "would"],
              correctAnswer: 1,
              explanation: "'Must' conveys strict obligation and necessity required by official deadlines."
            },
            {
              id: "ge-mcq-1-2-2",
              question: "In the sentence 'He used to walk five miles every morning', 'used to' functions as a:",
              options: ["Primary Auxiliary", "Semi-Modal Auxiliary", "Transitive Main Verb", "Subordinating Conjunction"],
              correctAnswer: 1,
              explanation: "'Used to' is a semi-modal auxiliary indicating a past habitual action."
            }
          ]
        },
        {
          id: "ge-u1-c2-l2",
          lessonNumber: "1.6",
          title: "Regular and Irregular Verbs & Verb Conjugations",
          duration: "30 mins",
          keyConcepts: [
            "Regular Verbs: Form past and past participle by adding -d or -ed (walk, walked, walked)",
            "Irregular Verbs: Change vowels or have identical forms across V1, V2, V3 (sing, sang, sung; cut, cut, cut)",
            "Easily confused verbs: lie/lay, rise/raise, fall/fell",
            "Transitive vs Intransitive verbs"
          ],
          studyNotes: [
            "Lie (rest/recline): lie, lay, lain, lying (Intransitive). Lay (place/put down): lay, laid, laid, laying (Transitive - requires an object).",
            "Rise (move upwards): rise, rose, risen (Intransitive). Raise (lift something): raise, raised, raised (Transitive).",
            "Irregular verbs with identical three forms: bet, burst, cast, cost, cut, hit, hurt, let, put, set, shut, split, spread."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-2-3",
              question: "Select the correct verb to complete the sentence: 'The patient has ______ in bed for over two days.'",
              options: ["laid", "lain", "lied", "lying"],
              correctAnswer: 1,
              explanation: "The verb 'to lie' (recline) has forms lie, lay, lain. Following 'has', the past participle 'lain' is correct."
            },
            {
              id: "ge-mcq-1-2-4",
              question: "Which of the following is an irregular verb that maintains the identical form in V1, V2, and V3?",
              options: ["Freeze", "Spread", "Grow", "Drive"],
              correctAnswer: 1,
              explanation: "'Spread' retains the exact same spelling and pronunciation across present, past, and past participle (spread, spread, spread)."
            }
          ]
        },
        {
          id: "ge-u1-c2-l3",
          lessonNumber: "1.7",
          title: "Non-Finite Verbs: Infinitives, Gerunds & Participles",
          duration: "45 mins",
          keyConcepts: [
            "Infinitives: 'to + base verb' (To err is human) and Bare Infinitives (make, let, bid)",
            "Gerund: 'verb + ing' functioning as a verbal noun (Swimming is good exercise)",
            "Present Participle: 'verb + ing' functioning as a verbal adjective (a barking dog)",
            "Past Participle: 'verb + ed/en' functioning as an adjective (a broken vase)"
          ],
          studyNotes: [
            "Verbs followed by Gerunds: admit, avoid, consider, delay, deny, enjoy, finish, postpone, practice, risk, suggest.",
            "Verbs followed by Infinitives: agree, decide, hope, manage, plan, promise, refuse, threaten, wish.",
            "Bare Infinitive (without 'to') follows modal auxiliaries and verbs of perception: 'I saw him enter the hall' (not 'to enter')."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-2-5",
              question: "Identify the function of 'Reading' in 'Reading enhances analytical thinking':",
              options: ["Finite Verb", "Gerund functioning as Subject", "Present Participle functioning as Adjective", "Infinitive"],
              correctAnswer: 1,
              explanation: "'Reading' is formed from 'read + ing' and functions as the noun subject of the sentence, making it a Gerund."
            },
            {
              id: "ge-mcq-1-2-6",
              question: "Fill in the blank with the appropriate non-finite verb: 'The teacher made the students ______ the passage silently.'",
              options: ["to read", "read", "reading", "having read"],
              correctAnswer: 1,
              explanation: "The causative verb 'make' is followed by a bare infinitive without 'to': 'made the students read'."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u1-c3",
      chapterNumber: 3,
      title: "Sentence Types, Question Tags & Transformations",
      lessons: [
        {
          id: "ge-u1-c3-l1",
          lessonNumber: "1.8",
          title: "Sentence Types: Statement, Interrogative, Imperative & Exclamatory",
          duration: "35 mins",
          keyConcepts: [
            "Declarative / Statement: States facts, opinions, or ideas, ending with a period",
            "Interrogative: Asks direct questions (Wh- questions and Yes/No questions), ending with a question mark",
            "Imperative: Expresses commands, requests, advice, or prohibitions with an implied subject 'You'",
            "Exclamatory: Expresses strong or sudden emotions, ending with an exclamation mark"
          ],
          studyNotes: [
            "Declarative word order: Subject + Verb + Complement/Object.",
            "Interrogative word order: Auxiliary + Subject + Main Verb (Yes/No) or Wh-word + Auxiliary + Subject + Main Verb.",
            "Imperatives typically begin with base verb (V1): 'Please maintain silence' or 'Do not step on the grass.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-3-1",
              question: "Identify the type of sentence: 'How wonderfully the musicians played tonight!'",
              options: ["Declarative Sentence", "Imperative Sentence", "Exclamatory Sentence", "Interrogative Sentence"],
              correctAnswer: 2,
              explanation: "The sentence conveys intense admiration and emotion, opening with 'How' and ending with an exclamation mark, making it Exclamatory."
            },
            {
              id: "ge-mcq-1-3-2",
              question: "Which of the following is an imperative sentence?",
              options: [
                "Will you pass the salt?",
                "Kindly submit the verified documents at counter number four.",
                "She submitted her certificates yesterday.",
                "What a splendid presentation it was!"
              ],
              correctAnswer: 1,
              explanation: "'Kindly submit...' expresses a polite request with an understood subject '(You)', which characterizes an Imperative sentence."
            }
          ]
        },
        {
          id: "ge-u1-c3-l2",
          lessonNumber: "1.9",
          title: "Sentence Transformations (Assertive, Negative, Interrogative & Exclamatory)",
          duration: "45 mins",
          keyConcepts: [
            "Affirmative to Negative without altering meaning (using antonyms or 'fail to')",
            "Exclamatory to Assertive: 'What a beautiful scene!' => 'It is a very beautiful scene'",
            "Interrogative to Assertive: 'Who does not love his motherland?' => 'Everyone loves his motherland'",
            "Imperative to Inquisitive Interrogative / Appreciative Statement"
          ],
          studyNotes: [
            "Affirmative into Negative without change of meaning: 'He is honest' => 'He is not dishonest'. 'I remembered your advice' => 'I did not forget your advice'.",
            "Exclamatory into Assertive: Replace 'How/What' with intensifiers like 'very', 'truly', or 'great': 'What an extraordinary achievement!' => 'It is a truly extraordinary achievement.'",
            "Interrogative into Assertive: Rhetorical questions imply their opposite assertion: 'Can a leopard change its spots?' => 'A leopard cannot change its spots.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-3-3",
              question: "Transform into Assertive: 'Who can doubt the integrity of APJ Abdul Kalam?'",
              options: [
                "Anyone can doubt the integrity of APJ Abdul Kalam.",
                "No one can doubt the integrity of APJ Abdul Kalam.",
                "Some people doubt the integrity of APJ Abdul Kalam.",
                "APJ Abdul Kalam had great integrity."
              ],
              correctAnswer: 1,
              explanation: "A positive rhetorical question ('Who can doubt...?') transforms into a negative universal assertion ('No one can doubt...')."
            },
            {
              id: "ge-mcq-1-3-4",
              question: "Transform into Negative without changing the meaning: 'All the members supported the proposal.'",
              options: [
                "No member opposed the proposal.",
                "All members did not support the proposal.",
                "Some members opposed the proposal.",
                "None supported the proposal."
              ],
              correctAnswer: 0,
              explanation: "'All supported' is equivalent in meaning to 'No member opposed', preserving meaning while introducing a negative structure."
            }
          ]
        },
        {
          id: "ge-u1-c3-l3",
          lessonNumber: "1.10",
          title: "Question Tags (Positive, Negative & Special Exceptions)",
          duration: "35 mins",
          keyConcepts: [
            "Positive statement takes a negative tag; negative statement takes a positive tag",
            "Tag comprises: Auxiliary Verb + Pronoun",
            "Special case 'I am': Tag is 'aren't I?' (or 'am I?' if negative 'I am not')",
            "Imperatives: 'Let's...' takes 'shall we?'; commands take 'will you?' / 'won't you?'",
            "Negative words ('hardly', 'scarcely', 'barely', 'seldom', 'never') take positive tags"
          ],
          studyNotes: [
            "'I am late, aren't I?' (not 'amn't I'). 'I am not guilty, am I?'",
            "'Let us begin the session, shall we?'",
            "'He seldom visits his native village, does he?' (Since 'seldom' is semantically negative, the tag must be positive).",
            "'Everyone has arrived, haven't they?' (Indefinite pronouns like 'everyone', 'somebody' take plural pronoun 'they' in the tag)."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-3-5",
              question: "Select the correct question tag: 'She rarely speaks in public, ______?'",
              options: ["doesn't she", "does she", "isn't she", "is she"],
              correctAnswer: 1,
              explanation: "'Rarely' has a negative connotation; hence the sentence requires a positive question tag: 'does she?'"
            },
            {
              id: "ge-mcq-1-3-6",
              question: "Choose the correct tag: 'Let us celebrate the success, ______?'",
              options: ["will we", "shall we", "should we", "can we"],
              correctAnswer: 1,
              explanation: "Suggestions beginning with 'Let us' or 'Let's' take the conventional question tag 'shall we?'."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u1-c4",
      chapterNumber: 4,
      title: "Sentence Syntax, Synthesis, Clauses & Punctuations",
      lessons: [
        {
          id: "ge-u1-c4-l1",
          lessonNumber: "1.11",
          title: "Sentence Patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA) & Synthesis",
          duration: "40 mins",
          keyConcepts: [
            "Components: S (Subject), V (Verb), O (Direct Object), IO (Indirect Object), DO (Direct Object), C (Complement), A (Adjunct)",
            "Patterns: SV, SVO, SVIODO, SVDOIO, SVC, SVOC, SVA, SVOA, SVOCA",
            "Complements complete the sense of linking verbs or describe the object",
            "Adjuncts answer How, When, Where, Why and can be omitted without grammatical collapse"
          ],
          studyNotes: [
            "'The child slept' => SV. 'They painted the house white' => SVOC ('white' is Object Complement describing 'the house').",
            "'My father gave me a fountain pen' => S + V + IO + DO (IO answers 'to whom?', DO answers 'what?').",
            "'The train arrived late' => SVA ('late' is an Adjunct answering 'when/how?')."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-4-1",
              question: "Identify the sentence pattern of: 'The committee elected Dr. Radhakrishnan President.'",
              options: ["S + V + IO + DO", "S + V + O + C", "S + V + O + A", "S + V + C + A"],
              correctAnswer: 1,
              explanation: "'The committee' (S) 'elected' (V) 'Dr. Radhakrishnan' (O) 'President' (C - Object Complement describing who he became)."
            },
            {
              id: "ge-mcq-1-4-2",
              question: "What is the pattern of: 'He walked briskly in the morning'?",
              options: ["S + V + A + A", "S + V + O + A", "S + V + C + A", "S + V + IO + DO"],
              correctAnswer: 0,
              explanation: "'He' (S) 'walked' (V) 'briskly' (A - Manner) 'in the morning' (A - Time) => S + V + A + A."
            }
          ]
        },
        {
          id: "ge-u1-c4-l2",
          lessonNumber: "1.12",
          title: "Simple, Compound, Complex Sentences & Clauses",
          duration: "45 mins",
          keyConcepts: [
            "Simple: One independent clause with a single finite verb ('On seeing the police, the thief ran away')",
            "Compound: Two or more independent clauses joined by coordinating conjunctions FANBOYS ('The thief saw the police and he ran away')",
            "Complex: One independent clause and one or more dependent clauses joined by subordinating conjunctions ('When the thief saw the police, he ran away')",
            "Noun clauses, Adjective (Relative) clauses, Adverbial clauses (Condition, Reason, Time)"
          ],
          studyNotes: [
            "Coordinating conjunctions (FANBOYS): For, And, Nor, But, Or, Yet, So.",
            "Subordinating conjunctions: Although, Because, Since, Unless, If, When, While, As soon as.",
            "Conditionals: Type 1 (If + Present => will + V1), Type 2 (If + Past => would + V1), Type 3 (If + had + V3 => would have + V3)."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-4-3",
              question: "Transform into Complex sentence: 'In spite of his poverty, he is exceptionally honest.'",
              options: [
                "He is poor but he is exceptionally honest.",
                "Though he is poor, he is exceptionally honest.",
                "Being poor, he is honest.",
                "He is honest despite poverty."
              ],
              correctAnswer: 1,
              explanation: "'Though he is poor' is a subordinate adverbial clause of concession, forming a Complex sentence with the main clause 'he is exceptionally honest'."
            },
            {
              id: "ge-mcq-1-4-4",
              question: "Complete the conditional clause: 'If she had informed me earlier, I ______ necessary arrangements.'",
              options: ["will make", "would make", "would have made", "had made"],
              correctAnswer: 2,
              explanation: "Third conditional (past unreal condition): 'If + had + past participle' in the if-clause requires 'would have + past participle' in the result clause."
            }
          ]
        },
        {
          id: "ge-u1-c4-l3",
          lessonNumber: "1.13",
          title: "Degrees of Comparison, Direct/Indirect Speech & Punctuation Rules",
          duration: "45 mins",
          keyConcepts: [
            "Degrees of Comparison: Positive (as...as), Comparative (...er than / more... than), Superlative (the ...est / the most...)",
            "Direct to Indirect Speech: Reporting verb shifts, tense backshifts, pronoun and time/place adverb shifts",
            "Universal truths and habitual actions retain original tense in indirect speech",
            "Punctuation: Capitalization, apostrophe in possessives/contractions, comma, semicolon, colon, hyphen, quotation marks"
          ],
          studyNotes: [
            "Model 1: 'No other poet is as great as Shakespeare' (Positive) <=> 'Shakespeare is greater than any other poet' (Comparative) <=> 'Shakespeare is the greatest poet' (Superlative).",
            "Model 2: 'Very few metals are as useful as iron' (Positive) <=> 'Iron is more useful than most other metals' (Comparative) <=> 'Iron is one of the most useful metals' (Superlative).",
            "Direct to Indirect: 'He said, \"The sun rises in the east\"' => 'He said that the sun rises in the east' (no tense change for universal truth)."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-1-4-5",
              question: "Transform into Comparative Degree: 'Mount Everest is the highest peak in the world.'",
              options: [
                "Mount Everest is higher than any other peak in the world.",
                "No other peak in the world is higher than Mount Everest.",
                "Mount Everest is as high as any peak in the world.",
                "Very few peaks in the world are higher than Mount Everest."
              ],
              correctAnswer: 0,
              explanation: "The superlative 'the highest peak' transforms into comparative as 'higher than any other peak in the world'."
            },
            {
              id: "ge-mcq-1-4-6",
              question: "Choose the correctly punctuated sentence:",
              options: [
                "She said \"where are you going, Ramesh?\"",
                "She said, \"Where are you going, Ramesh?\"",
                "She said, \"where are you going Ramesh\"?",
                "She said \"Where are you going Ramesh?\""
              ],
              correctAnswer: 1,
              explanation: "A comma precedes the opening quotation mark; direct speech begins with a capital letter; a comma separates the vocative noun 'Ramesh', and the question mark stays inside quotes."
            }
          ]
        }
      ]
    }
  ]
};
