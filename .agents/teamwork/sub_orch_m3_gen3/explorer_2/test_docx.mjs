import PizZip from '../../../../backend/node_modules/pizzip/js/index.js';
import Docxtemplater from '../../../../backend/node_modules/docxtemplater/js/docxtemplater.js';

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Họ và tên: {fullName}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiêu đề: {headline}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tiểu sử: {bio}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Danh sách thành tích:</w:t></w:r></w:p>
    {#achievements}
    <w:p><w:r><w:t>- {title} ({recognitionYear})</w:t></w:r></w:p>
    {/achievements}
  </w:body>
</w:document>`;

const zip = new PizZip();
zip.file('[Content_Types].xml', contentTypes);
zip.file('_rels/.rels', rels);
zip.file('word/document.xml', documentXml);

const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
doc.render({
  fullName: 'PGS.TS. Nguyễn Văn An',
  headline: 'Phó Giáo sư, Tiến sĩ - ĐH Lạc Hồng',
  bio: 'Chuyên gia nghiên cứu AI và Học sâu (Σ, α, β)',
  achievements: [
    { title: 'Công trình Scopus Q1', recognitionYear: 2025 },
    { title: 'Bằng khen Bộ Giáo dục & Đào tạo', recognitionYear: 2024 }
  ]
});

const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
console.log('Success! Buffer length:', buffer.length);
console.log('Magic bytes (hex):', buffer[0].toString(16), buffer[1].toString(16), buffer[2].toString(16), buffer[3].toString(16));
console.log('UInt32LE:', buffer.readUInt32LE(0).toString(16));
console.log('Has word/document.xml:', buffer.toString('utf-8').includes('word/document.xml'));
