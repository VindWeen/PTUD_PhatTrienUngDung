# Handoff Report: Reviewer 2 — Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP)

**Người thẩm định**: Reviewer 2 (Quality Reviewer & Adversarial Critic)  
**Ngày thẩm định**: 2026-11-12  
**Đối tượng bàn giao**: Sub-Orchestrator Milestone 2 (`83c8f951-06e2-4a54-989d-22102953315c`)  
**Thư mục làm việc**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung`  
**State folder**: `c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\.agents\teamwork\reviewer_m2_2`  

---

## 1. Observation (Quan Sát Trực Tiếp)

### 1.1 Kết quả thực thi kiểm thử độc lập
Lệnh kiểm tra các bài test chỉ định:
```powershell
cd backend; node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js
```
Kết quả: 24/24 tests pass (100%).

Tuy nhiên, khi thực hiện kiểm tra hồi quy các bài test liên quan đến kho và thùng rác thành tích:
```powershell
cd backend; node --test tests/achievement-trash.integration.js
```
Kết quả: **FAIL** (Mã thoát 1):
```
✖ SQL Server achievement trash: owner restore, expiry, version, evidence retention and permanent cleanup (188.7044ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  0 !== 1
      at TestContext.<anonymous> (tests/achievement-trash.integration.js:33:12)
```

### 1.2 Quan sát lỗi tại tầng Database Repository (`achievementRepository.js`)
Tại `backend/src/modules/achievements/achievementRepository.js:472-482`:
```javascript
export async function deleteAchievement(id, userId, version) {
  const result = await query(`UPDATE app.achievements SET deleted_at = SYSUTCDATETIME(), deleted_by = $2, updated_at = SYSUTCDATETIME(), version = version + 1
    OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $3 AND status = 'DRAFT' AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = app.achievements.achievement_id)`, [id, userId, version]);
  return result.rowCount > 0;
}
export async function restoreAchievement(id, version) {
  const result = await query(`UPDATE app.achievements SET deleted_at = NULL, deleted_by = NULL, updated_at = SYSUTCDATETIME(), version = version + 1
    OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $2 AND status = 'DRAFT'
    AND deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`, [id, version]);
  return result.rowCount > 0;
}
```
Mệnh đề SQL `WHERE` trong cả hai hàm vẫn ép buộc `status = 'DRAFT'`. Nhưng toàn bộ thành tích mới tạo hiện nay đều có `status = 'ACTIVE'`. Khi xóa hoặc khôi phục một thành tích `ACTIVE`, SQL Server cập nhật 0 dòng, `result.rowCount === 0`.
Kết hợp với `backend/src/modules/achievements/achievementService.js:349-350`:
```javascript
const deleted = await repo.deleteAchievement(id, user.userId, existing.version);
if (!deleted) {
  throw new ConflictError('Không thể xóa bản ghi thành tích');
}
```
Hệ thống ném ra `ConflictError: Không thể xóa bản ghi thành tích`. Cả chính chủ lẫn ADMIN đều **không thể xóa hoặc khôi phục thành tích ACTIVE**.

### 1.3 Quan sát quyền của vai trò chuẩn mới (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`)
Tại `backend/src/modules/achievements/achievementService.js:50-94`:
```javascript
const isAdmin = roles.includes('ADMIN');
const isManager = roles.includes('MANAGER');
const isRecordsOfficer = roles.includes('RECORDS_OFFICER');
const isUnitRep = roles.includes('UNIT_REPRESENTATIVE');
const isLecturer = roles.includes('LECTURER');

if (!isAdmin) {
  const orConditions = [];
  if (isLecturer || isManager || isUnitRep) {
    const lecturerProfile = await repo.findLecturerByUserId(user.userId);
    if (lecturerProfile) {
      myLecturerId = lecturerProfile.lecturerId;
      orConditions.push(`a.lecturer_id = ${myLecturerId}`);
    }
  }
  ...
  if (orConditions.length === 0) {
    return { items: [], pagination: { total: 0, page: queryParams.page, pageSize: queryParams.pageSize, totalPages: 0 } };
  }
}
```
Tại `achievementService.js:27-31`:
```javascript
async function listCatalogs(user) {
  const active = (await roles(user.userId)).map(r => typeof r === 'string' ? r : r.Code || r.code);
  if (!active.some(r => ['LECTURER', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r)))
    throw new ForbiddenError('Không có quyền đọc danh mục thành tích');
  return repo.listActiveTypes();
}
```
Khi người dùng mang vai trò chuẩn mới theo quy định Milestone 1 là `MEMBER`, `DEPARTMENT_HEAD` hoặc `FACULTY_LEAD` (không còn vai trò cũ `LECTURER`):
- `listAchievements` xác định `orConditions.length === 0` và trả về danh sách rỗng `{ items: [], total: 0 }`. Giảng viên/thành viên không xem được kho thành tích của chính mình.
- `listCatalogs` ném lỗi HTTP 403 `ForbiddenError: Không có quyền đọc danh mục thành tích`, khiến biểu mẫu tạo/sửa thành tích không tải được danh mục.

### 1.4 Quan sát lỗ hổng bảo mật IDOR trong `autoDiscoveryService` và `dossierPackagerService`
Tại `backend/src/modules/ai/autoDiscoveryService.js:15-28`:
```javascript
let subjectType = options.subjectType || 'LECTURER';
let subjectId = options.subjectId ? Number(options.subjectId) : null;

if (!subjectId && subjectType === 'LECTURER') {
  const lecRes = await db('SELECT lecturer_id FROM app.lecturers WHERE user_id = $1', [user.userId]);
  if (lecRes.rows[0]) {
    subjectId = Number(lecRes.rows[0].lecturer_id);
  } else {
    subjectId = Number(user.userId);
  }
}
```
Tại `backend/src/modules/ai/dossierPackagerService.js:109-120`:
```javascript
let subjectType = options.subjectType || 'LECTURER';
let subjectId = options.subjectId ? Number(options.subjectId) : null;

if (!subjectId && subjectType === 'LECTURER') {
  const lecRes = await db('SELECT lecturer_id FROM app.lecturers WHERE user_id = $1', [user.userId]);
  if (lecRes.rows[0]) {
    subjectId = Number(lecRes.rows[0].lecturer_id);
  } else {
    subjectId = Number(user.userId);
  }
}
```
Khi người dùng gửi request `POST /ai/export-dossier-zip` hoặc `POST /ai/auto-discovery` kèm `subjectId` (ví dụ: `{ "subjectId": 2, "regulationId": 1 }`), backend trực tiếp sử dụng `options.subjectId` mà **không hề gọi `authorizeSubjectAccess`** hay kiểm tra xem `req.user` có quyền hạn trên `subjectId` đó hay không. Bất kỳ tài khoản người dùng đăng nhập nào cũng có thể đóng gói và tải về toàn bộ tệp tài liệu minh chứng riêng tư của giảng viên khác (IDOR).
Đồng thời, nhánh `else { subjectId = Number(user.userId); }` tự ý gán `subjectId = user.userId` khi người dùng chưa có hồ sơ `app.lecturers`, dẫn đến việc truy vấn nhầm `lecturer_id = user.userId` của giảng viên khác (xung đột ID sequence).

### 1.5 Quan sát xử lý lỗi luồng stream ZIP (`dossierPackagerService.js`)
Tại `backend/src/modules/ai/dossierPackagerService.js:267-272`:
```javascript
archive.on('error', (err) => {
  console.error('[DossierPackager] Archive streaming error:', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
  }
});
```
Sự kiện `archive.on('error')` đã được bắt, giúp Express server không bị crash. Tuy nhiên, khi `res.headersSent === true` (dữ liệu đã bắt đầu truyền tới client), đoạn mã không gọi `res.destroy(err)` hay ngắt luồng phản hồi, khiến kết nối socket có thể bị treo lơ lửng nếu nén file giữa chừng gặp sự cố. Đồng thời chưa lắng nghe `res.on('close')` để `archive.abort()` giải phóng bộ nhớ khi client ngắt kết nối đột ngột.

---

## 2. Logic Chain (Chuỗi Lập Luận)

1. **Từ Quan sát 1.2 đến Khiếm khuyết Xóa thành tích**:
   - Yêu cầu R1 quy định thành tích cá nhân tạo mới lập tức nhận trạng thái `ACTIVE`.
   - Worker đã sửa `achievementService.js:325` cho phép xóa khi trạng thái là `['ACTIVE', 'DRAFT']`, và cập nhật UI actions trong `achievementPermissions.js`.
   - Tuy nhiên worker bỏ quên việc sửa câu truy vấn SQL trong `achievementRepository.js:474, 480`. Câu lệnh SQL vẫn yêu cầu cứng `WHERE ... AND status = 'DRAFT'`.
   - Hệ quả trực tiếp: Bất kỳ thao tác xóa hoặc khôi phục thành tích `ACTIVE` nào trên API đều bị SQL Server bỏ qua (0 rows affected) $\to$ service ném `ConflictError` $\to$ Người dùng và ADMIN không thể xóa thành tích cá nhân trong kho.

2. **Từ Quan sát 1.3 và 1.1 đến Khóa quyền người dùng và Hồi quy Test**:
   - Hệ thống đã chuẩn hóa 4 vai trò: `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` từ Milestone 1.
   - Nhưng trong `achievementService.js`, các hàm `listAchievements` và `listCatalogs` vẫn kiểm tra cứng vai trò cũ `LECTURER`.
   - Do đó, tài khoản người dùng mang vai trò chuẩn `MEMBER` không thể tải danh mục để tạo thành tích mới (`listCatalogs` ném 403) và không thể xem danh sách thành tích của mình (`listAchievements` trả về 0 item).
   - Bộ lọc `workflow: 'ACTIONABLE'` trong `achievementService.js:48` chỉ lọc `['DRAFT', 'NEED_CORRECTION']`, loại trừ hoàn toàn `ACTIVE`, làm bài test tích hợp `achievement-trash.integration.js` bị gãy tại dòng 33.

3. **Từ Quan sát 1.4 đến Lỗ hổng An ninh IDOR**:
   - Endpoint `POST /ai/export-dossier-zip` đọc trực tiếp `req.body.subjectId` mà không kiểm tra quyền sở hữu.
   - Trong kiến trúc bảo mật của hệ thống (`aiService.js:254-299`), mọi truy cập tài nguyên theo `subjectId` bắt buộc phải qua `authorizeSubjectAccess(user, subjectType, subjectId)` để đảm bảo: chỉ chính chủ hoặc quản trị viên/lãnh đạo đơn vị có thẩm quyền mới được truy cập.
   - Việc `autoDiscoveryService.js` và `dossierPackagerService.js` bỏ qua bước ủy quyền này mở toang quyền truy xuất hồ sơ và tải trọn gói tài liệu PDF minh chứng của bất kỳ nhân sự nào trong trường.

---

## 3. Review Report & Findings (Chi Tiết Đánh Giá)

### Review Summary
**Verdict**: **REQUEST_CHANGES**

### Findings

#### [Critical] Finding 1: Không thể Xóa hoặc Khôi phục thành tích ACTIVE tại tầng SQL Repository
- **What**: Câu lệnh SQL trong `deleteAchievement` và `restoreAchievement` gán cứng điều kiện `status = 'DRAFT'`.
- **Where**: `backend/src/modules/achievements/achievementRepository.js:474, 480`.
- **Why**: Mọi thành tích mới trong Kho đều có trạng thái `ACTIVE`. Khi gọi xóa hoặc khôi phục, SQL Server không tìm thấy bản ghi nào khớp điều kiện `status = 'DRAFT'`, trả về `rowCount = 0`, khiến service ném `ConflictError('Không thể xóa bản ghi thành tích')`.
- **Suggestion**:
  - Tại dòng 474, sửa thành: `AND status IN ('ACTIVE', 'DRAFT')`
  - Tại dòng 480, sửa thành: `AND status IN ('ACTIVE', 'DRAFT')`

#### [Critical] Finding 2: Lỗ hổng IDOR cho phép tải trái phép tệp minh chứng ZIP của giảng viên khác
- **What**: Endpoints `POST /ai/auto-discovery` và `POST /ai/export-dossier-zip` nhận `subjectId` từ client mà không kiểm tra quyền sở hữu.
- **Where**:
  - `backend/src/modules/ai/autoDiscoveryService.js:15-28`
  - `backend/src/modules/ai/dossierPackagerService.js:109-120`
- **Why**: Người dùng có role `MEMBER` thông thường chỉ cần đổi `subjectId` trong request body là có thể xem tỷ lệ hoàn thành quy chế và tải toàn bộ file minh chứng private của giảng viên khác về máy dưới dạng file ZIP.
- **Suggestion**:
  - Nếu `!roles.includes('ADMIN')` (hoặc không phải lãnh đạo quản lý đơn vị của giảng viên), bắt buộc ghi đè `subjectId` bằng chính `lecturer_id` của `user.userId`, hoặc gọi `aiService.authorizeSubjectAccess(user, subjectType, subjectId)`.
  - Nếu người dùng chưa có hồ sơ trong `app.lecturers`, không được tự ý fallback sang `user.userId` (dẫn đến va chạm ID của giảng viên khác), mà phải trả về lỗi hoặc kết quả rỗng hợp lệ.

#### [Major] Finding 3: Khóa quyền tài khoản `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` trong Kho Thành tích
- **What**: `listAchievements` và `listCatalogs` chỉ kiểm tra vai trò cũ `LECTURER`, không nhận diện các vai trò chuẩn mới.
- **Where**:
  - `backend/src/modules/achievements/achievementService.js:29, 62`
- **Why**: Tài khoản có vai trò `MEMBER` bị trả về 0 thành tích (`items: []`) và bị chặn 403 khi lấy danh mục `catalogs`.
- **Suggestion**:
  - Cập nhật điều kiện vai trò giảng viên/cá nhân: Bổ sung `roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD'].includes(r))`.
  - Cập nhật `listCatalogs` cho phép `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` truy cập.

#### [Major] Finding 4: Bộ lọc `workflow: 'ACTIONABLE'` loại bỏ thành tích `ACTIVE`, gây gãy kiểm thử hồi quy
- **What**: `filters.statuses = { ACTIONABLE: ['DRAFT', 'NEED_CORRECTION'], ... }` không bao gồm `ACTIVE`.
- **Where**: `backend/src/modules/achievements/achievementService.js:48`
- **Why**: Khi giao diện hoặc test kiểm tra các mục hành động được (`ACTIONABLE`), toàn bộ thành tích `ACTIVE` bị ẩn, dẫn đến việc `tests/achievement-trash.integration.js` bị fail (`0 !== 1`).
- **Suggestion**:
  - Sửa thành: `ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION']`.

#### [Minor] Finding 5: Thiếu đóng luồng kết nối và giải phóng bộ nhớ khi stream ZIP gặp sự cố
- **What**: Trong `dossierPackagerService.js:267-272`, khi `archive.on('error')` kích hoạt mà `res.headersSent === true`, luồng response không được `destroy`.
- **Where**: `backend/src/modules/ai/dossierPackagerService.js:267-275`
- **Why**: Nếu xảy ra lỗi nén khi đang truyền dữ liệu, kết nối socket của Express có thể bị treo. Đồng thời nếu người dùng ngắt kết nối tải xuống giữa chừng, archiver vẫn tiếp tục nén gây lãng phí CPU/RAM.
- **Suggestion**:
  - Khi `res.headersSent` là true trong `archive.on('error')`, gọi `res.destroy(err)`.
  - Đăng ký `res.on('close', () => archive.abort())` để ngắt nén ngay khi client hủy tải.

#### [Minor] Finding 6: Thứ tự sắp xếp mặc định trong `achievementRepository.listAchievements` đẩy `ACTIVE` về cuối
- **What**: Câu lệnh SQL sắp xếp `ORDER BY CASE a.status WHEN 'NEED_CORRECTION' THEN 0 WHEN 'DRAFT' THEN 1 ... ELSE 6 END` chưa khai báo `ACTIVE`.
- **Where**: `backend/src/modules/achievements/achievementRepository.js:341`
- **Suggestion**: Bổ sung `WHEN 'ACTIVE' THEN 0` hoặc `1` để thành tích hiệu lực hiển thị ưu tiên lên đầu.

---

## 4. Adversarial Challenge & Stress-Testing

### Challenge Summary
**Mức độ rủi ro tổng thể**: **HIGH**

### Challenges & Attack Scenarios

1. **Kịch bản Tấn công IDOR Tải Trộm Hồ sơ**:
   - **Mục tiêu**: Người dùng A (vai trò `MEMBER`, `user_id = 1002`) muốn tải trộm toàn bộ minh chứng của Trưởng khoa B (`lecturer_id = 5`).
   - **Thao tác**: Người dùng A gửi `POST /api/v1/ai/export-dossier-zip` với JSON `{ "regulationId": 1, "subjectId": 5 }`.
   - **Hành vi thực tế**: `dossierPackagerService.js` lấy thẳng `subjectId = 5`, truy vấn các bản ghi `ACTIVE` của Trưởng khoa B, đóng gói toàn bộ PDF và trả về file ZIP đính kèm cho Người dùng A.
   - **Bán kính thiệt hại**: Rò rỉ dữ liệu cá nhân, tài liệu khen thưởng và công trình nghiên cứu chưa công bố trên toàn hệ thống.

2. **Kịch bản Xóa Thành Tích Cá Nhân Bị Treo (DoS chức năng)**:
   - **Mục tiêu**: Người dùng tạo nhầm một bản ghi thành tích `ACTIVE` và bấm nút "Xóa" trên giao diện.
   - **Hành vi thực tế**: Giao diện nhận HTTP 409 Conflict với thông báo `"Không thể xóa bản ghi thành tích"`. Người dùng không có cách nào xóa bản ghi thừa, kể cả khi liên hệ ADMIN cũng không xóa được do SQL Server chặn ở câu lệnh `WHERE status = 'DRAFT'`.
   - **Bán kính thiệt hại**: Tê liệt tính năng quản lý kho thành tích cá nhân; vi phạm trực tiếp Acceptance Criteria của R1.

3. **Kịch bản Giảng viên mới đăng nhập không thấy danh mục và hồ sơ**:
   - **Mục tiêu**: Giảng viên được cấp tài khoản mới với role chuẩn `MEMBER`.
   - **Hành vi thực tế**: Vào trang Thành tích, danh sách rỗng (dù DB có dữ liệu). Bấm "Thêm thành tích", dropdown loại thành tích báo lỗi 403 Forbidden do `listCatalogs` từ chối `MEMBER`.
   - **Bán kính thiệt hại**: Toàn bộ người dùng mang role chuẩn không thể sử dụng chức năng Kho Thành tích.

---

## 5. Caveats (Giới Hạn & Giả Định)

1. **Dịch vụ AI Vision Ingest**:
   - Phần xử lý fallback khi không có API key, buffer rỗng, timeout và parse JSON của `achievementAiIngestService.js` hoạt động rất tốt, bọc `try...catch` đầy đủ và không làm rò rỉ exception 500 ra ngoài.
2. **ESM Compatibility & PizZip / Archiver**:
   - Việc tích hợp `archiver` v8 (sử dụng `ZipArchive`) và `pizzip` hoàn toàn chuẩn xác, tương thích ESM, tạo được cấu trúc file ZIP chuẩn byte `PK\x03\x04`.

---

## 6. Conclusion (Kết Luận Thẩm Định)

**YÊU CẦU ĐIỀU CHỈNH (REQUEST_CHANGES)**.

Worker đã hoàn thành đúng kiến trúc tổng thể về ESM, AI Vision Fallback, cấu trúc đánh giá quy chế và nén ZIP. Tuy nhiên, các lỗi nghiêm trọng về logic nghiệp vụ và bảo mật cần phải được khắc phục ngay lập tức:
1. Sửa `achievementRepository.js` (dòng 474 và 480) cho phép xóa và khôi phục thành tích ở trạng thái `ACTIVE`.
2. Kiểm tra quyền sở hữu (chống IDOR) trong `autoDiscoveryService.js` và `dossierPackagerService.js`, bảo đảm chỉ chính chủ (hoặc ADMIN) mới được truy xuất theo `subjectId`.
3. Bổ sung hỗ trợ vai trò chuẩn mới (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`) trong `achievementService.js` (`listAchievements` và `listCatalogs`).
4. Bổ sung `'ACTIVE'` vào bộ lọc `ACTIONABLE` trong `achievementService.js:48` để đảm bảo bài test `tests/achievement-trash.integration.js` vượt qua 100%.

---

## 7. Verification Method (Phương Pháp Tái Kiểm Minh)

Sau khi Worker hoàn thiện các bản sửa lỗi, Sub-Orchestrator hoặc Reviewer có thể kiểm tra lại bằng các bước sau:

### 7.1 Kiểm tra khắc phục lỗi Xóa thành tích ACTIVE
Chạy script kiểm tra trực tiếp:
```powershell
cd backend; node -e "
import { createAchievementService } from './src/modules/achievements/achievementService.js';
import repo from './src/modules/achievements/achievementRepository.js';

// Xác nhận code repo đã hỗ trợ ACTIVE
const repoCode = repo.deleteAchievement.toString();
if (!repoCode.includes(\"'ACTIVE'\")) {
  console.error('FAIL: repo.deleteAchievement chua ho tro ACTIVE');
  process.exit(1);
} else {
  console.log('PASS: repo.deleteAchievement da ho tro ACTIVE');
}
"
```

### 7.2 Kiểm tra khắc phục quyền xem danh sách và danh mục của role `MEMBER`
```powershell
cd backend; node -e "
import { createAchievementService } from './src/modules/achievements/achievementService.js';

const mockRepo = {
  findLecturerByUserId: async () => ({ lecturerId: 1 }),
  listAchievements: async () => ({ items: [{ id: 1 }], total: 1 }),
  listActiveTypes: async () => [{ id: 1 }],
  findActiveRepresentative: async () => false,
};

const service = createAchievementService(mockRepo, {
  roles: async () => [{ Code: 'MEMBER' }],
  scopes: async () => [],
  scope: async () => false,
});

Promise.all([
  service.listAchievements({ userId: 1 }, {}),
  service.listCatalogs({ userId: 1 })
]).then(([listRes, catRes]) => {
  if (listRes.items.length === 1 && catRes.length === 1) {
    console.log('PASS: MEMBER xem duoc danh sach va danh muc');
  } else {
    console.error('FAIL: MEMBER van bi chan');
    process.exit(1);
  }
});
"
```

### 7.3 Kiểm tra toàn bộ test suite bao gồm bài test hồi quy
```powershell
cd backend; node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/achievement-trash.integration.js
```
Điều kiện đạt: Toàn bộ các bài test trên phải thoát với mã 0 (`fail: 0`).
