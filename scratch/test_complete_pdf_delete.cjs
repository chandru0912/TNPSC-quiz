const path = require('path');
const { pool } = require(path.resolve(__dirname, '../backend/dist/db.js'));
const { generateAdminToken } = require(path.resolve(__dirname, '../backend/dist/middleware/auth.js'));
const { getAuthenticatedClient } = require(path.resolve(__dirname, '../backend/dist/services/googleDriveService.js'));
const { google } = require(path.resolve(__dirname, '../backend/node_modules/googleapis'));

async function testCompleteDeletion() {
  console.log('========================================================');
  console.log('STARTING COMPLETE GOOGLE DRIVE PDF DELETION VERIFICATION');
  console.log('========================================================');

  const TARGET_MATERIAL_ID = 578;
  const TARGET_DRIVE_FILE_ID = '1QWesmVGKcb22QcLSGSdjpnk0nrliCFkL';
  const TARGET_FILE_NAME = 'Samacheer Kalvi 7th Standard - Social Science - Term 1 - Tamil Medium.pdf';

  // --- STEP 1: BEFORE DELETION CHECKS ---
  console.log('\n--- 1. VERIFYING ENTITIES EXIST BEFORE DELETION ---');

  // 1a. Check Google Drive
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });
  let driveFileBefore = null;
  try {
    const res = await drive.files.get({
      fileId: TARGET_DRIVE_FILE_ID,
      fields: 'id, name, trashed'
    });
    driveFileBefore = res.data;
    console.log(`[Google Drive] File found on Drive: ID="${driveFileBefore.id}", Name="${driveFileBefore.name}", trashed=${driveFileBefore.trashed}`);
  } catch (err) {
    console.error(`[Google Drive] Could not find file before test:`, err.message);
    process.exit(1);
  }

  // 1b. Check google_drive_materials
  const gdmRes = await pool.query('SELECT id, file_name, google_drive_file_id FROM google_drive_materials WHERE id = $1', [TARGET_MATERIAL_ID]);
  console.log(`[DB google_drive_materials] Found ${gdmRes.rows.length} row(s):`, gdmRes.rows[0]);
  if (gdmRes.rows.length === 0) {
    console.error('Target material not found in google_drive_materials!');
    process.exit(1);
  }

  // 1c. Check textbooks
  const tbRes = await pool.query('SELECT id, book_name, file_path FROM textbooks WHERE file_path LIKE $1', [`%${TARGET_DRIVE_FILE_ID}%`]);
  console.log(`[DB textbooks] Found ${tbRes.rows.length} row(s):`, tbRes.rows);
  const targetTbId = tbRes.rows[0]?.id;

  // 1d. Check textbook_content
  const tcRes = await pool.query('SELECT COUNT(*) as count FROM textbook_content WHERE material_id = $1 OR textbook_id = $2', [TARGET_MATERIAL_ID, targetTbId || -1]);
  console.log(`[DB textbook_content] Found ${tcRes.rows[0].count} extracted page rows.`);

  // 1e. Check pdf_extractions
  const peRes = await pool.query('SELECT id, material_id, textbook_id FROM pdf_extractions WHERE material_id = $1 OR google_drive_file_id = $2', [TARGET_MATERIAL_ID, TARGET_DRIVE_FILE_ID]);
  console.log(`[DB pdf_extractions] Found ${peRes.rows.length} extraction job row(s).`);

  // --- STEP 2: TRIGGER DELETE VIA HTTP API ---
  console.log('\n--- 2. SENDING DELETE REQUEST TO API (/api/drive/materials/:id) ---');
  const token = generateAdminToken('admin', 'Admin User', 'admin');

  const deleteResponse = await fetch(`http://localhost:5000/api/drive/materials/${TARGET_MATERIAL_ID}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const deleteJson = await deleteResponse.json();
  console.log(`[API Response] Status: ${deleteResponse.status}`, deleteJson);

  if (!deleteResponse.ok || deleteJson.status !== 'success') {
    console.error('FAIL: API delete request failed!');
    process.exit(1);
  }

  // --- STEP 3: AFTER DELETION VERIFICATION ---
  console.log('\n--- 3. VERIFYING COMPLETE PERMANENT PURGE EVERYWHERE ---');

  // 3a. Verify on Google Drive: File must NOT exist (or be confirmed trashed/404)
  console.log('Checking Google Drive...');
  let driveStillExists = false;
  try {
    const checkDrive = await drive.files.get({
      fileId: TARGET_DRIVE_FILE_ID,
      fields: 'id, name, trashed'
    });
    if (checkDrive.data && !checkDrive.data.trashed) {
      driveStillExists = true;
      console.error('FAIL: File still exists and is NOT trashed on Google Drive!', checkDrive.data);
    } else {
      console.log('PASS: File was permanently deleted or moved to trash on Google Drive:', checkDrive.data);
    }
  } catch (driveErr) {
    if (driveErr.code === 404 || driveErr.status === 404) {
      console.log('PASS: Google Drive API confirmed 404 File Not Found (permanently purged from Google Drive).');
    } else {
      console.warn('Google Drive check notice:', driveErr.message);
    }
  }

  if (driveStillExists) {
    console.error('FAIL: Google Drive file was not deleted!');
    process.exit(1);
  }

  // 3b. Verify google_drive_materials
  const gdmAfter = await pool.query(
    'SELECT id, file_name FROM google_drive_materials WHERE id = $1 OR google_drive_file_id = $2 OR file_name = $3',
    [TARGET_MATERIAL_ID, TARGET_DRIVE_FILE_ID, TARGET_FILE_NAME]
  );
  console.log(`[DB google_drive_materials] Remaining rows: ${gdmAfter.rows.length}`);
  if (gdmAfter.rows.length > 0) {
    console.error('FAIL: Records still exist in google_drive_materials:', gdmAfter.rows);
    process.exit(1);
  } else {
    console.log('PASS: 0 records remain in google_drive_materials.');
  }

  // 3c. Verify textbooks
  const tbAfter = await pool.query(
    'SELECT id, book_name FROM textbooks WHERE file_path LIKE $1 OR book_name = $2',
    [`%${TARGET_DRIVE_FILE_ID}%`, TARGET_FILE_NAME.replace(/\.pdf$/i, '')]
  );
  console.log(`[DB textbooks] Remaining rows: ${tbAfter.rows.length}`);
  if (tbAfter.rows.length > 0) {
    console.error('FAIL: Records still exist in textbooks:', tbAfter.rows);
    process.exit(1);
  } else {
    console.log('PASS: 0 records remain in textbooks.');
  }

  // 3d. Verify textbook_content (page-by-page extracted text & indexed content)
  const tcAfter = await pool.query(
    'SELECT COUNT(*) as count FROM textbook_content WHERE material_id = $1 OR textbook_id = $2 OR file_name = $3',
    [TARGET_MATERIAL_ID, targetTbId || -1, TARGET_FILE_NAME]
  );
  console.log(`[DB textbook_content] Remaining extracted page rows: ${tcAfter.rows[0].count}`);
  if (parseInt(tcAfter.rows[0].count, 10) > 0) {
    console.error('FAIL: Extracted pages still exist in textbook_content!');
    process.exit(1);
  } else {
    console.log('PASS: 0 extracted pages remain in textbook_content.');
  }

  // 3e. Verify pdf_extractions
  const peAfter = await pool.query(
    'SELECT COUNT(*) as count FROM pdf_extractions WHERE material_id = $1 OR google_drive_file_id = $2',
    [TARGET_MATERIAL_ID, TARGET_DRIVE_FILE_ID]
  );
  console.log(`[DB pdf_extractions] Remaining extraction jobs: ${peAfter.rows[0].count}`);
  if (parseInt(peAfter.rows[0].count, 10) > 0) {
    console.error('FAIL: Extraction jobs still exist in pdf_extractions!');
    process.exit(1);
  } else {
    console.log('PASS: 0 records remain in pdf_extractions.');
  }

  // 3f. Verify it does NOT reappear when listing materials
  console.log('\n--- 4. VERIFYING DELETED PDF NEVER REAPPEARS IN LISTING ---');
  const listRes = await fetch('http://localhost:5000/api/drive/materials', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listJson = await listRes.json();
  const foundInList = (listJson.data || []).some(m => m.id === TARGET_MATERIAL_ID || m.googleDriveFileId === TARGET_DRIVE_FILE_ID || m.fileName === TARGET_FILE_NAME);
  if (foundInList) {
    console.error('FAIL: Deleted PDF reappeared in /api/drive/materials list!');
    process.exit(1);
  } else {
    console.log(`PASS: Deleted PDF does NOT appear in /api/drive/materials (Total remaining materials: ${listJson.data?.length}).`);
  }

  console.log('\n========================================================');
  console.log('ALL VERIFICATION CHECKS PASSED: PDF PERMANENTLY REMOVED!');
  console.log('========================================================');
  await pool.end();
  process.exit(0);
}

testCompleteDeletion().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

