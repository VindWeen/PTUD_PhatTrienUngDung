"""Generate small synthetic upload fixtures. No database or application writes."""
from pathlib import Path
import shutil
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/ui-test-fixtures'
DEST = ROOT / 'docs/testing/kits/fixtures'
OUT.mkdir(parents=True, exist_ok=True)
DEST.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('FixtureArial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('FixtureArialBold', 'C:/Windows/Fonts/arialbd.ttf'))

def pdf(name, title, lines):
    c = canvas.Canvas(str(OUT / name), pagesize=A4)
    w, h = A4
    c.setTitle(title)
    c.setFillColorRGB(.06, .28, .38)
    c.rect(0, h - 118, w, 118, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont('FixtureArialBold', 18)
    c.drawString(44, h - 53, title)
    c.setFont('FixtureArial', 11)
    c.drawString(44, h - 82, 'BỘ KIỂM THỬ GIAO DIỆN PTUD - DỮ LIỆU MÔ PHỎNG')
    y = h - 158
    c.setFillColorRGB(.15, .2, .26)
    for line in lines:
        c.setFont('FixtureArial', 12)
        c.drawString(44, y, line)
        y -= 27
    c.setStrokeColorRGB(.75, .8, .84)
    c.line(44, 78, w - 44, 78)
    c.setFont('FixtureArial', 10)
    c.drawString(44, 57, 'Chỉ dùng test upload, tải về, phiên bản tệp và luồng trạng thái.')
    c.drawString(44, 40, 'Không phải hồ sơ thực tế, không có giá trị chứng nhận hoặc pháp lý.')
    c.showPage()
    c.save()
    shutil.copyfile(OUT / name, DEST / name)

pdf('evidence-v1.pdf', 'MINH CHỨNG THỬ NGHIỆM - V1', [
    'Mã nội dung: UI-EVIDENCE-V1', 'Loại minh chứng: tài liệu nghiên cứu giả lập.',
    'Nội dung phiên bản đầu dùng để kê khai và gửi thẩm định.',
    'Chưa bổ sung thông tin vai trò đóng góp.', 'Trạng thái tài liệu: MÔ PHỎNG.',
])
pdf('evidence-v2.pdf', 'MINH CHỨNG THỬ NGHIỆM - V2', [
    'Mã nội dung: UI-EVIDENCE-V2', 'Loại minh chứng: tài liệu nghiên cứu giả lập.',
    'Đã bổ sung vai trò: tác giả chính, tổng hợp và kiểm tra dữ liệu.',
    'Dùng khi có yêu cầu bổ sung và khi tải phiên bản minh chứng mới.',
    'Nội dung và mã băm khác V1 để kiểm tra lịch sử tệp.',
    'Trạng thái tài liệu: MÔ PHỎNG.',
])
pdf('decision-demo.pdf', 'QUYẾT ĐỊNH THỬ NGHIỆM', [
    'Mã tài liệu mẫu: UI-DECISION-DEMO', 'Cơ quan: Đơn vị mô phỏng PTUD.',
    'Nội dung: tệp đính kèm cho bản ghi khen thưởng thử nghiệm.',
    'Số quyết định cụ thể được nhập riêng theo mẫu của từng người test.',
    'Không có chữ ký thật, con dấu thật hoặc hiệu lực khen thưởng.',
    'Trạng thái tài liệu: MÔ PHỎNG.',
])

img = Image.new('RGB', (960, 540), '#e8f3f5')
draw = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 35)
draw.text((48, 120), 'MINH CHỨNG ẢNH - MÔ PHỎNG', font=font, fill='#16485d')
draw.text((48, 210), 'UI test: PNG / JPG hợp lệ', font=font, fill='#16485d')
img.save(DEST / 'evidence-image.png')
img.save(DEST / 'evidence-image.jpg', quality=90)
print('Created 3 PDFs and 2 valid image fixtures:', DEST)
