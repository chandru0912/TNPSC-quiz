// Builds a 2-page mixed PDF: page 1 = native text, page 2 = scanned image.
// Usage: node _make_mixed.cjs <imageSourcePdf> <imagePage> <out>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getPdfParseClass } = require('./dist/services/pdfProcessor');

const NATIVE_TEXT = [
  'TNPSC General Studies - Indian Polity',
  'The Constitution of India was adopted by the Constituent Assembly on 26 November 1949.',
  'It came into force on 26 January 1950, which is celebrated as Republic Day.',
  'The Preamble declares India to be a sovereign, socialist, secular, democratic republic.',
  'Fundamental Rights are described in Part III, Articles 12 to 35 of the Constitution.',
  'Directive Principles of State Policy are covered in Part IV, Articles 36 to 51.',
].join('\n');

function buildMixedPdf(width, height, rgb) {
  const imgCompressed = zlib.deflateSync(Buffer.from(rgb));
  const textContent = [
    'BT',
    '/F1 18 Tf',
    '50 760 Td',
    '20 TL',
    ...NATIVE_TEXT.split('\n').map((line, i) => `${i === 0 ? '' : 'T* '}(${line.replace(/[()\\]/g, '\\$&')}) Tj`),
    'ET',
  ].join('\n');

  const objs = [];
  // 1 catalog
  objs.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'));
  // 2 pages
  objs.push(Buffer.from('<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'));
  // 3 page 1 (native text)
  objs.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>`));
  // 4 page 2 (image)
  objs.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 6 0 R >> >> /Contents 8 0 R >>`));
  // 5 page 1 content
  objs.push(Buffer.concat([Buffer.from(`<< /Length ${textContent.length} >>\nstream\n`), Buffer.from(textContent), Buffer.from('\nendstream')]));
  // 6 image xobject
  objs.push(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${imgCompressed.length} >>\nstream\n`),
    imgCompressed,
    Buffer.from('\nendstream'),
  ]));
  // 7 font
  objs.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  // 8 page 2 content
  const imgContent = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  objs.push(Buffer.concat([Buffer.from(`<< /Length ${imgContent.length} >>\nstream\n`), Buffer.from(imgContent), Buffer.from('\nendstream')]));

  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let offset = chunks[0].length;
  objs.forEach((body, i) => {
    offsets.push(offset);
    const part = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    chunks.push(part);
    offset += part.length;
  });
  const xrefStart = offset;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  chunks.push(Buffer.from(xref));
  chunks.push(Buffer.from(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

(async () => {
  const src = process.argv[2];
  const page = Number(process.argv[3] || 1);
  const out = process.argv[4];
  const PDFParseClass = getPdfParseClass();
  const parser = new PDFParseClass({ data: fs.readFileSync(src) });
  const shot = await parser.getScreenshot({ partial: [page], desiredWidth: 1200, imageBuffer: true, imageDataUrl: false });
  const png = Buffer.from(shot.pages[0].data);
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const rgb = Buffer.alloc(img.width * img.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2];
  }
  fs.writeFileSync(out, buildMixedPdf(img.width, img.height, rgb));
  console.log('wrote', out, fs.statSync(out).size, 'bytes', img.width + 'x' + img.height);
  await parser.destroy();
})();
