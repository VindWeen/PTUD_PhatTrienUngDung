# TỪ ĐIỂN DỮ LIỆU (DATA DICTIONARY)
## Hệ thống Quản lý Hồ sơ Thành tích Số & Hỗ trợ Xét duyệt Khen thưởng LHU
**Giai đoạn W1-Q1: Chốt nghiệp vụ, Schema và API lõi**  
**Tác giả:** Tạ Trần Vinh Quang (Phụ trách Backend / Database / Core API)  
**Ngày lập:** 25/09/2026 — **Bàn giao:** 26/09/2026  
**Mã nhiệm vụ:** `[W1-Q1]`

---

## 1. QUY ƯỚC THIẾT KẾ DỮ LIỆU VẬT LÝ (MSSQL)

- **Hệ quản trị CSDL:** Microsoft SQL Server 2019+ (T-SQL).
- **Khóa chính:** Mọi bảng đều sử dụng kiểu số nguyên lớn tự tăng `bigint IDENTITY(1,1) PRIMARY KEY`.
- **Chuỗi văn bản:**
  - Chuỗi có dấu tiếng Việt sử dụng `nvarchar(n)`.
  - Mã định danh ASCII, mã băm, URL, MIME type dùng `varchar(n)`.
  - Trường chứa dữ liệu JSON/Snapshot dùng `nvarchar(max)` kèm ràng buộc `CHECK (ISJSON(column) = 1)`.
- **Thời gian hệ thống:** Sử dụng kiểu `datetime2(3)` lưu giờ chuẩn quốc tế UTC (`SYSUTCDATETIME()`).
- **Thời gian ngày tháng nghiệp vụ:** Sử dụng kiểu `date` (chỉ lưu ngày, không lưu giờ).
- **Kiểm soát cập nhật đồng thời:** Tất cả các bảng nghiệp vụ có khả năng xung đột dữ liệu sử dụng cột `RowVersion timestamp NOT NULL` (kiểu nhị phân tự động cập nhật của SQL Server).
- **Bảo toàn lịch sử:** Tất cả các khóa ngoại liên quan đến lịch sử trạng thái, file, audit log đều áp dụng `ON DELETE NO ACTION` để ngăn ngừa xóa dây chuyền vô tình.

---

## 2. CHI TIẾT TỪ ĐIỂN DỮ LIỆU TỪNG BẢNG

### 2.1. Phân hệ Định danh & Xác thực (Identity)

#### Bảng: `Users` (Tài khoản người dùng)
Lưu trữ thông tin tài khoản đăng nhập của toàn bộ cán bộ, giảng viên, nhân viên và quản trị viên.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `UserId` | `bigint` | No | PK, IDENTITY | | Khóa chính tài khoản |
| `Username` | `varchar(50)` | No | UQ | | Tên đăng nhập duy nhất (thường là mã nhân sự hoặc email) |
| `Email` | `varchar(100)` | No | UQ | | Email làm việc tại trường (@lhu.edu.vn) |
| `PasswordHash` | `varchar(255)` | No | | | Mật khẩu băm (bcrypt / argon2id) |
| `DisplayName` | `nvarchar(100)` | No | | | Tên hiển thị của người dùng |
| `Status` | `varchar(20)` | No | CK | `'ACTIVE'` | Trạng thái: `ACTIVE`, `LOCKED`, `INACTIVE` |
| `MustChangePassword` | `bit` | No | | `0` | Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo |
| `PasswordChangedAt` | `datetime2(3)` | Yes | | `NULL` | Thời điểm đổi mật khẩu gần nhất |
| `LastLoginAt` | `datetime2(3)` | Yes | | `NULL` | Thời điểm đăng nhập thành công gần nhất |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo tài khoản |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật tài khoản |
| `RowVersion` | `timestamp` | No | | | Concurrency token kiểm soát đồng thời |

#### Bảng: `Roles` (Danh mục vai trò)
Danh mục các vai trò năng lực trong hệ thống.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `RoleId` | `bigint` | No | PK, IDENTITY | | Khóa chính vai trò |
| `Code` | `varchar(50)` | No | UQ | | Mã vai trò: `LECTURER`, `UNIT_REPRESENTATIVE`, `MANAGER`, `RECORDS_OFFICER`, `ADMIN`, `COUNCIL` |
| `Name` | `nvarchar(100)` | No | | | Tên hiển thị vai trò (tiếng Việt) |
| `Description` | `nvarchar(255)` | Yes | | `NULL` | Diễn giải trách nhiệm vai trò |
| `IsActive` | `bit` | No | | `1` | Trạng thái kích hoạt |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |

#### Bảng: `UserRoles` (Gán vai trò người dùng)
Lưu trữ việc phân quyền vai trò cho tài khoản, kèm thời hạn hiệu lực.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `UserId` | `bigint` | No | PK, FK -> `Users(UserId)` | | Mã tài khoản |
| `RoleId` | `bigint` | No | PK, FK -> `Roles(RoleId)` | | Mã vai trò |
| `ValidFrom` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Ngày bắt đầu có hiệu lực |
| `ValidTo` | `datetime2(3)` | Yes | CK: `ValidTo >= ValidFrom` | `NULL` | Ngày hết hạn hiệu lực (`NULL` = vô thời hạn) |
| `AssignedBy` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản Admin thực hiện gán |
| `AssignedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm gán quyền |

#### Bảng: `RefreshTokens` (Phiên đăng nhập & Refresh Token)
Lưu trữ mã làm mới JWT phục vụ cơ chế xoay vòng token (Token Rotation) và thu hồi phiên.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `RefreshTokenId` | `bigint` | No | PK, IDENTITY | | Khóa chính token |
| `UserId` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản sở hữu |
| `TokenHash` | `varchar(255)` | No | UQ | | Mã băm SHA-256 của refresh token |
| `ExpiresAt` | `datetime2(3)` | No | | | Thời điểm hết hạn |
| `RevokedAt` | `datetime2(3)` | Yes | | `NULL` | Thời điểm thu hồi (khi logout hoặc bị hủy) |
| `ReplacedByTokenId`| `bigint` | Yes | FK -> `RefreshTokens` | `NULL` | ID của token thay thế khi rotation |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cấp phát |
| `CreatedIp` | `varchar(45)` | Yes | | `NULL` | Địa chỉ IP tạo phiên |
| `UserAgent` | `nvarchar(255)` | Yes | | `NULL` | Thiết bị / trình duyệt |

---

### 2.2. Phân hệ Cơ cấu Tổ chức & Phạm vi (Organization & Scopes)

#### Bảng: `OrganizationUnits` (Cơ cấu đơn vị)
Cây tổ chức đơn vị đào tạo và quản lý trong trường (Khoa, Bộ môn, Phòng ban).

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `UnitId` | `bigint` | No | PK, IDENTITY | | Khóa chính đơn vị |
| `Code` | `varchar(50)` | No | UQ | | Mã đơn vị (ví dụ: `FIT_LHU`, `FIT_SE`, `FIT_AI`) |
| `Name` | `nvarchar(150)` | No | | | Tên đơn vị (Khoa Công nghệ Thông tin, Bộ môn Kỹ thuật Phần mềm...) |
| `Type` | `varchar(30)` | No | CK | | Phân loại: `FACULTY` (Khoa), `DEPARTMENT` (Bộ môn), `DIVISION` (Phòng/Ban) |
| `ParentId` | `bigint` | Yes | FK -> `OrganizationUnits(UnitId)` | `NULL` | Mã đơn vị cấp cha (`NULL` đối với đơn vị cấp cao nhất) |
| `Description` | `nvarchar(255)` | Yes | | `NULL` | Mô tả chức năng nhiệm vụ |
| `IsActive` | `bit` | No | | `1` | Trạng thái hoạt động |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |
| `RowVersion` | `timestamp` | No | | | Concurrency token |

#### Bảng: `UserUnitScopes` (Phân công phạm vi quản lý)
Quy định phạm vi đơn vị mà người dùng được quyền áp dụng vai trò `MANAGER` hoặc `RECORDS_OFFICER`.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `UserUnitScopeId` | `bigint` | No | PK, IDENTITY | | Khóa chính phân công scope |
| `UserId` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản được phân công |
| `RoleId` | `bigint` | No | FK -> `Roles(RoleId)` | | Vai trò áp dụng (thường là `MANAGER` hoặc `RECORDS_OFFICER`) |
| `UnitId` | `bigint` | No | FK -> `OrganizationUnits(UnitId)` | | Đơn vị phụ trách |
| `IncludeDescendants`| `bit` | No | | `0` | Cờ kế thừa: Nếu `1`, áp dụng cho cả các đơn vị con (ví dụ Khoa bao gồm các Bộ môn con) |
| `ValidFrom` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Ngày bắt đầu quyền phụ trách |
| `ValidTo` | `datetime2(3)` | Yes | CK: `ValidTo >= ValidFrom` | `NULL` | Ngày hết hạn phân công (`NULL` = vô thời hạn) |
| `AssignedBy` | `bigint` | No | FK -> `Users(UserId)` | | Quản trị viên chỉ định phân công |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |

#### Bảng: `UnitRepresentatives` (Đại diện đơn vị)
Phân công giảng viên đại diện nộp hồ sơ thành tích tập thể cho Khoa hoặc Bộ môn.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `UnitRepresentativeId` | `bigint` | No | PK, IDENTITY | | Khóa chính phân công đại diện |
| `UserId` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản người đại diện |
| `UnitId` | `bigint` | No | FK -> `OrganizationUnits(UnitId)` | | Đơn vị được đại diện |
| `ValidFrom` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Ngày bắt đầu đại diện |
| `ValidTo` | `datetime2(3)` | Yes | CK: `ValidTo >= ValidFrom` | `NULL` | Ngày hết hạn đại diện |
| `AssignedBy` | `bigint` | No | FK -> `Users(UserId)` | | Người phân công |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |

---

### 2.3. Phân hệ Giảng viên & Công tác (Lecturers)

#### Bảng: `Lecturers` (Hồ sơ giảng viên)
Lưu thông tin hồ sơ lý lịch khoa học và liên kết với tài khoản người dùng.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `LecturerId` | `bigint` | No | PK, IDENTITY | | Khóa chính giảng viên |
| `UserId` | `bigint` | Yes | UQ, FK -> `Users(UserId)` | `NULL` | Khóa ngoại tài khoản (Dùng để xác định danh tính và CHỐNG TỰ DUYỆT) |
| `EmployeeCode` | `varchar(30)` | No | UQ | | Mã cán bộ / giảng viên duy nhất (ví dụ: `GV00234`) |
| `FullName` | `nvarchar(100)` | No | | | Họ và tên đầy đủ |
| `Email` | `varchar(100)` | No | UQ | | Email liên hệ chính thức |
| `Phone` | `varchar(20)` | Yes | | `NULL` | Số điện thoại liên lạc |
| `Title` | `nvarchar(50)` | Yes | | `NULL` | Học hàm / Chức danh khoa học: `Giảng viên`, `Giảng viên chính`, `Phó Giáo sư`, `Giáo sư` |
| `Degree` | `nvarchar(50)` | Yes | | `NULL` | Học vị cao nhất: `Cử nhân`, `Thạc sĩ`, `Tiến sĩ`, `Tiến sĩ khoa học` |
| `IsActive` | `bit` | No | | `1` | Trạng thái công tác còn làm việc |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo hồ sơ |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |
| `RowVersion` | `timestamp` | No | | | Concurrency token |

#### Bảng: `LecturerAssignments` (Lịch sử công tác của giảng viên)
Lưu trữ quá trình phân công công tác tại các Khoa/Bộ môn theo thời gian.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `LecturerAssignmentId`| `bigint` | No | PK, IDENTITY | | Khóa chính phân công công tác |
| `LecturerId` | `bigint` | No | FK -> `Lecturers(LecturerId)` | | Giảng viên |
| `UnitId` | `bigint` | No | FK -> `OrganizationUnits(UnitId)` | | Đơn vị công tác (Khoa/Bộ môn) |
| `IsPrimary` | `bit` | No | | `1` | Cờ đơn vị công tác chính (`1` = chính, `0` = kiêm nhiệm) |
| `ValidFrom` | `date` | No | | | Ngày bắt đầu công tác |
| `ValidTo` | `date` | Yes | CK: `ValidTo >= ValidFrom` | `NULL` | Ngày kết thúc công tác (`NULL` = hiện tại) |
| `AssignedBy` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ tổ chức gán quyết định |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |

---

### 2.4. Phân hệ Danh mục dùng chung (Catalogs & Time)

#### Bảng: `AcademicYears` (Năm học)
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AcademicYearId` | `bigint` | No | PK, IDENTITY | | Khóa chính năm học |
| `Code` | `varchar(20)` | No | UQ | | Mã năm học: `2023-2024`, `2024-2025` |
| `Name` | `nvarchar(50)` | No | | | Tên hiển thị (Năm học 2024 - 2025) |
| `StartDate` | `date` | No | | | Ngày bắt đầu năm học |
| `EndDate` | `date` | No | CK: `EndDate > StartDate` | | Ngày kết thúc năm học |
| `IsCurrent` | `bit` | No | | `0` | Cờ đánh dấu năm học hiện hành |
| `IsActive` | `bit` | No | | `1` | Trạng thái sử dụng |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |

#### Bảng: `AchievementTypes` (Danh mục loại thành tích)
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AchievementTypeId`| `bigint` | No | PK, IDENTITY | | Khóa chính loại thành tích |
| `Code` | `varchar(50)` | No | UQ | | Mã loại: `RESEARCH_JOURNAL_Q1`, `RESEARCH_PATENT`, `TEACHING_CURRICULUM` |
| `Name` | `nvarchar(150)` | No | | | Tên loại (Bài báo quốc tế ISI/Scopus Q1, Bằng độc quyền sáng chế...) |
| `Description` | `nvarchar(255)` | Yes | | `NULL` | Diễn giải tiêu chí |
| `ApplicableSubjectType` | `varchar(20)` | No | CK | `'BOTH'` | Áp dụng cho: `LECTURER`, `UNIT`, `BOTH` |
| `IsActive` | `bit` | No | | `1` | Trạng thái kích hoạt |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |

#### Bảng: `AwardTypes` (Danh mục danh hiệu & khen thưởng)
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AwardTypeId` | `bigint` | No | PK, IDENTITY | | Khóa chính danh hiệu/khen thưởng |
| `Code` | `varchar(50)` | No | UQ | | Mã danh hiệu: `CSTĐ_CS`, `CSTĐ_BGD`, `BANG_KHEN_TTCP`, `TAP_THE_LĐXS` |
| `Name` | `nvarchar(150)` | No | | | Tên danh hiệu (Chiến sĩ thi đua cơ sở, Bằng khen Thủ tướng...) |
| `Category` | `varchar(30)` | No | CK | | Phân loại: `TITLE` (Danh hiệu thi đua), `REWARD_FORM` (Hình thức khen thưởng) |
| `Level` | `varchar(30)` | No | CK | | Cấp khen thưởng: `FACULTY`, `UNIVERSITY`, `MINISTRY`, `STATE` |
| `ApplicableSubjectType` | `varchar(20)` | No | CK | `'BOTH'` | Áp dụng cho: `LECTURER`, `UNIT`, `BOTH` |
| `Description` | `nvarchar(255)` | Yes | | `NULL` | Mô tả tiêu chuẩn |
| `IsActive` | `bit` | No | | `1` | Trạng thái sử dụng |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |

---

### 2.5. Phân hệ Thành tích (Achievements)

#### Bảng: `Achievements` (Hồ sơ thành tích kê khai)
Bảng trung tâm lưu trữ thành tích của cá nhân giảng viên hoặc tập thể đơn vị.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AchievementId` | `bigint` | No | PK, IDENTITY | | Khóa chính thành tích |
| `LecturerId` | `bigint` | Yes | FK -> `Lecturers(LecturerId)` | `NULL` | Giảng viên chủ thể (Bắt buộc XOR với `OrganizationUnitId`) |
| `OrganizationUnitId`| `bigint` | Yes | FK -> `OrganizationUnits(UnitId)` | `NULL` | Đơn vị chủ thể (Bắt buộc XOR với `LecturerId`) |
| `ContextUnitId` | `bigint` | No | FK -> `OrganizationUnits(UnitId)` | | Snapshot đơn vị quản lý lúc tạo hồ sơ (Bất biến khi đổi đơn vị) |
| `AchievementTypeId` | `bigint` | No | FK -> `AchievementTypes(AchievementTypeId)` | | Loại thành tích kê khai |
| `Title` | `nvarchar(255)` | No | | | Tên đề tài, bài báo, sáng kiến, giáo trình... |
| `Description` | `nvarchar(max)` | Yes | | `NULL` | Tóm tắt nội dung, kết quả đạt được |
| `ContributionRole` | `nvarchar(100)` | Yes | | `NULL` | Vai trò đóng góp cá nhân (Chủ nhiệm, Tác giả chính, Thành viên...) |
| `StartDate` | `date` | Yes | | `NULL` | Ngày bắt đầu thực hiện |
| `EndDate` | `date` | Yes | CK: `EndDate >= StartDate` | `NULL` | Ngày nghiệm thu / xuất bản / hoàn thành |
| `RecognitionYear` | `int` | No | CK: `RecognitionYear >= 1990` | | Năm dương lịch ghi nhận thành tích (ví dụ: `2024`) |
| `AcademicYearId` | `bigint` | Yes | FK -> `AcademicYears(AcademicYearId)` | `NULL` | Năm học tham chiếu bổ sung |
| `Status` | `varchar(30)` | No | CK | `'DRAFT'` | Trạng thái workflow: `DRAFT`, `SUBMITTED`, `NEED_CORRECTION`, `VERIFIED`, `REJECTED`, `CANCELLED`, `REVOKED` |
| `CreatedBy` | `bigint` | No | FK -> `Users(UserId)` | | Người tạo bản ghi |
| `SubmittedBy` | `bigint` | Yes | FK -> `Users(UserId)` | `NULL` | Người thực hiện thao tác nộp hồ sơ gần nhất |
| `ReplacesAchievementId`| `bigint`| Yes | FK -> `Achievements(AchievementId)` | `NULL` | Mã thành tích cũ nếu đây là bản kê khai thay thế cho bản bị từ chối/thu hồi |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo bản nháp |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật cuối |
| `RowVersion` | `timestamp` | No | | | Concurrency token chống cập nhật đồng thời |

**Ràng buộc trọng yếu trên `Achievements`:**
```sql
CONSTRAINT CK_Achievements_Subject_XOR CHECK (
    (LecturerId IS NOT NULL AND OrganizationUnitId IS NULL) OR
    (LecturerId IS NULL AND OrganizationUnitId IS NOT NULL)
);
```

#### Bảng: `AchievementSubmissions` (Các lần nộp hồ sơ & Snapshot dữ liệu)
Mỗi lần người dùng bấm gửi (lần đầu hoặc gửi lại sau yêu cầu bổ sung), hệ thống lưu một snapshot bất biến.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `SubmissionId` | `bigint` | No | PK, IDENTITY | | Khóa chính lần gửi |
| `AchievementId` | `bigint` | No | FK -> `Achievements(AchievementId)` | | Thuộc thành tích |
| `RevisionNo` | `int` | No | UQ(AchievementId, RevisionNo) | | Số thứ tự lần gửi (1, 2, 3...) |
| `SnapshotData` | `nvarchar(max)`| No | CK: `ISJSON(SnapshotData) = 1` | | Chuỗi JSON snapshot toàn bộ nội dung thành tích và danh sách minh chứng lúc gửi |
| `SubmittedBy` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản thực hiện bấm gửi |
| `SubmittedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm gửi |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo bản ghi snapshot |

---

### 2.6. Phân hệ Minh chứng & Tệp tin (Evidences)

#### Bảng: `Evidences` (Danh mục minh chứng của hồ sơ)
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `EvidenceId` | `bigint` | No | PK, IDENTITY | | Khóa chính minh chứng |
| `AchievementId` | `bigint` | No | FK -> `Achievements(AchievementId)` | | Thuộc hồ sơ thành tích |
| `Title` | `nvarchar(255)` | No | | | Tên minh chứng (Quyết định giao đề tài, Bản scan bằng sáng chế...) |
| `Description` | `nvarchar(500)` | Yes | | `NULL` | Diễn giải chi tiết minh chứng |
| `IsRemoved` | `bit` | No | | `0` | Cờ xóa mềm trước khi gửi duyệt (`1` = đã xóa) |
| `CreatedBy` | `bigint` | No | FK -> `Users(UserId)` | | Người tạo minh chứng |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |

#### Bảng: `EvidenceFiles` (Phiên bản tệp tin minh chứng bất biến)
Lưu trữ metadata tệp tin vật lý. Thay thế file sẽ tạo bản ghi mới với `VersionNo` tăng dần.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `EvidenceFileId` | `bigint` | No | PK, IDENTITY | | Khóa chính tệp tin |
| `EvidenceId` | `bigint` | No | FK -> `Evidences(EvidenceId)` | | Thuộc minh chứng |
| `VersionNo` | `int` | No | UQ(EvidenceId, VersionNo) | | Số phiên bản file (1, 2, 3...) |
| `OriginalFileName`| `nvarchar(255)`| No | | | Tên tệp gốc khi người dùng tải lên |
| `StorageKey` | `varchar(255)` | No | UQ | | Khóa định danh lưu trữ vật lý trên server/kho riêng |
| `MimeType` | `varchar(100)` | No | | | Định dạng MIME (`application/pdf`, `image/jpeg`...) |
| `FileExtension` | `varchar(20)` | No | | | Phần mở rộng (`.pdf`, `.jpg`, `.png`, `.docx`) |
| `FileSize` | `bigint` | No | CK: `FileSize > 0 AND FileSize <= 10485760` | | Dung lượng tệp (bytes, tối đa 10 MB = 10,485,760 bytes) |
| `Sha256Hash` | `char(64)` | No | | | Mã băm SHA-256 xác thực tính toàn vẹn của tệp tin |
| `UploadedBy` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản tải lên |
| `UploadedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tải lên |

#### Bảng: `SubmissionEvidenceFiles` (Đóng băng tệp tin theo lần nộp)
Bảng trung gian liên kết giữa lần gửi `AchievementSubmissions` và các phiên bản `EvidenceFiles` cụ thể.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `SubmissionId` | `bigint` | No | PK, FK -> `AchievementSubmissions(SubmissionId)` | | Lần gửi |
| `EvidenceFileId` | `bigint` | No | PK, FK -> `EvidenceFiles(EvidenceFileId)` | | Tệp tin minh chứng cụ thể được đính kèm tại lần gửi đó |
| `AttachedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm đóng băng liên kết |

---

### 2.7. Phân hệ Thẩm định & Lịch sử trạng thái (Verification)

#### Bảng: `AchievementStatusHistories` (Nhật ký trạng thái thành tích)
Bảng Append-only ghi nhận toàn bộ tiến trình thẩm định và chuyển trạng thái của hồ sơ.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `HistoryId` | `bigint` | No | PK, IDENTITY | | Khóa chính nhật ký |
| `AchievementId` | `bigint` | No | FK -> `Achievements(AchievementId)` | | Hồ sơ thành tích |
| `SubmissionId` | `bigint` | Yes | FK -> `AchievementSubmissions(SubmissionId)` | `NULL` | Lần nộp liên quan (nếu có) |
| `FromStatus` | `varchar(30)` | No | | | Trạng thái nguồn |
| `ToStatus` | `varchar(30)` | No | | | Trạng thái đích |
| `ActorId` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ / Giảng viên thực hiện thao tác |
| `Reason` | `nvarchar(1000)`| Yes | | `NULL` | Lý do yêu cầu bổ sung, từ chối, hủy hoặc thu hồi |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm chuyển trạng thái |

---

### 2.8. Phân hệ Khen thưởng có Quyết định (Awards)

#### Bảng: `AwardDecisions` (Quyết định khen thưởng)
Lưu thông tin văn bản quyết định khen thưởng do nhà trường, bộ ngành hoặc cơ quan nhà nước ban hành.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `DecisionId` | `bigint` | No | PK, IDENTITY | | Khóa chính quyết định |
| `DecisionNumber` | `varchar(100)` | No | | | Số hiệu quyết định (ví dụ: `123/QĐ-ĐHLH`) |
| `DecisionDate` | `date` | No | | | Ngày ký ban hành quyết định |
| `Issuer` | `nvarchar(150)` | No | | | Cơ quan ban hành (Hiệu trưởng Trường ĐH Lạc Hồng, Bộ GD&ĐT...) |
| `Title` | `nvarchar(255)` | No | | | Trích yếu quyết định |
| `Description` | `nvarchar(max)` | Yes | | `NULL` | Chi tiết nội dung quyết định |
| `CreatedBy` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ RecordsOfficer tạo quyết định |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm nhập |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |
| `RowVersion` | `timestamp` | No | | | Concurrency token |

*Khóa nghiệp vụ tự nhiên chống trùng văn bản:* `UNIQUE (Issuer, DecisionNumber, DecisionDate)`

#### Bảng: `AwardDecisionFiles` (Tệp đính kèm quyết định)
Lưu tệp scan văn bản quyết định (PDF có dấu đỏ).

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `DecisionFileId` | `bigint` | No | PK, IDENTITY | | Khóa chính tệp quyết định |
| `DecisionId` | `bigint` | No | FK -> `AwardDecisions(DecisionId)` | | Thuộc quyết định |
| `VersionNo` | `int` | No | UQ(DecisionId, VersionNo) | | Số phiên bản file |
| `OriginalFileName`| `nvarchar(255)`| No | | | Tên tệp gốc |
| `StorageKey` | `varchar(255)` | No | UQ | | Mã lưu trữ vật lý |
| `MimeType` | `varchar(100)` | No | | | MIME (`application/pdf`) |
| `FileExtension` | `varchar(20)` | No | | | `.pdf`, `.jpg`... |
| `FileSize` | `bigint` | No | CK: `FileSize > 0 AND FileSize <= 10485760` | | Dung lượng (tối đa 10 MB) |
| `Sha256Hash` | `char(64)` | No | | | Mã băm SHA-256 |
| `UploadedBy` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ tải lên |
| `UploadedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tải |

#### Bảng: `AwardRecords` (Bản ghi kết quả khen thưởng)
Ghi nhận việc một cá nhân hoặc tập thể được trao tặng một danh hiệu/hình thức khen thưởng cụ thể.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AwardRecordId` | `bigint` | No | PK, IDENTITY | | Khóa chính bản ghi khen thưởng |
| `LecturerId` | `bigint` | Yes | FK -> `Lecturers(LecturerId)` | `NULL` | Giảng viên nhận khen thưởng (XOR) |
| `OrganizationUnitId`| `bigint` | Yes | FK -> `OrganizationUnits(UnitId)` | `NULL` | Tập thể đơn vị nhận khen thưởng (XOR) |
| `ContextUnitId` | `bigint` | No | FK -> `OrganizationUnits(UnitId)` | | Đơn vị quản lý lúc trao thưởng |
| `AwardTypeId` | `bigint` | No | FK -> `AwardTypes(AwardTypeId)` | | Loại danh hiệu khen thưởng |
| `DecisionId` | `bigint` | No | FK -> `AwardDecisions(DecisionId)` | | Căn cứ quyết định ban hành |
| `RecognitionYear` | `int` | No | CK: `RecognitionYear >= 1990` | | Năm dương lịch ghi nhận khen thưởng |
| `PeriodStart` | `date` | Yes | | `NULL` | Thời gian bắt đầu giai đoạn thi đua được xét |
| `PeriodEnd` | `date` | Yes | CK: `PeriodEnd >= PeriodStart` | `NULL` | Thời gian kết thúc giai đoạn thi đua |
| `Status` | `varchar(30)` | No | CK | `'DRAFT'` | Trạng thái: `DRAFT`, `RECORDED`, `REVOKED` |
| `RecordedBy` | `bigint` | Yes | FK -> `Users(UserId)` | `NULL` | Cán bộ RecordsOfficer thực hiện ghi nhận |
| `RecordedAt` | `datetime2(3)` | Yes | | `NULL` | Thời điểm ghi nhận chính thức |
| `ReplacesAwardRecordId`| `bigint`| Yes | FK -> `AwardRecords(AwardRecordId)`| `NULL` | Mã bản ghi cũ nếu là bản ghi thay thế cho bản bị thu hồi |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo |
| `UpdatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm cập nhật |
| `RowVersion` | `timestamp` | No | | | Concurrency token |

**Ràng buộc trọng yếu trên `AwardRecords`:**
```sql
CONSTRAINT CK_AwardRecords_Subject_XOR CHECK (
    (LecturerId IS NOT NULL AND OrganizationUnitId IS NULL) OR
    (LecturerId IS NULL AND OrganizationUnitId IS NOT NULL)
);
```

**Filtered Unique Indexes chống trùng lặp khen thưởng đã `RECORDED`:**
```sql
CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Lecturer_Recorded
ON AwardRecords(LecturerId, AwardTypeId, DecisionId)
WHERE Status = 'RECORDED' AND LecturerId IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Unit_Recorded
ON AwardRecords(OrganizationUnitId, AwardTypeId, DecisionId)
WHERE Status = 'RECORDED' AND OrganizationUnitId IS NOT NULL;
```

#### Bảng: `AwardRecordAchievements` (Liên kết thành tích với khen thưởng - Tùy chọn)
Bảng liên kết nhiều - nhiều cho phép gắn các `Achievements` đã `VERIFIED` làm minh chứng nền tảng cho kết quả khen thưởng.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AwardRecordId` | `bigint` | No | PK, FK -> `AwardRecords(AwardRecordId)` | | Bản ghi khen thưởng |
| `AchievementId` | `bigint` | No | PK, FK -> `Achievements(AchievementId)` | | Thành tích liên kết |
| `LinkedBy` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ thực hiện liên kết |
| `LinkedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm liên kết |

#### Bảng: `AwardRecordHistories` (Nhật ký trạng thái khen thưởng)
Ghi nhận tiến trình từ `DRAFT` sang `RECORDED` hoặc thu hồi `REVOKED`.

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AwardRecordHistoryId`| `bigint` | No | PK, IDENTITY | | Khóa chính nhật ký |
| `AwardRecordId` | `bigint` | No | FK -> `AwardRecords(AwardRecordId)` | | Bản ghi khen thưởng |
| `FromStatus` | `varchar(30)` | No | | | Trạng thái trước |
| `ToStatus` | `varchar(30)` | No | | | Trạng thái sau |
| `ActorId` | `bigint` | No | FK -> `Users(UserId)` | | Cán bộ thao tác |
| `Reason` | `nvarchar(1000)`| Yes | | `NULL` | Bắt buộc khi `ToStatus = 'REVOKED'` |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm ghi |

---

### 2.9. Phân hệ Hệ thống (System)

#### Bảng: `Notifications` (Thông báo trong ứng dụng)
| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `NotificationId`| `bigint` | No | PK, IDENTITY | | Khóa chính thông báo |
| `UserId` | `bigint` | No | FK -> `Users(UserId)` | | Tài khoản nhận thông báo |
| `Type` | `varchar(50)` | No | | | Phân loại: `ACHIEVEMENT_STATUS`, `AWARD_RECORDED`, `SYSTEM_ALERT` |
| `Title` | `nvarchar(200)` | No | | | Tiêu đề thông báo |
| `Message` | `nvarchar(1000)`| No | | | Nội dung chi tiết |
| `EntityType` | `varchar(50)` | Yes | | `NULL` | Thực thể liên quan (`ACHIEVEMENT`, `AWARD_RECORD`) |
| `EntityId` | `bigint` | Yes | | `NULL` | ID của thực thể |
| `IsRead` | `bit` | No | | `0` | Cờ đã đọc (`0` = chưa đọc, `1` = đã đọc) |
| `ReadAt` | `datetime2(3)` | Yes | | `NULL` | Thời điểm đọc |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm tạo thông báo |

#### Bảng: `AuditLogs` (Nhật ký kiểm toán an ninh hệ thống)
Lưu dấu vết tất cả các thao tác nhạy cảm (Đăng nhập, duyệt, thu hồi, đổi quyền). Bất biến (Append-only).

| Tên cột | Kiểu dữ liệu | Nullable | Ràng buộc | Mặc định | Mô tả nghiệp vụ |
|---|---|:---:|:---:|---|---|
| `AuditLogId` | `bigint` | No | PK, IDENTITY | | Khóa chính bản ghi audit |
| `ActorId` | `bigint` | Yes | FK -> `Users(UserId)` | `NULL` | Người thực hiện (`NULL` nếu thao tác khách / hệ thống) |
| `Action` | `varchar(50)` | No | | | Hành động: `AUTH_LOGIN`, `SUBMIT`, `VERIFY`, `REQUEST_CORRECTION`, `REJECT`, `REVOKE`, `RECORD_AWARD` |
| `EntityType` | `varchar(50)` | No | | | Tên bảng bị tác động (`Achievements`, `AwardRecords`...) |
| `EntityId` | `bigint` | No | | | ID của bản ghi bị tác động |
| `OldValues` | `nvarchar(max)`| Yes | | `NULL` | Dữ liệu cũ dạng JSON |
| `NewValues` | `nvarchar(max)`| Yes | | `NULL` | Dữ liệu mới dạng JSON |
| `IpAddress` | `varchar(45)` | Yes | | `NULL` | Địa chỉ IP máy trạm của client |
| `UserAgent` | `nvarchar(255)` | Yes | | `NULL` | Thông tin trình duyệt / hệ điều hành |
| `CorrelationId` | `varchar(50)` | Yes | | `NULL` | Mã vết yêu cầu API (Trace Id) |
| `CreatedAt` | `datetime2(3)` | No | | `SYSUTCDATETIME()` | Thời điểm phát sinh sự kiện |
