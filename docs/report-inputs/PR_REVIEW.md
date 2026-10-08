# Review W5-P4 — quyền/file/restore

Review baseline 37a381e + diff W5-P4, 08/10/2026. Chưa có PR remote xác minh. Kết luận: **yêu cầu sửa W5-Q3 trước nghiệm thu restore**.

## Phát hiện và xử lý

| Mức | Vị trí | Bằng chứng / tác động | Xử lý |
|---|---|---|---|
| P1 | scripts/backup.mjs + restore.mjs | Backup native lấy DDL migrations nhưng dữ liệu live có `achievements.verified_by`; restore SQLSTATE 42703 sau khi DDL qua | BLOCKED Q3: đối soát drift hoặc dump đúng DDL nguồn; không bỏ cột/dữ liệu để lấy PASS |
| P1 | EvidenceService._getUserRoles | Catch lỗi đọc quyền rồi fallback user.roles có thể hồi sinh quyền JWT cũ khi scope vẫn còn | Đã sửa trong W5-P4: truyền lỗi DB, response không hợp lệ trả roles rỗng; 3 regression kiểm không đọc storage |
| P1 | restore.mjs restorePrivateStorage | `manifest.files[].storageKey` được path.join trực tiếp để copy, không qua resolveSafePath | Q3 cần kiểm containment cả nguồn/đích trước copy, chặn absolute/traversal và link ra ngoài; chưa thử payload trên kho thật |
| P1 | restore.mjs runRestore | `downloadCheck.allPassed` ghi báo cáo nhưng không làm fail; số dòng chỉ đếm, không so nguồn | Q3 cần fail khi file thiếu/hash sai và đối soát per-table với metadata backup; hiện success không đủ nghiệm thu |
| P2 | restore.mjs restoreDatabaseIsolated | targetSchema chèn thẳng SQL và DROP schema trước nạp; safety URL dựa chuỗi có thể bỏ sót alias cùng DB | Chỉ chạy tên random do runner sinh, schema mới; Q3 cần validate identifier, refuse existing target và nhận diện DB thực trước DROP |
| P2 | config/database.js + restore.mjs | TLS `rejectUnauthorized:false` mã hóa nhưng không xác minh CA/server | Ghi giới hạn rõ, chưa chứng nhận TLS xác thực máy chủ |

## Quyền/file đã đối chiếu

`authenticate` kiểm tài khoản ACTIVE từ DB; evidence download gọi service kiểm chủ hồ sơ/đại diện/role + scope trước storage. Sửa minh chứng chỉ DRAFT/NEED_CORRECTION; VERIFIED chặn 409. LocalStorageAdapter chặn `..`, null và đường dẫn ra ngoài base; không suy rộng bảo vệ adapter sang thao tác copy restore trực tiếp. CSV dùng kiểm role/scope và vệ sinh formula. Không đổi cơ chế auth Express hay public hóa file.

Unit hiện có dùng DI/fixture, có kết nối DB ở một số setup; không là bằng chứng tải HTTP restored. Runner P3 tạo schema thật Supabase riêng, login HTTP thật; lỗi restore ngăn các bước SHA/size/anonymous/outside-scope chạy. Không tính các bước đó PASS.

## Điều kiện duyệt lại Q3

1. Tạo backup hợp lệ từ schema nguồn đúng, đủ cả kho minh chứng và quyết định; không chứa key.
2. Restore schema và thư mục mới; so số bảng/dòng, FK/sequence, hash toàn bộ manifest; test thiếu file/hash sai phải fail.
3. Chạy HTTP owner tải đúng hash/size; anonymous 401, ngoài scope 403/404; VERIFIED không sửa/xóa; file quyết định cũng phải kiểm riêng.
4. Xác nhận app gốc không đổi, dọn đúng schema riêng và công bố kết quả thực; không thay báo cáo lỗi hiện tại bằng PASS lịch sử.
