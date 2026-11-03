const pool = require('../backend/dist/db').default || require('../backend/dist/db');
const { getOverallExtractionOverview, getExtractedPages } = require('../backend/dist/services/pdfExtractionService');

async function test() {
  console.log('Testing getOverallExtractionOverview...');
  const overview = await getOverallExtractionOverview();
  console.log('Overview result:', JSON.stringify(overview, null, 2));

  console.log('\nTesting getExtractedPages for material #313...');
  const pages = await getExtractedPages({ materialId: 313 });
  console.log('Document Header:');
  console.log({
    fileName: pages.fileName,
    pdfId: pages.pdfId,
    materialId: pages.materialId,
    standard: pages.standard,
    subject: pages.subject,
    term: pages.term,
    totalPages: pages.totalPages,
    status: pages.status,
    nativePages: pages.nativePages,
    ocrPages: pages.ocrPages,
    failedPages: pages.failedPages
  });
  console.log('\nSample Page 1:');
  console.log(pages.pages[0]);
  console.log('\nSample Page 5:');
  console.log(pages.pages[4]);

  await pool.end();
}
test().catch(console.error);

