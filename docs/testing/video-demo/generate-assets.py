"""Rebuild the small recording fixtures; never connects to a database."""
from pathlib import Path
import csv
import hashlib
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont('Demo', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('DemoBold', 'C:/Windows/Fonts/arialbd.ttf'))
documents = [
 ('Minh chứng nghiên cứu - bản 1.pdf', 'MINH CHỨNG NGHIÊN CỨU', 'Phiên bản 1 - hồ sơ ban đầu', [
  ('Mã mẫu', 'VID-01 / A-MAIN / EVIDENCE-V1'),
  ('Chủ thể mô phỏng', 'Nguyễn Văn An - Giảng viên'),
  ('Nội dung', 'Chuẩn bị bài báo nghiên cứu và tập hợp minh chứng phục vụ kê khai thành tích.'),
  ('Thông tin bản 1', 'Bản kê khai ban đầu. Chưa bổ sung trang thông tin vai trò tác giả và mốc thời gian.'),
  ('Mục đích ghi hình', 'Thêm minh chứng, xem tên tệp tiếng Việt và tải về; sau đó thay bằng bản 2.')]),
 ('Minh chứng nghiên cứu - bản 2.pdf', 'MINH CHỨNG NGHIÊN CỨU', 'Phiên bản 2 - bổ sung thông tin', [
  ('Mã mẫu', 'VID-01 / A-MAIN / EVIDENCE-V2'),
  ('Chủ thể mô phỏng', 'Nguyễn Văn An - Giảng viên'),
  ('Vai trò đã bổ sung', 'Tác giả chính - thông tin giả lập để minh họa vòng yêu cầu bổ sung.'),
  ('Thời gian mô phỏng', 'Từ ngày 01/01/2026 đến ngày 31/10/2026.'),
  ('Thay đổi so với bản 1', 'Bổ sung vai trò tác giả và thời gian thực hiện. Nội dung và mã phiên bản khác bản 1.'),
  ('Mục đích ghi hình', 'Thay tệp, tăng phiên bản, nộp lại và đối chiếu snapshot của các lần nộp.')]),
 ('Quyết định khen thưởng - mô phỏng.pdf', 'PHIẾU QUYẾT ĐỊNH MÔ PHỎNG', 'Bản ban đầu - không có giá trị pháp lý', [
  ('Số quyết định mẫu', 'VID-01-QD-001-DEMO'),
  ('Ngày mẫu', '11/11/2026'),
  ('Chủ thể mô phỏng', 'Nguyễn Văn An'),
  ('Nội dung giả lập', 'Ghi nhận khen thưởng phục vụ minh họa quy trình nhập quyết định và ghi sổ.'),
  ('Mục đích ghi hình', 'Tải lên quyết định cho R-MAIN; xem/tải lại trước khi ghi nhận.'),
  ('Lưu ý', 'Tên danh hiệu và chủ thể trên giao diện phải được chọn theo dữ liệu demo. Phiếu này không xác nhận bất kỳ thành tích thật nào.')]),
 ('Quyết định sửa sai - mô phỏng.pdf', 'PHIẾU SỬA SAI MÔ PHỎNG', 'Bản thay thế - không có giá trị pháp lý', [
  ('Số quyết định mẫu', 'VID-01-QD-002-DEMO'),
  ('Tham chiếu mẫu', 'Thay thế phiếu VID-01-QD-001-DEMO trong kịch bản thu hồi và lập bản thay thế.'),
  ('Nội dung khác bản đầu', 'Bổ sung ghi chú sửa thông tin trong quyết định; giữ liên kết bản đã thu hồi để truy vết.'),
  ('Chủ thể mô phỏng', 'Nguyễn Văn An'),
  ('Mục đích ghi hình', 'Dùng cho nhánh R-REVOKE và bản thưởng thay thế, không sửa trực tiếp bản đã ghi nhận.')]),
]

for name, title, subtitle, rows in documents:
 c = canvas.Canvas(str(ROOT / name), pagesize=(595.28, 841.89), invariant=1)
 c.setTitle(title + ' - MÔ PHỎNG')
 c.setAuthor('PTUD LHU - Bộ dữ liệu quay demo')
 c.setFillColor(HexColor('#0f766e')); c.rect(0, 736, 595.28, 106, fill=1, stroke=0)
 c.setFillColor(HexColor('#ffffff')); c.setFont('DemoBold', 18); c.drawString(42, 794, title)
 c.setFont('Demo', 11); c.drawString(42, 770, subtitle)
 c.setFillColor(HexColor('#fff7ed')); c.roundRect(42, 664, 511, 48, 6, fill=1, stroke=0)
 c.setFillColor(HexColor('#9a3412')); c.setFont('DemoBold', 12)
 c.drawString(56, 684, 'MÔ PHỎNG - PHỤC VỤ DEMO')
 y = 634
 for label, value in rows:
  c.setFillColor(HexColor('#0f766e')); c.setFont('DemoBold', 11); c.drawString(42, y, label)
  y -= 19
  c.setFillColor(HexColor('#1e293b')); c.setFont('Demo', 11)
  for line in simpleSplit(value, 'Demo', 11, 505):
   c.drawString(42, y, line); y -= 17
  y -= 18
 c.setStrokeColor(HexColor('#cbd5e1')); c.line(42, 78, 553, 78)
 c.setFillColor(HexColor('#64748b')); c.setFont('Demo', 9)
 c.drawString(42, 59, 'Dữ liệu giả lập. Không phải chứng nhận, văn bản ban hành hoặc quyết định thực tế.')
 c.drawRightString(553, 40, 'Trang 1 / 1'); c.save()

header = ['code','title','measureUnit','periodStart','periodEnd','target','plan','sourceNote','actual','evidenceNote']
valid = [
 ['VID-01-CSV-01','VID-01 | Mục tiêu bài báo MÔ PHỎNG','bài','2026-01-01','2026-12-31','2','Chuẩn bị bản thảo, thu thập minh chứng','MÔ PHỎNG - người dùng tự nhập','',''],
 ['VID-01-CSV-02','VID-01 | Mục tiêu nghiên cứu MÔ PHỎNG','hồ sơ','2026-01-01','2026-12-31','2','Chuẩn bị hồ sơ nghiên cứu','MÔ PHỎNG - người dùng tự nhập','1','MÔ PHỎNG - kết quả tự kê khai, chưa được xác nhận'],
]
invalid = [
 ['VID-01-CSV-BAD01','VID-01 | Lỗi kỳ MÔ PHỎNG','bài','2026-12-31','2026-01-01','2','Kiểm tra dữ liệu','MÔ PHỎNG','',''],
 ['VID-01-CSV-BAD02','VID-01 | Lỗi chỉ tiêu MÔ PHỎNG','hồ sơ','2026-01-01','2026-12-31','-1','Kiểm tra dữ liệu','MÔ PHỎNG','',''],
]
for name, rows in [('KPI - hợp lệ.csv', valid), ('KPI - lỗi.csv', invalid), ('KPI - xem trước có lỗi.csv', valid + invalid[:1])]:
 with (ROOT / name).open('w', encoding='utf-8-sig', newline='') as f:
  writer = csv.writer(f); writer.writerow(header); writer.writerows(rows)
(ROOT / 'Không hỗ trợ - thử định dạng.txt').write_text('MÔ PHỎNG - PHỤC VỤ DEMO\nTệp TXT này dùng để minh họa từ chối định dạng minh chứng không được hỗ trợ.\n', encoding='utf-8')
files = []
for path in sorted(ROOT.iterdir()):
 if path.suffix in {'.pdf','.csv','.txt','.png'}:
  files.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(ROOT / 'assets-manifest.json').write_text(json.dumps({'purpose':'MÔ PHỎNG - PHỤC VỤ DEMO', 'files':files}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'generatedPdfs': len(documents), 'manifestFiles': len(files)}, ensure_ascii=False))
