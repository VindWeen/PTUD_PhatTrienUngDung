# Kết quả chuyển sang SQL Server

Ngày kiểm chứng:11/11/2026. Phạm vi: mã nguồn trong workspace hiện tại, gồm thay đổi chưacommit. Đây không phải nghiệm thu toàn bộ mọi chức năng hoặc độ chính xácAI.

## Kết quả thực hiện

- Runtime: SQL Server2022 local `localhost:1433`, DB`PTUD_LHU`; backend Express dùng `mssql`. PostgreSQL không còn là kết nối ứng dụng thường trực.
- Schema chuẩn:`database/sqlserver/migrations`,2migration,53bảng nghiệp vụ và bảng `_schema_migrations`,5trigger. Chạy lại migration không có pending; FK/CHECK bật và trusted. READ_COMMITTED_SNAPSHOT đã bật cho DBlocal.
- T-SQL thay PostgreSQL trong mọi module runtime: auth/admin/tổ chức/hồ sơ, thành tích/minh chứng, đề nghị/Hội đồng/khen thưởng, báo cáo/thông báo/lịch/CV, KPI/quy định/AI/RAG. Adapter chỉ bind tham số, không dịch SQL khi chạy; Transaction dùng kết nối riêng, request trong cùng transaction được xếp nối tiếp.
- Xuất Supabase nguồn bằng giao dịch chỉđọc, nhập vào DBmới rỗng, giữ ID/JSON/lịch sử; bật và kiểm lại ràng buộc trước commit. Nguồn không bị ghi/xóa.
- Đối chiếu53bảng/609bản ghi tại checkpoint: không có trường lệch sau chuẩn hóa biểu diễn UUID/ngày/JSON. CộtDATE được giữ theo chuỗi ngày gốc, tránh lệch múi giờ. Logaudit/refresh token tăng khi ứng dụng chạy là thay đổi sau checkpoint.

## Kiểm thử và giới hạn

| Kiểm tra | Kết quả |
|---|---|
| `npm test` |31/31đạt bằng mock độc lập, không thay kết quảDBthật. |
| Toàn bộ `tests/*.test.js` |339/341đạt;2kiểm traAIholdout lịch sử chưađạt. |
| `npm run test:sqlserver` |16đạt,0lỗi,1ca fullbackupopt-in không chạy trong bộ mặc định. Có13kiểm tra native gồm test cha/con và3kiểm tra an toàn archive. |
| Nativecore |Đọc dữ liệu chuyển; auth/phạm vi; registration/refresh; admin/cycle/overlap; thành tích/snapshot/phiên bảnfile/xác nhận/history/notifications; lịch/CVHTTP. Fixture rollback. |
| NativeAI/KPI |CRUD; JSON/date/null; trigger source-rule; lưuđánhgiá/stale; RAG local; không gọiLLM thật. Fixture rollback. |
| Nativeawards |Nộp, bổ sung, chuyển đơn vị/Hộiđồng, recommend, quyếtđịnh, chặn thiếufile, ghi/thu hồi. Fixture rollback. Một bước file thử sử dụng adapterfixture, không nhận là uploaddiskend-to-end. |
| HTTP |85lượt đăngnhập/đọcAPI cho6vai trò, phản hồi200hoặc403theoquyền; không lỗi500. Không phải85luồng ghi đầu-cuối. |
| Frontend |`npm run build`, `npm run lint`đạt; có cảnh báo kích thước bundle. Edge/Playwright đăngnhập và mở trangthànhtích quaAPIthật. |
| NativeDBbackup/restore |COPY_ONLYBAK/CHECKSUM; VERIFYONLY;RESTOREvàoDBmới`PTUD_LHU_RestoreTest`;DBCCCHECKDBđạt;53bảng/609bản ghi khớpcheckpoint. |
| Tệpprivate |13/14khớpSHA256. Thiếu`tệp ach_8_ev_1793176346648_v1_a0658cbd.pdf` từ dữ liệu demo cũ. FullbackupcảDBvàtệp bị chặn đúng điều kiện, chưađạt. |

Hai testAIchưađạt ở `backend/tests/w5-q2.test.js`: tập lịch sử không cung cấp ánh xạ nguồn như evaluator hiện hành yêu cầu, nên trả `CRITERION_SOURCE_UNMAPPED` và ràsoát thủ công. Không hạ ngưỡng, sửa nhãn hoặc nhận tỷ lệ95%đạt. Chưa đo lại chất lượngLLMtrực tuyến. Tênpeer trong dataset lịch sử không được suy thành người xác nhận thực tế.

Một lần chạy đồng thời các bộ fixture gặp SQLServerdeadlock. Giao dịch rollback; lệnh chuẩn chạy nối tiếp với `--test-concurrency=1`. API ánh xạ deadlock thành409để thửlại; chưa có phép đo tải lớn/khả năngchịutải mới.

## Bằng chứng local và cách chạy lại

- `tmp/sqlserver-migration/full-data-verification.json`: đối chiếu53bảng và từng trường,0mismatch.
- `tmp/sqlserver-migration/file-verification.json`:13MATCH/1MISSING.
- `tmp/sqlserver-migration/native-final.log`, `unit-final.log`, `unit-results-runner-updated.log`, `http-results.json`.
- `tmp/sqlserver-engine-backups/restore-test-report.json`: DBrestore riêng, so với checkpoint nguồn; trườngso vớiDBđangchạy mang tínhthamkhảo vìaudit/token đã tăng.
- `tmp/sqlserver-migration/achievements-sqlserver.png`: ảnhEdge qua APIthật.
- `docs/deployment/PRE_DEMO_HEALTH_REPORT.json`:SQLServerUP nhưng readinessdemo toàn diện NEEDS_ATTENTIONdo1filethiếu.

Bản xuất nguồn trong `backups/` và cấu hình nguồn/login trong `tmp/`/`.env` chứa dữ liệu riêng, được Gitignore; không đưa vào commit. `pg` chỉ còn devDependency cho côngcụxuấtnguồnmộtlần. Lệnhcài/chạy ở `docs/deployment/GETTING_STARTED.md`. Không seed/reset DBđãchuyển.

Cần tìm đúng tệp gốc bịthiếu và kiểm lạihash trước fullbackup. Chưa commit các thay đổi; không ghiđèDBnguồn hoặc DBkhác.
