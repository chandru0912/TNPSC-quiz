const { GoogleGenerativeAI } = require('@google/generative-ai');
require('./dist/db');
(async () => {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const genAI = new GoogleGenerativeAI(key);
  const models = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite'];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const r = await model.generateContent('Reply with exactly: ok');
      console.log(m, '=> OK', r.response.text().trim().slice(0, 40));
    } catch (e) {
      console.log(m, 'ERR', String(e.message).slice(0, 180));
    }
  }
})();
