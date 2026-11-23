import assert from 'node:assert/strict'
import 'dotenv/config'
import pool from '../db'
import {
  bulkUpdateDriveTextbookPublication,
  classifyDriveTextbookMetadata,
  ensureDriveTextbookLibrarySchema,
  getPublishedStudentLibraryForStandard,
} from '../services/googleDriveTextbookLibraryService'
import { getConnectionStatus } from '../services/googleDriveService'

async function main() {
  console.log('=== 1. Schema & Zero-Binary Storage Verification ===')
  await ensureDriveTextbookLibrarySchema()
  const colRes = await pool.query<{ column_name: string; data_type: string }>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'textbooks'
    ORDER BY ordinal_position
  `)
  const binaryCols = colRes.rows.filter(
    (r: { column_name: string; data_type: string }) => String(r.data_type).toLowerCase() === 'bytea'
  )
  assert.equal(binaryCols.length, 0, 'textbooks table MUST NOT contain any BYTEA binary columns')
  const colNames = new Set(colRes.rows.map((r: { column_name: string; data_type: string }) => r.column_name))
  for (const required of [
    'google_drive_file_id',
    'google_drive_parent_folder_id',
    'volume',
    'file_name',
    'mime_type',
    'drive_modified_time',
    'drive_folder_path',
    'drive_available',
    'publication_status',
    'last_synced_at',
  ]) {
    assert.ok(colNames.has(required), `Missing required metadata column: ${required}`)
  }
  console.log(`PASS: textbooks schema has ${colRes.rows.length} metadata columns and 0 BYTEA binary columns.`)

  console.log('\n=== 2. Dynamic Hierarchy Classifier Unit Tests ===')
  const std6Term1 = classifyDriveTextbookMetadata('6th_Science_Term1_EM.pdf', [
    'TNPSC Study Hub Textbooks',
    '6th Standard',
    'Term 1',
    'English Medium',
  ])
  assert.equal(std6Term1.standard, 6)
  assert.equal(std6Term1.term, 'Term 1')
  assert.equal(std6Term1.volume, null, '6th–10th must NEVER force Volume')
  assert.equal(std6Term1.medium, 'English')
  assert.equal(std6Term1.subject, 'Science')

  const std10Full = classifyDriveTextbookMetadata('10th_Social_Science_TM.pdf', [
    'TNPSC Study Hub Textbooks',
    '10th Standard',
    'Tamil Medium',
  ])
  assert.equal(std10Full.standard, 10)
  assert.equal(std10Full.term, null)
  assert.equal(std10Full.volume, null)
  assert.equal(std10Full.medium, 'Tamil')
  assert.equal(std10Full.subject, 'Social Science')

  const std11Vol2 = classifyDriveTextbookMetadata('11th_Physics_Volume_2_EM.pdf', [
    'TNPSC Study Hub Textbooks',
    '11th Standard',
    'Volume 2',
    'English Medium',
  ])
  assert.equal(std11Vol2.standard, 11)
  assert.equal(std11Vol2.volume, 'Volume 2')
  assert.equal(std11Vol2.term, null, '11th–12th must NEVER force Term')
  assert.equal(std11Vol2.medium, 'English')
  assert.equal(std11Vol2.subject, 'Physics')

  const std12Vol1 = classifyDriveTextbookMetadata('12th_History_Vol1_TM.pdf', [
    'TNPSC Study Hub Textbooks',
    '12th Standard',
    'Tamil Medium',
  ])
  assert.equal(std12Vol1.standard, 12)
  assert.equal(std12Vol1.volume, 'Volume 1')
  assert.equal(std12Vol1.term, null, '11th–12th must NEVER force Term')
  assert.equal(std12Vol1.medium, 'Tamil')
  assert.equal(std12Vol1.subject, 'History')
  console.log('PASS: 6th–10th Term hierarchy & 11th–12th Volume hierarchy classified accurately.')

  console.log('\n=== 3. Published-Only Student Library Isolation Test (Live Neon DB) ===')
  const testDriveId = `smoke_test_drive_file_${Date.now()}`
  let insertedId: number | null = null
  try {
    const ins = await pool.query(
      `INSERT INTO textbooks (
         group_id, book_name, standard, subject, medium, term, volume,
         file_path, google_drive_file_id, file_name, mime_type, file_size,
         drive_folder_path, drive_available, publication_status, status, last_synced_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,'pending_review','uploaded',NOW())
       RETURNING id`,
      [
        'group1',
        '11th Standard Physics Volume 1 (English Medium)',
        11,
        'Physics',
        'English',
        null,
        'Volume 1',
        `gdrive://${testDriveId}`,
        testDriveId,
        '11th_Physics_Vol1_EM.pdf',
        'application/pdf',
        12582912,
        'TNPSC Study Hub Textbooks/11th Standard/Volume 1/English Medium/11th_Physics_Vol1_EM.pdf',
      ]
    )
    insertedId = Number(ins.rows[0].id)

    const beforePublish = await getPublishedStudentLibraryForStandard(11)
    assert.equal(beforePublish.hierarchyType, 'volume')
    assert.equal(
      beforePublish.books.some((b) => b.id === insertedId),
      false,
      'Pending-review book MUST NOT be visible in Student Library'
    )

    await bulkUpdateDriveTextbookPublication([insertedId], 'publish')
    const afterPublish = await getPublishedStudentLibraryForStandard(11)
    const found = afterPublish.books.find((b) => b.id === insertedId)
    assert.ok(found, 'Published book MUST appear in Student Library')
    assert.equal(found.volume, 'Volume 1')
    assert.equal(found.term, null)
    assert.equal(found.googleDriveFileId, testDriveId)
    assert.ok(afterPublish.availableVolumes.includes('Volume 1'))

    await bulkUpdateDriveTextbookPublication([insertedId], 'remove')
    const afterRemove = await getPublishedStudentLibraryForStandard(11)
    assert.equal(
      afterRemove.books.some((b) => b.id === insertedId),
      false,
      'Removed/unpublished book MUST disappear from Student Library'
    )
    console.log('PASS: Pending -> Publish -> Student Visible -> Remove -> Hidden lifecycle verified.')
  } finally {
    if (insertedId !== null) {
      await pool.query(`DELETE FROM textbooks WHERE id = $1`, [insertedId])
    }
  }

  console.log('\n=== 4. Live Google Drive Connection Check ===')
  const driveStatus = await getConnectionStatus(true)
  console.log('Google Drive Status:', JSON.stringify({
    configured: driveStatus.configured,
    connected: driveStatus.connected,
    connectionState: driveStatus.connectionState,
    email: driveStatus.email || null,
    errorSource: driveStatus.errorSource || null,
    error: driveStatus.error || null,
  }))

  await pool.end()
  console.log('\nALL CHECKS PASSED.')
}

main().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
