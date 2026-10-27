// Unit 5: Reading Comprehension (20 Questions)
module.exports = {
  id: 5,
  unitNumber: "Unit V",
  title: "Reading Comprehension",
  questionCount: 20,
  standard: "SSLC Standard (10th Standard)",
  officialTopics: [
    "Unseen passages (News Paper, Headlines, Editorials, Government related News)",
    "Question Types: Strong question, Weak question, Match the following, Sentence Completion",
    "Ascertainment of facts (Multiple Choice Question) - Choose the best response"
  ],
  chapters: [
    {
      id: "ge-u5-c1",
      chapterNumber: 1,
      title: "Media Texts & Public Passages Analysis",
      lessons: [
        {
          id: "ge-u5-c1-l1",
          lessonNumber: "5.1",
          title: "Newspaper Reports, Headlines & Editorial Analysis",
          duration: "40 mins",
          keyConcepts: [
            "Inverted Pyramid structure of journalistic reporting (Lead paragraph answers 5 Ws and 1 H: Who, What, When, Where, Why, How)",
            "Headline syntax: Omission of auxiliary verbs and articles, use of present tense for past events, infinitive for future events",
            "Editorial tone: Analytical, critical, persuasive, evaluative, cautiously optimistic",
            "Extracting the Central Idea / Thesis statement"
          ],
          studyNotes: [
            "Headline grammar: 'Cabinet Approves New Welfare Scheme' (Present tense indicates a recent past decision); 'PM to Visit Chennai Tomorrow' (Infinitive 'to visit' denotes future action).",
            "Editorial comprehension involves distinguishing the author's subjective stance and normative recommendations from objective facts cited.",
            "Skimming provides a high-level conceptual map, while scanning locates specific data points, dates, and names."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-5-1-1",
              question: "In newspaper headline style, which tense is conventionally employed to report an action that occurred yesterday?",
              options: ["Past Perfect Tense", "Simple Present Tense", "Future Continuous Tense", "Past Continuous Tense"],
              correctAnswer: 1,
              explanation: "Journalistic headline convention utilizes the Simple Present Tense to impart immediacy and freshness to recent past events."
            },
            {
              id: "ge-mcq-5-1-2",
              question: "When an editorial passage discusses public transit bottlenecks and suggests structural policy reforms, what is the author's primary tone?",
              options: ["Fictional and Playful", "Analytical and Constructive", "Satirical and Cynical", "Nostalgic"],
              correctAnswer: 1,
              explanation: "Editorials addressing public policy and infrastructure deficits with reasoned alternatives exhibit an 'Analytical and Constructive' tone."
            }
          ]
        },
        {
          id: "ge-u5-c1-l2",
          lessonNumber: "5.2",
          title: "Government News, Public Policy Schemes & Analytical Reports",
          duration: "40 mins",
          keyConcepts: [
            "Understanding developmental metrics: Target beneficiaries, budgetary allocations, implementation agencies",
            "Interpreting quantitative tables, charts, and policy summaries in unseen texts",
            "Identifying cause-and-effect relationships in public health, education, and economic news",
            "Contextualizing acronyms of state and national welfare schemes"
          ],
          studyNotes: [
            "Government news passages frequently test factual recall and direct causal links (e.g., scheme objectives, financial outlays, target demographic).",
            "Read the questions before deep-diving into statistical passages to target specific quantitative data points efficiently.",
            "Watch out for qualifier words: 'all', 'only', 'exclusively', 'primarily', 'partially', which often define true vs false statements."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-5-1-3",
              question: "In analyzing a government scheme report, the phrase 'Target Beneficiaries' refers to:",
              options: [
                "The funding international banks",
                "The specific demographic or socio-economic group intended to receive benefits",
                "The administrative staff executing the project",
                "The private software vendors"
              ],
              correctAnswer: 1,
              explanation: "'Target Beneficiaries' designates the exact segment of citizens or society for whose welfare the policy is crafted."
            },
            {
              id: "ge-mcq-5-1-4",
              question: "Which reading technique is most effective when searching for a specific statistical figure or year in a lengthy government survey report?",
              options: ["Skimming", "Scanning", "Intensive Reading", "Extensive Reading"],
              correctAnswer: 1,
              explanation: "'Scanning' is the reading strategy used to swiftly search a passage for specific isolated details, numbers, or terms."
            }
          ]
        }
      ]
    },
    {
      id: "ge-u5-c2",
      chapterNumber: 2,
      title: "Question Typology & Critical Reasoning",
      lessons: [
        {
          id: "ge-u5-c2-l1",
          lessonNumber: "5.3",
          title: "Strong Question vs Weak Question Identification & Fallacies",
          duration: "40 mins",
          keyConcepts: [
            "Strong Questions / Arguments: Directly relevant, logically sound, supported by factual evidence, touching the root cause",
            "Weak Questions / Arguments: Superficial, trivial, emotionally biased, vague, based on flawed assumptions or personal prejudice",
            "Logical Fallacies: Circular reasoning, false dilemma, ad hominem attacks, hasty generalization",
            "Evaluating argumentative strength in reading comprehension texts"
          ],
          studyNotes: [
            "A 'Strong' question probes substantial underlying causes or systemic outcomes: 'How does groundwater depletion impact agricultural yield and food security?'",
            "A 'Weak' question dwells on subjective trivialities or unverified opinions: 'Why don't all farmers simply migrate to cities?'",
            "In TNPSC reading questions, strong arguments must be both factually coherent and deeply relevant to the central proposition."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-5-2-1",
              question: "Statement: 'Should all major rivers in the country be interlinked?' Which of the following represents a STRONG argument?",
              options: [
                "Yes, because it will optimize water distribution, mitigate recurrent regional floods, and provide irrigation to drought-prone zones.",
                "No, because people in ancient times did not interlink rivers.",
                "Yes, because other nations might feel proud of our technology.",
                "No, because the names of the rivers sound very poetic individually."
              ],
              correctAnswer: 0,
              explanation: "Argument 1 is strong because it addresses practical, hydrological, agricultural, and socio-economic realities with logical cause-and-effect reasoning."
            },
            {
              id: "ge-mcq-5-2-2",
              question: "Which characteristic makes an argument WEAK in comprehension analysis?",
              options: [
                "It is supported by verified empirical statistics.",
                "It addresses the core constitutional premise directly.",
                "It is based purely on emotional bias, triviality, or broad generalization without evidence.",
                "It demonstrates logical consistency."
              ],
              correctAnswer: 2,
              explanation: "Weak arguments rely on personal bias, vague assumptions, or trivial tangents rather than factual and substantive evidence."
            }
          ]
        },
        {
          id: "ge-u5-c2-l2",
          lessonNumber: "5.4",
          title: "Fact Ascertainment, Sentence Completion & Match the Following",
          duration: "45 mins",
          keyConcepts: [
            "Ascertainment of Facts: Distinguishing verified statements explicitly asserted in the text from unverified extrapolations",
            "Sentence Completion: Selecting options that preserve semantic continuity, syntactic harmony, and authorial stance",
            "Match the Following: Correlating causes with effects, authors/speakers with quotes, terms with contextual definitions",
            "Elimination technique for tricky multi-statement comprehension questions"
          ],
          studyNotes: [
            "When answering 'Choose the best response based on the passage', avoid bringing outside world knowledge that contradicts the text.",
            "Sentence completion requires both grammatical concordance and contextual resonance.",
            "Cross-verify each matched pair in multi-column match questions to ensure zero contradiction."
          ],
          practiceQuestions: [
            {
              id: "ge-mcq-5-2-3",
              question: "Passage extract: 'Though digital payments surged by 65%, cybersecurity awareness among rural users remains inadequate.' Which statement is a verified fact?",
              options: [
                "Digital payments grew significantly, but rural cyber awareness requires improvement.",
                "Digital payments have completely replaced cash across all rural hamlets.",
                "Cybercrime in rural areas has tripled this fiscal year.",
                "Urban citizens do not utilize digital transaction modes."
              ],
              correctAnswer: 0,
              explanation: "The first statement reflects precisely the explicit factual assertion of the passage without unsupported extrapolation."
            },
            {
              id: "ge-mcq-5-2-4",
              question: "Complete the sentence logically: 'Unless stringent measures are enforced to curb industrial effluents, ______.'",
              options: [
                "river ecology will witness progressive rejuvenation",
                "water contamination will continue to endanger aquatic biodiversity",
                "industrial profits will triple automatically",
                "rainfall levels will double across coastal belts"
              ],
              correctAnswer: 1,
              explanation: "'Unless... enforced' sets up a negative condition; failure to curb toxic effluents logically results in sustained environmental contamination."
            }
          ]
        }
      ]
    }
  ]
};
