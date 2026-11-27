export interface PrivacyPolicySubsection {
  label: string
  paragraphs: string[]
  bullets?: string[]
}

export interface PrivacyPolicySection {
  id: string
  number: number
  title: string
  paragraphs: string[]
  bullets?: string[]
  subsections?: PrivacyPolicySubsection[]
  table?: {
    headers: string[]
    rows: string[][]
  }
  note?: string
  showCookieControls?: boolean
}

export interface PrivacyPolicyDocument {
  title: string
  subtitle: string
  effectiveDateLabel: string
  effectiveDateValue: string
  lastUpdatedLabel: string
  lastUpdatedValue: string
  legalReviewBanner: string
  sections: PrivacyPolicySection[]
}

export const PRIVACY_POLICY_METADATA = {
  effectiveDate: 'November 27, 2026',
  lastUpdated: 'November 27, 2026',
}

export const PRIVACY_POLICY_DOCUMENT: PrivacyPolicyDocument = {
  title: 'Privacy Policy',
  subtitle:
    'A transparent, technically accurate explanation of what information TNPSC Study Hub collects, why we collect it, how it is used and protected, and the privacy rights available to students.',
  effectiveDateLabel: 'Effective Date',
  effectiveDateValue: PRIVACY_POLICY_METADATA.effectiveDate,
  lastUpdatedLabel: 'Last Updated',
  lastUpdatedValue: PRIVACY_POLICY_METADATA.lastUpdated,
  legalReviewBanner:
    'Notice: This Privacy Policy is based on the verified technical implementation of TNPSC Study Hub. Before final legal publication, administrator configuration of verified contact details and review by a qualified Indian privacy/legal professional are recommended.',
  sections: [
    {
      id: 'introduction',
      number: 1,
      title: 'Introduction',
      paragraphs: [
        'Welcome to TNPSC Study Hub. Protecting your privacy and handling your personal information transparently is a core responsibility of our platform.',
        'This Privacy Policy explains what personal and technical data TNPSC Study Hub actually collects, how and why it is processed, where it is stored, which third-party services are involved, and how students can update or delete their account information.',
      ],
    },
    {
      id: 'about-platform',
      number: 2,
      title: 'About TNPSC Study Hub',
      paragraphs: [
        'TNPSC Study Hub is an online exam preparation platform built for students preparing for Tamil Nadu Public Service Commission (TNPSC) examinations, including Group 1, Group 2, Group 2A, and Group 4 & VAO.',
        'The platform provides Samacheer Kalvi Textbook Library access (6th–12th Standard), Study Materials, MCQ Practice, Unit Wise and Full-Length Mock Tests, Previous Year Question Papers, Mark List, Performance Analytics, and Progress Tracking.',
      ],
      note: 'Legal Entity Name & Registered Business Address: [Pending Administrator Review and Configuration].',
    },
    {
      id: 'scope',
      number: 3,
      title: 'Scope of This Privacy Policy',
      paragraphs: [
        'This Privacy Policy applies to all student-facing web pages, authentication flows, learning modules, mock tests, subscription checkout flows, and backend APIs operated by TNPSC Study Hub.',
        'External websites or third-party platforms (such as Google and Razorpay) are governed by their respective privacy policies.',
      ],
    },
    {
      id: 'information-collected',
      number: 4,
      title: 'Information We Collect',
      paragraphs: [
        'TNPSC Study Hub collects only the information needed to authenticate student accounts, deliver learning modules, process subscriptions, and secure the platform:',
      ],
      bullets: [
        'Account and registration information (full name, username, verified email, student ID, selected TNPSC exam category).',
        'Google authentication data (Google Subject ID, profile image URL, active session metadata).',
        'Student learning, study time, MCQ practice, mock test, and previous paper activity data.',
        'Subscription plan and Razorpay payment transaction records.',
        'Device, browser, session cookie, and technical usage metadata.',
      ],
    },
    {
      id: 'account-registration',
      number: 5,
      title: 'Account and Registration Information',
      paragraphs: [
        'When you register or sign in through a verified Google Account, the following account fields are stored in our PostgreSQL database (students table):',
      ],
      bullets: [
        'Full Name and system-generated Student ID.',
        'Google-verified Email Address and unique Google Subject ID (sub).',
        'Profile avatar URL supplied by Google OAuth.',
        'Selected TNPSC examination category (Group 1, Group 2, Group 2A, or Group 4).',
        'Account creation timestamp, last login timestamp, and account status.',
        'Optional or editable profile fields managed through Profile / Account Settings: Full Name, Username, Mobile Number (optional), Tamil Nadu District (optional), and Target Exam Group.',
      ],
    },
    {
      id: 'google-authentication',
      number: 6,
      title: 'Google Login and Authentication',
      paragraphs: [
        'Student registration and login on TNPSC Study Hub are restricted exclusively to verified Google Accounts using Google Identity Services. Manual email-only registration, password-only student login, and student password-reset endpoints are disabled.',
        'Every Google authorization code or ID Token is verified on our Express backend using the official google-auth-library (OAuth2Client.verifyIdToken), validating the cryptographic Google signature, Client ID audience, Google issuer, token expiration, Subject ID, and email_verified === true status.',
        'We accept Google-verified Gmail accounts and Google Workspace accounts with a verified hosted-domain (hd) claim matching the email domain. For account security, TNPSC Study Hub enforces a Single Active Device Session per student account and logs successful login timestamps along with device type, browser name, and operating system.',
      ],
    },
    {
      id: 'learning-activity',
      number: 7,
      title: 'Student Learning and Activity Data',
      paragraphs: [
        'To power your Student Dashboard, Performance Analytics, and Progress Tracker, we store your actual learning interactions:',
      ],
      bullets: [
        'Study time tracking and page session heartbeats (study_sessions).',
        'Study Materials accessed, reading duration, and lesson completion status (study_material_progress).',
        'Question-level practice attempts, selected options, correctness, subject/topic tags, and time spent (question_attempts).',
        'Daily learning streaks: daily questions count, study seconds, mock tests count, and study notes count (daily_streaks).',
        'Optional consent-based Tamil Nadu district detection on login (student_login_locations): if GPS consent is granted, coordinates are resolved server-side to a district name only and raw latitude/longitude are never stored.',
      ],
    },
    {
      id: 'mock-tests-results',
      number: 8,
      title: 'Mock Tests and Examination Results',
      paragraphs: [
        'When you take Unit Wise Mock Tests, Full-Length Mock Tests, or Previous Year Question Papers, the platform records:',
      ],
      bullets: [
        'In-progress exam session state (mock_test_sessions: saved answers, current question index, expiry time).',
        'Completed assessment submissions (mock_test_attempts: total, attempted, correct, incorrect, and unanswered counts, score, max score, percentage, grade, and achievement award tier).',
        'Subject-wise breakdown, topic-wise breakdown, and question-by-question response history for answer review.',
        'First-attempt, latest-attempt, best-attempt, and average-score statistics shown in Mark List, Performance Analytics, and Progress Tracker.',
      ],
    },
    {
      id: 'subscription-payment',
      number: 9,
      title: 'Subscription and Payment Information',
      paragraphs: [
        'Paid subscription plans (MCQ Practice, Mock Test, Previous Papers, Test Batch) are processed through Razorpay.',
        'TNPSC Study Hub stores only transaction and entitlement records in PostgreSQL (subscription_transactions and student_module_entitlements):',
      ],
      bullets: [
        'Subscription plan ID, plan name snapshot, and configured plan price.',
        'Amount paid, tax/discount/refund amounts (if applicable), and currency (INR).',
        'Razorpay Order ID, Razorpay Payment ID, general payment method category, payment status, subscription status, and activation/expiry timestamps.',
        'Student email snapshot at the time of transaction (student_email_snapshot).',
      ],
      note: 'Payment Credential Assurance: TNPSC Study Hub does NOT collect or store debit/credit card numbers, CVV codes, net-banking passwords, or UPI PINs. All payment credentials are handled directly by Razorpay.',
    },
    {
      id: 'technical-data',
      number: 10,
      title: 'Device, Browser and Technical Information',
      paragraphs: [
        'Certain technical data is collected automatically to operate, analyze, and protect the website:',
      ],
      bullets: [
        'Device category (desktop, mobile, tablet), browser name, and operating system.',
        'First-party visitor ID, session ID, visited page paths, page titles, and HTTP referrer (subject to your analytics cookie consent).',
        'IP address (req.ip) used transiently on the backend for API/login rate limiting and abuse protection.',
        'Standard hosting server access logs and error logs generated by Vercel and the Express backend for troubleshooting.',
      ],
    },
    {
      id: 'how-we-use',
      number: 11,
      title: 'How We Use Your Information',
      paragraphs: ['We process student information strictly for the following implemented purposes:'],
      bullets: [
        'Creating, authenticating, and maintaining verified Google student accounts.',
        'Delivering Study Materials, Samacheer Kalvi textbooks, MCQ Practice, Mock Tests, and Previous Year Papers.',
        'Tracking study time, lesson completion, mock test performance, mark lists, and progress analytics.',
        'Managing subscriptions and verifying payments via Razorpay.',
        'Enforcing single-device security, rate limiting, fraud/abuse prevention, and technical troubleshooting.',
      ],
    },
    {
      id: 'third-party-services',
      number: 12,
      title: 'Third-Party Services and Integrations',
      paragraphs: [
        'The following verified third-party services are integrated into TNPSC Study Hub. Admin-only AI integrations (Anthropic Claude / Google Gemini) are restricted to administrator content creation/translation and do NOT receive student personal information.',
      ],
      table: {
        headers: ['Provider', 'Purpose', 'Receives Student Personal Data?'],
        rows: [
          ['Google Identity Services / Google OAuth', 'Student Google Account authentication & ID Token verification', 'Yes — OAuth code / verified Google profile claims'],
          ['Razorpay', 'Subscription order creation, payment verification, webhooks', 'Yes — order & payment details for paying students'],
          ['Neon (AWS PostgreSQL)', 'Primary managed PostgreSQL database hosting', 'Yes — stores student account, learning, and transaction records over SSL/TLS'],
          ['Vercel', 'Frontend & Express API serverless hosting', 'Yes — processes HTTP requests and standard server logs'],
          ['Google Drive API', 'Admin-managed Samacheer Kalvi textbook PDF streaming via backend proxy', 'No — student personal data is not sent to Google Drive'],
          ['Anthropic Claude / Google Gemini (Admin Only)', 'Admin content/MCQ generation & translation', 'No — student personal data is not sent to AI providers'],
        ],
      },
    },
    {
      id: 'data-sharing',
      number: 13,
      title: 'Data Sharing and Disclosure',
      paragraphs: [
        'TNPSC Study Hub does not sell, rent, or trade student personal information.',
        'Information is shared only with the essential infrastructure and payment providers listed above to deliver the service, or when required to comply with applicable Indian law, court orders, lawful government requests, or to protect platform security.',
      ],
    },
    {
      id: 'data-storage-hosting',
      number: 14,
      title: 'Data Storage and Hosting',
      paragraphs: [
        'Student account, learning, mock test, and subscription records are stored in a managed Neon PostgreSQL database. The React + Vite frontend and Node.js + Express backend are hosted on Vercel.',
        'Official textbook PDFs are served through our backend proxy from administrator-configured Google Drive storage.',
      ],
    },
    {
      id: 'data-security',
      number: 15,
      title: 'Data Security',
      paragraphs: ['The following security safeguards are verified in the TNPSC Study Hub codebase:'],
      bullets: [
        'HTTPS/TLS transport encryption and Helmet security headers (including HSTS in production).',
        'Server-side cryptographic Google ID Token verification using google-auth-library.',
        'HMAC-SHA256 signed session tokens with HttpOnly, SameSite=Lax, and production Secure cookies.',
        'Single Active Device Session enforcement with instant server-side revocation.',
        'Role-Based Access Control separating Student routes from Administrator routes.',
        'Razorpay HMAC-SHA256 payment/webhook signature verification and express-rate-limit protection.',
      ],
      note: 'While no online service can guarantee absolute security, we apply practical technical safeguards appropriate to the platform.',
    },
    {
      id: 'data-retention',
      number: 16,
      title: 'Data Retention',
      paragraphs: [
        'Student profile, study progress, mock test attempts, and mark list records are retained while your account remains active so your learning history stays available.',
        'When you permanently delete your account, your student profile and associated learning/test records are deleted immediately. Subscription transaction records (subscription_transactions) remain retained with the student_id foreign key cleared (ON DELETE SET NULL) for financial, accounting, and tax compliance.',
      ],
      note: 'Automated retention schedules for inactive accounts and server logs: [Pending Administrator Review and Configuration].',
    },
    {
      id: 'privacy-rights',
      number: 17,
      title: 'Student Privacy Rights',
      paragraphs: ['Students have the following rights and controls:'],
      bullets: [
        'Right to Access: View your profile, learning analytics, and attempt history inside the Student Dashboard.',
        'Right to Correction: Update your full name, username, mobile number, and target exam group in Account Settings.',
        'Right to Erasure: Permanently delete your student account through Account Settings.',
        'Right to Withdraw Consent and Right to Grievance Redressal.',
      ],
    },
    {
      id: 'account-updates',
      number: 18,
      title: 'Account Information Updates',
      paragraphs: [
        'You can update your Full Name, Username (with real-time availability check), Mobile Number, and Target TNPSC Exam Group at any time via Profile / Account Settings (PUT /api/student/profile). Your verified email address is tied to your authenticated Google Account.',
      ],
    },
    {
      id: 'account-deletion',
      number: 19,
      title: 'Account Deletion',
      paragraphs: [
        'TNPSC Study Hub supports permanent self-service account deletion (DELETE /api/student/account). To confirm deletion, you must enter your registered email address and type "DELETE".',
        'Upon confirmation, your active sessions are revoked immediately, cookies are cleared, and your student record is deleted from PostgreSQL. Cascading deletion permanently removes study_sessions, question_attempts, mock_test_attempts, mock_test_sessions, study_material_progress, student_activity, daily_streaks, student_module_entitlements, and student_sessions.',
        'Deleted account and learning data cannot be recovered. Financial transaction records (subscription_transactions) and anonymized visitor_sessions have student_id set to NULL for accounting/legal continuity.',
      ],
    },
    {
      id: 'withdrawal-of-consent',
      number: 20,
      title: 'Withdrawal of Consent',
      paragraphs: [
        'You may update or withdraw optional cookie consent at any time using the Manage Cookie Preferences controls below, and you may revoke optional location permissions in your browser settings. To withdraw consent for platform data processing entirely, you may sign out and permanently delete your student account.',
      ],
    },
    {
      id: 'childrens-privacy',
      number: 21,
      title: "Children's Privacy",
      paragraphs: [
        'Although TNPSC competitive examinations primarily serve adult aspirants, TNPSC Study Hub also hosts 6th–12th Standard Samacheer Kalvi textbooks. The current registration system does not collect age or date of birth.',
        'Under India’s Digital Personal Data Protection Act, 2023 (DPDP Act, 2023), individuals under 18 years of age are classified as children. Students under 18 should use this platform only with the consent and supervision of a parent or lawful guardian.',
      ],
      note: 'Age-gating and verifiable parental consent workflows: [Pending Administrator & Legal Review].',
    },
    {
      id: 'international-transfers',
      number: 22,
      title: 'International Data Processing',
      paragraphs: [
        'Certain infrastructure and service providers used by TNPSC Study Hub (including Google, Vercel, and Neon/AWS cloud infrastructure) operate global data centers. Accordingly, your data may be processed or stored outside India subject to the security and contractual frameworks of those providers and applicable Indian law.',
      ],
    },
    {
      id: 'data-breach',
      number: 23,
      title: 'Data Breach and Security Incident Handling',
      paragraphs: [
        'In the event of a confirmed personal data breach, TNPSC Study Hub will take prompt containment measures (including revoking affected sessions and remediating root causes) and notify affected students and applicable authorities in accordance with Indian law.',
      ],
    },
    {
      id: 'policy-changes',
      number: 24,
      title: 'Changes to This Privacy Policy',
      paragraphs: [
        'We may update this Privacy Policy periodically to reflect platform improvements or legal requirements. The Effective Date and Last Updated Date at the top of this page will be updated whenever revisions are published.',
      ],
    },
    {
      id: 'cookies-sessions',
      number: 25,
      title: 'Cookies and Session Management',
      paragraphs: [
        'This section explains how TNPSC Study Hub uses cookies and browser storage technologies, what each verified mechanism does, and how you can control your cookie preferences.',
      ],
      subsections: [
        {
          label: 'A. What Are Cookies?',
          paragraphs: [
            'Cookies are small text files stored on your browser by a website when you visit it. Along with browser LocalStorage and SessionStorage, they help websites remember your authenticated session, enforce security protections, save your preferences, and support core application features.',
          ],
        },
        {
          label: 'B. Why We Use Cookies',
          paragraphs: ['TNPSC Study Hub uses cookies and browser storage for the following verified purposes:'],
          bullets: [
            'Authentication and login sessions: verifying your signed-in student session across API requests.',
            'Session management: enforcing Single Active Device Session security and handling post-login redirects.',
            'Security: protecting authenticated sessions via HttpOnly, SameSite=Lax, and production Secure cookie flags.',
            'User preferences: storing your saved cookie consent choice and study interface sync state.',
            'Website functionality & optional first-party analytics: preventing duplicate study-time counting across tabs and, when consented, measuring page usage.',
          ],
        },
        {
          label: 'C. Types of Cookies',
          paragraphs: ['We organize cookies and browser storage on TNPSC Study Hub into four clear categories:'],
          bullets: [
            'Strictly Necessary Cookies & Storage: Essential for student login, session verification, single-device revocation, and storing your cookie consent decision. These cannot be disabled without breaking core login functionality.',
            'Functional Storage: Supports multi-tab study-time coordination, live syllabus/content sync notifications, and temporary MCQ translation caching.',
            'Analytics Storage (Optional): First-party visitor and session identifiers used by our internal analytics tracker to understand page usage. Optional analytics storage is cleared and paused if you reject analytics consent.',
            'Third-Party Cookies: Set only by verified external providers directly invoked during Google Sign-In or Razorpay Checkout. We do NOT use advertising cookies or third-party ad tracking pixels.',
          ],
        },
        {
          label: 'D. Cookie Information',
          paragraphs: [
            'The table below lists the actual cookies and browser storage keys verified in the TNPSC Study Hub codebase:',
          ],
        },
      ],
      table: {
        headers: ['Name / Key', 'Type & Provider', 'Purpose', 'Duration / Expiry'],
        rows: [
          ['tnpsc_student_sid', 'HttpOnly Cookie (First-Party, SameSite=Lax)', 'Active student session identifier for single-device enforcement', 'Matches active student session expiry (cleared on logout)'],
          ['tnpsc_student_token', 'HttpOnly Cookie & LocalStorage (First-Party)', 'Signed student authentication token', 'Matches active student session expiry (cleared on logout)'],
          ['tnpsc_student_user', 'LocalStorage (First-Party, Essential)', 'Cached student profile summary for UI hydration & cross-tab sync', 'Persists until logout or browser storage is cleared'],
          ['tnpsc_cookie_consent', 'LocalStorage (First-Party, Essential)', 'Stores your selected cookie consent preferences', 'Persists until updated or browser storage is cleared'],
          ['tnpsc_study_tab_leader, tnpsc_syllabus_sync_ping', 'LocalStorage (First-Party, Functional)', 'Prevents double-counting study time across tabs and syncs published updates', 'Persists until cleared'],
          ['tnpsc_post_login_redirect, tnpsc_session_revoked_msg', 'SessionStorage (First-Party, Functional)', 'Stores post-login redirect URL and session-revoked notice', 'Cleared when browser tab/session closes'],
          ['tnpsc_visitor_id, tnpsc_session_id', 'LocalStorage / SessionStorage (First-Party, Analytics)', 'First-party usage analytics identifiers (subject to analytics consent)', 'Session-scoped / cleared if analytics consent is withdrawn'],
        ],
      },
      note: 'E. Cookie Preferences: You can accept all cookies, reject non-essential cookies, customize individual categories, or change/withdraw your optional cookie consent at any time using the "Manage Cookie Preferences" button below. F. Managing Cookies: You can also view, block, or delete cookies through your browser settings (Chrome, Safari, Firefox, Edge); disabling strictly necessary cookies will prevent signing in. G. Third-Party Cookies: Only Google Identity Services (during Google Sign-In) and Razorpay (during subscription checkout) may set third-party cookies on their respective domains; no advertising or social tracking cookies are used.',
      showCookieControls: true,
    },
    {
      id: 'contact-grievance',
      number: 26,
      title: 'Contact and Grievance Redressal',
      paragraphs: [
        'For privacy questions, data rights requests, or grievances, students may contact our privacy support channel once configured by the site administrator.',
        'This Privacy Policy has been prepared with reference to the Information Technology Act, 2000, the Digital Personal Data Protection Act, 2023 (noting phased statutory commencement), and the Digital Personal Data Protection Rules, 2025. Independent review by a qualified Indian privacy/legal professional is recommended prior to final legal publication.',
      ],
      note: 'Grievance Officer Name, Verified Privacy Contact Email, and Postal Address: [Pending Administrator Configuration — must be populated prior to final public legal publication].',
    },
    {
      id: 'effective-date',
      number: 27,
      title: 'Effective Date and Last Updated Date',
      paragraphs: [
        `Effective Date: ${PRIVACY_POLICY_METADATA.effectiveDate}`,
        `Last Updated: ${PRIVACY_POLICY_METADATA.lastUpdated}`,
      ],
    },
  ],
}
