"""Render the actual, sanitized W2-P4 integration result; not a UI screenshot."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
report = json.loads((root / 'docs/testing/week-2/W2_P4_RESULT.json').read_text(encoding='utf-8'))
img = Image.new('RGB', (1400, 950), '#0f172a')
draw = ImageDraw.Draw(img)
font_path = 'C:/Windows/Fonts/segoeui.ttf'
title = ImageFont.truetype(font_path, 40)
body = ImageFont.truetype(font_path, 26)
small = ImageFont.truetype(font_path, 21)
draw.text((50, 35), 'W2-P4 | Review thành tích và tiêu chí demo', font=title, fill='white')
draw.text((50, 100), f"Ngày {report['checkedAt']} | baseline {report['baseline']} | dữ liệu SYNTHETIC", font=body, fill='#94a3b8')
draw.rounded_rectangle((45, 155, 1355, 295), radius=20, fill='#1e293b')
draw.text((70, 178), f"{report['assertions']} assertions HTTP / PostgreSQL / cleanup đạt", font=title, fill='#5eead4')
draw.text((70, 244), f"{len(report['observations'])} finding tái hiện | Nghiệm thu: CHANGES_REQUIRED", font=body, fill='#fbbf24')
draw.text((50, 325), 'Schema riêng đã rollback; file test đã cleanup và kiểm tra lại.', font=body, fill='white')
draw.text((50, 370), 'PASS test REPRO nghĩa là tái hiện lỗi, không phải chấp thuận hệ thống.', font=body, fill='#fbbf24')
y = 435
for index, observation in enumerate(report['observations'], 1):
    words = f'{index}. {observation}'.split()
    line = ''
    for word in words:
        proposed = f'{line} {word}'.strip()
        if draw.textlength(proposed, font=small) > 1270:
            draw.text((55, y), line, font=small, fill='#e2e8f0')
            y += 33
            line = word
        else:
            line = proposed
    draw.text((55, y), line, font=small, fill='#e2e8f0')
    y += 61
draw.text((50, 855), 'LHU: CHƯA XÁC NHẬN ÁP DỤNG | 4 mục tiêu W1-P4 chỉ mô phỏng', font=body, fill='#fbbf24')
draw.text((50, 905), 'Ảnh dựng từ RESULT.json thực tế; không phải screenshot UI tích hợp.', font=small, fill='#94a3b8')
target = root / 'docs/weekly/images/W2_P4_TEST_REPORT.png'
target.parent.mkdir(parents=True, exist_ok=True)
img.save(target)
print(target)
