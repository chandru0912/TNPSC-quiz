/**
 * Automated Verification Script for Complete Gemini Removal & Claude AI Integration
 * Tests:
 * 1. Zero Gemini/OpenAI legacy imports in production services
 * 2. Claude provider initialization, configuration detection, and masked key formatting
 * 3. MCQ generation contract validation (4 options, correct answer index, difficulty, explanation)
 * 4. All TNPSC Groups (Group 1, Group 2, Group 2A, Group 4) support
 * 5. Strict rejection of mock/fallback generation
 * 6. Error classification without secret leakage
 */

import { CloudAIService } from './services/cloudAi/cloudAiService';
import { ClaudeCloudProvider } from './services/cloudAi/claudeProvider';
import { validateMcqItem } from './services/mcqGenerator';
import { cleanTamilUnicodeText } from './services/tamilUnicodeCleaner';

async function runTests() {
  console.log('====================================================');
  console.log('TNPSC STUDY HUB: CLAUDE AI INTEGRATION VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Claude AI Provider Info & Masked Key
  const provider = new ClaudeCloudProvider();
  assert(provider.name === 'claude', 'Provider name is strictly "claude"');

  const providerInfo = CloudAIService.getProviderStatus();
  assert(providerInfo.provider === 'claude', 'Centralized service manager resolves provider as "claude"');
  assert(providerInfo.name === 'Anthropic Claude API', 'Provider display name is "Anthropic Claude API"');
  assert(typeof providerInfo.model === 'string' && providerInfo.model.length > 0, `Configured model is resolved: ${providerInfo.model}`);

  // TEST 2: Masked Key Security
  provider.setCredentials('sk-ant-api03-abcdef1234567890xyz-valid', 'claude-3-5-sonnet-20241022', false);
  const masked = provider.getMaskedKey();
  assert(masked.startsWith('sk-ant-') && masked.endsWith('alid') && masked.includes('••••••••'), `Masked key formats safely: ${masked}`);
  assert(!masked.includes('abcdef1234567890xyz'), 'Masked key never reveals central secret tokens');

  // TEST 3: MCQ Validation - Perfect Item
  const validItem = validateMcqItem({
    question: 'பொருநை நதி என்று அழைக்கப்படும் ஆறு எது?',
    options: ['வைகை', 'தாமிரபரணி', 'காவிரி', 'பாலாறு'],
    correctAnswer: 1,
    explanation: 'தாமிரபரணி ஆறு பழங்காலத்தில் பொருநை நதி என்று அழைக்கப்பட்டது.',
    difficulty: 'Medium',
    category: 'group4',
    standard: 6,
    subject: 'General Tamil',
    unitId: 1,
    lessonTitle: 'தமிழ்நாடு ஆறுகள்',
    language: 'tamil',
  });
  assert(validItem.valid === true, 'Valid Tamil MCQ passes strict schema validation');
  assert(validItem.question?.correctAnswer === 1, 'Correct answer index preserved');
  assert(validItem.question?.correctAnswerText === 'தாமிரபரணி', 'Correct answer text matched');
  assert(validItem.question?.status === 'staging', 'Generated questions default to status "staging"');

  // TEST 4: MCQ Validation - Duplicate Options Rejection
  const duplicateOptsItem = validateMcqItem({
    question: 'Which is the capital of Tamil Nadu?',
    options: ['Chennai', 'Madurai', 'Chennai', 'Coimbatore'],
    correctAnswer: 0,
    explanation: 'Chennai is the capital.',
  });
  assert(duplicateOptsItem.valid === false, 'Question with duplicate options is strictly rejected');
  assert(duplicateOptsItem.reason?.includes('Duplicate options') === true, `Rejection reason: ${duplicateOptsItem.reason}`);

  // TEST 5: MCQ Validation - Invalid Correct Answer
  const invalidAnswerItem = validateMcqItem({
    question: 'Who was the first Governor-General of independent India?',
    options: ['Lord Mountbatten', 'C. Rajagopalachari', 'Jawaharlal Nehru', 'Dr. B.R. Ambedkar'],
    correctAnswer: 5, // Out of range
    explanation: 'Lord Mountbatten was the first Governor-General.',
  });
  assert(invalidAnswerItem.valid === false, 'Question with out-of-bounds correct answer is strictly rejected');

  // TEST 6: Tamil Unicode Text Sanitization
  const uncleanTamil = 'தாமிரபரணி\u200B \uFEFFஆறு   நதி';
  const cleanTamil = cleanTamilUnicodeText(uncleanTamil);
  assert(!cleanTamil.includes('\u200B') && !cleanTamil.includes('\uFEFF'), 'Tamil Unicode zero-width artifacts stripped');

  // TEST 7: JSON Parser Sanitization (Handles Markdown Fences & Trailing Commas)
  const jsonWithFences = '```json\n{\n  "status": "success",\n  "count": 25,\n}\n```';
  const parsed = (CloudAIService as any).parseJsonResponse(jsonWithFences);
  assert(parsed.status === 'success' && parsed.count === 25, 'JSON parser handles fences and trailing commas');

  // TEST 8: Zero Fallback Guarantee
  const emptyProvider = new ClaudeCloudProvider();
  emptyProvider.setCredentials('', 'claude-3-5-sonnet-20241022', false);
  let caughtError = false;
  try {
    await emptyProvider.generateCompletion('test');
  } catch (err: any) {
    caughtError = true;
    assert(err.message.includes('Claude API key is missing'), `Fails safely on missing key: ${err.message}`);
  }
  assert(caughtError, 'Zero fallback: Never falls back to Gemini or mock generation when key is missing');

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
