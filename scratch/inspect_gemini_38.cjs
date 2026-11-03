const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
});

const { GoogleGenerativeAI } = require(path.join(__dirname, '../backend/node_modules/@google/generative-ai'));

async function inspectGemini38() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8'];

  for (const m of models) {
    try {
      console.log(`Trying model: ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Reply with: Gemini connection OK');
      console.log(`SUCCESS for ${m}:`, res.response.text());
      break;
    } catch (e) {
      console.log(`Failed for ${m}:`, e.message || e);
    }
  }

  process.exit(0);
}

inspectGemini38();

