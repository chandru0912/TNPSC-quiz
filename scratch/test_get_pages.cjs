const pool = require('../backend/dist/db').default || require('../backend/dist/db');
const { getExtractedPages } = require('../backend/dist/services/pdfExtractionService');

async function run() {
  const res = await getExtractedPages({ materialId: 313 });
  console.log('Total pages:', res.totalPages);
  console.log('First page:', res.pages[0]);
  console.log('Page 10:', res.pages[9]);
  await pool.end();
}
run().catch(console.error);

