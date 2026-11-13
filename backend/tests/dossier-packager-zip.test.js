import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import PizZip from 'pizzip';
import {
  sanitizeFileName,
  formatStandardizedFileName,
  buildDossierArchive,
  packageAndStreamDossierZip,
} from '../src/modules/ai/dossierPackagerService.js';

test('Dossier Packager: sanitizeFileName chuẩn hóa chuỗi tiếng Việt và loại bỏ ký tự nguy hiểm', () => {
  const input1 = 'Bằng khen Giảng viên Xuất sắc năm 2025';
  const out1 = sanitizeFileName(input1);
  assert.equal(out1, 'Bang_khen_Giang_vien_Xuat_sac_nam_2025');

  const input2 = 'Khen thưởng / Quyết định: #123* (ĐHLH)';
  const out2 = sanitizeFileName(input2);
  assert.equal(out2, 'Khen_thuong_Quyet_dinh_123_DHLH');
});

test('Dossier Packager: formatStandardizedFileName tạo định dạng chuẩn 01_[TenMinhChung]_[Nam].pdf', () => {
  const filename1 = formatStandardizedFileName(1, 'Chiến sĩ thi đua cấp cơ sở', 2024, 'pdf');
  assert.equal(filename1, '01_[Chien_si_thi_dua_cap_co_so]_[2024].pdf');

  const filename2 = formatStandardizedFileName(12, 'Giấy chứng nhận NCKH', 2025, '.pdf');
  assert.equal(filename2, '12_[Giay_chung_nhan_NCKH]_[2025].pdf');
});

test('Dossier Packager: buildDossierArchive nén tệp tin và tạo cấu trúc ZIP hợp lệ', async () => {
  const dummyItems = [
    {
      title: 'Bằng khen Giảng viên Giỏi',
      year: 2024,
      buffer: Buffer.from('%PDF-1.4 Dummy PDF Content for item 1'),
    },
    {
      title: 'Chứng nhận Bài báo Q1',
      year: 2025,
      buffer: Buffer.from('%PDF-1.4 Dummy PDF Content for item 2'),
    },
  ];

  const archive = buildDossierArchive(dummyItems);

  // Thu thập chunks vào Buffer
  const chunks = [];
  archive.on('data', (chunk) => chunks.push(chunk));

  await new Promise((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
    archive.finalize();
  });

  const zipBuffer = Buffer.concat(chunks);

  // 1. Kiểm tra Magic Bytes chuẩn của ZIP file: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  assert.ok(zipBuffer.length > 0, 'ZIP buffer không được rỗng');
  assert.equal(zipBuffer[0], 0x50);
  assert.equal(zipBuffer[1], 0x4b);
  assert.equal(zipBuffer[2], 0x03);
  assert.equal(zipBuffer[3], 0x04);

  // 2. Dùng PizZip giải nén cấu trúc và kiểm tra tên các file bên trong
  const zip = new PizZip(zipBuffer);
  const fileNames = Object.keys(zip.files);

  assert.equal(fileNames.length, 2);
  assert.equal(fileNames[0], '01_[Bang_khen_Giang_vien_Gioi]_[2024].pdf');
  assert.equal(fileNames[1], '02_[Chung_nhan_Bai_bao_Q1]_[2025].pdf');

  // Kiểm tra nội dung tệp tin bên trong
  const content1 = zip.files[fileNames[0]].asText();
  assert.ok(content1.includes('Dummy PDF Content for item 1'));
});

test('Dossier Packager: packageAndStreamDossierZip thiết lập đúng headers và stream file zip ra HTTP Response', async () => {
  const user = { userId: 1001, username: 'an.nv' };
  const headers = {};
  const chunks = [];

  // Giả lập đối tượng HTTP Response kế thừa stream.PassThrough
  const mockRes = new PassThrough();
  mockRes.headersSent = false;
  mockRes.setHeader = (key, value) => {
    headers[key.toLowerCase()] = value;
  };
  mockRes.status = (code) => {
    mockRes.statusCode = code;
    return mockRes;
  };
  mockRes.json = (payload) => {
    mockRes.payload = payload;
    return mockRes;
  };
  mockRes.on('data', (c) => chunks.push(c));

  // Giả lập client DB chứa quy chế và 1 thành tích đạt
  const mockClient = {
    async query(sql) {
      const text = sql.trim();
      if (text.includes('SELECT lecturer_id FROM app.lecturers')) return { rows: [{ lecturer_id: 2001 }] };
      if (text.includes('FROM app.regulation_document_versions v')) {
        return {
          rows: [
            {
              version_id: 10,
              document_id: 1,
              version_number: 'QC-2026',
              sha256_hash: 'a'.repeat(64),
              document_code: 'LHU-QD-01',
              document_title: 'Khen thưởng NCKH',
            },
          ],
        };
      }
      if (text.includes('FROM app.achievements a')) {
        return {
          rows: [
            {
              id: 101,
              title: 'Bài báo Quốc tế Scopus',
              sourceTypeId: 1,
              year: 2025,
              status: 'ACTIVE',
              files: [{ id: 1, original_file_name: 'scopus.pdf', sha256_hash: 'b'.repeat(64) }],
            },
          ],
        };
      }
      if (text.includes('FROM app.award_criteria_versions c')) {
        return {
          rows: [
            {
              criteria_version_id: 1,
              criterion_code: 'TC-01',
              name: 'Đạt bài báo quốc tế',
              target_type: 'INDIVIDUAL',
              min_threshold: 1,
              is_confirmed: true,
              source_rules: JSON.stringify({ minimumDistinctYears: 1, sourceType: 'ACHIEVEMENT', achievementTypeIds: [1] }),
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  await packageAndStreamDossierZip(user, { regulationId: 1 }, mockRes, mockClient);

  // Đợi stream finalize
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Kiểm tra HTTP Headers
  assert.equal(headers['content-type'], 'application/zip');
  assert.ok(headers['content-disposition'].startsWith('attachment; filename="Goi_Minh_Chung_'));
  assert.ok(headers['content-disposition'].endsWith('.zip"'));

  // Kiểm tra dữ liệu binary stream ra response là ZIP hợp lệ
  const fullZip = Buffer.concat(chunks);
  assert.ok(fullZip.length > 0);
  assert.equal(fullZip[0], 0x50);
  assert.equal(fullZip[1], 0x4b);

  const zip = new PizZip(fullZip);
  const files = Object.keys(zip.files);
  assert.ok(files.length >= 1);
  assert.match(files[0], /01_\[.+\]_\[\d{4}\]\.pdf/);
});
