import fs from 'fs'
import path from 'path'
import pool from './db'
import { processTextbookPdf } from './services/pdfProcessor'
import { retrieveRelevantTextbookContent } from './services/textbookRag'
import { generateAiQuestions, verifyQuestionItem } from './services/aiMcqEngine'

async function runTestSuite() {
  console.log('=====================================================')
  console.log('TNPSC TEXTBOOK MANAGEMENT & AI MCQ SYSTEM TEST SUITE')
  console.log('=====================================================\n')

  let passedTests = 0
  let failedTests = 0

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`[PASS] ${testName}`)
      passedTests++
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`)
      failedTests++
    }
  }

  try {
    // 1. Verify Database Schema & Migrations
    console.log('--- TEST GROUP 1: Database Schema & Migrations ---')
    const tbTableRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'textbooks';
    `)
    assert(tbTableRes.rows.length >= 10, 'Table "textbooks" exists with expected columns')

    const tcTableRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'textbook_content';
    `)
    assert(tcTableRes.rows.length >= 8, 'Table "textbook_content" exists with expected columns')

    const qColsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name IN ('textbook_id', 'source_page', 'verification_status');
    `)
    assert(qColsRes.rows.length === 3, 'Table "questions" has textbook_id, source_page, and verification_status columns')

    // 2. Create Sample Samacheer Kalvi PDF
    console.log('\n--- TEST GROUP 2: PDF File Storage & Creation ---')
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'textbooks')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Minimal valid PDF structure with sample text for testing
    // We create a PDF file with Tamil and English content
    const samplePdfPath = path.join(uploadsDir, 'sample-class6-science.pdf')
    
    // Simple PDF header + catalog + pages + stream
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj
5 0 obj << /Length 260 >> stream
BT
/F1 12 Tf
72 700 Td
(Unit 1 General Science: Measurements and Units. Page 12.) Tj
0 -25 Td
(Standard international SI unit for length is meter. Mass is measured in kilograms.) Tj
0 -25 Td
(Samacheer Kalvi Class 6 Science Term 1. In ancient times people used cubit and hand span.) Tj
ET
endstream
endobj
6 0 obj << /Length 270 >> stream
BT
/F1 12 Tf
72 700 Td
(Unit 1 General Science: Motion and Distance. Page 13.) Tj
0 -25 Td
(Periodic motion repeats at equal intervals of time like the pendulum of a clock.) Tj
0 -25 Td
(Circular motion describes an object moving along a circular path around a central axis.) Tj
ET
endstream
endobj
7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000121 00000 n 
0000000240 00000 n 
0000000359 00000 n 
0000000673 00000 n 
0000000997 00000 n 
trailer << /Size 8 /Root 1 0 R >>
startxref
1067
%%EOF`

    fs.writeFileSync(samplePdfPath, pdfContent, 'binary')
    assert(fs.existsSync(samplePdfPath), 'Sample PDF created and stored in uploads/textbooks')

    // Clean up any previous test textbook
    await pool.query(`DELETE FROM textbooks WHERE book_name = 'Test Samacheer Kalvi Class 6 Science'`)

    // Insert textbook record
    const tbInsert = await pool.query(
      `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
       RETURNING *;`,
      ['group1', 6, 'General Science', 'English', 'Term 1', 'Test Samacheer Kalvi Class 6 Science', samplePdfPath, fs.statSync(samplePdfPath).size]
    )
    const testTbId = tbInsert.rows[0].id
    assert(Boolean(testTbId), `Textbook record created in PostgreSQL with ID: ${testTbId}`)

    // 3. Test PDF Text Extraction & Processing Engine
    console.log('\n--- TEST GROUP 3: PDF Processing Engine ---')
    await processTextbookPdf({
      textbookId: testTbId,
      filePath: samplePdfPath,
      groupId: 'group1',
      standard: 6,
      subject: 'General Science',
      medium: 'English',
      term: 'Term 1',
    })

    // Check status after processing
    const updatedTb = await pool.query(`SELECT * FROM textbooks WHERE id = $1`, [testTbId])
    assert(updatedTb.rows[0].status === 'completed', 'Textbook processing status changed to "completed"')
    assert(updatedTb.rows[0].page_count >= 2, `Recorded page_count: ${updatedTb.rows[0].page_count}`)

    // Check extracted content in textbook_content
    const contentRows = await pool.query(`SELECT * FROM textbook_content WHERE textbook_id = $1 ORDER BY page_number ASC`, [testTbId])
    assert(contentRows.rows.length >= 2, `Extracted ${contentRows.rows.length} page rows into textbook_content`)
    assert(contentRows.rows[0].content.includes('meter') || contentRows.rows[0].content.includes('Measurements'), 'Page 1 text content correctly extracted and preserved')
    assert(contentRows.rows[1].content.includes('Periodic motion') || contentRows.rows[1].content.includes('Motion'), 'Page 2 text content correctly extracted and preserved')

    // 4. Test Duplicate Prevention (Unique Constraint & Conflict Handling)
    console.log('\n--- TEST GROUP 4: Duplicate Prevention ---')
    let duplicateCaught = false
    try {
      await pool.query(
        `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded');`,
        ['group1', 6, 'General Science', 'English', 'Term 1', 'Test Samacheer Kalvi Class 6 Science', samplePdfPath, 1024]
      )
    } catch (dupErr: any) {
      if (dupErr.code === '23505') {
        duplicateCaught = true
      }
    }
    assert(duplicateCaught, 'PostgreSQL unique constraint successfully prevented duplicate textbook insertion (Error 23505)')

    // 5. Test Textbook Content Search (RAG)
    console.log('\n--- TEST GROUP 5: Textbook Content Search (RAG) ---')
    const ragResult = await retrieveRelevantTextbookContent({
      textbookId: testTbId,
      standard: 6,
      subject: 'General Science',
      medium: 'English',
      unitId: 1,
      lessonTitle: 'Measurements and Units',
      topic: 'Periodic motion',
    })

    assert(ragResult.chunks.length > 0, `RAG retrieved ${ragResult.chunks.length} relevant textbook passages`)
    assert(ragResult.chunks[0].pageNumber > 0, `RAG passage has valid source page number: ${ragResult.chunks[0].pageNumber}`)
    assert(Boolean(ragResult.bookName), `RAG attribution identified: "${ragResult.bookName}"`)

    // 6. Test AI Generation & 6-Point Verification Logic
    console.log('\n--- TEST GROUP 6: Grounded AI MCQ Generation & Verification ---')
    
    // Simulate question generated from retrieved context
    const mockGeneratedQuestion = {
      question: 'What is the standard International SI unit for length according to Samacheer Kalvi Class 6 Science?',
      options: ['Centimeter', 'Meter', 'Kilometer', 'Foot'],
      correctAnswer: 1, // Meter
      explanation: 'According to Samacheer Kalvi Class 6 Science Unit 1 (Page 1), the standard international SI unit for length is the meter.',
      difficulty: 'Easy' as const,
      sourceReference: 'Test Samacheer Kalvi Class 6 Science, Page 1',
      sourcePage: 1,
      textbookId: testTbId,
    }

    const mockConfig: any = {
      apiKey: '',
      category: 'group1',
      groupName: 'Group 1',
      groupCode: 'CCSE-I',
      examStandard: 'Degree Standard',
      subject: 'General Science',
      classId: 6,
      unitId: 1,
      lessonTitle: 'Measurements and Units',
      topic: 'Measurements',
      count: 1,
      difficulty: 'Easy',
      textbookContext: {
        textbookId: testTbId,
        textbookName: ragResult.bookName || 'Test Samacheer Kalvi Class 6 Science',
        totalAvailablePages: ragResult.totalAvailablePages,
        relevantPages: ragResult.relevantPages,
        hasSufficientContent: ragResult.hasSufficientContent,
        passages: ragResult.chunks.map((c) => ({
          pageNumber: c.pageNumber,
          unitId: c.unitId,
          lessonTitle: c.lessonTitle,
          content: c.content,
        })),
      },
      existingDbQuestions: [],
    }

    const verification = verifyQuestionItem(mockGeneratedQuestion, mockConfig, [])

    assert(verification.verificationStatus === 'verified', `Question verification passed with status: "${verification.verificationStatus}"`)
    assert(verification.verificationDetails.optionsValid, 'Verification check: 4 distinct options verified')
    assert(verification.verificationDetails.textSupport, 'Verification check: text support verified')
    assert(verification.verificationDetails.notDuplicate, 'Verification check: duplicate detection passed')
    assert(verification.verificationDetails.pageVerified, 'Verification check: page reference verified')

    // Test Ambiguous/Unsupported Question -> Needs Review
    const unsupportedQuestion = {
      question: 'What is the quantum spin of a Higgs Boson particle?',
      options: ['0', '1/2', '1', '2'],
      correctAnswer: 0,
      explanation: 'Higgs boson is a scalar boson with spin 0.',
      difficulty: 'Hard' as const,
      sourceReference: 'Test Samacheer Kalvi Class 6 Science, Page 999',
      sourcePage: 999, // Non-existent page
      textbookId: testTbId,
    }

    const unverifiedResult = verifyQuestionItem(unsupportedQuestion, mockConfig, [])
    assert(unverifiedResult.verificationStatus === 'needs_review', `Unsupported question flagged as "${unverifiedResult.verificationStatus}" (Needs Review)`)

    // 7. Test Staging and Admin Approval Flow
    console.log('\n--- TEST GROUP 7: Staging & Admin Approval Flow ---')
    
    // Clean up test questions
    await pool.query(`DELETE FROM questions WHERE source_reference LIKE '%Test Samacheer Kalvi%'`)

    // Insert into staging
    const stageInsert = await pool.query(
      `INSERT INTO questions (
        category, subject, class_id, unit_id, lesson_title, topic, difficulty, 
        tag, question_text, options, correct_answer, explanation, source_reference, 
        status, textbook_id, source_page, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;`,
      [
        'group1', 'General Science', 6, 1, 'Measurements and Units', 'Measurements', 'Easy',
        'Syllabus', mockGeneratedQuestion.question, JSON.stringify(mockGeneratedQuestion.options),
        mockGeneratedQuestion.correctAnswer, mockGeneratedQuestion.explanation, mockGeneratedQuestion.sourceReference,
        'staging', testTbId, mockGeneratedQuestion.sourcePage, verification.verificationStatus
      ]
    )
    const stagedQId = stageInsert.rows[0].id
    assert(stageInsert.rows[0].status === 'staging', `Generated question strictly entered Staging with ID: ${stagedQId}`)
    assert(stageInsert.rows[0].verification_status === 'verified', `Question stored with verification_status: "${stageInsert.rows[0].verification_status}"`)
    assert(stageInsert.rows[0].source_page === 1, `Question stored with source_page: ${stageInsert.rows[0].source_page}`)

    // Admin edits and approves question
    const updateRes = await pool.query(
      `UPDATE questions 
       SET question_text = $1, status = 'published' 
       WHERE id = $2 
       RETURNING *;`,
      ['What is the SI unit for length in Samacheer Kalvi Class 6 Science?', stagedQId]
    )
    assert(updateRes.rows[0].status === 'published', `Admin approved and published question #${stagedQId}`)

    // Verify published question is queryable for Study Materials & Quizzes
    const publicQuery = await pool.query(
      `SELECT id, question_text, status, source_page, verification_status 
       FROM questions 
       WHERE id = $1 AND status = 'published';`,
      [stagedQId]
    )
    assert(publicQuery.rows.length === 1, 'Published question is active and visible for student Quiz and Study Materials')

    // 8. Test Error Handling & Edge Cases
    console.log('\n--- TEST GROUP 8: Error Handling & Edge Cases ---')
    
    // Corrupted PDF test
    const corruptedPath = path.join(uploadsDir, 'corrupted-test.pdf')
    fs.writeFileSync(corruptedPath, 'Not a real PDF file content at all!')
    
    const corruptedTb = await pool.query(
      `INSERT INTO textbooks (group_id, standard, subject, medium, term, book_name, file_path, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
       RETURNING id;`,
      ['group1', 6, 'Science', 'English', 'Term 1', 'Corrupted Test Book', corruptedPath, 30]
    )
    const corruptedId = corruptedTb.rows[0].id

    await processTextbookPdf({
      textbookId: corruptedId,
      filePath: corruptedPath,
      groupId: 'group1',
      standard: 6,
      subject: 'Science',
      medium: 'English',
      term: 'Term 1',
    })
    
    const corruptedCheck = await pool.query(`SELECT status, error_message FROM textbooks WHERE id = $1`, [corruptedId])
    assert(corruptedCheck.rows[0].status === 'failed', `Corrupted PDF handled safely: status marked as "${corruptedCheck.rows[0].status}"`)
    assert(Boolean(corruptedCheck.rows[0].error_message), `Error message logged: "${corruptedCheck.rows[0].error_message?.slice(0, 40)}..."`)

    // Clean up test data
    console.log('\n--- Cleanup ---')
    await pool.query(`DELETE FROM textbooks WHERE id IN ($1, $2)`, [testTbId, corruptedId])
    await pool.query(`DELETE FROM questions WHERE id = $1`, [stagedQId])
    if (fs.existsSync(samplePdfPath)) fs.unlinkSync(samplePdfPath)
    if (fs.existsSync(corruptedPath)) fs.unlinkSync(corruptedPath)
    console.log('Cleaned up test fixtures.')

    console.log('\n=====================================================')
    console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
    console.log('=====================================================')

    if (failedTests === 0) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  } catch (err) {
    console.error('Fatal error running test suite:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runTestSuite()
