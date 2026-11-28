export interface HelpFaqItem {
  question: string
  answer: string
}

export interface PolicySection {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
  adminReviewNote?: string
}

export const HELP_CENTER_CONTENT = {
  title: 'Help Center',
  subtitle:
    'Student support, platform usage instructions, troubleshooting steps, and answers to common questions about TNPSC Aspirant Orbit.',
  quickGuides: [
    {
      title: 'Study Materials & Textbook Library',
      description:
        'Open Study Materials or Textbook Library from the left sidebar to browse 6th–12th Standard Samacheer Kalvi resources by Group, Subject, Standard, Medium, and Term.',
    },
    {
      title: 'MCQ Practice & Mock Tests',
      description:
        'Practice lesson-wise MCQs in MCQ Practice or attempt Admin-published Unit Wise and Full-Length tests in Mock Tests. Every completed submission is graded automatically.',
    },
    {
      title: 'Performance Analytics, Mark List & Progress Tracker',
      description:
        'Track your scores, attempt history, awards, and unit completion percentages in real time from the sidebar analytics and progress pages.',
    },
    {
      title: 'Subscription & Plan Upgrades',
      description:
        'Use Upgrade Plan in the Profile menu or Subscription in the sidebar to view available TNPSC Aspirant Orbit plans and your active access status.',
    },
  ],
  faqs: [
    {
      question: 'How do I sign in or register for a student account?',
      answer:
        'TNPSC Aspirant Orbit uses verified Google Account authentication. Click "Continue with Google" on the Login or Register screen and select your verified Google Account.',
    },
    {
      question: 'Why was I signed out when logging in on another device?',
      answer:
        'For account security, TNPSC Aspirant Orbit enforces a single active device session per student account. Signing in on a new device automatically ends the previous device session.',
    },
    {
      question: 'Why does a Unit Wise Mock Test show 0 Available Tests?',
      answer:
        'Unit Wise Mock Tests display only tests that have been generated, approved, and published by administrators in the Mock Test Generator. New tests appear automatically as soon as they are published.',
    },
    {
      question: 'Where can I review my submitted test answers and marks?',
      answer:
        'Open Mark List in the left sidebar to inspect all submitted MCQ Practice, Previous Year Paper, and Mock Test scorecards, including question-by-question explanations.',
    },
  ] as HelpFaqItem[],
  troubleshooting: [
    'If the Google Sign-In popup does not appear, allow popups for this site in your browser settings and disable strict popup blockers.',
    'If a page or test list appears outdated after new content is published, refresh the browser tab to sync the latest data.',
    'If you are unexpectedly signed out, verify that your account is not actively signed in on another browser or device, then sign in again with your verified Google Account.',
    'If a Samacheer Kalvi textbook PDF takes time to load, check your network connection and retry opening the document.',
  ],
  supportContactNote:
    'Official student support contact channels (support email / helpdesk details) are currently marked for administrator review and configuration. Please check back once published by the site administrator.',
}

export const PRIVACY_CENTER_CONTENT = {
  title: 'Privacy Center',
  subtitle:
    'Understand what student data TNPSC Aspirant Orbit collects, how it is stored and protected, and how you can manage your active session.',
  sections: [
    {
      id: 'data-collected',
      title: 'Data Collected for Your Student Account',
      paragraphs: [
        'When you sign in with a verified Google Account, TNPSC Aspirant Orbit receives only the verified identity fields provided by Google OAuth.',
      ],
      bullets: [
        'Google Subject ID (unique account identifier) and verified email address.',
        'Display name and profile picture URL from your Google Account.',
        'Selected TNPSC target exam category and optional profile preferences (such as district or mobile number if provided).',
        'Learning activity records: MCQ practice attempts, Mock Test submissions, Previous Year Paper attempts, study material reading progress, and daily study streaks.',
      ],
    },
    {
      id: 'how-used',
      title: 'How Your Data Is Used',
      paragraphs: [
        'Your account and study records are used strictly to deliver personalized TNPSC exam preparation features within TNPSC Aspirant Orbit.',
      ],
      bullets: [
        'Authenticating your student session and preventing unauthorized access via single-device session controls.',
        'Calculating your Mark List, Performance Analytics, Progress Tracker, and Unit Wise Mock Test completion.',
        'Managing subscription access and keeping your progress synced across sessions.',
      ],
    },
    {
      id: 'storage-security',
      title: 'Data Storage & Session Protection',
      paragraphs: [
        'Student profile and progress data are stored in our PostgreSQL database. Authentication relies on backend-verified Google ID Tokens and HttpOnly session cookies with SameSite protection.',
      ],
      adminReviewNote:
        'Data retention schedules and formal data export/deletion request channels are marked for administrator review and configuration.',
    },
  ] as PolicySection[],
}

export const TERMS_OF_SERVICE_CONTENT = {
  title: 'Terms of Service',
  subtitle:
    'Usage rules, student responsibilities, and subscription terms governing access to TNPSC Aspirant Orbit.',
  lastReviewedNote: 'Policy version managed by TNPSC Aspirant Orbit administrators (editable for future legal updates).',
  sections: [
    {
      id: 'acceptance',
      title: '1. Platform Access & Eligibility',
      paragraphs: [
        'By accessing or using TNPSC Aspirant Orbit, you agree to follow these Terms of Service. Student registration and sign-in require a verified Google Account.',
      ],
    },
    {
      id: 'student-responsibilities',
      title: '2. Student Responsibilities & Acceptable Use',
      paragraphs: [
        'Students are responsible for maintaining the security of their Google Account and using TNPSC Aspirant Orbit solely for personal exam preparation.',
      ],
      bullets: [
        'Do not share your active account session across multiple users; the platform enforces a single active device session per account.',
        'Do not attempt to scrape, redistribute, or copy study materials, textbooks, or mock test questions for commercial use.',
        'Do not attempt to bypass authentication, rate limits, or platform access controls.',
      ],
    },
    {
      id: 'subscriptions',
      title: '3. Subscriptions & Plan Access',
      paragraphs: [
        'Certain study features or premium plans may require an active subscription as shown on the Subscription page. Subscription availability, pricing, and billing terms are displayed prior to purchase.',
      ],
      adminReviewNote:
        'Specific refund, cancellation, and billing jurisdiction terms are marked for administrator review before final legal publication.',
    },
    {
      id: 'content-availability',
      title: '4. Educational Content & Availability',
      paragraphs: [
        'TNPSC Aspirant Orbit provides study notes, Samacheer Kalvi textbook references, previous year question papers, and mock tests for educational preparation. Administrators may update, publish, or unpublish study content and mock tests at any time to maintain accuracy.',
      ],
    },
    {
      id: 'updates',
      title: '5. Updates to These Terms',
      paragraphs: [
        'These Terms of Service may be updated as TNPSC Aspirant Orbit evolves. Continued use of the platform after updates constitutes acceptance of the revised terms.',
      ],
      adminReviewNote:
        'Legal entity name, governing law, and official legal contact address are marked for administrator review.',
    },
  ] as PolicySection[],
}

export const PRIVACY_POLICY_CONTENT = {
  title: 'Privacy Policy',
  subtitle:
    'How TNPSC Aspirant Orbit handles personal information, cookies, session security, and third-party services.',
  lastReviewedNote: 'Policy version managed by TNPSC Aspirant Orbit administrators (editable for future legal updates).',
  sections: [
    {
      id: 'personal-info',
      title: '1. Information We Collect',
      paragraphs: [
        'We collect only the information necessary to authenticate students and track TNPSC exam preparation progress.',
      ],
      bullets: [
        'Google Account identity verified on our backend: Google Subject ID, verified email address, full name, and profile avatar.',
        'Student study profile fields: selected TNPSC exam group and optional profile details.',
        'Academic records: quiz answers, mock test scores, time spent studying, study streaks, and completed lessons.',
      ],
    },
    {
      id: 'cookies-policy',
      title: '2. Cookies Policy & Browser Storage',
      paragraphs: [
        'Cookies are small text files stored by your web browser when you visit a website. Alongside browser localStorage and sessionStorage, TNPSC Aspirant Orbit uses strictly necessary cookies to authenticate your verified student account, protect active single-device sessions, and remember your cookie consent preferences.',
        'We do not expose authentication tokens or sensitive session values publicly, and we do not use advertising, ad-retargeting, or cross-site marketing trackers. Optional analytics storage is disabled until you explicitly grant consent.',
      ],
      bullets: [
        'Strictly Necessary HTTP Cookies (First-Party, Essential): tnpsc_student_sid (active single-device session ID) and tnpsc_student_token (signed authentication token). Both are set by the backend with HttpOnly, SameSite=Lax, Path=/, and Secure (in production HTTPS), expiring after up to 30 days or immediately upon logout or account deletion.',
        'Strictly Necessary Browser Storage (First-Party, Essential): localStorage keys for active student session state and your saved cookie consent preference (tnpsc_cookie_consent), plus sessionStorage keys for post-login redirects and session-revocation notices.',
        'Functional Storage (First-Party, Optional): localStorage and sessionStorage entries used to coordinate multi-tab study-time tracking (tnpsc_study_tab_leader), cache syllabus metadata, and cache bilingual MCQ translations during a study session.',
        'Analytics Storage (First-Party, Optional — Consent Required): tnpsc_visitor_id (localStorage) and tnpsc_session_id (sessionStorage) used solely for first-party page-view and study-activity metrics on TNPSC Aspirant Orbit. These are not created or transmitted unless you enable Analytics Cookies, and are cleared automatically if you reject or withdraw consent.',
        'Third-Party Services (Loaded On-Demand Only): Google Identity Services (accounts.google.com) loads only when you click Google Sign-In, and Razorpay Checkout (checkout.razorpay.com) loads only when you initiate a subscription payment. Any cookies set by these providers are governed by their respective privacy policies.',
        'Managing Cookie Preferences: You can accept, reject non-essential cookies, customize categories, or withdraw consent at any time using the "Cookie Preferences" control in the Privacy Center.',
        'Disabling Cookies in Browser Settings: You can also block or delete cookies through your browser privacy settings (Chrome, Edge, Firefox, Safari). Please note that disabling strictly necessary cookies will prevent student login, session persistence, and access to protected study modules.',
      ],
    },
    {
      id: 'data-protection',
      title: '3. Data Protection & Access Controls',
      paragraphs: [
        'All Google ID Tokens are verified cryptographically on the backend server using Google’s official authentication library. Protected student APIs require valid session verification, and student learning data is isolated per student account.',
      ],
    },
    {
      id: 'third-party-services',
      title: '4. Third-Party Services Used',
      paragraphs: [
        'TNPSC Aspirant Orbit relies on the following third-party infrastructure providers to operate the service:',
      ],
      bullets: [
        'Google Identity Services / Google OAuth — for verifying student Google Accounts during sign-in.',
        'PostgreSQL cloud database infrastructure — for storing student accounts, study materials, and test records.',
        'Web hosting and content delivery infrastructure (Vercel) — for serving the web application and APIs.',
        'Google Drive integration — where used by administrators to serve official Samacheer Kalvi textbook PDFs.',
      ],
    },
    {
      id: 'policy-updates',
      title: '5. Policy Updates & Contact',
      paragraphs: [
        'We may update this Privacy Policy to reflect improvements in our privacy practices or platform features.',
      ],
      adminReviewNote:
        'Official privacy contact email, grievance officer details, and formal data-deletion timelines are marked for administrator review.',
    },
  ] as PolicySection[],
}
