const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getPdfParseClass } = require('./dist/services/pdfProcessor');

function buildPdf(width, height, rgb) {
  const compressed = zlib.deflateSync(Buffer.from(rgb));
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  const objs = [];
  objs.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'));
  objs.push(Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  objs.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  objs.push(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`),
    compressed,
    Buffer.from('\nendstream'),
  ]));
  objs.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), Buffer.from(content), Buffer.from('endstream')]));

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
  const out = process.argv[3];
  const page = Number(process.argv[4] || 1);
  const PDFParseClass = getPdfParseClass();
  const parser = new PDFParseClass({ data: fs.readFileSync(src) });
  const shot = await parser.getScreenshot({ partial: [page], desiredWidth: 1400, imageBuffer: true, imageDataUrl: false });
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
  fs.writeFileSync(out, buildPdf(img.width, img.height, rgb));
  console.log('wrote', out, fs.statSync(out).size, 'bytes', img.width + 'x' + img.height);
  await parser.destroy();
})();
