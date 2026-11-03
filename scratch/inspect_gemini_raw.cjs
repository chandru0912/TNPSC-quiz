const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
});

const { GoogleGenerativeAI } = require(path.join(__dirname, '../backend/node_modules/@google/generative-ai'));

async function inspectGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Gemini API key prefix:', apiKey ? apiKey.slice(0, 8) + '...' : 'none');
  const genAI = new GoogleGenerativeAI(apiKey);

  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-pro'];

  for (const m of models) {
    try {
      console.log(`Trying model: ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Hello');
      console.log(`SUCCESS for ${m}:`, res.response.text());
      break;
    } catch (e) {
      console.log(`Failed for ${m}:`, e.message || e);
    }
  }

  process.exit(0);
}

inspectGemini();

