# W3-P4 — Initial final holdout

6 ca tổng hợp, khác case/group/chủ thể/file identity với bộ development. Nhãn kỳ vọng do tác giả phần mềm viết và **chưa được chuyên môn xác nhận**. Không dùng bộ này cho UI, prompt, chọn ngưỡng hoặc điều chỉnh evaluator sau khi freeze.

`freeze-manifest.json` khóa SHA-256 của cases cuối, cases dev, đặc tả và evaluator. Lệnh `node scripts/w3-p4-eval.mjs --final` kiểm tra manifest trước khi chạy; kết quả lưu `docs/testing/week-3/W3_P4_FINAL_RESULT.json`. Unit suite chỉ kiểm tra không trùng split, không chạy guard benchmark cuối.

`.gitattributes` chỉ áp LF cho JSON corpus và hai script W3-P4 để byte hashes không thay đổi do Windows/Linux checkout. Không thay quy tắc newline cho mã/tài liệu của task khác.

Đây là initial holdout tự tạo, không phải test blind độc lập, không đo độ chính xác AI hoặc điều kiện xét thưởng. Nếu thay rules/dataset/evaluator sau lần final, tạo phiên bản benchmark và bộ holdout mới, không sửa manifest cũ.
