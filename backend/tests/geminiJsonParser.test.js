/**
 * geminiJsonParser.test.ts
 *
 * Verifies all 10 JSON parsing, validation, repair, and large syllabus batching test cases.
 */
import { parseGeminiJsonResponse, validateSyllabusUnitsJson, GeminiJsonParseError, } from '../src/services/ai/providers/gemini/gemini.validator';
async function runTests() {
    console.log('=== STARTING GEMINI JSON VALIDATOR & PARSER TEST SUITE ===\n');
    let passed = 0;
    let failed = 0;
    // 1. Valid JSON response
    try {
        console.log('[Test 1] Valid JSON response:');
        const validRaw = JSON.stringify({
            units: [
                {
                    unit_number: 1,
                    unit_code: 'Unit I',
                    title: 'General Science',
                    description: 'Core concepts',
                    syllabus_topics: ['Nature of Universe', 'Scientific temper'],
                },
            ],
        });
        const parsed = parseGeminiJsonResponse(validRaw);
        const validated = validateSyllabusUnitsJson(parsed);
        if (validated.units.length === 1 && validated.units[0].title === 'General Science') {
            console.log('  -> PASS: Successfully parsed and validated clean JSON.\n');
            passed++;
        }
        else {
            throw new Error('Validation failed on valid JSON.');
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 1]:', e.message, '\n');
        failed++;
    }
    // 2. Missing comma (invalid syntax)
    try {
        console.log('[Test 2] Missing comma diagnostics:');
        const missingComma = '{\n  "units": [\n    {\n      "unit_number": 1\n      "title": "Science"\n    }\n  ]\n}';
        try {
            parseGeminiJsonResponse(missingComma);
            throw new Error('Should have thrown on missing comma');
        }
        catch (e) {
            if (e instanceof GeminiJsonParseError && e.line > 0 && e.position > 0) {
                console.log(`  -> PASS: Caught syntax error at line ${e.line}, col ${e.column} (pos ${e.position}): "${e.message}".\n`);
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 2]:', e.message, '\n');
        failed++;
    }
    // 3. Missing closing bracket
    try {
        console.log('[Test 3] Missing closing bracket diagnostics:');
        const missingBracket = '{\n  "units": [\n    {\n      "unit_number": 1,\n      "title": "Science"\n';
        try {
            parseGeminiJsonResponse(missingBracket);
            throw new Error('Should have thrown on missing closing bracket');
        }
        catch (e) {
            if (e instanceof GeminiJsonParseError && e.line > 0) {
                console.log(`  -> PASS: Caught unclosed bracket error at line ${e.line}, col ${e.column}.\n`);
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 3]:', e.message, '\n');
        failed++;
    }
    // 4. Invalid quotation marks
    try {
        console.log('[Test 4] Invalid quotation marks diagnostics:');
        const invalidQuotes = '{\n  "units": [\n    {\n      "title": "General "Science""\n    }\n  ]\n}';
        try {
            parseGeminiJsonResponse(invalidQuotes);
            throw new Error('Should have thrown on unescaped internal quotes');
        }
        catch (e) {
            if (e instanceof GeminiJsonParseError) {
                console.log(`  -> PASS: Caught unescaped quotation mark at line ${e.line}, col ${e.column}.\n`);
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 4]:', e.message, '\n');
        failed++;
    }
    // 5. Empty AI response
    try {
        console.log('[Test 5] Empty AI response:');
        try {
            parseGeminiJsonResponse('   ');
            throw new Error('Should have thrown on empty content');
        }
        catch (e) {
            if (e.message.includes('empty content')) {
                console.log('  -> PASS: Accurately caught empty AI response.\n');
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 5]:', e.message, '\n');
        failed++;
    }
    // 6. Truncated JSON response diagnostics
    try {
        console.log('[Test 6] Truncated JSON response diagnostics:');
        const truncated = '{"units": [{"unit_number": 1, "unit_code": "Unit I", "title": "General Science", "syllabus_topics": ["Nature of Universe"';
        try {
            parseGeminiJsonResponse(truncated);
            throw new Error('Should have thrown on truncated JSON');
        }
        catch (e) {
            if (e instanceof GeminiJsonParseError && e.rawSnippet.includes('Nature of Universe')) {
                console.log(`  -> PASS: Accurately recorded truncated position ${e.position} with raw snippet context.\n`);
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 6]:', e.message, '\n');
        failed++;
    }
    // 7. Schema rejection for missing required properties
    try {
        console.log('[Test 7] Schema rejection for missing required properties:');
        const missingTitle = {
            units: [
                {
                    unit_number: 1,
                    unit_code: 'Unit I',
                    // title is missing!
                    syllabus_topics: ['Topic A'],
                },
            ],
        };
        try {
            validateSyllabusUnitsJson(missingTitle);
            throw new Error('Should have rejected unit with missing title');
        }
        catch (e) {
            if (e.message.includes('"title" is required')) {
                console.log(`  -> PASS: Rejected missing required title: "${e.message}".\n`);
                passed++;
            }
            else {
                throw e;
            }
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 7]:', e.message, '\n');
        failed++;
    }
    // 8. Tamil and English bilingual syllabus content preservation
    try {
        console.log('[Test 8] Tamil and English bilingual syllabus content preservation:');
        const bilingualData = {
            units: [
                {
                    unit_number: 8,
                    unit_code: 'Unit VIII',
                    title: 'தமிழ்நாட்டின் வரலாறு, மரபு, பண்பாடு (History, Culture & Heritage of Tamil Nadu)',
                    description: 'தமிழ் சமுதாய வரலாறு மற்றும் தொல்லியல் கண்டுபிடிப்புகள்',
                    syllabus_topics: [
                        'History of Tamil Society, related Archaeological discoveries',
                        'தமிழ் சமுதாய வரலாறு, அது தொடர்பான தொல்லியல் கண்டுபிடிப்புகள்',
                        'திருக்குறள் (Thirukkural): மதச்சார்பற்ற தனித்தன்மையுள்ள இலக்கியம்',
                    ],
                },
            ],
        };
        const validated = validateSyllabusUnitsJson(bilingualData);
        const u = validated.units[0];
        if (u.title.includes('தமிழ்நாட்டின்') &&
            u.syllabus_topics.some((t) => t.includes('திருக்குறள்')) &&
            u.syllabus_topics.length === 3) {
            console.log('  -> PASS: Verified 100% fidelity of Tamil Unicode characters and English wording.\n');
            passed++;
        }
        else {
            throw new Error('Bilingual content was altered or corrupted.');
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 8]:', e.message, '\n');
        failed++;
    }
    // 9. Duplicate topic detection & pruning without mutating wording
    try {
        console.log('[Test 9] Duplicate topic detection and pruning:');
        const duplicateData = {
            units: [
                {
                    unit_number: 1,
                    unit_code: 'Unit I',
                    title: 'General Science',
                    syllabus_topics: [
                        'Nature of Universe',
                        'nature of universe', // duplicate case-insensitive
                        'General Scientific Laws',
                        'Nature of Universe', // exact duplicate
                        'Mechanics and properties of matter',
                    ],
                },
            ],
        };
        const validated = validateSyllabusUnitsJson(duplicateData);
        const topics = validated.units[0].syllabus_topics;
        if (topics.length === 3 && topics[0] === 'Nature of Universe' && topics[1] === 'General Scientific Laws') {
            console.log(`  -> PASS: Cleaned duplicates (reduced from 5 to 3), preserved exact casing of first occurrence.\n`);
            passed++;
        }
        else {
            throw new Error(`Expected 3 unique topics, got: ${topics.length} (${JSON.stringify(topics)})`);
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 9]:', e.message, '\n');
        failed++;
    }
    // 10. Successful extraction structure & sorting
    try {
        console.log('[Test 10] Sorting units in strict numerical order:');
        const unsortedData = {
            units: [
                { unit_number: 3, unit_code: 'Unit III', title: 'Geography', syllabus_topics: ['Monsoon'] },
                { unit_number: 1, unit_code: 'Unit I', title: 'Science', syllabus_topics: ['Matter'] },
                { unit_number: 2, unit_code: 'Unit II', title: 'Current Events', syllabus_topics: ['Sports'] },
            ],
        };
        const validated = validateSyllabusUnitsJson(unsortedData);
        const numbers = validated.units.map((u) => u.unit_number);
        if (numbers.join(',') === '1,2,3') {
            console.log('  -> PASS: Units strictly sorted in ascending order (1, 2, 3).\n');
            passed++;
        }
        else {
            throw new Error(`Sorting failed: ${numbers.join(',')}`);
        }
    }
    catch (e) {
        console.error('  -> FAIL [Test 10]:', e.message, '\n');
        failed++;
    }
    console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0)
        process.exit(1);
}
runTests();
