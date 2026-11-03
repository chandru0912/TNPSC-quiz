const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
});

const { ClaudeService } = require('../backend/dist/services/ai/providers/claude/claude.service');
const { GeminiService } = require('../backend/dist/services/ai/providers/gemini/gemini.service');

async function testProviders() {
  console.log('Testing Claude...');
  try {
    const claudeRes = await ClaudeService.testConnection();
    console.log('Claude Test Result:', JSON.stringify(claudeRes, null, 2));
  } catch (e) {
    console.error('Claude error:', e);
  }

  console.log('\nTesting Gemini...');
  try {
    const geminiRes = await GeminiService.testConnection();
    console.log('Gemini Test Result:', JSON.stringify(geminiRes, null, 2));
  } catch (e) {
    console.error('Gemini error:', e);
  }

  process.exit(0);
}

testProviders();
