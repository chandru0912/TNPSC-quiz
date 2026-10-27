const fs = require('fs');

// We will construct group2GeneralEnglishUnits containing all 7 Units with comprehensive chapters, lessons, study notes, key concepts, and MCQs.
// Let's create scratch/build_english_data.cjs

const script = `
const fs = require('fs');

const units = [
  {
    id: 1,
    unitNumber: "Unit I",
    title: "Grammar",
    tamilTitle: "அலகு I: இலக்கணம் (25 வினாக்கள்)",
    questionCount: 25,
    standard: "SSLC Standard (10th Standard)",
    officialTopics: [
      "Parts of speech, Concord, Tense, Active voice and passive voice",
      "Types of sentences: Statement, Interrogative, Imperative, Exclamatory and transformations (statements into imperatives, interrogatives into statements, assertives into negatives, exclamatory into statements)",
      "Verbs: Main Verbs and Auxiliary Verbs, Regular and Irregular Verbs, Infinitives, Gerunds, Participles",
      "Question tags, Sentence patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA), Simple, Compound and Complex sentences",
      "Phrases and clauses, Degrees of comparison (Positive, Comparative, Superlative), Direct into Indirect and Indirect to Direct, Synthesis of sentences, Punctuations"
    ],
    chapters: [
      {
        id: "ge-u1-c1",
        chapterNumber: 1,
        title: "Parts of Speech, Concord & Tense Forms",
        tamilTitle: "சொல் வகைகள், உடன்பாடு & காலங்கள்",
        lessons: [
          {
            id: "ge-u1-c1-l1",
            lessonNumber: "1.1",
            title: "Parts of Speech & Functional Word Classes",
            tamilTitle: "சொல் வகைகள் – 8 வகைகள்",
            duration: "35 mins",
            keyConcepts: [
              "8 Parts of Speech: Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection",
              "Nouns: Common, Proper, Collective, Abstract, Material",
              "Adjectives vs Adverbs: Modifying nouns vs modifying verbs/adjectives",
              "Prepositions of Time, Place, and Direction"
            ],
            studyNotes: [
              "A word's part of speech depends on its function in a sentence, not its form alone (e.g. 'fast' in 'a fast train' is an adjective, but in 'he ran fast' is an adverb).",
              "Collective nouns take singular verbs when thought of as a single entity ('The committee has reached its decision') and plural verbs when individuals act separately ('The committee are divided in their opinions').",
              "Prepositions show relationship between a noun/pronoun and other words: 'between' for two items, 'among' for more than two."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-1-1",
                question: "Identify the part of speech of the underlined word: 'She looked \\\\u003cu\\\\u003eabove\\\\u003c/u\\\\u003e at the stars.'",
                options: ["Preposition", "Adverb", "Noun", "Conjunction"],
                correctAnswer: 1,
                explanation: "'Above' modifies the verb 'looked' by indicating where she looked, functioning as an adverb of place."
              },
              {
                id: "ge-mcq-1-1-2",
                question: "Which of the following sentences correctly uses the preposition 'between'?",
                options: [
                  "The prize was divided between the five students.",
                  "There is a pact between India and Japan.",
                  "He distributed sweets between all the children in the hall.",
                  "The dispute between the workers was resolved."
                ],
                correctAnswer: 1,
                explanation: "'Between' is used for distinct mutual relationships, typically between two entities (India and Japan)."
              }
            ]
          },
          {
            id: "ge-u1-c1-l2",
            lessonNumber: "1.2",
            title: "Subject-Verb Agreement (Rules of Concord & Exceptions)",
            tamilTitle: "எழுவாய் - பயனிலை உடன்பாடு விதிகள்",
            duration: "40 mins",
            keyConcepts: [
              "Singular subject takes singular verb; plural subject takes plural verb",
              "Expressions like 'along with', 'as well as', 'together with' do not change the number of the subject",
              "Either...or / Neither...nor proximity rule",
              "Indefinite pronouns: 'Each', 'Every', 'Everyone', 'Neither' take singular verbs"
            ],
            studyNotes: [
              "When subjects are joined by 'as well as', 'along with', 'in addition to', 'accompanied by', the verb agrees with the first subject: 'The teacher along with her students is visiting the museum.'",
              "In 'either...or' and 'neither...nor', the verb agrees with the nearest subject: 'Neither the teacher nor the students were present.'",
              "'Each of', 'One of', 'Neither of' are always followed by plural nouns but singular verbs: 'One of my friends lives in London.'"
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-1-3",
                question: "Fill in the blank with the correct verb: 'Neither the manager nor his assistants ______ present at the briefing.'",
                options: ["was", "were", "is", "has been"],
                correctAnswer: 1,
                explanation: "When subjects are connected by 'neither...nor', the verb agrees with the nearer subject ('assistants', plural => 'were')."
              },
              {
                id: "ge-mcq-1-1-4",
                question: "Choose the correct sentence:",
                options: [
                  "The Minister, along with his security guards, have arrived.",
                  "The Minister, along with his security guards, has arrived.",
                  "The Minister, along with his security guards, are arrived.",
                  "The Minister, along with his security guards, were arrived."
                ],
                correctAnswer: 1,
                explanation: "'Along with' is a parenthetical prepositional phrase; the subject is the singular 'The Minister', which requires 'has arrived'."
              }
            ]
          },
          {
            id: "ge-u1-c1-l3",
            lessonNumber: "1.3",
            title: "Tenses & Time Expressions (12 Tenses, Regular & Irregular Verbs)",
            tamilTitle: "காலங்கள் (12 வகைகள்) & வினை வடிவங்கள்",
            duration: "45 mins",
            keyConcepts: [
              "Simple Present for universal truths, habitual actions, and fixed schedules",
              "Present Perfect vs Simple Past: Finished past time markers require Simple Past ('in 1947', 'yesterday')",
              "Past Perfect for earlier of two past actions (Earlier = Past Perfect; Later = Simple Past)",
              "Future Continuous and Future Perfect forms"
            ],
            studyNotes: [
              "Simple Past is mandatory when definite past time markers appear: 'He finished the project yesterday' (not 'has finished').",
              "When two actions occurred in the past, the earlier action takes the Past Perfect (had + V3) and the later takes the Simple Past: 'The train had left before I reached the station.'",
              "'Since' indicates point of time ('since 2015') and 'for' indicates duration ('for five years') with Present Perfect Continuous."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-1-5",
                question: "Select the correct tense form: 'The train ______ the platform before we arrived.'",
                options: ["had left", "has left", "leaves", "was left"],
                correctAnswer: 0,
                explanation: "The departure of the train happened before the arrival; the earlier past event requires Past Perfect ('had left')."
              },
              {
                id: "ge-mcq-1-1-6",
                question: "'I have been living in Chennai ______ ten years.' Choose the correct preposition:",
                options: ["since", "from", "for", "during"],
                correctAnswer: 2,
                explanation: "'For' is used to express a duration/period of time ('for ten years'), whereas 'since' denotes a specific starting point."
              }
            ]
          }
        ]
      },
      {
        id: "ge-u1-c2",
        chapterNumber: 2,
        title: "Voice, Auxiliary Verbs & Non-Finite Verb Forms",
        tamilTitle: "வினை மாற்றம் & துணை வினைகள்",
        lessons: [
          {
            id: "ge-u1-c2-l1",
            lessonNumber: "1.4",
            title: "Active Voice and Passive Voice Transformations",
            tamilTitle: "செய்வினை மற்றும் செயப்பாட்டு வினை மாற்றங்கள்",
            duration: "40 mins",
            keyConcepts: [
              "Active to Passive: Object becomes Subject; Verb = appropriate form of 'be' + Past Participle (V3)",
              "Passive of Imperative sentences: 'Let + Object + be + V3'",
              "Verbs with two objects (Direct and Indirect Object) yield two passive forms",
              "Intransitive verbs do not have passive forms"
            ],
            studyNotes: [
              "Active: Subject + Verb + Object. Passive: Object + be + V3 + (by + Subject).",
              "Imperative sentence passive: 'Close the door' => 'Let the door be closed' or 'You are requested/ordered to close the door.'",
              "Present Continuous Passive: 'is/are/am + being + V3'; Present Perfect Passive: 'has/have + been + V3'."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-2-1",
                question: "Change into Passive Voice: 'The mason is building the wall.'",
                options: [
                  "The wall is built by the mason.",
                  "The wall was being built by the mason.",
                  "The wall is being built by the mason.",
                  "The wall has been built by the mason."
                ],
                correctAnswer: 2,
                explanation: "Present continuous active ('is building') converts to 'is being built' in the passive voice."
              },
              {
                id: "ge-mcq-1-2-2",
                question: "What is the passive form of the imperative: 'Open the window'?",
                options: [
                  "The window should open.",
                  "Let the window be opened.",
                  "You must open the window.",
                  "The window was opened."
                ],
                correctAnswer: 1,
                explanation: "Imperative commands convert to passive using 'Let + Object + be + V3' ('Let the window be opened')."
              }
            ]
          },
          {
            id: "ge-u1-c2-l2",
            lessonNumber: "1.5",
            title: "Main Verbs, Auxiliary Verbs, Modals & Semi-Modals",
            tamilTitle: "முதன்மையான & துணை வினைகள், மாதிரி வினைகள்",
            duration: "35 mins",
            keyConcepts: [
              "Primary Auxiliaries: Be (am, is, are, was, were), Have (has, have, had), Do (do, does, did)",
              "Modal Auxiliaries: Can, Could, May, Might, Shall, Should, Will, Would, Must",
              "Semi-modals (Quasi-modals): Ought to, Used to, Need, Dare",
              "Expressing ability, permission, obligation, possibility, and habitual past"
            ],
            studyNotes: [
              "'May' expresses formal permission or factual possibility; 'Can' expresses ability or informal permission.",
              "'Ought to' expresses moral obligation or duty ('We ought to respect our national symbols').",
              "'Used to' denotes discontinued past habits ('He used to walk five miles every morning')."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-2-3",
                question: "Choose the appropriate modal: 'We ______ respect our elders.'",
                options: ["ought to", "used to", "might", "could"],
                correctAnswer: 0,
                explanation: "'Ought to' expresses moral duty and ethical obligation."
              }
            ]
          },
          {
            id: "ge-u1-c2-l3",
            lessonNumber: "1.6",
            title: "Non-Finite Verbs: Infinitives, Gerunds & Participles",
            tamilTitle: "வினையெச்சம், தொழிற்பெயர் & பெயரெச்சம்",
            duration: "35 mins",
            keyConcepts: [
              "Infinitive: 'to + base verb' (To err is human)",
              "Gerund: 'V-ing' functioning as a noun (Swimming is good exercise)",
              "Participle: 'V-ing' (Present) or 'V3' (Past) functioning as an adjective",
              "Bare Infinitive after verbs like 'make', 'let', 'hear', 'see'"
            ],
            studyNotes: [
              "A gerund is a verbal noun ending in -ing: 'Reading expands the mind.'",
              "Verbs followed by gerunds: avoid, enjoy, consider, postpone, mind, finish.",
              "Bare infinitive (infinitive without 'to') follows modals and verbs of perception: 'I saw him enter (not to enter) the room.'"
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-2-4",
                question: "Identify the underlined verbal form: '\\\\u003cu\\\\u003eWalking\\\\u003c/u\\\\u003e is a healthy habit.'",
                options: ["Present Participle", "Gerund", "Infinitive", "Past Participle"],
                correctAnswer: 1,
                explanation: "'Walking' acts as the grammatical subject (noun) of the sentence, making it a Gerund."
              }
            ]
          }
        ]
      },
      {
        id: "ge-u1-c3",
        chapterNumber: 3,
        title: "Sentence Types, Transformations & Question Tags",
        tamilTitle: "வாக்கிய வகைகள், மாற்றங்கள் & வினாக் குறிச்சொற்கள்",
        lessons: [
          {
            id: "ge-u1-c3-l1",
            lessonNumber: "1.7",
            title: "Sentence Types: Statement, Interrogative, Imperative, Exclamatory",
            tamilTitle: "வாக்கியங்களின் நான்கு அடிப்படை வகைகள்",
            duration: "30 mins",
            keyConcepts: [
              "Assertive / Declarative: Makes a statement or states a fact",
              "Interrogative: Asks a direct question (Wh- or Yes/No)",
              "Imperative: Expresses a command, request, advice, or entreaty",
              "Exclamatory: Expresses strong or sudden emotion"
            ],
            studyNotes: [
              "Declarative: Ends with a period ('.'). Example: 'Honesty is the best policy.'",
              "Interrogative: Subject and auxiliary are inverted. Ends with '?'.",
              "Imperative: Subject 'you' is understood/omitted. Example: 'Please pass the salt.'",
              "Exclamatory: Often starts with 'What a' or 'How'. Ends with '!'."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-3-1",
                question: "Identify the sentence type: 'How magnificent the temple tower looks!'",
                options: ["Declarative", "Interrogative", "Imperative", "Exclamatory"],
                correctAnswer: 3,
                explanation: "The sentence conveys wonder and ends with an exclamation mark, characterizing it as Exclamatory."
              }
            ]
          },
          {
            id: "ge-u1-c3-l2",
            lessonNumber: "1.8",
            title: "Sentence Transformations (Statements, Imperatives, Negatives & Inquisitives)",
            tamilTitle: "வாக்கிய உருமாற்றப் பயிற்சிகள்",
            duration: "40 mins",
            keyConcepts: [
              "Transformation of statements into imperatives",
              "Interrogatives into statements (rhetorical questions)",
              "Assertives into negatives without changing meaning",
              "Exclamatory sentences into statements"
            ],
            studyNotes: [
              "Affirmative to Negative: Use antonym + negative word. 'He is honest' => 'He is not dishonest.'",
              "Exclamatory to Assertive: 'What a beautiful flower!' => 'It is a very beautiful flower.'",
              "Interrogative to Assertive: 'Who does not love his country?' => 'Everyone loves his country.'"
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-3-2",
                question: "Transform into an Assertive sentence: 'Who can forget the sacrifices of freedom fighters?'",
                options: [
                  "Nobody can forget the sacrifices of freedom fighters.",
                  "Can anyone remember the freedom fighters?",
                  "Freedom fighters cannot be forgotten easily.",
                  "Everybody forgets freedom fighters."
                ],
                correctAnswer: 0,
                explanation: "Rhetorical question 'Who can...?' with affirmative meaning transforms into 'Nobody can forget...'."
              }
            ]
          },
          {
            id: "ge-u1-c3-l3",
            lessonNumber: "1.9",
            title: "Question Tags & Sentence Patterns (SV, SVO, SVIODO, SVOC, SVA, SVOCA)",
            tamilTitle: "வினாக் குறிச்சொற்கள் & வாக்கிய வடிவங்கள்",
            duration: "35 mins",
            keyConcepts: [
              "Question Tag Rule: Positive Statement = Negative Tag; Negative Statement = Positive Tag",
              "Imperative tag: 'will you?' / 'won't you?'; 'Let's...' tag = 'shall we?'",
              "Negative adverbs (seldom, rarely, hardly, scarcely, never) make statement negative => Positive tag",
              "Sentence Patterns: S (Subject), V (Verb), O (Object), C (Complement), A (Adjunct)"
            ],
            studyNotes: [
              "'Barking dogs seldom bite, do they?' (seldom makes it negative, so positive tag).",
              "'I am right, aren\\'t I?' ('aren\\'t I' is the standard tag for 'I am').",
              "Pattern S V O C: 'They made him captain' ('captain' completes the meaning of object 'him').",
              "Pattern S V A: 'She walks gracefully' ('gracefully' answers how, functioning as Adjunct)."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-3-3",
                question: "Choose the correct question tag: 'He rarely visits his hometown, ______?'",
                options: ["doesn't he", "does he", "didn't he", "did he"],
                correctAnswer: 1,
                explanation: "'Rarely' has a negative meaning, so the sentence requires a positive tag ('does he?')."
              },
              {
                id: "ge-mcq-1-3-4",
                question: "Identify the sentence pattern: 'The committee elected him President yesterday.'",
                options: ["S V O C A", "S V IO DO A", "S V O A A", "S V A C A"],
                correctAnswer: 0,
                explanation: "'The committee' (S) 'elected' (V) 'him' (O) 'President' (C) 'yesterday' (A). Pattern: S V O C A."
              }
            ]
          }
        ]
      },
      {
        id: "ge-u1-c4",
        chapterNumber: 4,
        title: "Clause Analysis, Degrees, Speech & Synthesis",
        tamilTitle: "வாக்கிய இணைப்பு, ஒப்பிட்டு நிலைகள் & நேர்க்கூற்று",
        lessons: [
          {
            id: "ge-u1-c4-l1",
            lessonNumber: "1.10",
            title: "Simple, Compound and Complex Sentences & Synthesis",
            tamilTitle: "எளிய, கூட்டு மற்றும் கலவை வாக்கியங்கள்",
            duration: "45 mins",
            keyConcepts: [
              "Simple: One independent clause with one finite verb ('In spite of his illness, he worked hard.')",
              "Compound: Two or more coordinate independent clauses joined by FANBOYS / coordinating conjunctions",
              "Complex: One main clause + one or more subordinate clauses (introduced by although, because, since, if)",
              "Synthesis: Combining two or more simple sentences into one"
            ],
            studyNotes: [
              "Transformation triad: Simple ('Besides being clever, he is hardworking') <=> Compound ('He is clever and also hardworking') <=> Complex ('Not only is he clever but he is also hardworking').",
              "'Too...to' (Simple) converts to 'so...that...not' (Complex): 'He is too weak to walk' => 'He is so weak that he cannot walk.'",
              "Conjunctions of Contrast: Though / Although / Even though (Complex) <=> But / Yet / Still (Compound) <=> In spite of / Despite (Simple)."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-4-1",
                question: "Convert the following Simple sentence into Complex: 'On hearing the alarm, the thief fled.'",
                options: [
                  "The thief heard the alarm and he fled.",
                  "When the thief heard the alarm, he fled.",
                  "Having heard the alarm, the thief fled.",
                  "The thief fled after the alarm."
                ],
                correctAnswer: 1,
                explanation: "'When the thief heard the alarm' is a subordinating adverbial clause of time, making it Complex."
              }
            ]
          },
          {
            id: "ge-u1-c4-l2",
            lessonNumber: "1.11",
            title: "Phrases and Clauses (Noun, Adjective, Adverbial Clauses)",
            tamilTitle: "சொற்றொடர்கள் மற்றும் சார்பு வாக்கியங்கள்",
            duration: "35 mins",
            keyConcepts: [
              "Phrase: Group of words without a finite verb (In the morning, With high spirits)",
              "Clause: Group of words containing a subject and a predicate with a finite verb",
              "Noun Clause: Functions as subject or object ('I know that he is honest')",
              "Adjective Clause: Relative clause qualifying a noun ('The man who won the race is my friend')",
              "Adverbial Clause: Modifying a verb for time, place, manner, reason, condition"
            ],
            studyNotes: [
              "Adjective clauses are introduced by relative pronouns: who, whom, whose, which, that.",
              "Conditional clauses (If-clauses): Type 1 (If + Present => will + V1), Type 2 (If + Past => would + V1), Type 3 (If + had + V3 => would have + V3).",
              "Noun clauses often answer 'what?': 'What he said was true.'"
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-4-2",
                question: "Complete the conditional: 'If he had worked harder, he ______ the examination.'",
                options: ["would pass", "would have passed", "will pass", "had passed"],
                correctAnswer: 1,
                explanation: "Third conditional (past unreal condition): 'If + had + V3' requires 'would have + V3' in the main clause."
              }
            ]
          },
          {
            id: "ge-u1-c4-l3",
            lessonNumber: "1.12",
            title: "Degrees of Comparison (Positive, Comparative, Superlative)",
            tamilTitle: "ஒப்பீட்டு நிலைகள் – பாசிட்டிவ், கம்பேரேட்டிவ், சூப்பர்லேட்டிவ்",
            duration: "35 mins",
            keyConcepts: [
              "Positive: 'as + adj + as' or 'so + adj + as'",
              "Comparative: 'adj-er + than' or 'more + adj + than'",
              "Superlative: 'the + adj-est' or 'the most + adj'",
              "Models: Model 1 ('No other...' <=> 'than any other' <=> 'the best'), Model 2 ('Very few...' <=> 'than most other' <=> 'one of the best')"
            ],
            studyNotes: [
              "Model 1 (Absolute uniqueness): 'No other metal is as heavy as lead' (Positive) => 'Lead is heavier than any other metal' (Comparative) => 'Lead is the heaviest of all metals' (Superlative).",
              "Model 2 (One of many): 'Very few metals are as useful as iron' (Positive) => 'Iron is more useful than most other metals' (Comparative) => 'Iron is one of the most useful metals' (Superlative).",
              "When comparing only two items, superlative degree is impossible: 'Ravi is taller than Suresh' => 'Suresh is not as tall as Ravi.'"
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-4-3",
                question: "Transform into Comparative: 'Mount Everest is the highest peak in the world.'",
                options: [
                  "Mount Everest is higher than any other peak in the world.",
                  "Mount Everest is as high as other peaks in the world.",
                  "Very few peaks are higher than Mount Everest.",
                  "No other peak is as high as Mount Everest."
                ],
                correctAnswer: 0,
                explanation: "The superlative 'the highest peak' converts to comparative using 'higher than any other peak'."
              }
            ]
          },
          {
            id: "ge-u1-c4-l4",
            lessonNumber: "1.13",
            title: "Direct and Indirect Speech & Punctuation Rules",
            tamilTitle: "நேர்க்கூற்று - அயற்கூற்று & நிறுத்தற்குறிகள்",
            duration: "40 mins",
            keyConcepts: [
              "Reporting verb shifts: said to => told (statement), asked (question), ordered/requested (imperative), exclaimed (exclamatory)",
              "Tense backshifts: Simple Present => Simple Past; Present Perfect => Past Perfect; Simple Past => Past Perfect",
              "Time and place adverb shifts: now => then, today => that day, yesterday => the previous day, tomorrow => the next day",
              "Punctuation: Capitalization, apostrophe in contractions/possessives, semicolon, comma, hyphen"
            ],
            studyNotes: [
              "Universal truths do not backshift: He said, 'The earth revolves around the sun' => He said that the earth revolves around the sun.",
              "Yes/No questions use 'if' or 'whether' as conjunction: He said to me, 'Are you coming?' => He asked me if I was coming.",
              "Imperative sentences replace inverted commas with 'to + infinitive': The doctor said to him, 'Take rest' => The doctor advised him to take rest."
            ],
            practiceQuestions: [
              {
                id: "ge-mcq-1-4-4",
                question: "Convert to Indirect Speech: He said, 'The sun rises in the east.'",
                options: [
                  "He said that the sun rose in the east.",
                  "He said that the sun rises in the east.",
                  "He told that the sun had risen in the east.",
                  "He asked if the sun rises in the east."
                ],
                correctAnswer: 1,
                explanation: "Universal truths and habitual scientific facts retain their present tense in indirect speech."
              }
            ]
          }
        ]
      }
    ]
  }
];

console.log('Unit 1 compiled successfully');
`;

fs.writeFileSync('scratch/build_english_data.cjs', script);
