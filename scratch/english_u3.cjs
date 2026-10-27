// Unit 3: Writing Skills (10 Questions)
module.exports = {
  id: 3,
  unitNumber: "Unit III",
  title: "Writing Skills",
  questionCount: 10,
  standard: "SSLC Standard (10th Standard)",
  officialTopics: [
    "Letter writing (formal and informal) – Types of Letters (Multiple Choice Question)",
    "Jumbled sentences, Finding out the right order of sentences",
    "Making queries (Multiple Choice Question)",
    "Inferences, Blanks, Substitutions"
  ],
  chapters: [
    {
      id: "ge-u3-c1",
      chapterNumber: 1,
      title: "Letter Writing Formats & Principles",
      lessons: [
        {
          id: "ge-u3-c1-l1",
          lessonNumber: "3.1",
          title: "Formal Letters: Structure, Salutations & Subscriptions",
          duration: "40 mins",
          keyConcepts: [
            "Formal letter categories: Official correspondence, Letters to Editors, Job Applications, Business inquiries, Complaints",
            "Essential components in order: Sender's Address, Date, Receiver's Designation & Address, Subject line, Reference, Salutation, Body (Intro, Detail, Conclusion), Complimentary Close (Subscription), Signature & Name",
            "Salutations: 'Sir/Madam', 'Dear Sir/Madam' (never 'Respected Sir' in modern standard format)",
            "Subscription rules: 'Yours faithfully' (when recipient is unnamed/Sir), 'Yours sincerely' (when recipient is addressed by name, e.g., Dear Mr. Sharma)",
            "No apostrophe in 'Yours': 'Yours faithfully', never 'Your's'"
          ],
          studyNotes: [
            "Date format: 27 October 2026 or October 27, 2026 (avoid ambiguous numerical notations like 27/10/26 in formal bodies).",
            "In job applications, the Curriculum Vitae / Resume / Bio-data forms an enclosure.",
            "Letters to Editors express civic or public concerns, usually concluding with: 'I request the authorities concerned to take necessary action through the esteemed columns of your daily.'"
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-3-1-1",
              question: "Which of the following complimentary closes is grammatically and conventionally correct for a formal letter?",
              options: ["Your's faithfully", "Yours faithfully", "Yours' faithfully", "Your faithfully"],
              correctAnswer: 1,
              explanation: "'Yours' is a possessive pronoun that never takes an apostrophe. 'Yours faithfully' is the correct formal subscription."
            },
            {
              id: "ge-mcq-3-1-2",
              question: "When writing a formal complaint to the Commissioner of Municipal Corporation, which of the following is the most appropriate salutation?",
              options: ["Hey Commissioner", "Dear Sir / Madam", "Dearest Friend", "To Whomsoever It May Concern"],
              correctAnswer: 1,
              explanation: "'Dear Sir / Madam' or 'Sir / Madam' is the formal, respectful salutation standard in administrative communication."
            }
          ]
        },
        {
          id: "ge-u3-c1-l2",
          lessonNumber: "3.2",
          title: "Informal Letters: Social & Personal Conventions",
          duration: "30 mins",
          keyConcepts: [
            "Informal letters written to parents, relatives, siblings, close friends",
            "Omission of Receiver's full designation address and formal Subject line",
            "Conversational, warm, and cordial tone",
            "Informal subscriptions: 'Yours affectionately', 'Yours lovingly', 'Your friend', 'With warm regards'"
          ],
          studyNotes: [
            "Unlike formal letters, an informal letter does not require a 'Subject' heading.",
            "Salutation format: 'Dear Father', 'My dear Mother', 'Dear Anita'.",
            "Subscription for parents and elders: 'Yours affectionately' or 'Your loving son/daughter'."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-3-1-3",
              question: "Which component is deliberately omitted in an informal letter to a close family friend?",
              options: ["Date", "Subject Line", "Salutation", "Sender's Address"],
              correctAnswer: 1,
              explanation: "Informal personal letters do not include a formal 'Subject' line."
            },
            {
              id: "ge-mcq-3-1-4",
              question: "Select the most appropriate subscription for a letter written to your younger brother:",
              options: ["Yours faithfully", "Yours lovingly", "Yours obediently", "With formal regards"],
              correctAnswer: 1,
              explanation: "'Yours lovingly' or 'Yours affectionately' conveys personal affection appropriate for siblings and family members."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u3-c2",
      chapterNumber: 2,
      title: "Sentence Coherence, Queries & Logic",
      lessons: [
        {
          id: "ge-u3-c2-l1",
          lessonNumber: "3.3",
          title: "Jumbled Sentences & Logical Sequencing Techniques",
          duration: "40 mins",
          keyConcepts: [
            "Identifying the Opening Sentence (Independent subject, thematic introduction, absence of antecedent pronouns like 'He', 'They', 'This')",
            "Noun-Pronoun Chains: A noun in sentence A introduces a subject referred to by pronouns (he, it, they) in subsequent sentences",
            "Chronological & Transition Markers: First, initially, subsequently, meanwhile, finally, therefore, however",
            "Identifying Mandatory Pairs (conjunctions like 'not only... but also', 'on one hand... on the other hand')"
          ],
          studyNotes: [
            "Examine introductory indicators: Sentences beginning with 'However', 'Therefore', 'Thus', 'Meanwhile' are rarely the opening sentence.",
            "Chronological sequence: Cause always precedes effect; problem precedes solution; historical events follow chronological dates.",
            "Look for acronym expansions: A sentence explaining an acronym (e.g., 'Indian Space Research Organisation (ISRO)') precedes one using just 'ISRO'."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-3-2-1",
              question: "Arrange the jumbled sentences into a coherent paragraph:\nP: They returned home with joyful memories.\nQ: The children planned an excursion to the botanical gardens.\nR: Throughout the afternoon, they explored exotic flora and rare plants.\nS: On Saturday morning, their school bus departed promptly.",
              options: ["Q - S - R - P", "S - Q - R - P", "Q - R - S - P", "P - R - S - Q"],
              correctAnswer: 0,
              explanation: "Q introduces the plan, S describes the departure, R portrays the activity at the garden, and P concludes the return home: Q-S-R-P."
            },
            {
              id: "ge-mcq-3-2-2",
              question: "In ordering a paragraph, which of the following sentences cannot serve as an opening sentence?",
              options: [
                "Renewable energy is the key to combating global climate change.",
                "Consequently, the government announced fresh subsidies for solar installations.",
                "Dr. A.P.J. Abdul Kalam was born in Rameswaram, Tamil Nadu.",
                "Water is an indispensable resource for all biological life."
              ],
              correctAnswer: 1,
              explanation: "'Consequently' is a causal transition word that refers back to preceding ideas, so it cannot initiate an independent paragraph."
            }
          ]
        },
        {
          id: "ge-u3-c2-l2",
          lessonNumber: "3.4",
          title: "Making Queries, Inferences, Blanks & Lexical Substitutions",
          duration: "40 mins",
          keyConcepts: [
            "Formulating polite queries in professional and administrative contexts: 'Could you please clarify...', 'May I request information regarding...'",
            "Information-seeking patterns: Timetable inquiries, fee structures, application statuses",
            "Logical Inference: Drawing valid conclusions strictly backed by factual premises",
            "Contextual cloze blanks and appropriate lexical substitutions"
          ],
          studyNotes: [
            "Polite queries use modals 'Could', 'Would', 'May' rather than blunt imperatives or 'Can': 'Could you please let me know the status of my petition?'",
            "An inference is an deduction drawn from evidence; avoid assumptions that introduce extraneous facts not supported by the prompt.",
            "Vocabulary substitutions require matching both semantic meaning and grammatical category (noun for noun, verb for verb)."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-3-2-3",
              question: "Which of the following is the most polite and professional query to request administrative information?",
              options: [
                "Tell me the exam schedule immediately.",
                "I want the schedule now.",
                "Could you kindly furnish the revised schedule of the upcoming examinations?",
                "Give the examination schedule."
              ],
              correctAnswer: 2,
              explanation: "'Could you kindly furnish...' maintains appropriate professional courtesy and polite modal phrasing."
            },
            {
              id: "ge-mcq-3-2-4",
              question: "Based on the sentence: 'The reservoir levels have touched a historic low of 8%, prompting authorities to ration tap supply', what is the logical inference?",
              options: [
                "The region is facing severe drought and water scarcity.",
                "The reservoir was emptied deliberately for cleaning.",
                "The authorities are constructing new reservoirs.",
                "Rainfall in the coming month will be abundant."
              ],
              correctAnswer: 0,
              explanation: "Historic low water levels coupled with rationing directly and logically imply acute water scarcity."
            }
          ]
        }
      ]
    }
  ]
};
