# W2-P4 — API dùng trong demo và đối chiếu hợp đồng

Baseline `f091c57` · 06/10/2026. Không thêm endpoint nghiệp vụ hoặc đổi auth/private storage. Base `/api/v1`, JWT bearer, version do backend cấp; quyền/trạng thái phải kiểm tra phía backend.

| Luồng | Hợp đồng dùng | Endpoint thực tế / lưu ý |
|---|---|---|
| Nháp | W2-Q1 schemas/routes | POST/PATCH `/achievements`, version khi sửa |
| Minh chứng | `EVIDENCE_FILES_W2_Q2.md`, evidence routes | POST `/achievements/:id/evidences`; POST `/evidences/:id/versions`; GET `/evidence-files/:id/download` |
| Nộp/gửi lại | Q3 schemas/routes + OpenAPI chung | POST `/achievements/:id/submit`, `{version,note}`; snapshot revision mới |
| Bổ sung/xác nhận | Q3 schemas/routes | POST `/:id/request-correction` `{version,reason}` và `/:id/verify` `{version,note}` |
| Lịch sử/snapshot | Q3 repository | GET `/achievements/:id/history`, `/:id/submissions`; snapshotData và frozenFilesCount |
| Quyết định/khen thưởng | `W2_P2.openapi.json`, `AWARDS_W2_P2.md` | Tạo decision/record, upload decision file, POST `/award-records/:id/record`, có file và scope |

`ACHIEVEMENTS_W2_Q3.md` hiện mô tả khác runtime: cancel về DRAFT và revoke về NEED_CORRECTION, nhưng code chuyển CANCELLED/REVOKED theo BUSINESS_RULES; quyền records officer thẩm định, action audit, route thay file `/files`, response histories/evidenceFiles cũng khác code. Không tự sửa workflow theo tài liệu sai hoặc dùng ví dụ Q1 làm ngưỡng. Xem review để chốt phiên bản hợp đồng đồng nhất trước nghiệm thu.

Test W2-P4 chọn schema/runtime của commit nêu trên để review, không coi những hành vi trái ma trận quyền là tiêu chí đã chốt. `docs/testing/week-2/W2_P4_RESULT.json` ghi kết quả HTTP/DB thực tế; acceptance CHANGES_REQUIRED dù các assertions REPRO pass.
