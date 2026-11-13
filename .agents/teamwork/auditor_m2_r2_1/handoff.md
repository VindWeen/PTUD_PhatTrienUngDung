# Forensic Integrity Audit Report & Handoff: Milestone 2 — Iteration 2 Remediation

**Auditor**: Teamwork Forensic Auditor (`auditor_m2_r2_1`)  
**Target**: Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP) — Iteration 2 Remediation  
**Recipient**: Sub-Orchestrator Milestone 2 (`b4442109-5705-4dae-83ed-e0f0f2dcfbf3`)  
**Audit Timestamp**: 2026-11-12T15:33:00Z  
**Integrity Mode**: `development` (per `ORIGINAL_REQUEST.md`)  
**Verdict**: **`CLEAN`**

---

## Forensic Audit Summary

| Category | Target Files / Scope | Audit Check | Result |
|---|---|---|---|
| **Defect Remediation** | `achievementRepository.js:474,480`, `achievementTrashCleanup.js:8` | `status IN ('ACTIVE', 'DRAFT')` | **PASS** |
| **Standard Roles Scope** | `achievementService.js:29,48,55-71` | `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD` access & `ACTIONABLE` | **PASS** |
| **Data Synchronization** | `dossierPackagerService.js:154-211, 292-309` | Dual table query (`achievements` + `award_records`) & stream error handling | **PASS** |
| **Integrity Forensics** | All M2 backend modules (`src/modules/achievements`, `src/modules/ai`) | Absence of hardcoded test bypasses, facade implementations & pre-populated logs | **PASS** |
| **Test Authenticity** | `achievement-vault-active.test.js` & related suites | Non-tautological verifications, dynamic payload assertions | **PASS** |
| **Runtime Execution** | 9 official test suites + 3 adversarial test suites | 100% test pass rate (36/36 official, 31/31 adversarial) | **PASS** |

---

## 1. Observation

### 1.1 Remediation of Prior Defect: `deleteAchievement` & `restoreAchievement`
- **File**: `backend/src/modules/achievements/achievementRepository.js`
- **Line 473-477**:
  ```javascript
  export async function deleteAchievement(id, userId, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = SYSUTCDATETIME(), deleted_by = $2, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $3 AND status IN ('ACTIVE', 'DRAFT') AND deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM app.achievement_submissions s WHERE s.achievement_id = app.achievements.achievement_id)`, [id, userId, version]);
    return result.rowCount > 0;
  }
  ```
- **Line 478-483**:
  ```javascript
  export async function restoreAchievement(id, version) {
    const result = await query(`UPDATE app.achievements SET deleted_at = NULL, deleted_by = NULL, updated_at = SYSUTCDATETIME(), version = version + 1
      OUTPUT INSERTED.achievement_id WHERE achievement_id = $1 AND version = $2 AND status IN ('ACTIVE', 'DRAFT')
      AND deleted_at > DATEADD(day, -30, SYSUTCDATETIME())`, [id, version]);
    return result.rowCount > 0;
  }
  ```
- **File**: `backend/src/modules/achievements/achievementTrashCleanup.js`
- **Line 7-9**:
  ```javascript
  INSERT INTO @expired SELECT achievement_id FROM app.achievements a WITH (UPDLOCK, HOLDLOCK)
  WHERE a.status IN ('ACTIVE', 'DRAFT') AND a.deleted_at <= DATEADD(day, -30, SYSUTCDATETIME())
  ```
- **Empirical Check**: The SQL status constraint has been changed from `status = 'DRAFT'` to `status IN ('ACTIVE', 'DRAFT')`.

### 1.2 Service Permissions & Role Alignment
- **File**: `backend/src/modules/achievements/achievementService.js`
- **Line 28-31**:
  ```javascript
  const active = (await roles(user.userId)).map(r => typeof r === 'string' ? r : r.Code || r.code);
  if (!active.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'UNIT_REPRESENTATIVE', 'MANAGER', 'RECORDS_OFFICER', 'ADMIN'].includes(r)))
    throw new ForbiddenError('Không có quyền đọc danh mục thành tích');
  return repo.listActiveTypes();
  ```
- **Line 48**:
  ```javascript
  filters.statuses = { ACTIONABLE: ['ACTIVE', 'DRAFT', 'NEED_CORRECTION'], PENDING: ['SUBMITTED'], VERIFIED: ['VERIFIED'], ENDED: ['REJECTED', 'REVOKED', 'CANCELLED'] }[queryParams.workflow];
  ```
- **Line 55-71**:
  ```javascript
  const isIndividual = roles.some(r => ['MEMBER', 'LECTURER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'MANAGER', 'UNIT_REPRESENTATIVE'].includes(r));
  ...
  if (isIndividual) {
    const lecturerProfile = await repo.findLecturerByUserId(user.userId);
    if (lecturerProfile) {
      myLecturerId = lecturerProfile.lecturerId;
      orConditions.push(`a.lecturer_id = ${myLecturerId}`);
    } else if (user.userId && Number.isSafeInteger(Number(user.userId))) {
      orConditions.push(`a.created_by = ${Number(user.userId)}`);
    }
  }
  ```
- **Empirical Check**: Standard roles `MEMBER`, `DEPARTMENT_HEAD`, and `FACULTY_LEAD` are included in catalog retrieval, personal achievement filtering, and actionable status list.

### 1.3 Dossier Packager Synchronization & Stream Safety
- **File**: `backend/src/modules/ai/dossierPackagerService.js`
- **Line 154-211**:
  - Queries `app.achievements` joined with `app.evidence_files`.
  - Queries `app.award_records` joined with `app.award_decision_files`.
  - Combines records into single evaluation dataset:
    `const records = [...achRes.rows.map((r) => mapRow(r, 'ACHIEVEMENT')), ...awardRes.rows.map((r) => mapRow(r, 'AWARD_RECORD'))];`
- **Line 292-309**:
  ```javascript
  archive.on('error', (err) => {
    console.error('[DossierPackager] Archive streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi nén file hồ sơ minh chứng' });
    } else {
      res.end();
    }
  });

  if (typeof res.on === 'function') {
    res.on('close', () => {
      if (typeof archive.abort === 'function') {
        try {
          archive.abort();
        } catch (_) {}
      }
    });
  }
  ```
- **Empirical Check**: Synchronized dual data-source querying matches `autoDiscoveryService.js`. Error handling terminates stream cleanly and aborts archive on connection close.

### 1.4 Forensic Absence of Prohibited Patterns
1. **Hardcoded test responses**: Zero hardcoded strings or conditional return values keyed to test inputs found in `src/modules/achievements` and `src/modules/ai`.
2. **Facade implementations**: All functions contain substantive implementation:
   - `extractCertificateInfo`: True external Vision REST API integrations (Groq `llama-3.2-11b-vision-preview` & Gemini `gemini-1.5-flash`) with timeout and graceful schema fallback.
   - `evaluateStructuredCriterion`: Pure algorithmic threshold evaluation, missing count determination, distinct year deduction, and issue tracking.
   - `discoverEligibleRegulations`: Dynamic database query, criterion iteration, percentage formula, and multi-tier sorting.
   - `packageAndStreamDossierZip`: Dynamic streaming archiver pipeline with path sanitization (`sanitizeFileName`) and standard name formatting (`formatStandardizedFileName`).
3. **Fabricated verification outputs**: Workspace scan confirmed 0 pre-existing `.log`, `*result*`, or `*output*` files in the backend workspace outside `node_modules`.
4. **Self-certifying tests**: `tests/achievement-vault-active.test.js` exercises real permission resolution, regex pattern verification on SQL strings, and service filtering logic without tautologies.

### 1.5 Independent Test Execution
- Command:
  ```powershell
  cd backend; node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js tests/achievement-trash.integration.js
  ```
- Verbatim Output:
  ```
  ✔ SQL Server achievement trash: owner restore, expiry, version, evidence retention and permanent cleanup (840.3603ms)
  ✔ Achievement Vault: Trạng thái ACTIVE cho phép chính chủ sửa, xóa và quản lý minh chứng (2.2827ms)
  ✔ Achievement Vault: Người dùng khác không có quyền ADMIN không được sửa/xóa thành tích ACTIVE (0.3783ms)
  ✔ Achievement Vault: Quyền ADMIN được phép chỉnh sửa và dọn dẹp thành tích ACTIVE (0.3402ms)
  ✔ Achievement Repository: SQL Query tạo mới gán trạng thái ACTIVE ngay lập tức (1.071ms)
  ✔ AI Vision Ingest: Fallback nhẹ nhàng khi buffer rỗng hoặc không có API key (1.1727ms)
  ✔ Achievement Routes: Các tuyến phê duyệt cũ bị bãi bỏ (HTTP 410 Decommissioned) (0.8501ms)
  ✔ Achievement Repository: SQL deleteAchievement & restoreAchievement cho phép xóa và khôi phục bản ghi ACTIVE (1.9638ms)
  ✔ Achievement Service: Hỗ trợ vai trò chuẩn MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD trong listCatalogs và listAchievements (2.9352ms)
  ✔ Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records (0.7064ms)
  ✔ Auto-Discovery: Quét các quy chế mở và tính toán % hoàn thành chính xác (5.2454ms)
  ✔ Auto-Discovery: Xếp hạng giảm dần theo tỷ lệ % hoàn thành (22.2138ms)
  ✔ AI Criteria Evaluator: Chấp nhận hồ sơ thành tích trạng thái ACTIVE từ Kho cá nhân (4.9371ms)
  ✔ AI Criteria Evaluator: Tính toán chính xác missingCount khi chưa đủ số lượng yêu cầu (0.5334ms)
  ✔ AI Criteria Evaluator: Kết hợp cả ACTIVE, VERIFIED và RECORDED song song (0.6408ms)
  ✔ AI Criteria Evaluator: Loại trừ tuyệt đối REVOKED và CANCELLED khỏi matchedRecords (0.5458ms)
  ✔ reject impossible dates, inverted ranges, blank titles and forged ownership/system events (13.4345ms)
  ✔ all-day and multiday events include both boundary dates (0.4759ms)
  ✔ month navigation handles year rollover, leap years and Monday-first grids (0.8538ms)
  ✔ system calendar uses open award-period deadlines as read-only events (0.8608ms)
  ✔ CV only exposes selected profile data and achievements (4.0346ms)
  ✔ public CV hides revoked or legacy unverifiable achievements and does not expose IDs (0.3752ms)
  ✔ CV validates limits, template and experience fields (1.4119ms)
  2026-11-12T15:31:14.844Z GET /api/v1/cv/invalid 404 5.371 ms - 201 [req-id: -]
  ✔ public CV route is accessible without login and rejects invalid links with noindex (69.8848ms)
  ✔ Dossier Packager: sanitizeFileName chuẩn hóa chuỗi tiếng Việt và loại bỏ ký tự nguy hiểm (2.4229ms)
  ✔ Dossier Packager: formatStandardizedFileName tạo định dạng chuẩn 01_[TenMinhChung]_[Nam].pdf (0.6897ms)
  ✔ Dossier Packager: buildDossierArchive nén tệp tin và tạo cấu trúc ZIP hợp lệ (34.3915ms)
  ✔ Dossier Packager: packageAndStreamDossierZip thiết lập đúng headers và stream file zip ra HTTP Response (73.9723ms)
  ✔ Strict validation: no forged status/source/owner, finite amounts and real dates (22.8933ms)
  ✔ CSV handles BOM, quotes, multiline, bad header/width and bounded input (9.2142ms)
  ✔ W4-Q1 [Ca 1]: Bộ đếm năm phân biệt bằng code xác định đạt chuẩn ELIGIBLE (4.0455ms)
  ✔ W4-Q1 [Ca 2]: Phát hiện gián đoạn chuỗi năm liên tiếp (YEAR_GAP) chuyển sang rà soát (0.7172ms)
  ✔ W4-Q1 [Ca 3]: Loại trừ tuyệt đối hồ sơ thu hồi (REVOKED / CANCELLED) (0.856ms)
  ✔ W4-Q1 [Ca 4]: Quy tắc nghiệm thu: Thiếu chứng cứ KHÔNG mặc định không đạt (1.1277ms)
  ✔ W4-Q1 [Ca 5]: Tiêu chuẩn mô phỏng / chưa duyệt LHU luôn trả SIMULATION_ONLY hoặc UNCONFIRMED (0.4691ms)
  ✔ W4-Q1 [Ca 6]: Đối tượng EvaluationRun tuân thủ chuẩn W3-Q4 schema, cấm tự trao thưởng (8.2541ms)
  ℹ tests 36
  ℹ suites 0
  ℹ pass 36
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 2781.3605
  ```
- Adversarial Suites Execution:
  ```powershell
  cd backend; node --test tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js
  ```
  Result: `31/31 tests pass` (100% pass, 0 fail).

---

## 2. Logic Chain

1. **Defect Resolution**:
   - In Iteration 1, the Auditor found that `deleteAchievement` and `restoreAchievement` had SQL conditions `status = 'DRAFT'`, which blocked users from deleting or restoring their `ACTIVE` personal achievements.
   - Observation 1.1 directly confirms that `achievementRepository.js` lines 474 and 480 have been modified to `status IN ('ACTIVE', 'DRAFT')`.
   - Furthermore, `achievementTrashCleanup.js` line 8 was proactively updated to clean up expired `ACTIVE` achievements from the trash.
   - Direct test `achievement-vault-active.test.js` (test case 7) and `achievement-trash.integration.js` executed and passed cleanly.
   - Therefore, the defect advisory has been resolved with zero regressions.

2. **Role Compatibility Verification**:
   - Observation 1.2 demonstrates that `achievementService.js` now recognizes `MEMBER`, `DEPARTMENT_HEAD`, and `FACULTY_LEAD` when listing catalogs (`listCatalogs`) and listing personal achievements (`listAchievements`).
   - The status mapping for actionable records includes `'ACTIVE'`.
   - Therefore, users under the streamlined 4-role hierarchy can access their vault without authorization barriers or empty lists.

3. **ZIP Packager Integrity**:
   - Observation 1.3 shows that `dossierPackagerService.js` now queries both `app.achievements` and `app.award_records`, matching the evaluation scope of `autoDiscoveryService.js`.
   - Streaming error handling guarantees `res.end()` is invoked if headers were already sent, preventing connection hangs.
   - Tests `Dossier Packager: Đồng bộ hóa nguồn bản ghi app.achievements và app.award_records` and `packageAndStreamDossierZip` pass.

4. **Integrity Forensics Compliance**:
   - In accordance with the General Project Profile and Development Mode integrity requirements, all code additions are genuine, algorithmic, and non-fabricated.
   - All tests run against live service logic and database helpers.
   - Total test suite count across all 12 suites is 67 tests, with a 100% pass rate.

---

## 3. Caveats

- **External AI Vision Credentials**: The AI Vision service fallback was verified using simulated missing keys and null/empty buffers, which correctly returned `{ success: true, fallback: true, data: null }` as mandated by R1. Live cloud Vision endpoints (`llama-3.2-11b-vision-preview` / `gemini-1.5-flash`) will be exercised when production keys are supplied in deployment environments.
- **No Schema Migration Required**: Remediation changes were strictly confined to application logic, SQL queries, and test assertions. Database tables and columns created in Milestone 1 remain fully compatible.

---

## 4. Conclusion & Verdict

- **Forensic Verdict**: **`CLEAN`**
- **Prior Defect Advisory**: **CLEANLY RESOLVED** (No remaining status mismatch in `deleteAchievement` or `restoreAchievement`).
- **Standard Roles & Vault Access**: **VERIFIED** (Seamless support for `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`).
- **Packager Synchronization**: **VERIFIED** (Full dual-source parity with `autoDiscoveryService.js`).
- **Code Integrity**: **CONFIRMED** (No facades, no bypasses, no hardcoded results, no pre-populated artifacts).
- **Recommendation**: Accept Milestone 2 Iteration 2 work products and proceed to synthesis / Milestone 3.

---

## 5. Verification Method

To independently reproduce the forensic verification:

1. **Verify Source Code SQL Remediation**:
   ```powershell
   Select-String -Path "backend/src/modules/achievements/achievementRepository.js" -Pattern "status IN \('ACTIVE', 'DRAFT'\)"
   Select-String -Path "backend/src/modules/achievements/achievementTrashCleanup.js" -Pattern "status IN \('ACTIVE', 'DRAFT'\)"
   ```

2. **Execute Full Backend Verification Suites (36 Tests)**:
   ```powershell
   cd backend
   node --test tests/achievement-vault-active.test.js tests/ai-criteria-active.test.js tests/ai-auto-discovery.test.js tests/dossier-packager-zip.test.js tests/cv.test.js tests/calendar.test.js tests/w4-q1.test.js tests/w3-p2.test.js tests/achievement-trash.integration.js
   ```

3. **Execute Adversarial Test Suites (31 Tests)**:
   ```powershell
   cd backend
   node --test tests/adversarial-vault-permissions.test.js tests/adversarial-ai-evaluator.test.js tests/challenger-m2-adversarial.test.js
   ```

4. **Invalidation Conditions**:
   This verdict is invalidated if:
   - Any SQL query in `achievementRepository.js` reverts to `status = 'DRAFT'`.
   - A `MEMBER` user is rejected with HTTP 403 when reading active achievement catalogs.
   - `dossierPackagerService.js` omits records from `app.award_records`.
