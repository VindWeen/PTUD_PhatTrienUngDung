# W3-P4 — Review revision/file và AI ban đầu

Võ Nhạc Phước, 06/10/2026. Kết luận: **demo kỹ thuật có thể kiểm tra; chưa chấp nhận pipeline AI xét thưởng production**. Các finding dưới đây tách rõ điều đã tái hiện và rủi ro đọc từ mã. Không khẳng định toàn bộ revision/file đã bất biến trong mọi đường ghi.

## W3P4-R01 [P2] Snapshot thành tích chưa có guard DB UPDATE/DELETE

`achievementRepository.js:499` INSERT revision mới và `:513` đóng băng file link; migration 016 không tạo trigger append-only cho achievement_submissions/submission_evidence_files/evidence_files. API không có route sửa revision, Data API anon/authenticated bị thu hồi quyền, nhưng một đường ghi backend/script bằng credential DB vẫn có thể sửa snapshot/file metadata.

**Đã tái hiện**: integration W3-P4 trong schema tạm UPDATE snapshot_data của revision 1 thành `{}` thành công; sau đó rollback savepoint ngay. Đồng thời test API chứng minh v1 nguyên vẹn sau v2 và revoke ở luồng bình thường. Đây là thiếu bảo vệ chiều sâu DB, không phải bằng chứng user frontend đã bypass. Đề nghị migration mới guard immutable content/file/link và permission phù hợp; không sửa checksum migration 016 đã chạy. W3-P3 đã có trigger cho application input, nhưng trigger đó không bảo vệ achievement submissions.

Về bytes: localStorageAdapter.saveFile dùng writeFile mặc định, không `flag: 'wx'`; nếu code/script có quyền kho private gọi lại cùng storageKey sẽ ghi đè. Endpoint hiện sinh key ngẫu nhiên riêng cho mỗi version nên test v1/v2 vẫn giữ bytes; đây là finding bảo vệ chiều sâu từ đọc mã, chưa thử collision/overwrite bằng API người dùng. Đề nghị exclusive-create và quy trình kiểm hash kho private; không khẳng định kho hiện là WORM.

## W3P4-R02 [P1] Check trạng thái file trước transaction có race với submit/verify

`evidenceService.js:151–180` đọc achievement, check DRAFT/NEED_CORRECTION, save file trước BEGIN; upload phiên bản tại `:263–286` check trạng thái và MAX(version) trước transaction. delete tại `:345–351` cũng check trước BEGIN, không khóa row achievement khi ghi evidence. Submit dùng transaction/row lock, nhưng các đường evidence không lấy cùng lock nên request đã qua check có thể ghi sau khi hồ sơ chuyển SUBMITTED/VERIFIED; MAX(version)+1 cạnh tranh còn có thể vướng unique thay vì OCC có chủ đích.

**Finding từ đọc mã; chưa tái hiện bằng nhiều connection đồng thời.** Test 49 checks là tuần tự một client/savepoint, không chứng minh race đã được giải quyết. Đề nghị đưa kiểm tra chủ thể/trạng thái và khóa achievement/evidence/version allocator vào cùng transaction ghi; rollback/dọn file khi trạng thái thay đổi. Không sửa rộng module người khác trong task review.

## W3P4-R03 [P2] Hai phiên bản cùng có hiệu lực tại biên chuyển tiếp

`regulationService.createVersion` đặt predecessor.effective_to = successor.effective_from, trong khi repository `regulationRepository.js:38,121,269` lọc `effective_to >= asOfDate`. **Đã tái hiện** qua API thật: v1 và v2 đều nằm trong active_versions tại ngày 2026-06-01. Người gọi không được tự chọn bản có lợi hoặc cộng tiêu chí cả hai phiên bản.

Đề nghị chốt interval đóng/mở và cách áp dụng chuyển tiếp với chuyên môn; sau đó test biên, không sửa cơ học thành `<` trước khi xác nhận nghiệp vụ. Corpus có RULE_CHANGED và OUT_OF_EFFECTIVE_WINDOW; labels chỉ kỹ thuật. AI hiện có guard ngày nhưng chưa tự giải quyết tình huống nhiều phiên bản cùng active.

## W3P4-R04 [P1] AI chỉ authenticate, sai repo signature và dùng nguồn chưa duyệt — đã sửa giới hạn

Trước W3-P4: `evaluateCriterion` gọi `findAchievementById(null,achievementId)` trong khi repo có chữ ký `(id,client=null)`, không kiểm tra quyền đọc; unconfirmed chỉ warning rồi vẫn gọi provider. `provider` HTTP không ánh xạ forcedProvider; mock luôn tự nói hồ sơ thỏa điều kiện.

Đã sửa trong task: chuyển user tới read service có quyền đọc, require VERIFIED; require criterion+version confirmed/CONFIRMED_LHU_POLICY, kiểm hiệu lực và target; smoke require parent confirmed; mapping provider và bỏ kết luận đạt điều kiện khỏi mock. **Đã xác minh**: HTTP ngoài quyền 403, unconfirmed criterion/parent 400, nguồn đã hết hiệu lực/thu hồi 400, provider mock đúng và automaticAward=false. Unit chứng minh completeWithRetry không chạy khi source gate fail.

Phần còn lại: legacy API chỉ trả analysis, chưa đọc toàn bộ file/snapshot nhiều năm và chưa persist EvaluationRun/input bất biến; quyền/status/confirmed có thể thay đổi trong lúc chờ provider. Confirmation endpoints W3-Q2 hiện dựa trên roles từ JWT và cho xác nhận criterion độc lập dù parent chưa confirmed; AI guard nay chặn parent nhưng cần review quy trình approval riêng. Không dùng response legacy làm quyết định xét thưởng. Corpus chưa được phép xem là gold benchmark LLM.

## W3P4-R05 [P2] Bản thay thế achievement và audit chưa chung transaction

`achievementService.js:975–1026` tạo record mới bằng repo.createAchievement rồi recordAuditLog ngoài transaction, không throwOnError. Khi audit lỗi, bản thay thế có thể tồn tại mà không có audit tương ứng. **Finding từ mã**, chưa fault-inject real integration cho action này trong W3-P4. Đề nghị gom replace + history/audit trong cùng transaction, cập nhật OCC hợp đồng nếu cần. Không nhầm với award replacement W2-P2/W3-P3 vốn đã có transaction khác.

## Các điểm đã đạt ở luồng tuần tự

- KPI W3-P2 tạo DRAFT từ dữ liệu có nhãn MO PHONG, không tự VERIFIED hoặc AwardRecord.
- Submit/resubmit tạo revision mới; file v1/v2 metadata/hash/bytes riêng, v1 giữ nguyên khi v2 và revoke.
- API khóa sửa VERIFIED và xóa minh chứng; người ngoài quyền không đọc submissions.
- Quy định thêm v2 có supersedes id, giữ hash/nội dung v1; confirmed criterion không vượt unconfirmed parent ở AI guard mới.
- Dev fixture và holdout giữ nhãn chưa được chuyên môn xác nhận, không có legalReferences giả hoặc xác suất trao thưởng.

Bằng chứng máy đọc: `docs/testing/week-3/W3_P4_INTEGRATION_RESULT.json`; lệnh/giới hạn đầy đủ: `W3_P4_TEST_REPORT.md`. Trạng thái PR online chưa xác minh; review dựa checkout hiện tại và commits phụ thuộc đã nêu trong plan.
