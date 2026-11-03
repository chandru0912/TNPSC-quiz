const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
(async () => {
  const files = process.argv.slice(2);
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const parser = new PDFParse({ data: buf });
    try {
      const r = await parser.getText();
      const pages = r.pages || [];
      let totalChars = 0, empty = 0;
      for (const p of pages) {
        const n = (p.text || '').replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '').length;
        totalChars += n;
        if (n < 40) empty++;
      }
      console.log(JSON.stringify({ file: path.basename(f), bytes: buf.length, pages: pages.length, totalChars, pagesUnder40Chars: empty, first80: (pages[0]?.text || '').slice(0, 80) }));
    } catch (e) {
      console.log(JSON.stringify({ file: path.basename(f), error: e.message }));
    } finally {
      await parser.destroy();
    }
  }
})();
