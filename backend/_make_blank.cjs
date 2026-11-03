// 2-page PDF: page 1 native text, page 2 completely blank (empty content stream).
const fs = require('fs');
const zlib = require('zlib');

function build() {
  const text = [
    'BT', '/F1 16 Tf', '50 760 Td', '18 TL',
    '(TNPSC General Studies - Geography) Tj',
    'T* (The Earth is the third planet from the Sun and the only known planet with life.) Tj',
    'T* (The atmosphere is divided into troposphere, stratosphere, mesosphere and thermosphere.) Tj',
    'T* (Monsoon winds bring seasonal rainfall to the Indian subcontinent every year.) Tj',
    'ET',
  ].join('\n');
  const objs = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 7 0 R >>'),
    Buffer.concat([Buffer.from(`<< /Length ${text.length} >>\nstream\n`), Buffer.from(text), Buffer.from('\nendstream')]),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.from('<< /Length 0 >>\nstream\n\nendstream'),
  ];
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

fs.writeFileSync(process.argv[2] || 'uploads/textbooks/_blank_page.pdf', build());
console.log('wrote blank-page fixture');
