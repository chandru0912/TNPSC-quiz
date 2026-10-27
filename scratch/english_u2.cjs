// Unit 2: Vocabulary (15 Questions)
module.exports = {
  id: 2,
  unitNumber: "Unit II",
  title: "Vocabulary",
  questionCount: 15,
  standard: "SSLC Standard (10th Standard)",
  officialTopics: [
    "Synonyms, Antonyms, Homonyms, Homophones",
    "Collocations, Idioms & Phrases, Phrasal verbs",
    "Spelling of words, Correct usage of words, One word substitution, Word creation",
    "Singular and plural (including Zero plural), Derivatives, Abbreviations",
    "British and American English, Compound words and Figures of speech"
  ],
  chapters: [
    {
      id: "ge-u2-c1",
      chapterNumber: 1,
      title: "Lexical Semantics, Pairs & Word Formations",
      lessons: [
        {
          id: "ge-u2-c1-l1",
          lessonNumber: "2.1",
          title: "Synonyms and Antonyms (Contextual & Textbook Words)",
          duration: "35 mins",
          keyConcepts: [
            "Contextual Synonyms from prescribed Tamil Nadu SCERT English textbooks",
            "Antonyms formed by prefixation (un-, in-, dis-, mis-, non-, ir-, il-)",
            "Gradable vs Complementary antonyms",
            "Connotation vs Denotation in word selection"
          ],
          studyNotes: [
            "Always infer the meaning from the context of the sentence; a word may have diverse synonyms depending on its usage (e.g., 'grave' can mean 'serious' or 'tomb').",
            "Common textbook words: 'Placid' = calm/serene; 'Frugal' = economical/thrifty; 'Audacious' = bold/daring (Antonym: timid/cowardly); 'Obsolete' = outdated/archaic (Antonym: contemporary/modern).",
            "Prefix-based antonyms: legal -> illegal; rational -> irrational; pure -> impure; legible -> illegible; reverent -> irreverent."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-1-1",
              question: "Choose the exact synonym of the underlined word: 'The ascetic lived an <u>austere</u> life in the mountain sanctuary.'",
              options: ["Luxurious", "Strict and simple", "Extravagant", "Chaotic"],
              correctAnswer: 1,
              explanation: "'Austere' means severely simple, unadorned, or strictly disciplined without comforts."
            },
            {
              id: "ge-mcq-2-1-2",
              question: "Identify the antonym of the word 'BENEVOLENT':",
              options: ["Generous", "Altruistic", "Malevolent", "Compassionate"],
              correctAnswer: 2,
              explanation: "'Benevolent' means well-wishing, kind, and charitable; its direct antonym is 'Malevolent' (spiteful or wishing harm)."
            }
          ]
        },
        {
          id: "ge-u2-c1-l2",
          lessonNumber: "2.2",
          title: "Homonyms and Homophones (Confusing Pairs & Nuances)",
          duration: "35 mins",
          keyConcepts: [
            "Homophones: Words with the same sound/pronunciation but different spelling and meaning (altar/alter, principal/principle)",
            "Homonyms: Words with the same sound and spelling but different meanings (bear, bank, ring)",
            "Homographs: Words with the same spelling but different pronunciation and meaning (lead/lead, tear/tear)",
            "Frequently tested pairs: complement/compliment, stationary/stationery, council/counsel"
          ],
          studyNotes: [
            "'Principal' = head of an institution or main sum of money; 'Principle' = fundamental truth, moral rule.",
            "'Stationary' (with 'a') = fixed, not moving; 'Stationery' (with 'e' as in paper/pen) = writing materials.",
            "'Compliment' = praise or regards; 'Complement' = that which completes or enhances another thing."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-1-3",
              question: "Fill in the blank with the appropriate word: 'The scientist explained the scientific ______ governing thermodynamics.'",
              options: ["principals", "principles", "principle's", "principality"],
              correctAnswer: 1,
              explanation: "'Principles' refers to fundamental scientific laws or rules of operation."
            },
            {
              id: "ge-mcq-2-1-4",
              question: "Select the sentence with the correct homophone usage:",
              options: [
                "The truck rammed into a stationery bus.",
                "The truck rammed into a stationary bus.",
                "He bought notebooks from the stationary shop.",
                "The bus remained stationery at the terminal."
              ],
              correctAnswer: 1,
              explanation: "'Stationary' means motionless or standing still, which correctly describes the vehicle."
            }
          ]
        },
        {
          id: "ge-u2-c1-l3",
          lessonNumber: "2.3",
          title: "Singular, Plural & Zero Plural Nouns (Irregular & Foreign Plurals)",
          duration: "35 mins",
          keyConcepts: [
            "Regular plurals (-s, -es, -ies)",
            "Irregular plurals: foot/feet, tooth/teeth, goose/geese, mouse/mice, ox/oxen",
            "Zero Plural (words that do not change form in plural): sheep, deer, cattle, aircraft, salmon, trout, species, series",
            "Foreign plurals (Latin & Greek): alumnus/alumni, crisis/crises, criterion/criteria, phenomenon/ phenomena, datum/data, radius/radii"
          ],
          studyNotes: [
            "Zero plural nouns retain identical singular and plural forms: 'one sheep' => 'ten sheep'; 'a rare species' => 'many species'.",
            "Nouns always singular in form and use: furniture, luggage, information, advice, machinery, scenery, poetry, baggage (never 'furnitures' or 'informations').",
            "Nouns plural in form but singular in meaning: physics, mathematics, news, economics, politics, civics, measles, billiards (takes singular verb: 'The news is true')."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-1-5",
              question: "Which of the following nouns exhibits a 'Zero Plural' (identical singular and plural form)?",
              options: ["Crisis", "Deer", "Ox", "Phenomenon"],
              correctAnswer: 1,
              explanation: "'Deer' has no separate plural ending; its plural form remains 'deer' (Zero Plural)."
            },
            {
              id: "ge-mcq-2-1-6",
              question: "What is the plural form of the Greek-derived noun 'Criterion'?",
              options: ["Criterions", "Criteria", "Criterias", "Criterium"],
              correctAnswer: 1,
              explanation: "Nouns ending in -on of Greek origin form their plural with -a: criterion -> criteria; phenomenon -> phenomena."
            }
          ]
        },
        {
          id: "ge-u2-c1-l4",
          lessonNumber: "2.4",
          title: "Word Creation, Derivatives (Prefixes, Suffixes) & Compound Words",
          duration: "40 mins",
          keyConcepts: [
            "Prefixes modifying meaning: re- (again), pre- (before), post- (after), anti- (against), auto- (self), poly- (many), semi- (half)",
            "Suffixes creating word classes: -tion/-ment/-ness/-ity (Nouns); -ify/-ize/-en (Verbs); -ful/-less/-able/-ous (Adjectives); -ly (Adverbs)",
            "Compound word patterns: Noun + Noun (sunlight), Noun + Verb (sunset), Gerund + Noun (washing machine), Adjective + Noun (blackboard), Preposition + Noun (underworld)"
          ],
          studyNotes: [
            "Derivatives are formed by adding morphemes (affixes) to base root words: 'child' -> 'childish' (adjective), 'childhood' (abstract noun).",
            "Compound words combine two distinct lexical bases to create a new semantic unit: 'greenhouse', 'waterfall', 'postman'.",
            "Hyphenated compound nouns in pluralize the headword: 'passer-by' -> 'passers-by'; 'son-in-law' -> 'sons-in-law'; 'commander-in-chief' -> 'commanders-in-chief'."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-1-7",
              question: "Identify the grammatical combination used in the compound word 'SEWING MACHINE':",
              options: ["Noun + Noun", "Gerund + Noun", "Adjective + Verb", "Adverb + Noun"],
              correctAnswer: 1,
              explanation: "'Sewing' is a gerund (verb + ing functioning as noun/qualifier) and 'machine' is a noun, forming Gerund + Noun."
            },
            {
              id: "ge-mcq-2-1-8",
              question: "What is the correct plural form of the compound word 'Brother-in-law'?",
              options: ["Brother-in-laws", "Brothers-in-law", "Brothers-in-laws", "Brother-ins-law"],
              correctAnswer: 1,
              explanation: "In compound nouns composed of a noun followed by a prepositional phrase, the plural suffix '-s' is added to the principal noun: 'Brothers-in-law'."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u2-c2",
      chapterNumber: 2,
      title: "Idiomatic Expressions, Phrasal Verbs & Collocations",
      lessons: [
        {
          id: "ge-u2-c2-l1",
          lessonNumber: "2.5",
          title: "Idioms & Phrases with Meanings and Usage",
          duration: "40 mins",
          keyConcepts: [
            "Definition of an idiom: Figurative, non-literal meaning understood through cultural convention",
            "High-frequency animal idioms: 'a dark horse' (unexpected winner), 'a bull in a china shop' (clumsy person), 'let the cat out of the bag' (reveal a secret)",
            "Color idioms: 'out of the blue' (unexpectedly), 'in the pink of health' (optimal fitness), 'see red' (furious)",
            "Action idioms: 'burn the midnight oil' (study late), 'at the eleventh hour' (at the last moment), 'burn the candle at both ends' (overwork)"
          ],
          studyNotes: [
            "'Beat around the bush': Discussing a matter without coming directly to the central point.",
            "'Bite the bullet': To endure a painful or grim situation with fortitude and courage.",
            "'Piece of cake': An exceptionally easy task or assignment.",
            "'Blessing in disguise': A misfortune that unexpectedly produces beneficial outcomes."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-2-1",
              question: "What is the meaning of the idiom 'to burn the midnight oil'?",
              options: ["To cause accidental fire", "To study or work late into the night", "To waste precious resources", "To sleep early"],
              correctAnswer: 1,
              explanation: "'Burn the midnight oil' refers to staying awake and working diligently late into the night."
            },
            {
              id: "ge-mcq-2-2-2",
              question: "Choose the correct idiom to express an unexpected, sudden occurrence: 'The news of the promotion came ______.'",
              options: ["out of the blue", "in black and white", "with flying colours", "at the drop of a hat"],
              correctAnswer: 0,
              explanation: "'Out of the blue' is an idiom meaning completely unexpected or without any prior warning."
            }
          ]
        },
        {
          id: "ge-u2-c2-l2",
          lessonNumber: "2.6",
          title: "Phrasal Verbs (Separable & Inseparable Particles)",
          duration: "40 mins",
          keyConcepts: [
            "Structure: Verb + Preposition or Verb + Adverb particle",
            "Verbs with 'Call': call off (cancel), call on (visit a person), call at (visit a place), call for (require/demand)",
            "Verbs with 'Look': look into (investigate), look after (take care of), look down upon (despise), look forward to (anticipate with pleasure)",
            "Verbs with 'Put': put off (postpone), put out (extinguish), put up with (tolerate), put on (wear)"
          ],
          studyNotes: [
            "'Call off' vs 'Put off': 'Call off' means to permanently cancel an event, whereas 'put off' means to postpone or reschedule it.",
            "'Look into': The police are looking into the burglary (investigating).",
            "'Look forward to' is followed by a gerund (verb+ing): 'I look forward to meeting you' (not 'meet you').",
            "'Give up' = surrender or abandon a habit; 'Give in' = yield or submit to pressure."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-2-3",
              question: "The match was ______ due to incessant heavy rainfall.",
              options: ["called off", "called out", "called for", "called upon"],
              correctAnswer: 0,
              explanation: "'Called off' means cancelled, which is the standard term when a sporting fixture is terminated due to weather."
            },
            {
              id: "ge-mcq-2-2-4",
              question: "Select the phrasal verb that means 'to investigate': 'The Special Investigation Team was constituted to ______ the cyber scam.'",
              options: ["look after", "look into", "look down upon", "look for"],
              correctAnswer: 1,
              explanation: "'Look into' signifies to examine, inspect, or investigate facts systematically."
            }
          ]
        },
        {
          id: "ge-u2-c2-l3",
          lessonNumber: "2.7",
          title: "Collocations (Verb-Noun, Adjective-Noun Combinations)",
          duration: "30 mins",
          keyConcepts: [
            "Collocation definition: Natural co-occurrence of words that sound right to native speakers",
            "Do vs Make: 'make a decision', 'make an effort', 'make a mistake' vs 'do homework', 'do business', 'do one's duty'",
            "Adjective + Noun: 'heavy traffic', 'torrential rain', 'blissful ignorance', 'vivid imagination'",
            "Verb + Preposition collocations: 'abide by', 'adhere to', 'comply with', 'abstain from'"
          ],
          studyNotes: [
            "One says 'heavy rain' (not 'strong rain'); 'fast food' (not 'quick food'); 'quick meal' (not 'fast meal').",
            "Legal/administrative collocations: 'pass a resolution', 'file an affidavit', 'reach a consensus', 'deliver a verdict'.",
            "Prepositional collocations: 'accused of', 'acquitted of', 'capable of', 'congratulate on', 'prevent from'."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-2-5",
              question: "Choose the correct collocation: 'The committee was unable to ______ a final decision today.'",
              options: ["do", "make", "create", "build"],
              correctAnswer: 1,
              explanation: "In English, one 'makes a decision', forming an established verb-noun collocation."
            },
            {
              id: "ge-mcq-2-2-6",
              question: "Fill in the correct adjective collocation: 'Motorists experienced delays owing to ______ rain in the city.'",
              options: ["big", "deep", "torrential", "thick"],
              correctAnswer: 2,
              explanation: "'Torrential rain' is the standard, natural collocation used to denote extraordinarily heavy downpours."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u2-c3",
      chapterNumber: 3,
      title: "Specialized Vocabulary, Orthography & Linguistic Varieties",
      lessons: [
        {
          id: "ge-u2-c3-l1",
          lessonNumber: "2.8",
          title: "One Word Substitutions (Persons, Sciences, Terms)",
          duration: "40 mins",
          keyConcepts: [
            "Fields of study: Numismatics (coins), Philately (stamps), Ornithology (birds), Entomology (insects), Paleontology (fossils)",
            "Types of persons: Philanthropist (lover of mankind), Misanthrope (hater of mankind), Polyglot (knows multiple languages), Optimist/Pessimist",
            "Government types: Autocracy, Democracy, Oligarchy, Bureaucracy, Plutocracy (rule by wealthy)",
            "Medical specialists: Dermatologist, Ophthalmologist, Cardiologist, Pediatrician, Neurologist"
          ],
          studyNotes: [
            "'Infallible' = one who never makes mistakes; 'Invincible' = too powerful to be defeated.",
            "'Egoist' = selfish person; 'Egotist' = talks excessively about oneself.",
            "'Omniscient' = knowing everything; 'Omnipotent' = all-powerful; 'Omnipresent' = present everywhere.",
            "'Teetotaler' = a person who completely abstains from alcoholic beverages."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-3-1",
              question: "What is the one-word substitution for 'A person who collects or studies postage stamps'?",
              options: ["Numismatist", "Philatelist", "Cartographer", "Anthropologist"],
              correctAnswer: 1,
              explanation: "A 'Philatelist' is someone who collects and studies postage stamps."
            },
            {
              id: "ge-mcq-2-3-2",
              question: "A government conducted by the wealthy class of citizens is known as:",
              options: ["Aristocracy", "Plutocracy", "Oligarchy", "Theocracy"],
              correctAnswer: 1,
              explanation: "'Plutocracy' (from Greek ploutos = wealth + kratos = power) denotes governance by the wealthy."
            }
          ]
        },
        {
          id: "ge-u2-c3-l2",
          lessonNumber: "2.9",
          title: "Spelling Rules, Word Usage, Abbreviations & Acronyms",
          duration: "35 mins",
          keyConcepts: [
            "Spelling rules: 'i before e except after c' (receive, deceive vs believe, relief)",
            "Silent letters: subtle, doubt, gnaw, mnemonic, pseudo, knight, aisle",
            "Frequently misspelled words: Accommodation, Commission, Bureaucracy, Conscientious, Millennium, Questionnaire, Separate",
            "Abbreviations vs Acronyms (UNESCO, ISRO, TNPSC, WHO, IMF, e.g., i.e., etc.)"
          ],
          studyNotes: [
            "'Separate' has 'a' in the middle (remember: 'there is a rat in separate').",
            "'Accommodation' features double 'c' and double 'm'.",
            "'e.g.' stands for Latin 'exempli gratia' (for example); 'i.e.' stands for Latin 'id est' (that is).",
            "'Acronym' is pronounced as a single word (e.g., NASA, LASER, RADAR), while an 'Initialism' is pronounced letter by letter (e.g., TNPSC, BBC)."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-3-3",
              question: "Select the word with the correct spelling:",
              options: ["Accomodation", "Acommodation", "Accommodation", "Accomadation"],
              correctAnswer: 2,
              explanation: "'Accommodation' is spelled with double 'c' and double 'm'."
            },
            {
              id: "ge-mcq-2-3-4",
              question: "The Latin abbreviation 'i.e.' stands for:",
              options: ["In essence", "Id est", "In example", "Index entry"],
              correctAnswer: 1,
              explanation: "'i.e.' is an abbreviation for the Latin phrase 'id est', translating to 'that is'."
            }
          ]
        },
        {
          id: "ge-u2-c3-l3",
          lessonNumber: "2.10",
          title: "British and American English Equivalents & Figures of Speech",
          duration: "40 mins",
          keyConcepts: [
            "Vocabulary pairs: Flat (UK) / Apartment (US); Lift (UK) / Elevator (US); Petrol (UK) / Gasoline (US); Boot (UK) / Trunk (US)",
            "Spelling variations: -our vs -or (colour/color); -re vs -er (theatre/theater); -ise vs -ize (organise/organize); -ence vs -ense (defence/defense)",
            "Figures of speech in vocabulary: Simile, Metaphor, Personification, Oxymoron, Hyperbole, Onomatopoeia",
            "Idiomatic lexical figures: 'bittersweet' (oxymoron), 'buzzing bees' (onomatopoeia)"
          ],
          studyNotes: [
            "UK vs US vocabulary: Bonnet / Hood; Biscuit / Cookie; Autumn / Fall; Pavement / Sidewalk; Dustbin / Garbage can; Queue / Line; Lorry / Truck.",
            "Oxymoron joins two contradictory terms: 'deafening silence', 'open secret', 'original copy'.",
            "Hyperbole uses deliberate exaggeration: 'I have told you a million times'."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-2-3-5",
              question: "What is the American English equivalent for the British word 'PAVEMENT'?",
              options: ["Footpath", "Sidewalk", "Driveway", "Kerb"],
              correctAnswer: 1,
              explanation: "In American English, the pedestrian pathway known as 'pavement' in British English is called 'sidewalk'."
            },
            {
              id: "ge-mcq-2-3-6",
              question: "Identify the figure of speech in the phrase 'A DEAFENING SILENCE':",
              options: ["Simile", "Oxymoron", "Personification", "Hyperbole"],
              correctAnswer: 1,
              explanation: "An 'Oxymoron' places two mutually contradictory or opposing words ('deafening' and 'silence') side-by-side for rhetorical effect."
            }
          ]
        }
      ]
    }
  ]
};
