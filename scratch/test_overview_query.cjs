const pool = require('../backend/dist/db').default || require('../backend/dist/db');

async function run() {
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total_files,
      COALESCE(SUM(COALESCE(total_pages, page_count, 0)), 0)::int AS total_pages,
      COALESCE(SUM(COALESCE(native_pages, 0) + COALESCE(ocr_pages, 0)), 0)::int AS extracted_pages,
      COALESCE(SUM(COALESCE(failed_pages, 0)), 0)::int AS failed_pages,
      COALESCE(SUM(COALESCE(native_pages, 0)), 0)::int AS native_pages,
      COALESCE(SUM(COALESCE(ocr_pages, 0)), 0)::int AS ocr_pages,
      COUNT(*) FILTER (WHERE extraction_status = 'COMPLETED')::int AS count_completed,
      COUNT(*) FILTER (WHERE extraction_status = 'PARTIALLY_COMPLETED')::int AS count_partial,
      COUNT(*) FILTER (WHERE extraction_status IN ('PROCESSING', 'EXTRACTING', 'OCR_PROCESSING', 'DETECTING'))::int AS count_processing,
      COUNT(*) FILTER (WHERE extraction_status IN ('PENDING') OR extraction_status IS NULL)::int AS count_pending,
      COUNT(*) FILTER (WHERE extraction_status = 'FAILED')::int AS count_failed
    FROM google_drive_materials
  `);
  console.log('Overview stats:', res.rows[0]);
  await pool.end();
}
run().catch(console.error);

